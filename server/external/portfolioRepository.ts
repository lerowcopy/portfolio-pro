import { getExternalPostgresPool } from "./postgres";
import { ownedPortfolioListQuery, ownedPortfolioQuery, ownedProjectListQuery, ownedProjectQuery, publishedPortfolioBySlugQuery, publishedProjectListQuery } from "./portfolioQueries";

export async function listExternalPortfolios(userId: string) {
  const query = ownedPortfolioListQuery(userId);
  return (await getExternalPostgresPool().query(query.text, [...query.values])).rows;
}

export async function getExternalPortfolio(portfolioId: string, userId: string) {
  const query = ownedPortfolioQuery(portfolioId, userId);
  return (await getExternalPostgresPool().query(query.text, [...query.values])).rows[0] ?? null;
}

export async function getExternalProject(projectId: string, portfolioId: string, userId: string) {
  const query = ownedProjectQuery(projectId, portfolioId, userId);
  return (await getExternalPostgresPool().query(query.text, [...query.values])).rows[0] ?? null;
}

export async function listExternalProjects(portfolioId: string, userId: string, search: string | null = null, limit?: number, offset?: number) {
  const query = ownedProjectListQuery(portfolioId, userId, search, limit, offset);
  return (await getExternalPostgresPool().query(query.text, [...query.values])).rows;
}

export async function getPublishedExternalPortfolioBySlug(slug: string) {
  const query = publishedPortfolioBySlugQuery(slug);
  return (await getExternalPostgresPool().query(query.text, [...query.values])).rows[0] ?? null;
}

export async function listPublishedExternalProjects(portfolioId: string) {
  const query = publishedProjectListQuery(portfolioId);
  return (await getExternalPostgresPool().query(query.text, [...query.values])).rows;
}
