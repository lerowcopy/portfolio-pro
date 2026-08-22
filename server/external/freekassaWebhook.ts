import type { Request, Response } from "express";
import type pg from "pg";
import { amountToKopeks, FREEKASSA_CALLBACK_IPS, getFreeKassaConfig, parseAndVerifyFreeKassaCallback } from "./freekassa";
import { getExternalPostgresPool } from "./postgres";

type WebhookDependencies = { pool?: pg.Pool; getConfig?: typeof getFreeKassaConfig };

function remoteIp(request: Request): string {
  return (request.ip ?? "").replace(/^::ffff:/, "");
}

/**
 * Обрабатывает Result URL FreeKassa. Все бизнес-изменения выполняются одной
 * PostgreSQL транзакцией; повторный callback с тем же intid безопасно отвечает YES.
 */
export async function handleFreeKassaWebhook(request: Request, response: Response, dependencies: WebhookDependencies = {}): Promise<void> {
  const configFactory = dependencies.getConfig ?? getFreeKassaConfig;
  let config: ReturnType<typeof getFreeKassaConfig>;
  try {
    config = configFactory();
    if (config.enforceIpAllowlist && !FREEKASSA_CALLBACK_IPS.has(remoteIp(request))) {
      response.status(403).type("text/plain").send("FORBIDDEN");
      return;
    }
    const callback = parseAndVerifyFreeKassaCallback(request.body, config);
    const pool = dependencies.pool ?? getExternalPostgresPool();
    const client = await pool.connect();
    try {
      await client.query("begin");
      const orderResult = await client.query<{
        id: string;
        user_id: string;
        plan: "starter" | "pro" | "business";
        expected_amount_kopeks: number;
        period_days: number;
        status: string;
      }>("select id, user_id, plan, expected_amount_kopeks, period_days, status from public.billing_orders where id = $1::uuid for update", [callback.MERCHANT_ORDER_ID]);
      const order = orderResult.rows[0];
      if (!order) throw new Error("FreeKassa order was not found");
      if (amountToKopeks(callback.AMOUNT) !== order.expected_amount_kopeks) throw new Error("FreeKassa amount mismatch");

      const event = await client.query<{ id: string }>("insert into public.billing_webhook_events (freekassa_intid, billing_order_id, merchant_id, amount_kopeks, currency_id, commission_kopeks) values ($1, $2::uuid, $3, $4, $5, $6) on conflict (freekassa_intid) do nothing returning id", [callback.intid, order.id, callback.MERCHANT_ID, amountToKopeks(callback.AMOUNT), callback.CUR_ID ?? null, callback.commission ? amountToKopeks(callback.commission) : null]);
      if (event.rowCount === 0) {
        await client.query("commit");
        response.type("text/plain").send("YES");
        return;
      }

      if (order.status !== "pending") throw new Error("FreeKassa order is not pending");

      await client.query("update public.billing_orders set status = 'paid', freekassa_intid = $2, paid_at = timezone('utc', now()), updated_at = timezone('utc', now()) where id = $1::uuid", [order.id, callback.intid]);
      await client.query("insert into public.subscriptions (user_id, plan, status, current_period_end, source_order_id, updated_at) values ($1::uuid, $2, 'active', timezone('utc', now()) + ($3::text || ' days')::interval, $4::uuid, timezone('utc', now())) on conflict (user_id) do update set plan = excluded.plan, status = 'active', current_period_end = greatest(public.subscriptions.current_period_end, timezone('utc', now())) + ($3::text || ' days')::interval, source_order_id = excluded.source_order_id, updated_at = timezone('utc', now())", [order.user_id, order.plan, order.period_days, order.id]);
      await client.query("commit");
      response.type("text/plain").send("YES");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  } catch {
    // Не отражаем детали callback или секретов; FreeKassa выполнит повторную доставку при non-2xx.
    response.status(400).type("text/plain").send("INVALID");
  }
}
