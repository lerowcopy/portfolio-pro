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
