import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import { getDb } from "./db";
import { storagePut } from "./storage";
import { projectInputSchema, type ProjectInput } from "../shared/portfolio";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({ getDb: vi.fn() }));
vi.mock("./storage", () => ({ storagePut: vi.fn() }));

const values: ProjectInput = {
  title: "Mobile App Redesign",
  description: "Complete overhaul of a fitness app with a calmer, more useful daily experience.",
  images: ["/manus-storage/projects/mobile.webp"],
  tags: ["UI Design", "UX"],
  projectUrl: "https://example.com/case-study",
  startDate: "2025-01-01",
  endDate: "2025-04-30",
};

function createContext(): TrpcContext {
  return {
    user: { id: 11, openId: "project-owner", email: "maker@example.com", name: "Maker", loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("project input validation", () => {
  it("accepts five managed image URLs and rejects a sixth image", () => {
    expect(projectInputSchema.safeParse({ ...values, images: Array.from({ length: 5 }, (_, index) => `/manus-storage/${index}.webp`) }).success).toBe(true);
    expect(projectInputSchema.safeParse({ ...values, images: Array.from({ length: 6 }, (_, index) => `/manus-storage/${index}.webp`) }).success).toBe(false);
  });

  it("rejects invalid project date ranges", () => {
    const parsed = projectInputSchema.safeParse({ ...values, startDate: "2025-05-01", endDate: "2025-04-01" });
    expect(parsed.success).toBe(false);
  });
});

describe("protected project procedures", () => {
  beforeEach(() => vi.resetAllMocks());

  it("creates a project only after portfolio ownership is confirmed", async () => {
    const created = { id: 91, portfolioId: 7, ...values, images: values.images, tags: values.tags, projectUrl: values.projectUrl, startDate: new Date("2025-01-01T00:00:00.000Z"), endDate: new Date("2025-04-30T00:00:00.000Z"), sortOrder: 2, createdAt: new Date(), updatedAt: new Date() };
    const selections = [
      { limit: [{ id: 7 }] },
      { orderedLimit: [{ sortOrder: 1 }] },
      { limit: [created] },
    ];
    const select = vi.fn(() => {
      const next = selections.shift() ?? {};
      return { from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(async () => next.limit ?? []), orderBy: vi.fn(() => ({ limit: vi.fn(async () => next.orderedLimit ?? []) })) })) })) };
    });
    const insertValues = vi.fn(async () => [{ insertId: 91 }]);
    vi.mocked(getDb).mockResolvedValue({ select, insert: vi.fn(() => ({ values: insertValues })) } as never);

    const caller = appRouter.createCaller(createContext());
    const result = await caller.projects.create({ portfolioId: 7, values });

    expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({ portfolioId: 7, sortOrder: 2, title: values.title }));
    expect(result).toMatchObject({ id: 91, title: values.title, sortOrder: 2 });
  });

  it("rejects create and reorder requests when the portfolio is not owned", async () => {
    const select = vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(async () => []) })) })) }));
    vi.mocked(getDb).mockResolvedValue({ select } as never);
    const caller = appRouter.createCaller(createContext());

    await expect(caller.projects.create({ portfolioId: 7, values })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(caller.projects.reorder({ portfolioId: 7, ids: [91] })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("updates, removes and persists an owner-scoped project order", async () => {
    const updated = { id: 91, portfolioId: 7, ...values, startDate: new Date("2025-01-01T00:00:00.000Z"), endDate: null, sortOrder: 1, createdAt: new Date(), updatedAt: new Date() };
    const selections = [[{ id: 7 }], [{ id: 91 }], [updated], [{ id: 7 }]];
    const select = vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(async () => selections.shift() ?? []) })) })) }));
    const updateWhere = vi.fn(async () => undefined);
    const updateSet = vi.fn(() => ({ where: updateWhere }));
    const deleteWhere = vi.fn(async () => undefined);
    vi.mocked(getDb).mockResolvedValue({ select, update: vi.fn(() => ({ set: updateSet })), delete: vi.fn(() => ({ where: deleteWhere })) } as never);
    const caller = appRouter.createCaller(createContext());

    await expect(caller.projects.update({ portfolioId: 7, projectId: 91, values })).resolves.toMatchObject({ id: 91, title: values.title });
    await expect(caller.projects.remove({ portfolioId: 7, projectId: 91 })).resolves.toEqual({ success: true });
    let reorderSelectCall = 0;
    const reorderSelect = vi.fn(() => {
      const rows = reorderSelectCall++ === 0 ? [{ id: 7 }] : [{ id: 91 }, { id: 92 }];
      const query = Object.assign(Promise.resolve(rows), { limit: vi.fn(async () => rows) });
      return { from: vi.fn(() => ({ where: vi.fn(() => query) })) };
    });
    vi.mocked(getDb).mockReset();
    vi.mocked(getDb).mockResolvedValue({ select: reorderSelect, update: vi.fn(() => ({ set: updateSet })) } as never);
    await expect(caller.projects.reorder({ portfolioId: 7, ids: [92, 91] })).resolves.toEqual({ success: true });
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ title: values.title }));
    expect(deleteWhere).toHaveBeenCalledTimes(1);
    expect(updateWhere).toHaveBeenCalledTimes(3);
  });

  it("rejects invalid project image bytes and accepts a signed PNG under the managed 5MB limit", async () => {
    const select = vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(async () => [{ id: 7 }]) })) })) }));
    vi.mocked(getDb).mockResolvedValue({ select } as never);
    vi.mocked(storagePut).mockResolvedValue({ key: "portfolio-projects/11/7/image.png", url: "/manus-storage/portfolio-projects/11/7/image.png" });
    const caller = appRouter.createCaller(createContext());
    await expect(caller.projects.uploadImage({ portfolioId: 7, mimeType: "image/png", base64: "aGVsbG8t" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).toString("base64");
    await expect(caller.projects.uploadImage({ portfolioId: 7, mimeType: "image/png", base64: pngSignature })).resolves.toEqual({ url: "/manus-storage/portfolio-projects/11/7/image.png" });
    expect(storagePut).toHaveBeenCalledTimes(1);
  });
});
