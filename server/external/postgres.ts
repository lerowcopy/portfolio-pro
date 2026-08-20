import pg from "pg";

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getExternalPostgresPool(): pg.Pool {
  if (pool) return pool;

  const connectionString = process.env.SUPABASE_DATABASE_URL;
  if (!connectionString) {
    throw new Error("SUPABASE_DATABASE_URL must be configured for the external PostgreSQL router");
  }

  pool = new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 8_000,
  });

  return pool;
}
