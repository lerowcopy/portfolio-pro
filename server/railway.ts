import "dotenv/config";
import { createServer } from "http";
import { createPortfolioApp } from "./app";

function readPort(): number {
  const rawPort = process.env.PORT ?? "3000";
  const port = Number.parseInt(rawPort, 10);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer from 1 to 65535");
  }

  return port;
}

async function startRailwayServer(): Promise<void> {
  const app = await createPortfolioApp({
    runtime: "external",
    serveFrontend: false,
  });
  const server = createServer(app);
  const port = readPort();

  server.listen(port, () => {
    console.log(`Railway API foundation listening on port ${port}`);
  });
}

startRailwayServer().catch((error: unknown) => {
  console.error("Railway API foundation failed to start", error);
  process.exitCode = 1;
});
