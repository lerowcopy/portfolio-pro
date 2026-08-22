import { describe, expect, it, vi } from "vitest";
import { buildFreeKassaPaymentUrl, kopeksToAmount } from "./freekassa";
import { createFreeKassaCheckout } from "./freekassaCheckout";

describe("FreeKassa checkout", () => {
  it("creates a server-priced pending order and a signed SCI redirect", async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 1 });
    const result = await createFreeKassaCheckout({ userId: "22222222-2222-4222-8222-222222222222", plan: "pro", locale: "ru", email: "owner@example.com" }, {
      pool: { query } as never,
      createOrderId: () => "11111111-1111-4111-8111-111111111111",
      getConfig: () => ({ shopId: "7012", secretWord1: "form-secret", planAmountsKopeks: { starter: 49_000, pro: 99_000, business: 199_000 } }),
    });

    expect(query).toHaveBeenCalledWith(expect.stringContaining("insert into public.billing_orders"), expect.arrayContaining(["pro", 99_000, 30]));
    expect(result.checkoutUrl).toContain("oa=990.00");
    expect(result.checkoutUrl).toContain("lang=ru");
    expect(result.checkoutUrl).not.toContain("form-secret");
  });

  it("formats kopeks deterministically and signs payment form URLs", () => {
    expect(kopeksToAmount(49_000)).toBe("490.00");
    expect(buildFreeKassaPaymentUrl({ shopId: "7012", secretWord1: "form-secret", orderId: "11111111-1111-4111-8111-111111111111", amountKopeks: 49_000, locale: "en" })).toContain("currency=RUB");
  });
});
