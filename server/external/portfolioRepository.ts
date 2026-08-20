import { getExternalPostgresPool } from "./postgres";
import { ownedPortfolioListQuery, ownedPortfolioQuery, ownedProjectQuery } from "./portfolioQueries";

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
