import { useQuery } from "@tanstack/react-query";

const API_BASE = import.meta.env.DEV
  ? "https://local.spike.land:8787/api"
  : "https://spike.land/api";

export interface McpAppSummary {
  slug: string;
  name: string;
  description: string;
  emoji: string;
  tool_count: number;
  sort_order: number;
}

export interface McpAppDetail extends McpAppSummary {
  status: string;
  tools: string[];
  graph: Record<string, unknown>;
  markdown: string;
}

export function useApps() {
  return useQuery({
    queryKey: ["mcp-apps"],
    queryFn: async (): Promise<McpAppSummary[]> => {
      const res = await fetch(`${API_BASE}/apps`);
      if (!res.ok) throw new Error("Failed to fetch apps");
      const data = await res.json();
      return data.apps || [];
    },
  });
}

export function useApp(slug: string) {
  return useQuery({
    queryKey: ["mcp-app", slug],
    queryFn: async (): Promise<McpAppDetail> => {
      const res = await fetch(`${API_BASE}/apps/${slug}`);
      if (!res.ok) throw new Error("Failed to fetch app");
      return res.json();
    },
    enabled: !!slug,
  });
}
