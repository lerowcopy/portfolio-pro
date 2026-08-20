import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { z } from "zod";
import { portfolioColorSchemes, portfolioFontFamilies, portfolioInputSchema, portfolioTemplates, projectInputSchema } from "../../shared/portfolio";
import type { ExternalTrpcContext } from "./externalContext";
import { createUniqueExternalSlug, externalSlugify } from "./externalSlug";
import { requireExternalPortfolioOwner, uuidSchema } from "./ownership";
import { getExternalPostgresPool } from "./postgres";
import { getExternalPortfolio, getExternalProject, getPublishedExternalPortfolioBySlug, listExternalPortfolios, listExternalProjects, listPublishedExternalProjects } from "./portfolioRepository";
import { createPortfolioQuery, createProjectQuery, deletePortfolioQuery, deleteProjectQuery, updatePortfolioQuery, updateProjectQuery } from "./portfolioWrites";
import { recordExternalStorageCleanupFailure } from "./storageCleanupAudit";
import { createExternalSignedImageUrl, deleteExternalImage, parseOwnedExternalStoragePath, uploadExternalImage } from "./supabaseStorage";

type DatabaseRow = Record<string, unknown>;

const t = initTRPC.context<ExternalTrpcContext>().create({ transformer: superjson });
const router = t.router;
const publicProcedure = t.procedure;
const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Требуется авторизация." });
  return next({ ctx: { ...ctx, user: ctx.user } });
});

const portfolioIdSchema = z.object({ id: uuidSchema });
const projectIdSchema = z.object({ portfolioId: uuidSchema, projectId: uuidSchema });
const externalImageRefSchema = z.string().max(1000).refine((value) => value === "" || value.startsWith("storage://"), "Внешний runtime принимает только защищённые ссылки Supabase Storage.");
const externalPortfolioInputSchema = portfolioInputSchema.safeExtend({
  logoUrl: externalImageRefSchema,
  avatarUrl: externalImageRefSchema,
});
const externalProjectInputSchema = projectInputSchema.safeExtend({
  images: z.array(externalImageRefSchema).max(5, "Можно добавить не более 5 изображений."),
});
const imageUploadSchema = z.object({
  portfolioId: uuidSchema,
  kind: z.enum(["logo", "avatar"]),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  base64: z.string().min(8).max(3_200_000),
});
const projectImageUploadSchema = z.object({
  portfolioId: uuidSchema,
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  base64: z.string().min(8).max(7_100_000),
});

function toDateValue(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return typeof value === "string" ? value.slice(0, 10) : "";
}

function toTimestampValue(value: unknown): Date | string {
  if (value instanceof Date || typeof value === "string") return value;
  return new Date(0);
}

function toJsonArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function toAllowedValue<T extends readonly string[]>(value: unknown, allowed: T, fallback: T[number]): T[number] {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? value as T[number] : fallback;
}

function decodeBase64Image(value: string): Buffer {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value) || value.length % 4 !== 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Некорректные данные изображения." });
  }
  const buffer = Buffer.from(value, "base64");
  if (!buffer.length || buffer.toString("base64") !== value) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Некорректные данные изображения." });
  }
  return buffer;
}

async function resolveExternalImage(value: unknown, userId: string): Promise<string> {
  if (typeof value !== "string" || value.length === 0) return "";
  return value.startsWith("storage://") ? createExternalSignedImageUrl(value, userId) : value;
}

function assertOwnedStorageReference(value: string, userId: string): void {
  if (!value.startsWith("storage://")) return;
  try {
    parseOwnedExternalStoragePath(value, userId);
  } catch (error) {
    throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Недопустимый путь к приватному файлу." });
  }
}

async function deleteUnreferencedExternalImages(previousValues: unknown[], nextValues: unknown[], userId: string): Promise<void> {
  const nextPaths = new Set(nextValues.filter((value): value is string => typeof value === "string" && value.startsWith("storage://")));
  const pathsToDelete = previousValues.filter((value): value is string => typeof value === "string" && value.startsWith("storage://") && !nextPaths.has(value));
  const outcomes = await Promise.allSettled(pathsToDelete.map((path) => deleteExternalImage(path, userId)));
  const auditOutcomes = await Promise.allSettled(outcomes.flatMap((outcome, index) => outcome.status === "rejected" ? [recordExternalStorageCleanupFailure(userId, pathsToDelete[index]!, outcome.reason)] : []));
  if (auditOutcomes.some((outcome) => outcome.status === "rejected")) console.error("Не удалось зафиксировать очистку заменённого private Storage object.");
}

