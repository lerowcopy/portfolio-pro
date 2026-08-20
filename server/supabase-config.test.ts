import { describe, expect, it } from "vitest";
import pg from "pg";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
const supabaseDatabaseUrl = process.env.SUPABASE_DATABASE_URL;

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

  it("connects to the configured PostgreSQL pooler without exposing the connection string", async () => {
    expect(supabaseDatabaseUrl, "SUPABASE_DATABASE_URL must be configured").toBeTruthy();

    const client = new pg.Client({ connectionString: supabaseDatabaseUrl });
    try {
      await client.connect();
      const result = await client.query("select 1 as connected");
      expect(result.rows).toEqual([{ connected: 1 }]);
    } finally {
      await client.end();
    }
  }, 15_000);
});
