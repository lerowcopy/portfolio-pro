import { readFile } from "node:fs/promises";
import pg from "pg";

const connectionString = process.env.SUPABASE_DATABASE_URL;
if (!connectionString) throw new Error("SUPABASE_DATABASE_URL is not available");

const migrationPath = new URL("../supabase/migrations/20260822000600_reconcile_freekassa_billing.sql", import.meta.url);
const source = await readFile(migrationPath, "utf8");
const rollbackOnlySql = source
  .replace(/^begin;\s*/i, "begin;\n")
  .replace(/\ncommit;\s*$/i, "\nrollback;\n");

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
try {
  await client.connect();
  await client.query(rollbackOnlySql);
  console.log("Reconciliation migration validated against current Supabase schema and rolled back.");
} finally {
  await client.end();
}
