/**
 * Shared base URL resolver for MCP OAuth endpoints.
 *
 * Priority: production environment always wins to prevent
 * preview/build-time URLs from leaking into OAuth discovery metadata.
 */
export function getMcpBaseUrl(): string {
  if (process.env.APP_ENV === "production") return "https://spike.land";
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  return "https://spike.land";
}
