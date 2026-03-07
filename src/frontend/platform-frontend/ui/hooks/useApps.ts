import { useQuery } from "@tanstack/react-query";
import { apiUrl } from "../../core-logic/api";

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
      const res = await fetch(apiUrl("/store/tools"));
      if (!res.ok) throw new Error("Failed to fetch tools");
      const data = await res.json();

      const allTools = [];
      if (data.categories) {
        for (const cat of data.categories) {
          if (cat.tools) {
            allTools.push(...cat.tools);
          }
        }
      } else if (data.featured) {
        allTools.push(...data.featured);
      } else if (data.tools) {
        allTools.push(...data.tools);
      }

      return allTools.map((t: Record<string, unknown>, i: number) => ({
        slug: t.name as string,
        name: t.name as string,
        description: (t.description as string) || "",
        emoji: "🔧",
        tool_count: 1,
        sort_order: i,
        category: (t.category as string) || "general"
      }));
    },
  });
}

export function useApp(slug: string) {
  return useQuery({
    queryKey: ["mcp-app", slug],
    queryFn: async (): Promise<McpAppDetail> => {
      const res = await fetch(apiUrl("/store/tools"));
      if (!res.ok) throw new Error("Failed to fetch tools");
      const data = await res.json();

      let foundTool: Record<string, unknown> | null = null;
      if (data.categories) {
        for (const cat of data.categories) {
          const t = cat.tools?.find((x: Record<string, unknown>) => x.name === slug);
          if (t) foundTool = t;
        }
      }
      if (!foundTool && data.featured) {
        foundTool = data.featured.find((x: Record<string, unknown>) => x.name === slug);
      }
      if (!foundTool && data.tools) {
        foundTool = data.tools.find((x: Record<string, unknown>) => x.name === slug);
      }

      if (!foundTool) throw new Error("Tool not found");

      return {
        slug: foundTool.name as string,
        name: foundTool.name as string,
        description: (foundTool.description as string) || "",
        emoji: "🔧",
        tool_count: 1,
        sort_order: 0,
        status: "live",
        tools: [foundTool.name as string],
        graph: {},
        markdown: `# ${foundTool.name as string}\n\n${(foundTool.description as string) || ""}`
      };
    },
    enabled: !!slug,
  });
}
