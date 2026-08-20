import pg from "pg";

const { Client } = pg;
const databaseUrl = process.env.SUPABASE_DATABASE_URL;

if (!databaseUrl) {
  throw new Error("SUPABASE_DATABASE_URL must be configured before inspecting the Supabase schema");
}

const client = new Client({ connectionString: databaseUrl });

try {
  await client.connect();

  const tables = await client.query(`
    select tablename
    from pg_tables
    where schemaname = 'public'
    order by tablename
  `);

  const columns = await client.query(`
    select table_name, column_name, data_type, is_nullable
    from information_schema.columns
    where table_schema = 'public'
      and table_name in ('profiles', 'portfolios', 'portfolio_projects')
    order by table_name, ordinal_position
  `);

  const policies = await client.query(`
    select tablename, policyname, roles, cmd, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles', 'portfolios', 'portfolio_projects')
    order by tablename, policyname
  `);

  console.log(JSON.stringify({
    tables: tables.rows.map(row => row.tablename),
    columns: columns.rows,
    policies: policies.rows,
  }, null, 2));
} finally {
  await client.end();
}
