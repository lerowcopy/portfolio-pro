import { describe, expect, it } from "vitest";
import { createExternalStoragePath, parseOwnedExternalStoragePath, readExternalStorageConfig } from "./supabaseStorage";

const userId = "550e8400-e29b-41d4-a716-446655440000";
const otherUserId = "550e8400-e29b-41d4-a716-446655440001";

describe("external Supabase Storage contract", () => {
  it("accepts only a server-only storage credential", () => {
    expect(readExternalStorageConfig({ SUPABASE_URL: "https://example.supabase.co", SUPABASE_SECRET_KEY: "sb_secret_abc" })).toEqual({
      url: "https://example.supabase.co",
      secretKey: "sb_secret_abc",
    });
    expect(() => readExternalStorageConfig({ SUPABASE_URL: "https://example.supabase.co", SUPABASE_PUBLISHABLE_KEY: "sb_publishable_abc" })).toThrow(/server-only/);
  });

  it("creates a UUID-scoped opaque path for a permitted bucket", () => {
    const path = createExternalStoragePath(userId, "avatar", "image/png");
    expect(path).toMatch(new RegExp(`^storage://portfolio-avatars/${userId}/[0-9a-f-]+\\.png$`));
  });

  it("rejects cross-user and malformed opaque paths", () => {
    const path = `storage://portfolio-logos/${userId}/a0b1c2d3-e4f5-6789-a0b1-c2d3e4f56789.webp`;
    expect(parseOwnedExternalStoragePath(path, userId)).toEqual({ bucket: "portfolio-logos", objectPath: `${userId}/a0b1c2d3-e4f5-6789-a0b1-c2d3e4f56789.webp` });
    expect(() => parseOwnedExternalStoragePath(path, otherUserId)).toThrow(/Недопустимый/);
    expect(() => parseOwnedExternalStoragePath("https://example.com/logo.png", userId)).toThrow(/Недопустимый/);
  });
});
