import pg from "pg";

const { Client } = pg;
const databaseUrl = process.env.SUPABASE_DATABASE_URL;

if (!databaseUrl) {
  throw new Error("SUPABASE_DATABASE_URL must be configured before auditing Supabase data");
}

const client = new Client({ connectionString: databaseUrl });

try {
  await client.connect();

  const result = await client.query(`
    select 'profiles' as table_name, count(*)::integer as record_count from public.profiles
    union all
    select 'portfolios' as table_name, count(*)::integer as record_count from public.portfolios
    union all
    select 'portfolio_projects' as table_name, count(*)::integer as record_count from public.portfolio_projects
    order by table_name
  `);

  console.log(JSON.stringify({ counts: result.rows }, null, 2));
} finally {
  await client.end();
}
