import { date, index, int, json, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";
import type { SocialPlatform } from "../shared/portfolio";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const portfolioTemplates = ["minimal", "gallery", "cards", "blog", "creative", "agency", "showcase"] as const;
export const portfolioColorSchemes = ["blue", "dark", "purple", "green", "warm"] as const;
export const portfolioFontFamilies = ["inter", "playfair", "georgia"] as const;

export type StoredSocialLink = { id: string; platform: SocialPlatform; url: string };
export type StoredProject = { id: string; title: string; description: string; images: string[]; tags: string[]; year: string; href?: string };
export type StoredService = { id: string; title: string; description: string };
export type StoredPost = { id: string; title: string; excerpt: string; date: string; href?: string };

/** User-owned publishable portfolio. All URL and visual state is stored separately from file bytes. */
export const portfolios = mysqlTable("portfolios", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 120 }).notNull(),
  bio: text("bio").notNull(),
  logoUrl: varchar("logoUrl", { length: 1000 }),
  avatarUrl: varchar("avatarUrl", { length: 1000 }),
  socialLinks: json("socialLinks").$type<StoredSocialLink[]>().notNull(),
  template: mysqlEnum("template", portfolioTemplates).notNull().default("minimal"),
  colorScheme: mysqlEnum("colorScheme", portfolioColorSchemes).notNull().default("blue"),
  fontFamily: mysqlEnum("fontFamily", portfolioFontFamilies).notNull().default("inter"),
  projects: json("projects").$type<StoredProject[]>(),
  services: json("services").$type<StoredService[]>(),
  posts: json("posts").$type<StoredPost[]>(),
  contactEmail: varchar("contactEmail", { length: 320 }),
  isPublished: int("isPublished").notNull().default(0),
  publishedAt: timestamp("publishedAt"),
  slug: varchar("slug", { length: 50 }).notNull(),
  slugManuallyEdited: int("slugManuallyEdited").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("portfolios_slug_unique").on(table.slug),
  index("portfolios_owner_updated_idx").on(table.userId, table.updatedAt),
  index("portfolios_public_slug_idx").on(table.isPublished, table.slug),
]);

export type Portfolio = typeof portfolios.$inferSelect;
export type InsertPortfolio = typeof portfolios.$inferInsert;

/** Normalized project records; image bytes are stored in managed S3, and only URLs live here. */
export const portfolioProjects = mysqlTable("portfolio_projects", {
  id: int("id").autoincrement().primaryKey(),
  portfolioId: int("portfolioId").notNull().references(() => portfolios.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 100 }).notNull(),
  description: varchar("description", { length: 1000 }).notNull(),
  images: json("images").$type<string[]>().notNull(),
  projectUrl: varchar("projectUrl", { length: 500 }),
  tags: json("tags").$type<string[]>().notNull(),
  startDate: date("startDate"),
  endDate: date("endDate"),
  sortOrder: int("sortOrder").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("portfolio_projects_portfolio_order_idx").on(table.portfolioId, table.sortOrder),
  index("portfolio_projects_portfolio_created_idx").on(table.portfolioId, table.createdAt),
]);

export type PortfolioProject = typeof portfolioProjects.$inferSelect;
export type InsertPortfolioProject = typeof portfolioProjects.$inferInsert;
