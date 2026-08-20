import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Client } = pg;
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationName = "20260820000200_reconcile_existing_portfolio_schema.sql";
const migrationPath = path.join(projectRoot, "supabase", "migrations", migrationName);
const databaseUrl = process.env.SUPABASE_DATABASE_URL;

if (!databaseUrl) {
  throw new Error("SUPABASE_DATABASE_URL must be configured before applying the Supabase migration");
}

const migrationSql = await readFile(migrationPath, "utf8");
const checksum = createHash("sha256").update(migrationSql).digest("hex");
const client = new Client({ connectionString: databaseUrl });

try {
  await client.connect();

  await client.query(`
    create schema if not exists private;
    create table if not exists private.app_schema_migrations (
      name text primary key,
      checksum text not null,
      applied_at timestamptz not null default timezone('utc', now())
    );
    revoke all on schema private from public;
    revoke all on table private.app_schema_migrations from public, anon, authenticated;
  `);

  const existing = await client.query(
    "select checksum from private.app_schema_migrations where name = $1",
    [migrationName]
  );

  if (existing.rowCount === 1) {
    if (existing.rows[0].checksum !== checksum) {
      throw new Error(`Migration ${migrationName} was already applied with a different checksum`);
    }

    console.log(`Supabase migration ${migrationName} is already applied`);
  } else {
    await client.query(migrationSql);
    await client.query(
      "insert into private.app_schema_migrations (name, checksum) values ($1, $2)",
      [migrationName, checksum]
    );
    console.log(`Supabase migration ${migrationName} applied successfully`);
  }
} finally {
  await client.end();
}
