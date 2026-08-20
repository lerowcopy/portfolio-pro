import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Client } = pg;
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDirectory = path.join(projectRoot, "supabase", "migrations");
const databaseUrl = process.env.SUPABASE_DATABASE_URL;

if (!databaseUrl) {
  throw new Error("SUPABASE_DATABASE_URL must be configured before applying the Supabase migration");
}

const migrationNames = (await readdir(migrationsDirectory))
  .filter((name) => /^\d+_.+\.sql$/.test(name))
  .sort();
const legacyBaselineMigration = "20260820000100_portfolio_pro_initial.sql";
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

  for (const migrationName of migrationNames) {
    const migrationPath = path.join(migrationsDirectory, migrationName);
    const migrationSql = await readFile(migrationPath, "utf8");
    const checksum = createHash("sha256").update(migrationSql).digest("hex");
    const existing = await client.query(
      "select checksum from private.app_schema_migrations where name = $1",
      [migrationName]
    );

    if (existing.rowCount === 1) {
      if (existing.rows[0].checksum !== checksum) {
        throw new Error(`Migration ${migrationName} was already applied with a different checksum`);
      }

      console.log(`Supabase migration ${migrationName} is already applied`);
      continue;
    }

    if (migrationName === legacyBaselineMigration) {
      const coreTables = await client.query(
        "select tablename from pg_tables where schemaname = 'public' and tablename = any($1::text[])",
        [["profiles", "portfolios", "portfolio_projects"]]
      );

      if (coreTables.rowCount === 3) {
        await client.query(
          "insert into private.app_schema_migrations (name, checksum) values ($1, $2)",
          [migrationName, checksum]
        );
        console.log(`Supabase migration ${migrationName} marked as existing baseline`);
        continue;
      }
    }

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
