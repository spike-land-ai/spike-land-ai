const isProd = import.meta.env.PROD;

export const API_BASE = isProd ? "https://api.spike.land" : "";
export const MCP_BASE = isProd ? "https://mcp.spike.land" : "";

export function apiUrl(path: string): string {
  return `${API_BASE}/api${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Build a URL for the MCP service.
 *
 * Dev mode proxies through spike-edge (vite proxy → spike.land):
 *   /mcp/tools → spike.land/mcp/tools → mcp.spike.land/tools
 *   /mcp       → spike.land/mcp       → mcp.spike.land/mcp
 *
 * Prod mode talks directly to mcp.spike.land:
 *   https://mcp.spike.land/tools
 *   https://mcp.spike.land/mcp
 */
export function mcpUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (!isProd) {
    // /mcp is the streamable HTTP endpoint — don't double-prefix
    if (normalized === "/mcp") return "/mcp";
    return `/mcp${normalized}`;
  }
  return `${MCP_BASE}${normalized}`;
}
