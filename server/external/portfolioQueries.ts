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
