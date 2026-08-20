import type { Server } from "http";
import type { AddressInfo } from "net";
import { afterEach, describe, expect, it } from "vitest";
import { createPortfolioApp } from "./app";

const openServers: Server[] = [];

afterEach(async () => {
  await Promise.all(
    openServers.splice(0).map(
      server =>
        new Promise<void>((resolve, reject) => {
          server.close(error => (error ? reject(error) : resolve()));
        })
    )
  );
});

async function startExternalFoundation(): Promise<string> {
  const app = await createPortfolioApp({ runtime: "external", serveFrontend: false });
  const server = app.listen(0);
  openServers.push(server);

  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

describe("external runtime foundation", () => {
  it("exposes a health endpoint without enabling Manus routes", async () => {
    const origin = await startExternalFoundation();

    const health = await fetch(`${origin}/healthz`);
    expect(health.status).toBe(200);
    await expect(health.json()).resolves.toEqual({ ok: true, runtime: "external" });

    const oauth = await fetch(`${origin}/api/oauth/callback`);
    expect(oauth.status).toBe(404);
  });
});
