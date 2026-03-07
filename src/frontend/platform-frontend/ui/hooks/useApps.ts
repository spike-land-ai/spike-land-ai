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

interface ToolEntry {
  name: string;
  description?: string;
  category?: string;
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
      
      return allTools.map((t: ToolEntry, i: number) => ({
        slug: t.name,
        name: t.name,
        description: t.description || "",
        emoji: "🔧",
        tool_count: 1,
        sort_order: i,
        category: t.category || "general"
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
      
      let foundTool = null;
      if (data.categories) {
        for (const cat of data.categories) {
          const t = cat.tools?.find((x: ToolEntry) => x.name === slug);
          if (t) foundTool = t;
        }
      }
      if (!foundTool && data.featured) {
        foundTool = data.featured.find((x: ToolEntry) => x.name === slug);
      }
      if (!foundTool && data.tools) {
        foundTool = data.tools.find((x: ToolEntry) => x.name === slug);
      }
      
      if (!foundTool) throw new Error("Tool not found");

      return {
        slug: foundTool.name,
        name: foundTool.name,
        description: foundTool.description || "",
        emoji: "🔧",
        tool_count: 1,
        sort_order: 0,
        status: "live",
        tools: [foundTool.name],
        graph: {},
        markdown: `# ${foundTool.name}\n\n${foundTool.description || ""}`
      };
    },
    enabled: !!slug,
  });
}
