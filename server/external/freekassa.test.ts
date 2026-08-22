import { describe, expect, it } from "vitest";
import { amountToKopeks, freeKassaCallbackSignature, parseAndVerifyFreeKassaCallback, signaturesMatch } from "./freekassa";

describe("FreeKassa callback security", () => {
  const config = { shopId: "7012", secretWord2: "callback-secret", enforceIpAllowlist: false };
  const base = { MERCHANT_ID: "7012", AMOUNT: "490.00", intid: "123456", MERCHANT_ORDER_ID: "11111111-1111-4111-8111-111111111111" };

  it("accepts an exactly signed callback and converts amount without floating point loss", () => {
    const SIGN = freeKassaCallbackSignature(base.MERCHANT_ID, base.AMOUNT, config.secretWord2, base.MERCHANT_ORDER_ID);
    expect(parseAndVerifyFreeKassaCallback({ ...base, SIGN }, config).intid).toBe("123456");
    expect(amountToKopeks("490.00")).toBe(49_000);
    expect(amountToKopeks("0.1")).toBe(10);
  });

  it("rejects merchant, amount and signature tampering", () => {
    const SIGN = freeKassaCallbackSignature(base.MERCHANT_ID, base.AMOUNT, config.secretWord2, base.MERCHANT_ORDER_ID);
    expect(() => parseAndVerifyFreeKassaCallback({ ...base, SIGN, AMOUNT: "1.00" }, config)).toThrow("signature");
    expect(() => parseAndVerifyFreeKassaCallback({ ...base, SIGN, MERCHANT_ID: "999" }, config)).toThrow("merchant");
    expect(signaturesMatch(SIGN, "0".repeat(32))).toBe(false);
  });
});
