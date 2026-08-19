import { and, asc, desc, eq, like, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { portfolioProjects, portfolios } from "../drizzle/schema";
import { getDb } from "./db";
import { createUniqueSlug, hasValidImageSignature, slugify } from "./portfolio";
import { storagePut } from "./storage";
import { portfolioInputSchema, projectInputSchema } from "../shared/portfolio";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";

const imageUploadSchema = z.object({
  portfolioId: z.number().int().positive(),
  kind: z.enum(["logo", "avatar"]),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  base64: z.string().min(8).max(3_200_000),
});

const projectImageUploadSchema = z.object({
  portfolioId: z.number().int().positive(),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  // 5MB source images expand to roughly 6.7MB in base64. Buffer size stays authoritative.
  base64: z.string().min(8).max(7_100_000),
});

const projectIdInput = z.object({ portfolioId: z.number().int().positive(), projectId: z.number().int().positive() });

async function requireDatabase() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "База данных временно недоступна." });
  return db;
}

function toClientPortfolio(row: typeof portfolios.$inferSelect) {
  return {
    ...row,
    isPublished: Boolean(row.isPublished),
    slugManuallyEdited: Boolean(row.slugManuallyEdited),
    logoUrl: row.logoUrl ?? "",
    avatarUrl: row.avatarUrl ?? "",
    socialLinks: row.socialLinks ?? [],
    projects: row.projects ?? [],
    services: row.services ?? [],
    posts: row.posts ?? [],
    contactEmail: row.contactEmail ?? "",
  };
}

function toClientProject(row: typeof portfolioProjects.$inferSelect) {
  const normalizeDate = (value: string | Date | null) => value instanceof Date ? value.toISOString().slice(0, 10) : value ?? "";
  const startDate = normalizeDate(row.startDate);
  const endDate = normalizeDate(row.endDate);
  const dateYear = startDate || endDate || String(row.createdAt.getUTCFullYear());
  return {
    ...row,
    images: row.images ?? [],
    tags: row.tags ?? [],
    projectUrl: row.projectUrl ?? "",
    startDate,
    endDate,
    year: dateYear.slice(0, 4),
    href: row.projectUrl ?? undefined,
  };
}

async function requirePortfolioOwner(db: Awaited<ReturnType<typeof requireDatabase>>, portfolioId: number, userId: number) {
  const rows = await db.select({ id: portfolios.id }).from(portfolios).where(and(eq(portfolios.id, portfolioId), eq(portfolios.userId, userId))).limit(1);
  if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Портфолио не найдено." });
}

