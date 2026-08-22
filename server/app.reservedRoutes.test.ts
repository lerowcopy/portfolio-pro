import { describe, expect, it } from "vitest";
import { applicationInternals } from "./app";

describe("reserved public SPA routes", () => {
  it("does not treat billing or future checkout result routes as portfolio slugs", () => {
    expect(applicationInternals.isPublicSlugCandidate("billing")).toBe(false);
    expect(applicationInternals.isPublicSlugCandidate("dashboard")).toBe(false);
    expect(applicationInternals.isPublicSlugCandidate("portfolio")).toBe(true);
  });
});
