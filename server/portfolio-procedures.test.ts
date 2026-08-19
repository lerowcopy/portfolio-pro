import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import { getDb } from "./db";
import { createUniqueSlug } from "./portfolio";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({ getDb: vi.fn() }));
vi.mock("./portfolio", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./portfolio")>();
  return { ...actual, createUniqueSlug: vi.fn() };
});

function createContext(): TrpcContext {
  return {
    user: { id: 11, openId: "user-11", email: "maker@example.com", name: "Maker", loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("portfolio list, create and remove procedures", () => {
  beforeEach(() => vi.resetAllMocks());

  it("lists only the calling user's query result", async () => {
    const orderBy = vi.fn(async () => []);
    const where = vi.fn(() => ({ orderBy }));
    vi.mocked(getDb).mockResolvedValue({ select: vi.fn(() => ({ from: vi.fn(() => ({ where })) })) } as never);

    const caller = appRouter.createCaller(createContext());
    await expect(caller.portfolios.list()).resolves.toEqual([]);
    expect(where).toHaveBeenCalledTimes(1);
    expect(orderBy).toHaveBeenCalledTimes(1);
  });

  it("creates a draft with safe defaults and the server-generated unique slug", async () => {
    const createdRow = {
      id: 71, userId: 11, title: "Untitled portfolio", bio: "", logoUrl: null, avatarUrl: null, socialLinks: [], template: "minimal", colorScheme: "blue", fontFamily: "inter", isPublished: 0, publishedAt: null, slug: "untitled-portfolio-2", slugManuallyEdited: 0, createdAt: new Date(), updatedAt: new Date(),
    };
    const insertValues = vi.fn(async () => [{ insertId: 71 }]);
    const select = vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(async () => [createdRow]) })) })) }));
    vi.mocked(getDb).mockResolvedValue({ select, insert: vi.fn(() => ({ values: insertValues })) } as never);
    vi.mocked(createUniqueSlug).mockResolvedValue("untitled-portfolio-2");

    const caller = appRouter.createCaller(createContext());
    const result = await caller.portfolios.create();

    expect(createUniqueSlug).toHaveBeenCalledWith("Untitled portfolio");
    expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({ userId: 11, title: "Untitled portfolio", isPublished: 0, slug: "untitled-portfolio-2", slugManuallyEdited: 0 }));
    expect(result).toMatchObject({ id: 71, isPublished: false, slug: "untitled-portfolio-2" });
  });

  it("removes through an owner-scoped delete operation", async () => {
    const where = vi.fn(async () => undefined);
    const remove = vi.fn(() => ({ where }));
    vi.mocked(getDb).mockResolvedValue({ delete: remove } as never);

    const caller = appRouter.createCaller(createContext());
    await expect(caller.portfolios.remove({ id: 71 })).resolves.toEqual({ success: true });
    expect(remove).toHaveBeenCalledTimes(1);
    expect(where).toHaveBeenCalledTimes(1);
  });
});

describe("portfolio publishing success path", () => {
  const baseRow = {
    id: 71, userId: 11, title: "Maker portfolio", bio: "A considered body of work.", logoUrl: null, avatarUrl: null, socialLinks: [], template: "showcase", colorScheme: "warm", fontFamily: "playfair", projects: [], services: [], posts: [], contactEmail: "maker@example.com", isPublished: 0, publishedAt: null, slug: "maker-portfolio", slugManuallyEdited: 0, createdAt: new Date(), updatedAt: new Date(),
  };

  it("publishes an owned portfolio and returns the normalized persisted record", async () => {
    const publishedRow = { ...baseRow, isPublished: 1, publishedAt: new Date() };
    const resultQueue = [[baseRow], [publishedRow]];
    const select = vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(async () => resultQueue.shift() ?? []) })) })) }));
    const updateWhere = vi.fn(async () => undefined);
    const updateSet = vi.fn(() => ({ where: updateWhere }));
    vi.mocked(getDb).mockResolvedValue({ select, update: vi.fn(() => ({ set: updateSet })) } as never);
    vi.mocked(createUniqueSlug).mockResolvedValue("maker-portfolio");

    const caller = appRouter.createCaller(createContext());
    const values = { ...baseRow, logoUrl: "", avatarUrl: "", isPublished: true, slugManuallyEdited: false };
    const result = await caller.portfolios.update({ id: 71, values });

    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ isPublished: 1, slug: "maker-portfolio" }));
    expect(updateWhere).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ id: 71, isPublished: true, slug: "maker-portfolio" });
  });

  it("returns a published portfolio from the public slug procedure", async () => {
    const select = vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(async () => [{ ...baseRow, isPublished: 1, publishedAt: new Date() }]) })) })) }));
    vi.mocked(getDb).mockResolvedValue({ select } as never);

    const caller = appRouter.createCaller(createContext());
    await expect(caller.publicPortfolio.bySlug({ slug: "maker-portfolio" })).resolves.toMatchObject({ id: 71, isPublished: true, slug: "maker-portfolio" });
  });
});
