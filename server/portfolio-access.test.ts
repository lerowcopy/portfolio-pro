import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import { getDb } from "./db";
import { defaultPortfolioInput } from "../shared/portfolio";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({ getDb: vi.fn() }));

function createOwnerContext(): TrpcContext {
  return {
    user: {
      id: 9,
      openId: "owner-9",
      email: "owner@example.com",
      name: "Portfolio owner",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

function createDbWithNoOwnedPortfolio() {
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({ limit: vi.fn(async () => []) })),
      })),
    })),
  };
}

describe("protected portfolio access", () => {
  beforeEach(() => {
    vi.mocked(getDb).mockResolvedValue(createDbWithNoOwnedPortfolio() as never);
  });

  it("rejects reading a portfolio that is not owned by the session user", async () => {
    const caller = appRouter.createCaller(createOwnerContext());
    await expect(caller.portfolios.get({ id: 42 })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects updating a portfolio that is not owned by the session user", async () => {
    const caller = appRouter.createCaller(createOwnerContext());
    await expect(caller.portfolios.update({ id: 42, values: defaultPortfolioInput })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects uploading an image to a portfolio that is not owned by the session user", async () => {
    const caller = appRouter.createCaller(createOwnerContext());
    await expect(caller.portfolios.uploadImage({ portfolioId: 42, kind: "avatar", mimeType: "image/png", base64: "aGVsbG8t" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
