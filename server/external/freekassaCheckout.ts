import { randomUUID } from "node:crypto";
import type pg from "pg";
import { buildFreeKassaPaymentUrl, type FreeKassaPlan, getFreeKassaCheckoutConfig } from "./freekassa";
import { getExternalPostgresPool } from "./postgres";

const billingPeriods: Record<FreeKassaPlan, number> = { starter: 30, pro: 30, business: 30 };

export async function createFreeKassaCheckout(input: { userId: string; email?: string; plan: FreeKassaPlan; locale: "ru" | "en" }, dependencies: { pool?: pg.Pool; getConfig?: typeof getFreeKassaCheckoutConfig; createOrderId?: () => string } = {}) {
  const config = (dependencies.getConfig ?? getFreeKassaCheckoutConfig)();
  const amountKopeks = config.planAmountsKopeks[input.plan];
  const orderId = (dependencies.createOrderId ?? randomUUID)();
  const pool = dependencies.pool ?? getExternalPostgresPool();
  await pool.query("insert into public.billing_orders (id, user_id, plan, expected_amount_kopeks, period_days) values ($1::uuid, $2::uuid, $3, $4, $5)", [orderId, input.userId, input.plan, amountKopeks, billingPeriods[input.plan]]);

  return {
    orderId,
    checkoutUrl: buildFreeKassaPaymentUrl({ shopId: config.shopId, secretWord1: config.secretWord1, orderId, amountKopeks, email: input.email, locale: input.locale }),
  };
}
