import { describe, expect, it } from "vitest";
import { createPortfolioQuery } from "./portfolioWrites";

describe("external portfolio write queries", () => {
  it("binds UUID owner and never interpolates values", () => {
    const query = createPortfolioQuery("550e8400-e29b-41d4-a716-446655440000", "Untitled portfolio", "untitled-portfolio", "user@example.com");
    expect(query.text).toContain("$1::uuid");
    expect(query.text).toContain("returning *");
    expect(query.values[0]).toBe("550e8400-e29b-41d4-a716-446655440000");
  });
});
