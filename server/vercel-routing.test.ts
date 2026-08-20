import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(import.meta.dirname, "..");

describe("Vercel SPA and API routing contract", () => {
  it("keeps the Railway proxy as a filesystem API route before the SPA fallback", async () => {
    const [config, apiRoute] = await Promise.all([
      readFile(path.join(projectRoot, "vercel.json"), "utf8"),
      access(path.join(projectRoot, "api", "trpc", "[...path].ts")),
    ]);
    const parsed = JSON.parse(config) as { outputDirectory?: string; rewrites?: Array<{ source: string; destination: string }> };
    expect(apiRoute).toBeUndefined();
    expect(parsed.outputDirectory).toBe("dist/public");
    expect(parsed.rewrites).toEqual([{ source: "/((?!api(?:/|$)).*)", destination: "/index.html" }]);
  });
});
