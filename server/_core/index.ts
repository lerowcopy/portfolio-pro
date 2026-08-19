import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { and, eq } from "drizzle-orm";
import { portfolios } from "../../drizzle/schema";
import { getDb } from "../db";
import { slugify } from "../portfolio";

const PUBLIC_ROUTE_RESERVED = new Set(["dashboard", "auth", "api", "404", "assets", "manus-storage", "login", "signup", "pricing", "settings", "terms", "privacy", "favicon", "templates"]);

function isPublicSlugCandidate(slug: string): boolean {
  return /^[a-zA-Z0-9-]{3,50}$/.test(slug) && !PUBLIC_ROUTE_RESERVED.has(slug.toLowerCase());
}

function sendPublicNotFound(res: express.Response): void {
  res.status(404).type("html").send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Portfolio not found — Portfolio Pro</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#090a0f;color:#fff;font-family:ui-sans-serif,system-ui,sans-serif}main{max-width:36rem;padding:2.5rem;text-align:center}p{color:#aeb5c7;line-height:1.65}a{display:inline-block;margin-top:1.4rem;border-radius:999px;background:#fff;padding:.75rem 1.1rem;color:#111;text-decoration:none;font-weight:700}</style></head><body><main><p style="color:#c4b5fd;font-size:.72rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase">404</p><h1 style="font-family:Georgia,serif;font-size:clamp(2.6rem,7vw,4.4rem);letter-spacing:-.06em;margin:.8rem 0">This page is private.</h1><p>It may have moved, or its maker has chosen not to publish it yet.</p><a href="/">Visit Portfolio Pro</a></main></body></html>`);
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // This check runs before the SPA fallback. Public pages still render through React,
  // while an unknown or unpublished direct navigation receives a genuine 404 response.
  app.get("/:slug", async (req, res, next) => {
    const slug = req.params.slug;
    if (!isPublicSlugCandidate(slug)) return next();

    try {
      const db = await getDb();
      if (!db) return next(); // A transient DB outage must not be disguised as 404.
      const result = await db.select({ id: portfolios.id }).from(portfolios).where(and(eq(portfolios.slug, slugify(slug)), eq(portfolios.isPublished, 1))).limit(1);
      if (result.length === 0) return sendPublicNotFound(res);
      return next();
    } catch (error) {
      return next(error);
    }
  });
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
