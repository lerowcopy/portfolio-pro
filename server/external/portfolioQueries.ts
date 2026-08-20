import { uuidSchema } from "./ownership";

export function ownedPortfolioQuery(portfolioId: string, userId: string) {
  return {
    text: "select * from public.portfolios where id = $1::uuid and user_id = $2::uuid limit 1",
    values: [uuidSchema.parse(portfolioId), uuidSchema.parse(userId)],
  } as const;
}

export function ownedPortfolioListQuery(userId: string) {
  return {
    text: "select * from public.portfolios where user_id = $1::uuid order by updated_at desc",
    values: [uuidSchema.parse(userId)],
  } as const;
}

export function ownedProjectQuery(projectId: string, portfolioId: string, userId: string) {
  return {
    text: "select p.* from public.portfolio_projects p join public.portfolios f on f.id = p.portfolio_id where p.id = $1::uuid and p.portfolio_id = $2::uuid and f.user_id = $3::uuid limit 1",
    values: [uuidSchema.parse(projectId), uuidSchema.parse(portfolioId), uuidSchema.parse(userId)],
  } as const;
}

export function ownedProjectListQuery(portfolioId: string, userId: string, search: string | null = null, limit?: number, offset?: number) {
  return {
    text: "select p.* from public.portfolio_projects p join public.portfolios f on f.id = p.portfolio_id where p.portfolio_id = $1::uuid and f.user_id = $2::uuid and ($3::text is null or p.title ilike '%' || $3 || '%') order by p.sort_order asc, p.created_at desc limit coalesce($4::integer, 2147483647) offset coalesce($5::integer, 0)",
    values: [uuidSchema.parse(portfolioId), uuidSchema.parse(userId), search, limit ?? null, offset ?? null],
  } as const;
}

export function publishedProjectListQuery(portfolioId: string) {
  return {
    text: "select p.* from public.portfolio_projects p join public.portfolios f on f.id = p.portfolio_id where p.portfolio_id = $1::uuid and f.is_published = true order by p.sort_order asc, p.created_at desc",
    values: [uuidSchema.parse(portfolioId)],
  } as const;
}

export function publishedPortfolioBySlugQuery(slug: string) {
  return {
    text: "select * from public.portfolios where slug = $1 and is_published = true limit 1",
    values: [slug],
  } as const;
}

export function portfolioSlugExistsQuery(slug: string, excludingPortfolioId?: string) {
  const excludingId = excludingPortfolioId ? uuidSchema.parse(excludingPortfolioId) : null;
  return {
    text: "select 1 from public.portfolios where slug = $1 and ($2::uuid is null or id <> $2::uuid) limit 1",
    values: [slug, excludingId],
  } as const;
}
