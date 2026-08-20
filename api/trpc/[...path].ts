import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from "node:http";

type VercelRequest = IncomingMessage & { body?: unknown };
const MAX_PROXY_BODY_BYTES = 8 * 1024 * 1024;
const FORWARDED_HEADERS = new Set(["accept", "authorization", "content-type", "trpc-accept", "x-trpc-source"]);

export function readRailwayApiUrl(env: NodeJS.ProcessEnv = process.env): string {
  const value = env.RAILWAY_API_URL?.trim();
  if (!value || !/^https:\/\/[a-z0-9.-]+(?:\.up\.railway\.app|\.railway\.app)\/?$/i.test(value)) {
    throw new Error("RAILWAY_API_URL must be a valid HTTPS Railway deployment URL");
  }
  return value.replace(/\/$/, "");
}

function forwardRequestHeaders(headers: IncomingHttpHeaders): Headers {
  const forwarded = new Headers();
  for (const [name, value] of Object.entries(headers)) {
    if (!value || !FORWARDED_HEADERS.has(name.toLowerCase())) continue;
    forwarded.set(name, Array.isArray(value) ? value.join(",") : value);
  }
  return forwarded;
}

async function readRequestBody(request: VercelRequest): Promise<Uint8Array | undefined> {
  if (["GET", "HEAD"].includes(request.method ?? "GET")) return undefined;
  if (request.body !== undefined) {
    const encoded = new TextEncoder().encode(typeof request.body === "string" ? request.body : JSON.stringify(request.body));
    if (encoded.byteLength > MAX_PROXY_BODY_BYTES) throw new Error("Request body exceeds the external API limit");
    return encoded;
  }
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += bytes.byteLength;
    if (totalBytes > MAX_PROXY_BODY_BYTES) throw new Error("Request body exceeds the external API limit");
    chunks.push(bytes);
  }
  return Buffer.concat(chunks);
}

export default async function railwayTrpcProxy(request: VercelRequest, response: ServerResponse): Promise<void> {
  try {
    const railwayUrl = readRailwayApiUrl();
    const requestPath = request.url ?? "/api/trpc";
    if (!requestPath.startsWith("/api/trpc")) throw new Error("Unexpected API proxy path");
    const upstream = await fetch(`${railwayUrl}${requestPath}`, {
      method: request.method,
      headers: forwardRequestHeaders(request.headers),
      body: await readRequestBody(request),
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });

    response.statusCode = upstream.status;
    for (const [name, value] of upstream.headers.entries()) {
      if (!["connection", "content-encoding", "content-length", "transfer-encoding"].includes(name.toLowerCase())) response.setHeader(name, value);
    }
    response.setHeader("cache-control", "no-store");
    response.end(Buffer.from(await upstream.arrayBuffer()));
  } catch {
    response.statusCode = 502;
    response.setHeader("content-type", "application/json; charset=utf-8");
    response.setHeader("cache-control", "no-store");
    response.end(JSON.stringify({ error: "External API is temporarily unavailable" }));
  }
}
