import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getExternalPostgresPool } from "./postgres";

export const uuidSchema = z.string().uuid();

export async function requireExternalPortfolioOwner(portfolioId: string, userId: string): Promise<void> {
  const pool = getExternalPostgresPool();
  const result = await pool.query(
    "select 1 from public.portfolios where id = $1::uuid and user_id = $2::uuid limit 1",
    [portfolioId, userId]
  );

  if (result.rowCount !== 1) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Портфолио не найдено." });
  }
}
