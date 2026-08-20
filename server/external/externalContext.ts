import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { authenticateSupabaseRequest, type SupabaseIdentity } from "./supabaseAuth";

export type ExternalTrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: SupabaseIdentity | null;
};

export async function createExternalContext(opts: CreateExpressContextOptions): Promise<ExternalTrpcContext> {
  return { req: opts.req, res: opts.res, user: await authenticateSupabaseRequest(opts.req) };
}
