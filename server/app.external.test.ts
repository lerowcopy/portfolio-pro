import type { Server } from "http";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { defaultPortfolioInput } from "../shared/portfolio";

const mocks = vi.hoisted(() => ({
  getExternalPortfolio: vi.fn(),
  getExternalProject: vi.fn(),
  getPublishedExternalPortfolioBySlug: vi.fn(),
  listExternalPortfolios: vi.fn(),
  listExternalProjects: vi.fn(),
  listPublishedExternalProjects: vi.fn(),
  poolQuery: vi.fn(),
  requireExternalPortfolioOwner: vi.fn(),
  uploadExternalImage: vi.fn(),
  createExternalSignedImageUrl: vi.fn(),
  parseOwnedExternalStoragePath: vi.fn(),
  deleteExternalImage: vi.fn(),
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
  createUniqueExternalSlug: vi.fn().mockResolvedValue("owner-portfolio"),
  externalSlugify: (value: string) => value,
}));

vi.mock("./external/ownership", async () => {
  const actual = await vi.importActual<typeof import("./external/ownership")>("./external/ownership");
  return { ...actual, requireExternalPortfolioOwner: mocks.requireExternalPortfolioOwner };
});

vi.mock("./external/supabaseStorage", () => ({
  uploadExternalImage: mocks.uploadExternalImage,
  createExternalSignedImageUrl: mocks.createExternalSignedImageUrl,
  parseOwnedExternalStoragePath: mocks.parseOwnedExternalStoragePath,
  deleteExternalImage: mocks.deleteExternalImage,
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

async function mutation(procedure: string, input: unknown, authorization: string) {
  return fetch(`${baseUrl}/api/trpc/${procedure}`, {
    method: "POST",
    headers: { authorization, "content-type": "application/json", "trpc-accept": "application/json" },
    body: JSON.stringify({ json: input }),
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
  mocks.requireExternalPortfolioOwner.mockResolvedValue(undefined);
  mocks.uploadExternalImage.mockResolvedValue({ storagePath: `storage://portfolio-avatars/${ownerId}/a0b1c2d3-e4f5-6789-a0b1-c2d3e4f56789.png`, url: "https://signed.example/avatar" });
  mocks.createExternalSignedImageUrl.mockResolvedValue("https://signed.example/avatar");
  mocks.parseOwnedExternalStoragePath.mockReturnValue({ bucket: "portfolio-avatars", objectPath: `${ownerId}/a0b1c2d3-e4f5-6789-a0b1-c2d3e4f56789.png` });
  mocks.deleteExternalImage.mockResolvedValue(undefined);
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

  it("persists a bearer-owned opaque storage ref and returns only its signed delivery URL", async () => {
    const storagePath = `storage://portfolio-avatars/${ownerId}/a0b1c2d3-e4f5-6789-a0b1-c2d3e4f56789.png`;
    const uploadResponse = await mutation("portfolios.uploadImage", {
      portfolioId,
      kind: "avatar",
      mimeType: "image/png",
      base64: "iVBORw0KGgo=",
    }, "Bearer owner");
    expect(uploadResponse.status).toBe(200);
    await expect(uploadResponse.json()).resolves.toMatchObject({ result: { data: { json: { storagePath, url: "https://signed.example/avatar" } } } });

    mocks.poolQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ id: portfolioId, user_id: ownerId, title: "Owner portfolio", bio: "", logo_path: "", avatar_path: storagePath, social_links: [], services: [], posts: [], contact_email: "owner@example.com", template: "minimal", color_scheme: "blue", font_family: "inter", is_published: false, slug_manually_edited: false }],
    });
    const updateResponse = await mutation("portfolios.update", {
      id: portfolioId,
      values: { ...defaultPortfolioInput, avatarUrl: storagePath },
    }, "Bearer owner");
    expect(updateResponse.status).toBe(200);
    await expect(updateResponse.json()).resolves.toMatchObject({ result: { data: { json: { avatarStoragePath: storagePath, avatarUrl: "https://signed.example/avatar" } } } });
    expect(mocks.uploadExternalImage).toHaveBeenCalledWith(expect.objectContaining({ userId: ownerId, kind: "avatar" }));
    expect(mocks.parseOwnedExternalStoragePath).toHaveBeenCalledWith(storagePath, ownerId);
  });

  it("cleans up prior owner-scoped avatar and project media after mounted successful mutations", async () => {
    const oldAvatarPath = `storage://portfolio-avatars/${ownerId}/11111111-1111-4111-8111-111111111111.png`;
    const newAvatarPath = `storage://portfolio-avatars/${ownerId}/22222222-2222-4222-8222-222222222222.png`;
    const oldLogoPath = `storage://portfolio-logos/${ownerId}/88888888-8888-4888-8888-888888888888.png`;
    const projectId = "770e8400-e29b-41d4-a716-446655440000";
    const oldProjectPath = `storage://portfolio-project-images/${ownerId}/33333333-3333-4333-8333-333333333333.webp`;
    mocks.getExternalPortfolio.mockResolvedValueOnce({ id: portfolioId, user_id: ownerId, logo_path: oldLogoPath, avatar_path: oldAvatarPath });
    mocks.poolQuery.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: portfolioId, user_id: ownerId, title: "Owner portfolio", bio: "", logo_path: "", avatar_path: newAvatarPath, social_links: [], services: [], posts: [], contact_email: "owner@example.com", template: "minimal", color_scheme: "blue", font_family: "inter", is_published: false, slug_manually_edited: false }] });
    const updateResponse = await mutation("portfolios.update", { id: portfolioId, values: { ...defaultPortfolioInput, logoUrl: "", avatarUrl: newAvatarPath } }, "Bearer owner");
    expect(updateResponse.status).toBe(200);

    mocks.getExternalProject.mockResolvedValueOnce({ id: projectId, portfolio_id: portfolioId, image_paths: [oldProjectPath] });
    mocks.poolQuery.mockResolvedValueOnce({ rowCount: 1, rows: [] });
    const removeResponse = await mutation("projects.remove", { portfolioId, projectId }, "Bearer owner");
    expect(removeResponse.status).toBe(200);
    expect(mocks.deleteExternalImage).toHaveBeenCalledWith(oldAvatarPath, ownerId);
    expect(mocks.deleteExternalImage).toHaveBeenCalledWith(oldLogoPath, ownerId);
    expect(mocks.deleteExternalImage).toHaveBeenCalledWith(oldProjectPath, ownerId);
  });

  it("cleans up all owned portfolio media and replaces project media through mounted API mutations", async () => {
    const projectId = "770e8400-e29b-41d4-a716-446655440000";
    const removedProjectPath = `storage://portfolio-project-images/${ownerId}/44444444-4444-4444-8444-444444444444.webp`;
    const keptProjectPath = `storage://portfolio-project-images/${ownerId}/99999999-9999-4999-8999-999999999999.webp`;
    const newProjectPath = `storage://portfolio-project-images/${ownerId}/55555555-5555-4555-8555-555555555555.webp`;
    const oldLogoPath = `storage://portfolio-logos/${ownerId}/66666666-6666-4666-8666-666666666666.png`;
    const oldAvatarPath = `storage://portfolio-avatars/${ownerId}/77777777-7777-4777-8777-777777777777.png`;
    mocks.getExternalProject.mockResolvedValueOnce({ id: projectId, portfolio_id: portfolioId, image_paths: [removedProjectPath, keptProjectPath] });
    mocks.poolQuery.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: projectId, portfolio_id: portfolioId, title: "Case study", description: "", image_paths: [keptProjectPath, newProjectPath], tags: [], project_url: "", start_date: null, end_date: null }] });
    const projectUpdate = await mutation("projects.update", {
      portfolioId,
      projectId,
      values: { title: "Case study", description: "Описание проекта", images: [keptProjectPath, newProjectPath], tags: [], projectUrl: "", startDate: "", endDate: "" },
    }, "Bearer owner");
    expect(projectUpdate.status).toBe(200);

    mocks.getExternalPortfolio.mockResolvedValueOnce({ id: portfolioId, user_id: ownerId, logo_path: oldLogoPath, avatar_path: oldAvatarPath });
    mocks.listExternalProjects.mockResolvedValueOnce([{ id: projectId, portfolio_id: portfolioId, image_paths: [keptProjectPath, newProjectPath] }]);
    mocks.poolQuery.mockResolvedValueOnce({ rowCount: 1, rows: [] });
    const portfolioRemove = await mutation("portfolios.remove", { id: portfolioId }, "Bearer owner");
    expect(portfolioRemove.status).toBe(200);
    expect(mocks.deleteExternalImage).toHaveBeenCalledWith(removedProjectPath, ownerId);
    expect(mocks.deleteExternalImage).toHaveBeenCalledWith(oldLogoPath, ownerId);
    expect(mocks.deleteExternalImage).toHaveBeenCalledWith(oldAvatarPath, ownerId);
    expect(mocks.deleteExternalImage).toHaveBeenCalledWith(newProjectPath, ownerId);
    expect(mocks.deleteExternalImage).toHaveBeenCalledWith(keptProjectPath, ownerId);
  });
});
