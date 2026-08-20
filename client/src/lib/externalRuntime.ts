export const isExternalRuntime = import.meta.env.VITE_EXTERNAL_RUNTIME === "true";

export function getExternalTrpcUrl(): string {
  const configuredUrl = import.meta.env.VITE_API_URL?.trim();
  if (!configuredUrl) return "/api/trpc";
  return `${configuredUrl.replace(/\/$/, "")}/api/trpc`;
}