async function hydratePortfolioProjects(db: Awaited<ReturnType<typeof requireDatabase>>, row: typeof portfolios.$inferSelect) {
  const projectRows = await db.select().from(portfolioProjects).where(eq(portfolioProjects.portfolioId, row.id)).orderBy(asc(portfolioProjects.sortOrder), desc(portfolioProjects.createdAt));
  return { ...toClientPortfolio(row), projects: projectRows.map(toClientProject) };
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  portfolios: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDatabase();
      const rows = await db.select().from(portfolios).where(eq(portfolios.userId, ctx.user.id)).orderBy(desc(portfolios.updatedAt));
      return Promise.all(rows.map((row) => hydratePortfolioProjects(db, row)));
    }),
    get: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const db = await requireDatabase();
      const rows = await db.select().from(portfolios).where(and(eq(portfolios.id, input.id), eq(portfolios.userId, ctx.user.id))).limit(1);
      if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Портфолио не найдено." });
      return hydratePortfolioProjects(db, rows[0]);
    }),
    create: protectedProcedure.mutation(async ({ ctx }) => {
      const db = await requireDatabase();
      const title = "Untitled portfolio";
      const slug = await createUniqueSlug(title);
      const result = await db.insert(portfolios).values({
        userId: ctx.user.id, title, bio: "", socialLinks: [], template: "minimal", colorScheme: "blue", fontFamily: "inter", projects: [], services: [], posts: [], contactEmail: ctx.user.email ?? null, isPublished: 0, slug, slugManuallyEdited: 0,
      });
      const rows = await db.select().from(portfolios).where(eq(portfolios.id, Number(result[0].insertId))).limit(1);
      if (!rows[0]) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Не удалось создать портфолио." });
      return hydratePortfolioProjects(db, rows[0]);
    }),
    update: protectedProcedure.input(z.object({ id: z.number().int().positive(), values: portfolioInputSchema })).mutation(async ({ ctx, input }) => {
      const db = await requireDatabase();
      const owned = await db.select().from(portfolios).where(and(eq(portfolios.id, input.id), eq(portfolios.userId, ctx.user.id))).limit(1);
      const existing = owned[0];
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Портфолио не найдено." });
      const desiredSlug = input.values.slugManuallyEdited ? input.values.slug : input.values.title;
      const slug = await createUniqueSlug(desiredSlug || input.values.title, existing.id);
      const justPublished = input.values.isPublished && !existing.isPublished;

      await db.update(portfolios).set({
        title: input.values.title, bio: input.values.bio, logoUrl: input.values.logoUrl || null, avatarUrl: input.values.avatarUrl || null, socialLinks: input.values.socialLinks, template: input.values.template, colorScheme: input.values.colorScheme, fontFamily: input.values.fontFamily, services: input.values.services, posts: input.values.posts, contactEmail: input.values.contactEmail || null, isPublished: input.values.isPublished ? 1 : 0, publishedAt: justPublished ? new Date() : existing.publishedAt, slug, slugManuallyEdited: input.values.slugManuallyEdited ? 1 : 0,
      }).where(and(eq(portfolios.id, existing.id), eq(portfolios.userId, ctx.user.id)));

      const rows = await db.select().from(portfolios).where(eq(portfolios.id, existing.id)).limit(1);
      if (!rows[0]) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Не удалось сохранить портфолио." });
      return hydratePortfolioProjects(db, rows[0]);
    }),
    remove: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const db = await requireDatabase();
      await db.delete(portfolios).where(and(eq(portfolios.id, input.id), eq(portfolios.userId, ctx.user.id)));
      return { success: true } as const;
    }),
    uploadImage: protectedProcedure.input(imageUploadSchema).mutation(async ({ ctx, input }) => {
      const db = await requireDatabase();
      await requirePortfolioOwner(db, input.portfolioId, ctx.user.id);
      const buffer = Buffer.from(input.base64, "base64");
      if (!buffer.length || buffer.length > 2 * 1024 * 1024 || !hasValidImageSignature(buffer, input.mimeType)) throw new TRPCError({ code: "BAD_REQUEST", message: "Поддерживаются корректные JPG, PNG и WebP размером до 2 МБ." });
      const extension = input.mimeType === "image/jpeg" ? "jpg" : input.mimeType.split("/")[1];
      const uploaded = await storagePut(`portfolios/${ctx.user.id}/${input.portfolioId}/${input.kind}-${crypto.randomUUID()}.${extension}`, buffer, input.mimeType);
      return { url: uploaded.url };
    }),
  }),
  projects: router({
    list: protectedProcedure.input(z.object({ portfolioId: z.number().int().positive(), query: z.string().trim().max(100).optional(), page: z.number().int().positive().default(1), pageSize: z.number().int().min(1).max(30).default(12) })).query(async ({ ctx, input }) => {
      const db = await requireDatabase();
      await requirePortfolioOwner(db, input.portfolioId, ctx.user.id);
      const condition = input.query ? and(eq(portfolioProjects.portfolioId, input.portfolioId), like(portfolioProjects.title, `%${input.query}%`)) : eq(portfolioProjects.portfolioId, input.portfolioId);
      const offset = (input.page - 1) * input.pageSize;
      const rows = await db.select().from(portfolioProjects).where(condition).orderBy(asc(portfolioProjects.sortOrder), desc(portfolioProjects.createdAt)).limit(input.pageSize).offset(offset);
      const totals = await db.select({ total: sql<number>`count(*)` }).from(portfolioProjects).where(condition);
      return { items: rows.map(toClientProject), total: Number(totals[0]?.total ?? 0), page: input.page, pageSize: input.pageSize };
    }),
    get: protectedProcedure.input(projectIdInput).query(async ({ ctx, input }) => {
      const db = await requireDatabase();
      await requirePortfolioOwner(db, input.portfolioId, ctx.user.id);
      const rows = await db.select().from(portfolioProjects).where(and(eq(portfolioProjects.id, input.projectId), eq(portfolioProjects.portfolioId, input.portfolioId))).limit(1);
      if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Проект не найден." });
      return toClientProject(rows[0]);
    }),
    create: protectedProcedure.input(z.object({ portfolioId: z.number().int().positive(), values: projectInputSchema })).mutation(async ({ ctx, input }) => {
      const db = await requireDatabase();
      await requirePortfolioOwner(db, input.portfolioId, ctx.user.id);
      const last = await db.select({ sortOrder: portfolioProjects.sortOrder }).from(portfolioProjects).where(eq(portfolioProjects.portfolioId, input.portfolioId)).orderBy(desc(portfolioProjects.sortOrder)).limit(1);
      const result = await db.insert(portfolioProjects).values({ portfolioId: input.portfolioId, title: input.values.title, description: input.values.description, images: input.values.images, tags: input.values.tags, projectUrl: input.values.projectUrl || null, startDate: input.values.startDate ? new Date(`${input.values.startDate}T00:00:00.000Z`) : null, endDate: input.values.endDate ? new Date(`${input.values.endDate}T00:00:00.000Z`) : null, sortOrder: (last[0]?.sortOrder ?? -1) + 1 });
      const rows = await db.select().from(portfolioProjects).where(eq(portfolioProjects.id, Number(result[0].insertId))).limit(1);
      if (!rows[0]) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Не удалось создать проект." });
      return toClientProject(rows[0]);
    }),
    update: protectedProcedure.input(projectIdInput.extend({ values: projectInputSchema })).mutation(async ({ ctx, input }) => {
      const db = await requireDatabase();
      await requirePortfolioOwner(db, input.portfolioId, ctx.user.id);
      const owned = await db.select({ id: portfolioProjects.id }).from(portfolioProjects).where(and(eq(portfolioProjects.id, input.projectId), eq(portfolioProjects.portfolioId, input.portfolioId))).limit(1);
      if (!owned[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Проект не найден." });
      await db.update(portfolioProjects).set({ title: input.values.title, description: input.values.description, images: input.values.images, tags: input.values.tags, projectUrl: input.values.projectUrl || null, startDate: input.values.startDate ? new Date(`${input.values.startDate}T00:00:00.000Z`) : null, endDate: input.values.endDate ? new Date(`${input.values.endDate}T00:00:00.000Z`) : null }).where(eq(portfolioProjects.id, input.projectId));
      const rows = await db.select().from(portfolioProjects).where(eq(portfolioProjects.id, input.projectId)).limit(1);
      if (!rows[0]) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Не удалось обновить проект." });
      return toClientProject(rows[0]);
    }),
    remove: protectedProcedure.input(projectIdInput).mutation(async ({ ctx, input }) => {
      const db = await requireDatabase();
      await requirePortfolioOwner(db, input.portfolioId, ctx.user.id);
      await db.delete(portfolioProjects).where(and(eq(portfolioProjects.id, input.projectId), eq(portfolioProjects.portfolioId, input.portfolioId)));
      return { success: true } as const;
    }),
    reorder: protectedProcedure.input(z.object({ portfolioId: z.number().int().positive(), ids: z.array(z.number().int().positive()).min(1).max(100).refine((ids) => new Set(ids).size === ids.length, "Каждый проект должен присутствовать один раз.") })).mutation(async ({ ctx, input }) => {
      const db = await requireDatabase();
      await requirePortfolioOwner(db, input.portfolioId, ctx.user.id);
      const owned = await db.select({ id: portfolioProjects.id }).from(portfolioProjects).where(eq(portfolioProjects.portfolioId, input.portfolioId));
      if (owned.length !== input.ids.length || owned.some((project) => !input.ids.includes(project.id))) throw new TRPCError({ code: "BAD_REQUEST", message: "Неверный набор проектов для сортировки." });
      await Promise.all(input.ids.map((id, sortOrder) => db.update(portfolioProjects).set({ sortOrder }).where(and(eq(portfolioProjects.id, id), eq(portfolioProjects.portfolioId, input.portfolioId)))));
      return { success: true } as const;
    }),
    uploadImage: protectedProcedure.input(projectImageUploadSchema).mutation(async ({ ctx, input }) => {
      const db = await requireDatabase();
      await requirePortfolioOwner(db, input.portfolioId, ctx.user.id);
      const buffer = Buffer.from(input.base64, "base64");
      if (!buffer.length || buffer.length > 5 * 1024 * 1024 || !hasValidImageSignature(buffer, input.mimeType)) throw new TRPCError({ code: "BAD_REQUEST", message: "Поддерживаются корректные JPG, PNG и WebP размером до 5 МБ." });
      const extension = input.mimeType === "image/jpeg" ? "jpg" : input.mimeType.split("/")[1];
      const uploaded = await storagePut(`portfolio-projects/${ctx.user.id}/${input.portfolioId}/${crypto.randomUUID()}.${extension}`, buffer, input.mimeType);
      return { url: uploaded.url };
    }),
  }),
  publicPortfolio: router({
    bySlug: publicProcedure.input(z.object({ slug: z.string().min(3).max(50) })).query(async ({ input }) => {
      const db = await requireDatabase();
      const rows = await db.select().from(portfolios).where(and(eq(portfolios.slug, slugify(input.slug)), eq(portfolios.isPublished, 1))).limit(1);
      if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Портфолио не найдено." });
      return hydratePortfolioProjects(db, rows[0]);
    }),
  }),
});

export type AppRouter = typeof appRouter;
