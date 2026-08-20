import { describe, expect, it } from "vitest";
import { ownedPortfolioQuery } from "./portfolioQueries";

describe("external portfolio SQL ownership queries", () => {
  it("uses parameterized UUID owner checks", () => {
    const query = ownedPortfolioQuery("550e8400-e29b-41d4-a716-446655440000", "550e8400-e29b-41d4-a716-446655440001");
    expect(query.text).toContain("id = $1::uuid and user_id = $2::uuid");
    expect(query.values).toHaveLength(2);
  });
});
