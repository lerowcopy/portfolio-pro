import { describe, expect, it } from "vitest";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

describe("Supabase server configuration", () => {
  it("accepts the configured secret key on a lightweight REST capability endpoint", async () => {
    expect(supabaseUrl, "SUPABASE_URL must be configured").toMatch(/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i);
    expect(supabaseSecretKey, "SUPABASE_SECRET_KEY must be configured").toMatch(/^sb_secret_[A-Za-z0-9_-]+$/);

    const response = await fetch(new URL("/rest/v1/", supabaseUrl), {
      headers: {
        apikey: supabaseSecretKey!,
      },
    });

    expect(response.status, "Supabase secret key must authorize the REST capability endpoint").toBe(200);
  }, 15_000);
});
