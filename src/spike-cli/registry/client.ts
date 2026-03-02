/**
 * Registry client — search and fetch MCP server entries from spike.land.
 */

export interface RegistryServer {
  id: string;
  name: string;
  description: string;
  url?: string;
  command?: string;
  args?: string[];
  tags?: string[];
}

export async function searchRegistry(
  query: string,
  baseUrl: string,
  token: string,
): Promise<RegistryServer[]> {
  const res = await fetch(`${baseUrl}/api/mcp/registry/search?q=${encodeURIComponent(query)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`Registry search failed: ${res.status} ${res.statusText}`);
  }

  return (await res.json()) as RegistryServer[];
}

export async function getRegistryServer(
  id: string,
  baseUrl: string,
  token: string,
): Promise<RegistryServer | null> {
  const res = await fetch(`${baseUrl}/api/mcp/registry/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 404) return null;

  if (!res.ok) {
    throw new Error(`Registry fetch failed: ${res.status} ${res.statusText}`);
  }

  return (await res.json()) as RegistryServer;
}
