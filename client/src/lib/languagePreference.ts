export const supportedLocales = ["en", "ru"] as const;

export type Locale = (typeof supportedLocales)[number];

export const LANGUAGE_STORAGE_KEY = "portfolio-pro.locale";

export function isLocale(value: string | null | undefined): value is Locale {
  return value === "en" || value === "ru";
}

export function resolveLocale(storedLocale?: string | null, browserLocale?: string): Locale {
  if (isLocale(storedLocale)) return storedLocale;
  return browserLocale?.toLowerCase().startsWith("ru") ? "ru" : "en";
}