async function toClientProject(row: DatabaseRow, userId: string) {
  const startDate = toDateValue(row.start_date);
  const endDate = toDateValue(row.end_date);
  const images = await Promise.all(toJsonArray(row.image_paths).map((image) => resolveExternalImage(image, userId)));
  return {
    ...row,
    id: String(row.id),
    portfolioId: String(row.portfolio_id),
    images,
    imageStoragePaths: toJsonArray(row.image_paths) as string[],
    tags: toJsonArray(row.tags) as string[],
    projectUrl: typeof row.project_url === "string" ? row.project_url : "",
    startDate,
    endDate,
    year: (startDate || endDate || new Date().getUTCFullYear().toString()).slice(0, 4),
    href: typeof row.project_url === "string" ? row.project_url : undefined,
  };
}

async function toClientPortfolio(row: DatabaseRow, projects: Awaited<ReturnType<typeof toClientProject>>[]) {
  return {
    ...row,
    id: String(row.id),
    userId: String(row.user_id),
    createdAt: toTimestampValue(row.created_at),
    updatedAt: toTimestampValue(row.updated_at),
    template: toAllowedValue(row.template, portfolioTemplates, "minimal"),
    colorScheme: toAllowedValue(row.color_scheme, portfolioColorSchemes, "blue"),
    fontFamily: toAllowedValue(row.font_family, portfolioFontFamilies, "inter"),
    logoUrl: await resolveExternalImage(row.logo_path, String(row.user_id)),
    avatarUrl: await resolveExternalImage(row.avatar_path, String(row.user_id)),
    logoStoragePath: typeof row.logo_path === "string" && row.logo_path.startsWith("storage://") ? row.logo_path : "",
    avatarStoragePath: typeof row.avatar_path === "string" && row.avatar_path.startsWith("storage://") ? row.avatar_path : "",
    socialLinks: toJsonArray(row.social_links),
    services: toJsonArray(row.services),
    posts: toJsonArray(row.posts),
    contactEmail: typeof row.contact_email === "string" ? row.contact_email : "",
    isPublished: row.is_published === true,
    slugManuallyEdited: row.slug_manually_edited === true,
    projects,
  };
}

async function hydrateExternalPortfolio(row: DatabaseRow, userId: string) {
  const projects = await listExternalProjects(String(row.id), userId);
  return toClientPortfolio(row, await Promise.all(projects.map((project) => toClientProject(project as DatabaseRow, userId))));
}

function requireMutationResult(rowCount: number | null, message: string): void {
  if (rowCount !== 1) throw new TRPCError({ code: "NOT_FOUND", message });
}

async function uploadOwnedExternalImage(userId: string, portfolioId: string, input: { kind: "avatar" | "logo" | "project"; mimeType: "image/jpeg" | "image/png" | "image/webp"; base64: string }) {
  await requireExternalPortfolioOwner(portfolioId, userId);
  try {
    return await uploadExternalImage({
      userId,
      kind: input.kind,
      mimeType: input.mimeType,
      buffer: decodeBase64Image(input.base64),
    });
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Не удалось загрузить изображение." });
  }
}

