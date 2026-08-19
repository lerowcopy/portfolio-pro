import { and, eq, ne } from "drizzle-orm";
import { portfolios } from "../drizzle/schema";
import { getDb } from "./db";

const CYRILLIC_MAP: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
  х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

const RESERVED_SLUGS = new Set(["auth", "dashboard", "api", "login", "signup", "portfolios", "settings", "404"]);

export function slugify(value: string): string {
  const transliterated = value
    .toLowerCase()
    .replace(/[а-яё]/g, (character) => CYRILLIC_MAP[character] ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const sanitized = transliterated
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/g, "");

  const fallback = sanitized.length >= 3 ? sanitized : "portfolio";
  return RESERVED_SLUGS.has(fallback) ? `${fallback}-portfolio` : fallback;
}

export async function createUniqueSlug(seed: string, excludingPortfolioId?: number): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const base = slugify(seed);
  for (let suffix = 1; suffix < 10_000; suffix += 1) {
    const candidate = suffix === 1 ? base : `${base.slice(0, 50 - (`-${suffix}`).length)}-${suffix}`;
    const condition = excludingPortfolioId
      ? and(eq(portfolios.slug, candidate), ne(portfolios.id, excludingPortfolioId))
      : eq(portfolios.slug, candidate);
    const result = await db.select({ id: portfolios.id }).from(portfolios).where(condition).limit(1);
    if (result.length === 0) return candidate;
  }
  throw new Error("Unable to allocate a unique portfolio slug");
}

export function hasValidImageSignature(buffer: Buffer, mimeType: string): boolean {
  const jpeg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const png = buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const webp = buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  return (mimeType === "image/jpeg" && jpeg) || (mimeType === "image/png" && png) || (mimeType === "image/webp" && webp);
}
