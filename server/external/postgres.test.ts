import { describe, expect, it } from "vitest";
import { getExternalPostgresPoolConfig } from "./postgres";

describe("getExternalPostgresPoolConfig", () => {
  it("uses encrypted scoped TLS compatibility only for Supabase shared poolers", () => {
    const config = getExternalPostgresPoolConfig({
      SUPABASE_DATABASE_URL:
        "postgresql://postgres.example:password@aws-1-eu-west-3.pooler.supabase.com:5432/postgres?sslmode=require",
    });

    expect(config.connectionString).toBe(
      "postgresql://postgres.example:password@aws-1-eu-west-3.pooler.supabase.com:5432/postgres",
    );
    expect(config.ssl).toEqual({ rejectUnauthorized: false });
  });

  it("keeps default TLS behavior for non-pooler PostgreSQL hosts", () => {
    const connectionString = "postgresql://postgres:password@db.example.test:5432/postgres?sslmode=require";
    const config = getExternalPostgresPoolConfig({ SUPABASE_DATABASE_URL: connectionString });

    expect(config.connectionString).toBe(connectionString);
    expect(config.ssl).toBeUndefined();
  });

  it("rejects missing or malformed connection strings", () => {
    expect(() => getExternalPostgresPoolConfig({})).toThrow("SUPABASE_DATABASE_URL must be configured");
    expect(() => getExternalPostgresPoolConfig({ SUPABASE_DATABASE_URL: "not-a-url" })).toThrow(
      "SUPABASE_DATABASE_URL must be a valid PostgreSQL connection URL",
    );
  });
});
