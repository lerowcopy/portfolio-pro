import { describe, expect, it } from "vitest";
import { createPortfolioQuery, createProjectQuery, deletePortfolioQuery, deleteProjectQuery, updatePortfolioQuery, updateProjectQuery } from "./portfolioWrites";

const userId = "550e8400-e29b-41d4-a716-446655440000";
const portfolioId = "660e8400-e29b-41d4-a716-446655440000";
const projectId = "770e8400-e29b-41d4-a716-446655440000";

const portfolioValues = {
  title: "Product designer",
  bio: "Дизайнер цифровых продуктов",
  logoUrl: "",
  avatarUrl: "",
  socialLinks: [],
  template: "minimal" as const,
  colorScheme: "blue" as const,
  fontFamily: "inter" as const,
  projects: [],
  services: [],
  posts: [],
  contactEmail: "user@example.com",
  slug: "product-designer",
  slugManuallyEdited: false,
  isPublished: false,
};

const projectValues = {
  title: "Mobile product redesign",
  description: "Полное обновление интерфейса и пользовательского сценария приложения.",
  images: ["https://example.com/project.webp"],
  tags: ["UX", "UI"],
  projectUrl: "https://example.com",
  startDate: "2026-01-10",
  endDate: "2026-03-20",
};

describe("external portfolio write queries", () => {
  it("binds UUID owner and never interpolates values", () => {
    const query = createPortfolioQuery(userId, "Untitled portfolio", "untitled-portfolio", "user@example.com");
    expect(query.text).toContain("$1::uuid");
    expect(query.text).toContain("returning *");
    expect(query.values[0]).toBe(userId);
  });

  it("binds portfolio mutation values and owner UUIDs", () => {
    const query = updatePortfolioQuery(portfolioId, userId, portfolioValues, "product-designer");
    expect(query.text).toContain("where id = $1::uuid and user_id = $2::uuid");
    expect(query.text).toContain("social_links = $7::jsonb");
    expect(query.values).toContain(JSON.stringify(portfolioValues.socialLinks));
    expect(deletePortfolioQuery(portfolioId, userId).text).toContain("user_id = $2::uuid");
  });

  it("enforces portfolio ownership through joined project mutations", () => {
    const createQuery = createProjectQuery(portfolioId, userId, projectValues);
    const updateQuery = updateProjectQuery(projectId, portfolioId, userId, projectValues);
    const deleteQuery = deleteProjectQuery(projectId, portfolioId, userId);
    expect(createQuery.text).toContain("f.id = $1::uuid and f.user_id = $2::uuid");
    expect(updateQuery.text).toContain("f.user_id = $3::uuid");
    expect(deleteQuery.text).toContain("f.user_id = $3::uuid");
    expect(createQuery.values[4]).toEqual(projectValues.images);
  });
});
