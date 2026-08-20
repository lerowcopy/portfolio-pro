import type { Server } from "http";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getExternalPortfolio: vi.fn(),
  getExternalProject: vi.fn(),
  getPublishedExternalPortfolioBySlug: vi.fn(),
  listExternalPortfolios: vi.fn(),
  listExternalProjects: vi.fn(),
  listPublishedExternalProjects: vi.fn(),
  poolQuery: vi.fn(),
}));

const ownerId = "550e8400-e29b-41d4-a716-446655440000";
const otherId = "550e8400-e29b-41d4-a716-446655440001";
const portfolioId = "660e8400-e29b-41d4-a716-446655440000";

vi.mock("./external/externalContext", () => ({
  createExternalContext: async (opts: { req: { header(name: string): string | undefined }; res: unknown }) => {
    const bearer = opts.req.header("authorization");
    const user = bearer === "Bearer owner"
      ? { id: ownerId, email: "owner@example.com", displayName: "Owner" }
      : bearer === "Bearer other"
        ? { id: otherId, email: "other@example.com", displayName: "Other" }
        : null;
    return { req: opts.req, res: opts.res, user };
  },
}));

vi.mock("./external/portfolioRepository", () => ({
  getExternalPortfolio: mocks.getExternalPortfolio,
  getExternalProject: mocks.getExternalProject,
  getPublishedExternalPortfolioBySlug: mocks.getPublishedExternalPortfolioBySlug,
  listExternalPortfolios: mocks.listExternalPortfolios,
  listExternalProjects: mocks.listExternalProjects,
  listPublishedExternalProjects: mocks.listPublishedExternalProjects,
}));

vi.mock("./external/postgres", () => ({
  getExternalPostgresPool: () => ({ query: mocks.poolQuery }),
}));

vi.mock("./external/externalSlug", () => ({
  createUniqueExternalSlug: vi.fn(),
  externalSlugify: (value: string) => value,
}));

import { createPortfolioApp } from "./app";

let server: Server;
let baseUrl = "";

function trpcPath(procedure: string, input: unknown): string {
  return `/api/trpc/${procedure}?input=${encodeURIComponent(JSON.stringify({ json: input }))}`;
}

async function request(procedure: string, input: unknown, authorization?: string) {
  return fetch(`${baseUrl}${trpcPath(procedure, input)}`, {
    headers: authorization ? { authorization, "trpc-accept": "application/json" } : { "trpc-accept": "application/json" },
  });
}

beforeAll(async () => {
  mocks.getExternalPortfolio.mockResolvedValue(null);
  mocks.getExternalProject.mockResolvedValue(null);
  mocks.getPublishedExternalPortfolioBySlug.mockResolvedValue(null);
  mocks.listExternalPortfolios.mockResolvedValue([]);
  mocks.listExternalProjects.mockResolvedValue([]);
  mocks.listPublishedExternalProjects.mockResolvedValue([]);
  mocks.poolQuery.mockResolvedValue({ rowCount: 0, rows: [] });
  const app = await createPortfolioApp({ runtime: "external", serveFrontend: false });
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Тестовый Railway listener не запущен.");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
});

describe("Railway external runtime boundary", () => {
  it("serves health without Manus OAuth initialization", async () => {
    const response = await fetch(`${baseUrl}/healthz`);
    await expect(response.json()).resolves.toEqual({ ok: true, runtime: "external" });
  });

  it("resolves auth.me from mounted bearer-authenticated external context", async () => {
    const response = await request("auth.me", null, "Bearer owner");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ result: { data: { json: { id: ownerId, email: "owner@example.com" } } } });
  });

  it("rejects unauthenticated mounted protected requests", async () => {
    const response = await request("portfolios.list", null);
    expect(response.status).toBe(401);
  });

  it("passes bearer identity only to owner-scoped portfolio reads", async () => {
    const response = await request("portfolios.get", { id: portfolioId }, "Bearer other");
    expect(response.status).toBe(404);
    expect(mocks.getExternalPortfolio).toHaveBeenLastCalledWith(portfolioId, otherId);
  });
});
