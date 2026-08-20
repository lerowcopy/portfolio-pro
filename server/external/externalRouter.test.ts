import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultPortfolioInput } from "../../shared/portfolio";
import type { ExternalTrpcContext } from "./externalContext";

const mocks = vi.hoisted(() => ({
  createUniqueExternalSlug: vi.fn(),
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
  recordExternalStorageCleanupFailure: vi.fn(),
}));

vi.mock("./portfolioRepository", () => ({
  getExternalPortfolio: mocks.getExternalPortfolio,
  getExternalProject: mocks.getExternalProject,
  getPublishedExternalPortfolioBySlug: mocks.getPublishedExternalPortfolioBySlug,
  listExternalPortfolios: mocks.listExternalPortfolios,
  listExternalProjects: mocks.listExternalProjects,
  listPublishedExternalProjects: mocks.listPublishedExternalProjects,
}));

vi.mock("./postgres", () => ({
  getExternalPostgresPool: () => ({ query: mocks.poolQuery }),
}));

vi.mock("./externalSlug", () => ({
  createUniqueExternalSlug: mocks.createUniqueExternalSlug,
  externalSlugify: (value: string) => value,
}));

vi.mock("./ownership", async () => {
  const actual = await vi.importActual<typeof import("./ownership")>("./ownership");
  return { ...actual, requireExternalPortfolioOwner: mocks.requireExternalPortfolioOwner };
});

vi.mock("./supabaseStorage", () => ({
  uploadExternalImage: mocks.uploadExternalImage,
  createExternalSignedImageUrl: mocks.createExternalSignedImageUrl,
  parseOwnedExternalStoragePath: mocks.parseOwnedExternalStoragePath,
  deleteExternalImage: mocks.deleteExternalImage,
}));

vi.mock("./storageCleanupAudit", () => ({
  recordExternalStorageCleanupFailure: mocks.recordExternalStorageCleanupFailure,
}));

import { externalAppRouter } from "./externalRouter";

const userId = "550e8400-e29b-41d4-a716-446655440000";
const otherUserId = "550e8400-e29b-41d4-a716-446655440001";
const portfolioId = "660e8400-e29b-41d4-a716-446655440000";
const projectId = "770e8400-e29b-41d4-a716-446655440000";

const portfolioRow = {
  id: portfolioId,
  user_id: userId,
  title: "Product designer",
  bio: "Дизайнер цифровых продуктов",
  logo_path: null,
  avatar_path: null,
  social_links: [],
  template: "minimal",
  color_scheme: "blue",
  font_family: "inter",
  services: [],
  posts: [],
  contact_email: "owner@example.com",
  slug: "product-designer",
  is_published: false,
  slug_manually_edited: false,
  created_at: "2026-08-20T19:40:58.703Z",
  updated_at: "2026-08-20T19:41:54.187Z",
};

const projectRow = {
  id: projectId,
  portfolio_id: portfolioId,
  title: "Mobile product redesign",
  description: "Полное обновление интерфейса и пользовательского сценария приложения.",
  image_paths: ["https://example.com/project.webp"],
  tags: ["UX", "UI"],
  project_url: "https://example.com",
  start_date: "2026-01-10",
  end_date: "2026-03-20",
  sort_order: 0,
};

const projectInput = {
  title: projectRow.title,
  description: projectRow.description,
  images: [`storage://portfolio-project-images/${userId}/a0b1c2d3-e4f5-6789-a0b1-c2d3e4f56789.webp`],
  tags: projectRow.tags,
  projectUrl: projectRow.project_url,
  startDate: projectRow.start_date,
  endDate: projectRow.end_date,
};

function createContext(user = { id: userId, email: "owner@example.com", displayName: "Owner" }): ExternalTrpcContext {
  return {
    user,
    req: {} as ExternalTrpcContext["req"],
    res: {} as ExternalTrpcContext["res"],
  };
}

