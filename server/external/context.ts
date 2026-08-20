import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { TrpcContext } from "../_core/context";

/**
 * Railway foundation намеренно не использует Manus SDK.
 * Protected procedures остаются закрытыми до подключения UUID PostgreSQL user contract.
 */
export async function createExternalFoundationContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  return {
    req: opts.req,
    res: opts.res,
    user: null,
  };
}
