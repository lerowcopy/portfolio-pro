import { describe, expect, it } from "vitest";
import { isLocale, resolveLocale } from "./languagePreference";

describe("languagePreference", () => {
  it("accepts only supported UI locales", () => {
    expect(isLocale("ru")).toBe(true);
    expect(isLocale("en")).toBe(true);
    expect(isLocale("de")).toBe(false);
    expect(isLocale(null)).toBe(false);
  });

  it("prioritizes a stored supported locale", () => {
    expect(resolveLocale("en", "ru-RU")).toBe("en");
  });

  it("uses the Russian browser locale when no supported preference is stored", () => {
    expect(resolveLocale(undefined, "ru-RU")).toBe("ru");
  });

  it("uses English as a stable fallback locale", () => {
    expect(resolveLocale("unsupported", "de-DE")).toBe("en");
  });
});
