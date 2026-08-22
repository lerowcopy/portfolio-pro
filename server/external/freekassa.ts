import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export const freeKassaPlans = ["starter", "pro", "business"] as const;
export type FreeKassaPlan = (typeof freeKassaPlans)[number];

const callbackSchema = z.object({
  MERCHANT_ID: z.coerce.string().trim().min(1).max(32),
  AMOUNT: z.coerce.string().trim().regex(/^\d+(?:\.\d{1,2})?$/),
  intid: z.coerce.string().trim().regex(/^\d+$/).max(32),
  MERCHANT_ORDER_ID: z.coerce.string().trim().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
  SIGN: z.coerce.string().trim().regex(/^[a-fA-F0-9]{32}$/),
  CUR_ID: z.coerce.string().trim().max(32).optional(),
  commission: z.coerce.string().trim().regex(/^\d+(?:\.\d{1,2})?$/).optional(),
});

export type FreeKassaCallback = z.infer<typeof callbackSchema>;

export type FreeKassaConfig = {
  shopId: string;
  secretWord2: string;
  enforceIpAllowlist: boolean;
};

export type FreeKassaCheckoutConfig = {
  shopId: string;
  secretWord1: string;
  planAmountsKopeks: Record<FreeKassaPlan, number>;
};

export const FREEKASSA_CALLBACK_IPS = new Set([
  "168.119.157.136",
  "168.119.60.227",
  "178.154.197.79",
  "51.250.54.238",
]);

/** Читает исключительно server-side параметры FreeKassa. */
export function getFreeKassaConfig(env: NodeJS.ProcessEnv = process.env): FreeKassaConfig {
  const shopId = env.FREEKASSA_SHOP_ID?.trim();
  const secretWord2 = env.FREEKASSA_SECRET_WORD_2;
  if (!shopId || !secretWord2) throw new Error("FreeKassa callback is not configured");
  return {
    shopId,
    secretWord2,
    enforceIpAllowlist: env.FREEKASSA_ENFORCE_IP_ALLOWLIST === "true",
  };
}

export function freeKassaCallbackSignature(merchantId: string, amount: string, secretWord2: string, merchantOrderId: string): string {
  return createHash("md5").update(`${merchantId}:${amount}:${secretWord2}:${merchantOrderId}`, "utf8").digest("hex");
}

function parsePositiveInteger(value: string | undefined, name: string): number {
  if (!value || !/^\d+$/.test(value)) throw new Error(`${name} must be a positive integer amount in kopeks`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer amount in kopeks`);
  return parsed;
}

export function getFreeKassaCheckoutConfig(env: NodeJS.ProcessEnv = process.env): FreeKassaCheckoutConfig {
  const shopId = env.FREEKASSA_SHOP_ID?.trim();
  const secretWord1 = env.FREEKASSA_SECRET_WORD_1;
  if (!shopId || !secretWord1) throw new Error("FreeKassa checkout is not configured");
  return {
    shopId,
    secretWord1,
    planAmountsKopeks: {
      starter: parsePositiveInteger(env.FREEKASSA_STARTER_AMOUNT_KOPEKS, "FREEKASSA_STARTER_AMOUNT_KOPEKS"),
      pro: parsePositiveInteger(env.FREEKASSA_PRO_AMOUNT_KOPEKS, "FREEKASSA_PRO_AMOUNT_KOPEKS"),
      business: parsePositiveInteger(env.FREEKASSA_BUSINESS_AMOUNT_KOPEKS, "FREEKASSA_BUSINESS_AMOUNT_KOPEKS"),
    },
  };
}

export function signaturesMatch(expected: string, received: string): boolean {
  const expectedBuffer = Buffer.from(expected.toLowerCase(), "utf8");
  const receivedBuffer = Buffer.from(received.toLowerCase(), "utf8");
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}

/** Переводит десятичную сумму FreeKassa в копейки без floating-point ошибок. */
export function amountToKopeks(amount: string): number {
  const [whole, fraction = ""] = amount.split(".");
  const kopeks = `${fraction}00`.slice(0, 2);
  const wholePart = Number(whole);
  const total = wholePart * 100 + Number(kopeks);
  if (!Number.isSafeInteger(wholePart) || !Number.isSafeInteger(total)) throw new Error("Payment amount is outside the supported range");
  return total;
}

export function parseAndVerifyFreeKassaCallback(payload: unknown, config: FreeKassaConfig): FreeKassaCallback {
  const callback = callbackSchema.parse(payload);
  if (callback.MERCHANT_ID !== config.shopId) throw new Error("FreeKassa merchant mismatch");
  const expected = freeKassaCallbackSignature(callback.MERCHANT_ID, callback.AMOUNT, config.secretWord2, callback.MERCHANT_ORDER_ID);
  if (!signaturesMatch(expected, callback.SIGN)) throw new Error("FreeKassa signature mismatch");
  return callback;
}

export function kopeksToAmount(kopeks: number): string {
  if (!Number.isSafeInteger(kopeks) || kopeks <= 0) throw new Error("Payment amount must be a positive integer in kopeks");
  return `${Math.floor(kopeks / 100)}.${String(kopeks % 100).padStart(2, "0")}`;
}

/** Создаёт SCI redirect; price и подпись вычисляются только на server-side. */
export function buildFreeKassaPaymentUrl(input: { shopId: string; secretWord1: string; orderId: string; amountKopeks: number; email?: string; locale: "ru" | "en" }): string {
  const amount = kopeksToAmount(input.amountKopeks);
  const signature = createHash("md5").update(`${input.shopId}:${amount}:${input.secretWord1}:RUB:${input.orderId}`, "utf8").digest("hex");
  const params = new URLSearchParams({ m: input.shopId, oa: amount, currency: "RUB", o: input.orderId, s: signature, lang: input.locale });
  if (input.email) params.set("em", input.email);
  return `https://pay.fk.money/?${params.toString()}`;
}
