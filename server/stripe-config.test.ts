import { describe, expect, it } from "vitest";

const priceKeys = ["STRIPE_PRICE_STARTER", "STRIPE_PRICE_PRO", "STRIPE_PRICE_BUSINESS"] as const;

const secret = process.env.STRIPE_SECRET_KEY;
const hasConfiguredStripeSandbox = Boolean(secret && /^sk_(test|live)_/.test(secret) && priceKeys.every((key) => /^price_/.test(process.env[key] ?? "")));

function stripeAuthorization(secret: string): string {
  return `Basic ${Buffer.from(`${secret}:`).toString("base64")}`;
}

describe("Stripe sandbox configuration", () => {
  it.skipIf(hasConfiguredStripeSandbox)("keeps external Stripe validation disabled until real sandbox Price IDs are configured", () => {
    expect(hasConfiguredStripeSandbox).toBe(false);
  });

  it.runIf(hasConfiguredStripeSandbox)("resolves every configured subscription Price ID through Stripe without exposing credentials", async () => {
    expect(secret, "STRIPE_SECRET_KEY must be configured by the Stripe integration").toMatch(/^sk_(test|live)_/);

    for (const key of priceKeys) {
      const priceId = process.env[key];
      expect(priceId, `${key} must contain a Stripe Price ID`).toMatch(/^price_/);
      const response = await fetch(`https://api.stripe.com/v1/prices/${priceId}`, {
        headers: { Authorization: stripeAuthorization(secret!) },
        signal: AbortSignal.timeout(8_000),
      });
      expect(response.ok, `${key} must resolve to an accessible Stripe Price`).toBe(true);
      const price = await response.json() as { active?: boolean; type?: string };
      expect(price.active).toBe(true);
      expect(price.type).toBe("recurring");
    }
  }, 30_000);
});
