import { createClient, type User as SupabaseUser } from "@supabase/supabase-js";
import type { Request } from "express";

export type SupabaseServerConfig = {
  url: string;
  publishableKey: string;
};

export type SupabaseIdentity = {
  id: string;
  email: string | null;
  displayName: string | null;
};

export function readSupabaseServerConfig(env: NodeJS.ProcessEnv = process.env): SupabaseServerConfig {
  const url = env.SUPABASE_URL;
  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY;

  if (!url || !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url)) {
    throw new Error("SUPABASE_URL must contain a valid Supabase project URL");
  }

  if (!publishableKey || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey)) {
    throw new Error("SUPABASE_PUBLISHABLE_KEY must contain a Supabase publishable key");
  }

  return { url, publishableKey };
}

function readBearerToken(request: Request): string | null {
  const authorization = request.header("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;

  const token = authorization.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

function toIdentity(user: SupabaseUser): SupabaseIdentity {
  const metadataName = user.user_metadata.name ?? user.user_metadata.full_name;
  return {
    id: user.id,
    email: user.email ?? null,
    displayName: typeof metadataName === "string" ? metadataName : null,
  };
}

/**
 * Проверяет Supabase-issued access token через Auth API.
 * Этот adapter пока не заменяет current MySQL user contract: он станет источником
 * identity после применения UUID PostgreSQL migration и переписывания tRPC ownership.
 */
export async function authenticateSupabaseRequest(request: Request): Promise<SupabaseIdentity | null> {
  const token = readBearerToken(request);
  if (!token) return null;

  const config = readSupabaseServerConfig();
  const client = createClient(config.url, config.publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
  const { data, error } = await client.auth.getUser(token);

  if (error || !data.user) return null;
  return toIdentity(data.user);
}

export const supabaseAuthInternals = {
  readBearerToken,
  toIdentity,
};
