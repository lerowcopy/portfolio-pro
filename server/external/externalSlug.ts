import { portfolioSlugExistsQuery } from "./portfolioQueries";
import { getExternalPostgresPool } from "./postgres";

const cyrillicMap: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
  х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

const reservedSlugs = new Set(["auth", "dashboard", "api", "login", "signup", "portfolios", "settings", "404"]);

export function externalSlugify(value: string): string {
  const transliterated = value
    .toLowerCase()
    .replace(/[а-яё]/g, (character) => cyrillicMap[character] ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const sanitized = transliterated
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/g, "");

  const fallback = sanitized.length >= 3 ? sanitized : "portfolio";
  return reservedSlugs.has(fallback) ? `${fallback}-portfolio` : fallback;
}

export async function createUniqueExternalSlug(seed: string, excludingPortfolioId?: string): Promise<string> {
  const pool = getExternalPostgresPool();
  const base = externalSlugify(seed);

  for (let suffix = 1; suffix < 10_000; suffix += 1) {
    const suffixText = suffix === 1 ? "" : `-${suffix}`;
    const candidate = `${base.slice(0, 50 - suffixText.length)}${suffixText}`;
    const query = portfolioSlugExistsQuery(candidate, excludingPortfolioId);
    const result = await pool.query(query.text, [...query.values]);
    if (result.rowCount === 0) return candidate;
  }

  throw new Error("Не удалось сформировать уникальный slug.");
}
