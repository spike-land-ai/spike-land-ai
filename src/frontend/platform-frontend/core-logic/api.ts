const isDev = import.meta.env.DEV;
const chatBaseEnv = import.meta.env.VITE_CHAT_BASE_URL;

export const API_BASE = isDev ? "" : "https://api.spike.land";
export const MCP_BASE = isDev ? "" : "https://mcp.spike.land";

export function resolveChatBase(dev: boolean, configuredBase?: string): string {
  if (dev) return "";
  return configuredBase?.trim() ?? "";
}

export function toWebSocketBase(httpBase: string): string {
  const url = new URL(httpBase);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString().replace(/\/$/, "");
}

export const CHAT_BASE = resolveChatBase(isDev, chatBaseEnv);
export const CHAT_ENABLED = isDev || CHAT_BASE.length > 0;

export function apiUrl(path: string): string {
  return `${API_BASE}/api${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Fetch wrapper for authenticated API calls.
 * Always sends credentials (cookies) so cross-origin requests to api.spike.land work.
 */
export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(apiUrl(path), { credentials: "include", ...init });
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
  if (isDev) {
    // /mcp is the streamable HTTP endpoint — don't double-prefix
    if (normalized === "/mcp") return "/mcp";
    return `/mcp${normalized}`;
  }
  return `${MCP_BASE}${normalized}`;
}

/** Build a URL for the spike-chat service. */
export function chatUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (isDev) return `/chat${normalized}`;
  if (!CHAT_BASE) return "";
  return `${CHAT_BASE}${normalized}`;
}

/** Build a WebSocket URL for the spike-chat service. */
export function chatWsUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (isDev) {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}/chat${normalized}`;
  }
  if (!CHAT_BASE) return "";
  return `${toWebSocketBase(CHAT_BASE)}${normalized}`;
}
