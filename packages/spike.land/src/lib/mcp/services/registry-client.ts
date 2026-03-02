import {
  GLAMA_API_BASE,
  MCP_REGISTRY_CACHE_PREFIX,
  MCP_REGISTRY_CACHE_TTL,
  OFFICIAL_MCP_REGISTRY_BASE,
  SMITHERY_API_BASE,
} from "../constants";
import { redis } from "@/lib/upstash/client";

export interface McpServerInfo {
  id: string;
  name: string;
  description: string;
  source: "smithery" | "official" | "glama";
  url: string;
  transport: "stdio" | "sse" | "streamable-http";
  envVarsRequired: string[];
  installCommand?: string;
  homepage?: string;
  stars?: number;
}

function cacheKey(...parts: string[]): string {
  return `${MCP_REGISTRY_CACHE_PREFIX}${parts.join(":")}`;
}

async function getCached<T>(key: string): Promise<T | null> {
  return redis.get<T>(key);
}

async function setCached<T>(key: string, value: T): Promise<void> {
  await redis.set(key, value, { ex: MCP_REGISTRY_CACHE_TTL });
}

export async function searchSmithery(query: string, limit: number): Promise<McpServerInfo[]> {
  const key = cacheKey("smithery", query, String(limit));
  const cached = await getCached<McpServerInfo[]>(key);
  if (cached) return cached;

  const apiKey = process.env.SMITHERY_API_KEY;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const url = `${SMITHERY_API_BASE}/servers?q=${encodeURIComponent(query)}&limit=${limit}`;
  let data;
  try {
    const response = await fetch(url, { headers });
    if (!response.ok) return [];

    data = (await response.json()) as {
      servers?: Array<{
        qualifiedName: string;
        displayName: string;
        description: string;
        homepage?: string;
        connections?: Array<{ type: string }>;
      }>;
    };
  } catch {
    return [];
  }
  const results = (data.servers ?? []).map((s) => ({
    id: s.qualifiedName,
    name: s.displayName,
    description: s.description ?? "",
    source: "smithery" as const,
    url: `https://smithery.ai/server/${s.qualifiedName}`,
    transport: (s.connections?.[0]?.type as "stdio" | "sse" | "streamable-http") ?? "stdio",
    envVarsRequired: [],
    ...(s.homepage !== undefined ? { homepage: s.homepage } : {}),
  }));

  await setCached(key, results);
  return results;
}

export async function searchOfficialRegistry(
  query: string,
  limit: number,
): Promise<McpServerInfo[]> {
  const key = cacheKey("official", query, String(limit));
  const cached = await getCached<McpServerInfo[]>(key);
  if (cached) return cached;

  const url = `${OFFICIAL_MCP_REGISTRY_BASE}?q=${encodeURIComponent(query)}&count=${limit}`;
  let data;
  try {
    const response = await fetch(url);
    if (!response.ok) return [];

    data = (await response.json()) as {
      servers?: Array<{
        id: string;
        name: string;
        description: string;
        url?: string;
        transport?: string;
      }>;
    };
  } catch {
    return [];
  }
  const results = (data.servers ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description ?? "",
    source: "official" as const,
    url: s.url ?? "",
    transport: (s.transport as "stdio" | "sse" | "streamable-http") ?? "stdio",
    envVarsRequired: [],
  }));

  await setCached(key, results);
  return results;
}

export async function searchGlama(query: string, limit: number): Promise<McpServerInfo[]> {
  const key = cacheKey("glama", query, String(limit));
  const cached = await getCached<McpServerInfo[]>(key);
  if (cached) return cached;

  const url = `${GLAMA_API_BASE}?search=${encodeURIComponent(query)}&limit=${limit}`;
  let data;
  try {
    const response = await fetch(url);
    if (!response.ok) return [];

    data = (await response.json()) as {
      servers?: Array<{
        id: string;
        name: string;
        description: string;
        url?: string;
        transport?: string;
        stars?: number;
      }>;
    };
  } catch {
    return [];
  }
  const results = (data.servers ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description ?? "",
    source: "glama" as const,
    url: s.url ?? "",
    transport: (s.transport as "stdio" | "sse" | "streamable-http") ?? "stdio",
    envVarsRequired: [],
    ...(s.stars !== undefined ? { stars: s.stars } : {}),
  }));

  await setCached(key, results);
  return results;
}

export async function searchAllRegistries(query: string, limit: number): Promise<McpServerInfo[]> {
  const [smithery, official, glama] = await Promise.allSettled([
    searchSmithery(query, limit),
    searchOfficialRegistry(query, limit),
    searchGlama(query, limit),
  ]);

  const results: McpServerInfo[] = [];
  if (smithery.status === "fulfilled") results.push(...smithery.value);
  if (official.status === "fulfilled") results.push(...official.value);
  if (glama.status === "fulfilled") results.push(...glama.value);

  // Deduplicate by name (case-insensitive)
  const seen = new Map<string, McpServerInfo>();
  for (const server of results) {
    const k = server.name.toLowerCase();
    if (!seen.has(k)) seen.set(k, server);
  }

  return Array.from(seen.values()).slice(0, limit);
}
