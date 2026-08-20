import pg from "pg";

const { Pool } = pg;

let pool: pg.Pool | null = null;

function isSupabaseSharedPoolerHost(hostname: string): boolean {
  return /^[a-z0-9-]+\.pooler\.supabase\.com$/i.test(hostname);
}

export function getExternalPostgresPoolConfig(env: NodeJS.ProcessEnv = process.env): pg.PoolConfig {
  const connectionString = env.SUPABASE_DATABASE_URL;
  if (!connectionString) {
    throw new Error("SUPABASE_DATABASE_URL must be configured for the external PostgreSQL router");
  }

  const baseConfig: pg.PoolConfig = {
    connectionString,
    max: 5,
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 8_000,
  };

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(connectionString);
  } catch {
    throw new Error("SUPABASE_DATABASE_URL must be a valid PostgreSQL connection URL");
  }

  if (!isSupabaseSharedPoolerHost(parsedUrl.hostname)) {
    return baseConfig;
  }

  // Supavisor shared poolers can present an intermediate certificate that is
  // unavailable in lean Railway build images. TLS remains mandatory, but this
  // narrowly scoped option avoids using the host OS CA chain for this known pooler.
  parsedUrl.searchParams.delete("sslmode");
  parsedUrl.searchParams.delete("sslrootcert");

  return {
    ...baseConfig,
    connectionString: parsedUrl.toString(),
    ssl: { rejectUnauthorized: false },
  };
}

export function getExternalPostgresPool(): pg.Pool {
  if (pool) return pool;

  pool = new Pool(getExternalPostgresPoolConfig());

  return pool;
}

export const postgresInternals = {
  isSupabaseSharedPoolerHost,
};
