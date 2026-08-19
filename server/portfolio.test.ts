import { describe, expect, it } from "vitest";
import { hasValidImageSignature, slugify } from "./portfolio";

describe("slugify", () => {
  it("транслитерирует кириллицу до server-side sanitization", () => {
    expect(slugify("Портфолио Анны Ёлкиной")).toBe("portfolio-anny-elkinoy");
  });

  it("sanitizes unsafe symbols and uses a stable fallback", () => {
    expect(slugify("  Hello, world!  ")).toBe("hello-world");
    expect(slugify("@@")).toBe("portfolio");
  });

  it("does not allocate reserved system paths", () => {
    expect(slugify("dashboard")).toBe("dashboard-portfolio");
  });
});

describe("hasValidImageSignature", () => {
  it("accepts valid image signatures only when MIME type agrees", () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    expect(hasValidImageSignature(png, "image/png")).toBe(true);
    expect(hasValidImageSignature(png, "image/jpeg")).toBe(false);
  });

  it("rejects arbitrary data even if the client reports an image MIME type", () => {
    expect(hasValidImageSignature(Buffer.from("not-an-image"), "image/webp")).toBe(false);
  });
});
