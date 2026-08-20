import { describe, expect, it } from "vitest";
import { shouldRedirectUnauthenticatedRoute } from "./authRouteGuard";

describe("shouldRedirectUnauthenticatedRoute", () => {
  it("does not redirect during Supabase session hydration", () => {
    expect(shouldRedirectUnauthenticatedRoute(true, false)).toBe(false);
  });

  it("does not redirect an authenticated user", () => {
    expect(shouldRedirectUnauthenticatedRoute(false, true)).toBe(false);
  });

  it("redirects only after hydration confirms no session", () => {
    expect(shouldRedirectUnauthenticatedRoute(false, false)).toBe(true);
  });
});
