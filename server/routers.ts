import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { portfolios } from "../drizzle/schema";
import { getDb } from "./db";
import { createUniqueSlug, hasValidImageSignature, slugify } from "./portfolio";
import { storagePut } from "./storage";
import { portfolioInputSchema } from "../shared/portfolio";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";

const imageUploadSchema = z.object({
  portfolioId: z.number().int().positive(),
  kind: z.enum(["logo", "avatar"]),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  base64: z.string().min(8).max(2_800_000),
});

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
  };
}

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  portfolios: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDatabase();
      const rows = await db.select().from(portfolios).where(eq(portfolios.userId, ctx.user.id)).orderBy(desc(portfolios.updatedAt));
      return rows.map(toClientPortfolio);
    }),
    get: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const db = await requireDatabase();
      const rows = await db.select().from(portfolios).where(and(eq(portfolios.id, input.id), eq(portfolios.userId, ctx.user.id))).limit(1);
      if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Портфолио не найдено." });
      return toClientPortfolio(rows[0]);
    }),
    create: protectedProcedure.mutation(async ({ ctx }) => {
      const db = await requireDatabase();
      const title = "Untitled portfolio";
      const slug = await createUniqueSlug(title);
      const result = await db.insert(portfolios).values({
        userId: ctx.user.id,
        title,
        bio: "",
        socialLinks: [],
        template: "minimal",
        colorScheme: "blue",
        fontFamily: "inter",
        isPublished: 0,
        slug,
        slugManuallyEdited: 0,
      });
      const rows = await db.select().from(portfolios).where(eq(portfolios.id, Number(result[0].insertId))).limit(1);
      if (!rows[0]) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Не удалось создать портфолио." });
      return toClientPortfolio(rows[0]);
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
        title: input.values.title,
        bio: input.values.bio,
        logoUrl: input.values.logoUrl || null,
        avatarUrl: input.values.avatarUrl || null,
        socialLinks: input.values.socialLinks,
        template: input.values.template,
        colorScheme: input.values.colorScheme,
        fontFamily: input.values.fontFamily,
        isPublished: input.values.isPublished ? 1 : 0,
        publishedAt: justPublished ? new Date() : existing.publishedAt,
        slug,
        slugManuallyEdited: input.values.slugManuallyEdited ? 1 : 0,
      }).where(and(eq(portfolios.id, existing.id), eq(portfolios.userId, ctx.user.id)));

      const rows = await db.select().from(portfolios).where(eq(portfolios.id, existing.id)).limit(1);
      if (!rows[0]) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Не удалось сохранить портфолио." });
      return toClientPortfolio(rows[0]);
    }),
    remove: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const db = await requireDatabase();
      await db.delete(portfolios).where(and(eq(portfolios.id, input.id), eq(portfolios.userId, ctx.user.id)));
      return { success: true } as const;
    }),
    uploadImage: protectedProcedure.input(imageUploadSchema).mutation(async ({ ctx, input }) => {
      const db = await requireDatabase();
      const owner = await db.select({ id: portfolios.id }).from(portfolios).where(and(eq(portfolios.id, input.portfolioId), eq(portfolios.userId, ctx.user.id))).limit(1);
      if (!owner[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Портфолио не найдено." });

      const buffer = Buffer.from(input.base64, "base64");
      if (!buffer.length || buffer.length > 2 * 1024 * 1024 || !hasValidImageSignature(buffer, input.mimeType)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Поддерживаются корректные JPG, PNG и WebP размером до 2 МБ." });
      }
      const extension = input.mimeType === "image/jpeg" ? "jpg" : input.mimeType.split("/")[1];
      const key = `portfolios/${ctx.user.id}/${input.portfolioId}/${input.kind}-${crypto.randomUUID()}.${extension}`;
      const uploaded = await storagePut(key, buffer, input.mimeType);
      return { url: uploaded.url };
    }),
  }),
  publicPortfolio: router({
    bySlug: publicProcedure.input(z.object({ slug: z.string().min(3).max(50) })).query(async ({ input }) => {
      const db = await requireDatabase();
      const rows = await db.select().from(portfolios).where(and(eq(portfolios.slug, slugify(input.slug)), eq(portfolios.isPublished, 1))).limit(1);
      if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Портфолио не найдено." });
      return toClientPortfolio(rows[0]);
    }),
  }),
});

export type AppRouter = typeof appRouter;
