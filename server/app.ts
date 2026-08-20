import express, { type Express } from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import type { Server } from "http";
import { and, eq } from "drizzle-orm";
import { portfolios } from "../drizzle/schema";
import { registerOAuthRoutes } from "./_core/oauth";
import { registerStorageProxy } from "./_core/storageProxy";
import { createContext } from "./_core/context";
import { createExternalFoundationContext } from "./external/context";
import { serveStatic, setupVite } from "./_core/vite";
import { getDb } from "./db";
import { slugify } from "./portfolio";
import { appRouter } from "./routers";

export type ApplicationRuntime = "manus" | "external";

export type CreatePortfolioAppOptions = {
  runtime: ApplicationRuntime;
  serveFrontend: boolean;
  server?: Server;
};

const PUBLIC_ROUTE_RESERVED = new Set([
  "dashboard",
  "auth",
  "api",
  "404",
  "assets",
  "manus-storage",
  "login",
  "signup",
  "pricing",
  "settings",
  "terms",
  "privacy",
  "favicon",
  "templates",
  "healthz",
]);

function isPublicSlugCandidate(slug: string): boolean {
  return /^[a-zA-Z0-9-]{3,50}$/.test(slug) && !PUBLIC_ROUTE_RESERVED.has(slug.toLowerCase());
}

function sendPublicNotFound(res: express.Response): void {
  res.status(404).type("html").send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Portfolio not found — Portfolio Pro</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#090a0f;color:#fff;font-family:ui-sans-serif,system-ui,sans-serif}main{max-width:36rem;padding:2.5rem;text-align:center}p{color:#aeb5c7;line-height:1.65}a{display:inline-block;margin-top:1.4rem;border-radius:999px;background:#fff;padding:.75rem 1.1rem;color:#111;text-decoration:none;font-weight:700}</style></head><body><main><p style="color:#c4b5fd;font-size:.72rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase">404</p><h1 style="font-family:Georgia,serif;font-size:clamp(2.6rem,7vw,4.4rem);letter-spacing:-.06em;margin:.8rem 0">This page is private.</h1><p>It may have moved, or its maker has chosen not to publish it yet.</p><a href="/">Visit Portfolio Pro</a></main></body></html>`);
}

/**
 * Собирает Express application без запуска TCP listener.
 * Manus-specific routes подключаются только в текущем managed runtime.
 */
export async function createPortfolioApp(options: CreatePortfolioAppOptions): Promise<Express> {
  const app = express();
  app.disable("x-powered-by");

  app.get("/healthz", (_req, res) => {
    res.status(200).json({ ok: true, runtime: options.runtime });
  });

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  if (options.runtime === "manus") {
    registerStorageProxy(app);
    registerOAuthRoutes(app);
  }

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext: options.runtime === "manus" ? createContext : createExternalFoundationContext,
    })
  );

  // Проверка выполняется до SPA fallback, чтобы draft и неизвестный slug отдавали HTTP 404.
  app.get("/:slug", async (req, res, next) => {
    const slug = req.params.slug;
    if (!isPublicSlugCandidate(slug)) return next();

    try {
      const db = await getDb();
      if (!db) return next();
      const result = await db
        .select({ id: portfolios.id })
        .from(portfolios)
        .where(and(eq(portfolios.slug, slugify(slug)), eq(portfolios.isPublished, 1)))
        .limit(1);

      if (result.length === 0) return sendPublicNotFound(res);
      return next();
    } catch (error) {
      return next(error);
    }
  });

  if (!options.serveFrontend) {
    app.use((_req, res) => {
      res.status(404).json({ error: "Not found" });
    });
    return app;
  }

  if (process.env.NODE_ENV === "development") {
    if (!options.server) {
      throw new Error("An HTTP server is required when Vite development middleware is enabled");
    }
    await setupVite(app, options.server);
  } else {
    serveStatic(app);
  }

  return app;
}
