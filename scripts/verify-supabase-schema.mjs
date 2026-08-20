import pg from "pg";

const { Client } = pg;
const databaseUrl = process.env.SUPABASE_DATABASE_URL;

if (!databaseUrl) {
  throw new Error("SUPABASE_DATABASE_URL must be configured before verifying the Supabase schema");
}

const expectedTables = ["profiles", "portfolios", "portfolio_projects"];
const expectedPolicies = [
  "Profiles are visible only to their owner",
  "Profile owners can update permitted profile fields",
  "Published portfolios are publicly readable",
  "Owners can read their draft portfolios",
  "Users can create their own portfolios",
  "Owners can update their own portfolios",
  "Owners can delete their own portfolios",
  "Published project records are publicly readable",
  "Owners can read draft project records",
  "Owners can create project records",
  "Owners can update project records",
  "Owners can delete project records",
];
const expectedStorageBuckets = ["portfolio-avatars", "portfolio-logos", "portfolio-project-images"];
const expectedStoragePolicy = "Portfolio Pro owners manage private media";
const expectedAuditTable = "storage_cleanup_tasks";

const expectedColumns = ["role", "services", "posts", "contact_email", "slug_manually_edited"];

const client = new Client({ connectionString: databaseUrl });

try {
  await client.connect();

  const tables = await client.query(
    "select tablename from pg_tables where schemaname = 'public' and tablename = any($1::text[])",
    [expectedTables]
  );
  const actualTables = new Set(tables.rows.map(row => row.tablename));
  const missingTables = expectedTables.filter(name => !actualTables.has(name));

  if (missingTables.length > 0) {
    throw new Error(`Missing expected Supabase tables: ${missingTables.join(", ")}`);
  }

  const rls = await client.query(
    "select relname, relrowsecurity from pg_class where relnamespace = 'public'::regnamespace and relname = any($1::text[])",
    [expectedTables]
  );
  const tablesWithoutRls = rls.rows.filter(row => !row.relrowsecurity).map(row => row.relname);

  if (tablesWithoutRls.length > 0) {
    throw new Error(`RLS is disabled for: ${tablesWithoutRls.join(", ")}`);
  }

  const policies = await client.query(
    "select policyname from pg_policies where schemaname = 'public' and tablename = any($1::text[])",
    [expectedTables]
  );
  const actualPolicies = new Set(policies.rows.map(row => row.policyname));
  const missingPolicies = expectedPolicies.filter(name => !actualPolicies.has(name));

  if (missingPolicies.length > 0) {
    throw new Error(`Missing expected RLS policies: ${missingPolicies.join(", ")}`);
  }

  const storageBuckets = await client.query(
    "select id, public from storage.buckets where id = any($1::text[])",
    [expectedStorageBuckets]
  );
  const actualStorageBuckets = new Set(storageBuckets.rows.map(row => row.id));
  const missingStorageBuckets = expectedStorageBuckets.filter(name => !actualStorageBuckets.has(name));
  if (missingStorageBuckets.length > 0 || storageBuckets.rows.some(row => row.public)) {
    throw new Error(`Storage buckets are missing or public: ${missingStorageBuckets.join(", ") || "unexpected public bucket"}`);
  }

  const storagePolicy = await client.query(
    "select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = $1",
    [expectedStoragePolicy]
  );
  if (storagePolicy.rowCount !== 1) {
    throw new Error("Missing expected private Storage ownership policy");
  }

  const cleanupAudit = await client.query(
    "select tablename, rowsecurity from pg_tables where schemaname = 'public' and tablename = $1",
    [expectedAuditTable]
  );
  if (cleanupAudit.rowCount !== 1 || cleanupAudit.rows[0].rowsecurity !== true) {
    throw new Error("Missing expected protected Storage cleanup audit table");
  }

  const columns = await client.query(
    "select column_name from information_schema.columns where table_schema = 'public' and ((table_name = 'profiles' and column_name = 'role') or (table_name = 'portfolios' and column_name = any($1::text[])))",
    [["services", "posts", "contact_email", "slug_manually_edited"]]
  );
  const actualColumns = new Set(columns.rows.map(row => row.column_name));
  const missingColumns = expectedColumns.filter(name => !actualColumns.has(name));

  if (missingColumns.length > 0) {
    throw new Error(`Missing expected reconciliation columns: ${missingColumns.join(", ")}`);
  }

  console.log("Supabase schema verification passed: tables, reconciliation columns, RLS and policies are present");
} finally {
  await client.end();
}