export const externalAppRouter = router({
  system: router({
    health: publicProcedure.query(() => ({ ok: true, runtime: "external" as const })),
  }),
  auth: router({
    me: publicProcedure.query(({ ctx }) => ctx.user),
    logout: publicProcedure.mutation(() => ({ success: true } as const)),
  }),
  portfolios: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const rows = await listExternalPortfolios(ctx.user.id);
      return Promise.all(rows.map((row) => hydrateExternalPortfolio(row as DatabaseRow, ctx.user.id)));
    }),
    get: protectedProcedure.input(portfolioIdSchema).query(async ({ ctx, input }) => {
      const row = await getExternalPortfolio(input.id, ctx.user.id);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Портфолио не найдено." });
      return hydrateExternalPortfolio(row as DatabaseRow, ctx.user.id);
    }),
    create: protectedProcedure.input(z.object({ title: z.string().trim().min(3).max(120) }).optional()).mutation(async ({ ctx, input }) => {
      const title = input?.title || "Untitled portfolio";
      const slug = await createUniqueExternalSlug(title);
      const query = createPortfolioQuery(ctx.user.id, title, slug, ctx.user.email);
      const result = await getExternalPostgresPool().query(query.text, [...query.values]);
      const row = result.rows[0] as DatabaseRow | undefined;
      if (!row) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Не удалось создать портфолио." });
      return toClientPortfolio(row, []);
    }),
    update: protectedProcedure.input(portfolioIdSchema.extend({ values: externalPortfolioInputSchema })).mutation(async ({ ctx, input }) => {
      await requireExternalPortfolioOwner(input.id, ctx.user.id);
      const previous = await getExternalPortfolio(input.id, ctx.user.id) as DatabaseRow | null;
      assertOwnedStorageReference(input.values.logoUrl, ctx.user.id);
      assertOwnedStorageReference(input.values.avatarUrl, ctx.user.id);
      const slug = await createUniqueExternalSlug(input.values.slugManuallyEdited ? input.values.slug : input.values.title, input.id);
      const query = updatePortfolioQuery(input.id, ctx.user.id, input.values, slug);
      const result = await getExternalPostgresPool().query(query.text, [...query.values]);
      const row = result.rows[0] as DatabaseRow | undefined;
      if (!row) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Не удалось сохранить портфолио." });
      await deleteUnreferencedExternalImages([previous?.logo_path, previous?.avatar_path], [input.values.logoUrl, input.values.avatarUrl], ctx.user.id);
      return hydrateExternalPortfolio(row, ctx.user.id);
    }),
    remove: protectedProcedure.input(portfolioIdSchema).mutation(async ({ ctx, input }) => {
      const previous = await getExternalPortfolio(input.id, ctx.user.id) as DatabaseRow | null;
      const previousProjects = await listExternalProjects(input.id, ctx.user.id);
      const query = deletePortfolioQuery(input.id, ctx.user.id);
      const result = await getExternalPostgresPool().query(query.text, [...query.values]);
      requireMutationResult(result.rowCount, "Портфолио не найдено.");
      await deleteUnreferencedExternalImages([previous?.logo_path, previous?.avatar_path, ...previousProjects.flatMap((project) => toJsonArray((project as DatabaseRow).image_paths))], [], ctx.user.id);
      return { success: true } as const;
    }),
    uploadImage: protectedProcedure.input(imageUploadSchema).mutation(({ ctx, input }) => uploadOwnedExternalImage(ctx.user.id, input.portfolioId, {
      kind: input.kind,
      mimeType: input.mimeType,
      base64: input.base64,
    })),
  }),
  projects: router({
    list: protectedProcedure.input(z.object({ portfolioId: uuidSchema, query: z.string().trim().max(100).optional(), page: z.number().int().positive().default(1), pageSize: z.number().int().min(1).max(30).default(12) })).query(async ({ ctx, input }) => {
      await requireExternalPortfolioOwner(input.portfolioId, ctx.user.id);
      const offset = (input.page - 1) * input.pageSize;
      const rows = await listExternalProjects(input.portfolioId, ctx.user.id, input.query || null, input.pageSize, offset);
      const allRows = await listExternalProjects(input.portfolioId, ctx.user.id, input.query || null);
      return { items: await Promise.all(rows.map((row) => toClientProject(row as DatabaseRow, ctx.user.id))), total: allRows.length, page: input.page, pageSize: input.pageSize };
    }),
    get: protectedProcedure.input(projectIdSchema).query(async ({ ctx, input }) => {
      const row = await getExternalProject(input.projectId, input.portfolioId, ctx.user.id);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Проект не найден." });
      return toClientProject(row as DatabaseRow, ctx.user.id);
    }),
    create: protectedProcedure.input(z.object({ portfolioId: uuidSchema, values: externalProjectInputSchema })).mutation(async ({ ctx, input }) => {
      input.values.images.forEach((image) => assertOwnedStorageReference(image, ctx.user.id));
      const query = createProjectQuery(input.portfolioId, ctx.user.id, input.values);
      const result = await getExternalPostgresPool().query(query.text, [...query.values]);
      const row = result.rows[0] as DatabaseRow | undefined;
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Портфолио не найдено." });
      return toClientProject(row, ctx.user.id);
    }),
    update: protectedProcedure.input(projectIdSchema.extend({ values: externalProjectInputSchema })).mutation(async ({ ctx, input }) => {
      const previous = await getExternalProject(input.projectId, input.portfolioId, ctx.user.id) as DatabaseRow | null;
      input.values.images.forEach((image) => assertOwnedStorageReference(image, ctx.user.id));
      const query = updateProjectQuery(input.projectId, input.portfolioId, ctx.user.id, input.values);
      const result = await getExternalPostgresPool().query(query.text, [...query.values]);
      const row = result.rows[0] as DatabaseRow | undefined;
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Проект не найден." });
      await deleteUnreferencedExternalImages(toJsonArray(previous?.image_paths), input.values.images, ctx.user.id);
      return toClientProject(row, ctx.user.id);
    }),
    remove: protectedProcedure.input(projectIdSchema).mutation(async ({ ctx, input }) => {
      const previous = await getExternalProject(input.projectId, input.portfolioId, ctx.user.id) as DatabaseRow | null;
      const query = deleteProjectQuery(input.projectId, input.portfolioId, ctx.user.id);
      const result = await getExternalPostgresPool().query(query.text, [...query.values]);
      requireMutationResult(result.rowCount, "Проект не найден.");
      await deleteUnreferencedExternalImages(toJsonArray(previous?.image_paths), [], ctx.user.id);
      return { success: true } as const;
    }),
    reorder: protectedProcedure.input(z.object({ portfolioId: uuidSchema, ids: z.array(uuidSchema).min(1).max(100).refine((ids) => new Set(ids).size === ids.length, "Каждый проект должен присутствовать один раз.") })).mutation(async ({ ctx, input }) => {
      await requireExternalPortfolioOwner(input.portfolioId, ctx.user.id);
      const pool = getExternalPostgresPool();
      const owned = await pool.query(
        "select id::text from public.portfolio_projects where portfolio_id = $1::uuid order by sort_order asc",
        [input.portfolioId]
      );
      const ownedIds = new Set(owned.rows.map((row) => String(row.id)));
      if (ownedIds.size !== input.ids.length || input.ids.some((id) => !ownedIds.has(id))) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Неверный набор проектов для сортировки." });
      }
      const result = await pool.query(
        "update public.portfolio_projects p set sort_order = source.sort_order from public.portfolios f join unnest($3::uuid[]) with ordinality as source(id, sort_order) on true where p.portfolio_id = $1::uuid and f.id = p.portfolio_id and f.user_id = $2::uuid and p.id = source.id",
        [input.portfolioId, ctx.user.id, input.ids]
      );
      if (result.rowCount !== input.ids.length) throw new TRPCError({ code: "CONFLICT", message: "Не удалось сохранить порядок проектов." });
      return { success: true } as const;
    }),
    uploadImage: protectedProcedure.input(projectImageUploadSchema).mutation(({ ctx, input }) => uploadOwnedExternalImage(ctx.user.id, input.portfolioId, {
      kind: "project",
      mimeType: input.mimeType,
      base64: input.base64,
    })),
  }),
  publicPortfolio: router({
    bySlug: publicProcedure.input(z.object({ slug: z.string().trim().min(3).max(50) })).query(async ({ input }) => {
      const portfolio = await getPublishedExternalPortfolioBySlug(externalSlugify(input.slug));
      if (!portfolio) throw new TRPCError({ code: "NOT_FOUND", message: "Портфолио не найдено." });
      const row = portfolio as DatabaseRow;
      const projects = await listPublishedExternalProjects(String(row.id));
      return toClientPortfolio(row, await Promise.all(projects.map((project) => toClientProject(project as DatabaseRow, String(row.user_id)))));
    }),
  }),
});

export type ExternalAppRouter = typeof externalAppRouter;
