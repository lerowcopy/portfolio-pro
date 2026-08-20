import { describe, expect, it } from "vitest";
import { uuidSchema } from "./ownership";

describe("external UUID ownership contract", () => {
  it("accepts UUID identifiers and rejects numeric legacy identifiers", () => {
    expect(uuidSchema.safeParse("550e8400-e29b-41d4-a716-446655440000").success).toBe(true);
    expect(uuidSchema.safeParse("42").success).toBe(false);
  });
});
