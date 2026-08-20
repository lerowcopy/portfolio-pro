import { describe, expect, it } from "vitest";
import { readSupabaseServerConfig, supabaseAuthInternals } from "./supabaseAuth";

describe("Supabase Auth adapter", () => {
  it("accepts an explicit Bearer token and rejects malformed authorization values", () => {
    const readBearerToken = supabaseAuthInternals.readBearerToken;

    expect(readBearerToken({ header: () => "Bearer access-token" } as never)).toBe("access-token");
    expect(readBearerToken({ header: () => "Basic access-token" } as never)).toBeNull();
    expect(readBearerToken({ header: () => "Bearer    " } as never)).toBeNull();
  });

  it("requires an explicit project URL and publishable key", () => {
    expect(() =>
      readSupabaseServerConfig({
        SUPABASE_URL: "https://project-ref.supabase.co",
        SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
      })
    ).not.toThrow();

    expect(() => readSupabaseServerConfig({})).toThrow("SUPABASE_URL");
    expect(() =>
      readSupabaseServerConfig({
        SUPABASE_URL: "https://project-ref.supabase.co",
        SUPABASE_PUBLISHABLE_KEY: "service_role_must_not_be_used_here",
      })
    ).toThrow("SUPABASE_PUBLISHABLE_KEY");
  });
});