describe("external UUID router ownership boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createUniqueExternalSlug.mockResolvedValue("product-designer");
    mocks.getExternalPortfolio.mockResolvedValue(null);
    mocks.getExternalProject.mockResolvedValue(null);
    mocks.getPublishedExternalPortfolioBySlug.mockResolvedValue(null);
    mocks.listExternalPortfolios.mockResolvedValue([]);
    mocks.listExternalProjects.mockResolvedValue([]);
    mocks.listPublishedExternalProjects.mockResolvedValue([]);
    mocks.poolQuery.mockResolvedValue({ rowCount: 0, rows: [] });
    mocks.requireExternalPortfolioOwner.mockResolvedValue(undefined);
    mocks.createExternalSignedImageUrl.mockImplementation((value: string) => Promise.resolve(value));
    mocks.uploadExternalImage.mockResolvedValue({ storagePath: `storage://portfolio-avatars/${userId}/a0b1c2d3-e4f5-6789-a0b1-c2d3e4f56789.png`, url: "https://signed.example/avatar" });
    mocks.parseOwnedExternalStoragePath.mockReturnValue({ bucket: "portfolio-avatars", objectPath: `${userId}/a0b1c2d3-e4f5-6789-a0b1-c2d3e4f56789.png` });
    mocks.deleteExternalImage.mockResolvedValue(undefined);
    mocks.recordExternalStorageCleanupFailure.mockResolvedValue(undefined);
  });

  it("returns current Supabase identity and requires it for protected procedures", async () => {
    const caller = externalAppRouter.createCaller(createContext());
    await expect(caller.auth.me()).resolves.toMatchObject({ id: userId, email: "owner@example.com" });
    await expect(caller.auth.logout()).resolves.toEqual({ success: true });

    const anonymousCaller = externalAppRouter.createCaller({ ...createContext(), user: null });
    await expect(anonymousCaller.portfolios.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("hydrates owner-scoped portfolio and project lists", async () => {
    mocks.listExternalPortfolios.mockResolvedValue([portfolioRow]);
    mocks.listExternalProjects.mockResolvedValue([projectRow]);
    const caller = externalAppRouter.createCaller(createContext());

    await expect(caller.portfolios.list()).resolves.toMatchObject([{
      id: portfolioId,
      createdAt: portfolioRow.created_at,
      updatedAt: portfolioRow.updated_at,
      template: "minimal",
      colorScheme: "blue",
      fontFamily: "inter",
      projects: [{ id: projectId }],
    }]);
    await expect(caller.projects.list({ portfolioId, page: 1, pageSize: 12, query: "mobile" })).resolves.toMatchObject({
      items: [{ id: projectId }],
      total: 1,
      page: 1,
      pageSize: 12,
    });
    mocks.listExternalPortfolios.mockResolvedValue([]);
    const otherCaller = externalAppRouter.createCaller(createContext({ id: otherUserId, email: "other@example.com", displayName: "Other" }));
    await expect(otherCaller.portfolios.list()).resolves.toEqual([]);
    expect(mocks.listExternalPortfolios).toHaveBeenLastCalledWith(otherUserId);
  });

  it("creates and updates UUID-owned portfolios with parameterized query results", async () => {
    mocks.poolQuery.mockResolvedValue({ rowCount: 1, rows: [portfolioRow] });
    const caller = externalAppRouter.createCaller(createContext());

    await expect(caller.portfolios.create({ title: portfolioRow.title })).resolves.toMatchObject({ id: portfolioId, slug: "product-designer" });
    await expect(caller.portfolios.update({ id: portfolioId, values: defaultPortfolioInput })).resolves.toMatchObject({ id: portfolioId });
    expect(mocks.requireExternalPortfolioOwner).toHaveBeenCalledWith(portfolioId, userId);
    expect(mocks.poolQuery).toHaveBeenCalledTimes(2);
  });

  it("creates, updates and reorders projects only after owner validation", async () => {
    mocks.poolQuery
      .mockResolvedValueOnce({ rowCount: 1, rows: [projectRow] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [projectRow] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: projectId }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });
    const caller = externalAppRouter.createCaller(createContext());

    await expect(caller.projects.create({ portfolioId, values: projectInput })).resolves.toMatchObject({ id: projectId });
    await expect(caller.projects.update({ portfolioId, projectId, values: projectInput })).resolves.toMatchObject({ id: projectId });
    await expect(caller.projects.reorder({ portfolioId, ids: [projectId] })).resolves.toEqual({ success: true });
    expect(mocks.requireExternalPortfolioOwner).toHaveBeenCalledWith(portfolioId, userId);
  });

  it("returns a published portfolio only through public slug lookup", async () => {
    mocks.getPublishedExternalPortfolioBySlug.mockResolvedValue({ ...portfolioRow, is_published: true });
    mocks.listPublishedExternalProjects.mockResolvedValue([projectRow]);
    const caller = externalAppRouter.createCaller({ ...createContext(), user: null });

    await expect(caller.publicPortfolio.bySlug({ slug: "product-designer" })).resolves.toMatchObject({
      id: portfolioId,
      isPublished: true,
      projects: [{ id: projectId }],
    });
  });

  it("rejects cross-user reads, writes and deletes without revealing ownership", async () => {
    mocks.requireExternalPortfolioOwner.mockRejectedValue(new TRPCError({ code: "NOT_FOUND", message: "Портфолио не найдено." }));
    const caller = externalAppRouter.createCaller(createContext({ id: otherUserId, email: "other@example.com", displayName: "Other" }));

    await expect(caller.portfolios.get({ id: portfolioId })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(caller.projects.get({ portfolioId, projectId })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(caller.portfolios.update({ id: portfolioId, values: defaultPortfolioInput })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(caller.projects.reorder({ portfolioId, ids: [projectId] })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(caller.portfolios.remove({ id: portfolioId })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(caller.projects.remove({ portfolioId, projectId })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("uploads validated image bytes through the server-only Storage adapter", async () => {
    const caller = externalAppRouter.createCaller(createContext());
    const base64Png = "iVBORw0KGgo=";
    await expect(caller.portfolios.uploadImage({ portfolioId, kind: "avatar", mimeType: "image/png", base64: base64Png })).resolves.toMatchObject({ url: "https://signed.example/avatar" });
    await expect(caller.projects.uploadImage({ portfolioId, mimeType: "image/png", base64: base64Png })).resolves.toMatchObject({ storagePath: expect.stringContaining("storage://") });
    expect(mocks.uploadExternalImage).toHaveBeenCalledWith(expect.objectContaining({ userId, kind: "avatar", mimeType: "image/png" }));
  });

  it("rejects malformed image payloads before Storage access", async () => {
    const caller = externalAppRouter.createCaller(createContext());
    await expect(caller.portfolios.uploadImage({ portfolioId, kind: "logo", mimeType: "image/png", base64: "not-base64" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.uploadExternalImage).not.toHaveBeenCalled();
  });

  it("rejects an opaque Storage reference that is not owned by the authenticated user", async () => {
    mocks.parseOwnedExternalStoragePath.mockImplementation(() => {
      throw new Error("Недопустимый путь к приватному файлу.");
    });
    const caller = externalAppRouter.createCaller(createContext());
    await expect(caller.portfolios.update({
      id: portfolioId,
      values: { ...defaultPortfolioInput, logoUrl: `storage://portfolio-logos/${otherUserId}/a0b1c2d3-e4f5-6789-a0b1-c2d3e4f56789.png` },
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects legacy Manus and arbitrary remote image refs in the external runtime", async () => {
    const caller = externalAppRouter.createCaller(createContext());
    await expect(caller.portfolios.update({
      id: portfolioId,
      values: { ...defaultPortfolioInput, avatarUrl: "/manus-storage/legacy-avatar.png" },
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.projects.create({
      portfolioId,
      values: { ...projectInput, images: ["https://example.com/not-owned.webp"] },
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("cleans up an old owned avatar only after a successful portfolio update", async () => {
    const oldPath = `storage://portfolio-avatars/${userId}/11111111-1111-4111-8111-111111111111.png`;
    const newPath = `storage://portfolio-avatars/${userId}/22222222-2222-4222-8222-222222222222.png`;
    mocks.getExternalPortfolio.mockResolvedValue({ ...portfolioRow, avatar_path: oldPath });
    mocks.poolQuery.mockResolvedValue({ rowCount: 1, rows: [{ ...portfolioRow, avatar_path: newPath }] });
    const caller = externalAppRouter.createCaller(createContext());
    await expect(caller.portfolios.update({ id: portfolioId, values: { ...defaultPortfolioInput, avatarUrl: newPath } })).resolves.toMatchObject({ id: portfolioId });
    expect(mocks.deleteExternalImage).toHaveBeenCalledWith(oldPath, userId);
  });

  it("cleans up removed owned project media after a successful project delete", async () => {
    const oldPath = `storage://portfolio-project-images/${userId}/33333333-3333-4333-8333-333333333333.webp`;
    mocks.getExternalProject.mockResolvedValue({ ...projectRow, image_paths: [oldPath] });
    mocks.poolQuery.mockResolvedValue({ rowCount: 1, rows: [] });
    const caller = externalAppRouter.createCaller(createContext());
    await expect(caller.projects.remove({ portfolioId, projectId })).resolves.toEqual({ success: true });
    expect(mocks.deleteExternalImage).toHaveBeenCalledWith(oldPath, userId);
  });

  it("records a protected cleanup audit task when object deletion fails after a successful mutation", async () => {
    const oldPath = `storage://portfolio-logos/${userId}/44444444-4444-4444-8444-444444444444.png`;
    mocks.getExternalPortfolio.mockResolvedValue({ ...portfolioRow, logo_path: oldPath });
    mocks.poolQuery.mockResolvedValue({ rowCount: 1, rows: [{ ...portfolioRow, logo_path: "" }] });
    mocks.deleteExternalImage.mockRejectedValue(new Error("Storage provider unavailable"));
    const caller = externalAppRouter.createCaller(createContext());
    await expect(caller.portfolios.update({ id: portfolioId, values: { ...defaultPortfolioInput, logoUrl: "" } })).resolves.toMatchObject({ id: portfolioId });
    expect(mocks.recordExternalStorageCleanupFailure).toHaveBeenCalledWith(userId, oldPath, expect.any(Error));
  });
});
