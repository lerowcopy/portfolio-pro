import { describe, expect, it, vi } from "vitest";
import railwayTrpcProxy, { readRailwayApiUrl } from "../api/trpc/[...path]";

function createResponse() {
  const headers = new Map<string, string>();
  let body = Buffer.alloc(0);
  return {
    statusCode: 200,
    setHeader: vi.fn((name: string, value: string) => headers.set(name, value)),
    end: vi.fn((value: Buffer) => { body = value; }),
    result: () => ({ headers, body }),
  };
}

describe("Vercel Railway tRPC proxy", () => {
  it("accepts only an HTTPS Railway deployment URL", () => {
    expect(readRailwayApiUrl({ RAILWAY_API_URL: "https://portfolio-api.up.railway.app/" })).toBe("https://portfolio-api.up.railway.app");
    expect(() => readRailwayApiUrl({ RAILWAY_API_URL: "http://localhost:3000" })).toThrow(/RAILWAY_API_URL/);
  });

  it("forwards a bearer-authenticated tRPC request without caching upstream output", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ result: { data: { json: { ok: true } } } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    const previousUrl = process.env.RAILWAY_API_URL;
    process.env.RAILWAY_API_URL = "https://portfolio-api.up.railway.app";
    const response = createResponse();
    const request = {
      method: "GET",
      url: "/api/trpc/system.health?input=%7B%22json%22%3Anull%7D",
      headers: { authorization: "Bearer access-token", host: "portfolio-pro.vercel.app", cookie: "must-not-reach-railway=true" },
    } as never;

    await railwayTrpcProxy(request, response as never);

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("https://portfolio-api.up.railway.app/api/trpc/system.health"), expect.objectContaining({
      headers: expect.any(Headers),
    }));
    const forwardedHeaders = fetchMock.mock.calls[0]?.[1]?.headers as Headers;
    expect(forwardedHeaders.get("authorization")).toBe("Bearer access-token");
    expect(forwardedHeaders.get("cookie")).toBeNull();
    expect(response.statusCode).toBe(200);
    expect(response.result().headers.get("cache-control")).toBe("no-store");
    expect(response.result().body.toString("utf8")).toContain("ok");
    process.env.RAILWAY_API_URL = previousUrl;
    fetchMock.mockRestore();
  });

  it("returns a generic error when a request exceeds the proxy body limit", async () => {
    const response = createResponse();
    const previousUrl = process.env.RAILWAY_API_URL;
    process.env.RAILWAY_API_URL = "https://portfolio-api.up.railway.app";
    await railwayTrpcProxy({ method: "POST", url: "/api/trpc/portfolios.uploadImage", headers: {}, body: "x".repeat(8 * 1024 * 1024 + 1) } as never, response as never);
    expect(response.statusCode).toBe(502);
    expect(response.result().body.toString("utf8")).toBe(JSON.stringify({ error: "External API is temporarily unavailable" }));
    process.env.RAILWAY_API_URL = previousUrl;
  });
});
