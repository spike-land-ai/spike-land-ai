import { useQuery, useMutation } from "@tanstack/react-query";
import { mcpUrl } from "../../../core-logic/api";
import { callMcpTool } from "../../../core-logic/mcp-client";

interface McpTool {
  name: string;
  description: string;
  category: string;
  inputSchema: {
    type: "object";
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

interface ToolsListResponse {
  tools: McpTool[];
}

export function useMcpTools() {
  return useQuery({
    queryKey: ["mcp", "tools", "list"],
    queryFn: async (): Promise<ToolsListResponse> => {
      const res = await fetch(mcpUrl("/tools"));

      if (!res.ok) throw new Error("Failed to fetch tools");

      return res.json();
    },
  });
}

export function useMcpToolCall() {
  return useMutation({
    mutationFn: async ({ name, args }: { name: string; args: Record<string, unknown> }) => {
      return callMcpTool(name, args);
    },
  });
}
