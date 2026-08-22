import pg from "pg";

const connectionString = process.env.SUPABASE_DATABASE_URL;
if (!connectionString) {
  console.error("SUPABASE_DATABASE_URL is not available in this environment.");
  process.exit(2);
}

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  const [tables, columns, constraints, policies, rls, counts] = await Promise.all([
    client.query("select table_name from information_schema.tables where table_schema = 'public' and table_name in ('subscriptions', 'billing_orders', 'billing_webhook_events') order by table_name"),
    client.query("select table_name, column_name, data_type, udt_name, is_nullable, column_default from information_schema.columns where table_schema = 'public' and table_name in ('subscriptions', 'billing_orders', 'billing_webhook_events') order by table_name, ordinal_position"),
    client.query("select c.relname as table_name, con.conname as constraint_name, contype as constraint_type, pg_get_constraintdef(con.oid) as definition from pg_constraint con join pg_class c on c.oid = con.conrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname in ('subscriptions', 'billing_orders', 'billing_webhook_events') order by c.relname, con.conname"),
    client.query("select tablename, policyname, cmd from pg_policies where schemaname = 'public' and tablename in ('subscriptions', 'billing_orders', 'billing_webhook_events') order by tablename, policyname"),
    client.query("select c.relname as table_name, c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname in ('subscriptions', 'billing_orders', 'billing_webhook_events') order by c.relname"),
    client.query("select (select count(*) from public.billing_orders) as billing_orders, (select count(*) from public.billing_webhook_events) as billing_webhook_events, (select count(*) from public.subscriptions) as subscriptions"),
  ]);
  console.log(JSON.stringify({ tables: tables.rows, columns: columns.rows, constraints: constraints.rows, policies: policies.rows, rls: rls.rows, counts: counts.rows[0] }, null, 2));
} finally {
  await client.end();
}
