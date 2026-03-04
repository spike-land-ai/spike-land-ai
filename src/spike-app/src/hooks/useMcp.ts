import { useQuery, useMutation } from "@tanstack/react-query";

interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties?: Record<string, any>;
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
      const res = await fetch("/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "tools/list",
          id: crypto.randomUUID(),
        }),
      });

      if (!res.ok) throw new Error("Failed to fetch tools");
      
      const json = await res.json();
      if (json.error) throw new Error(json.error.message || "MCP Error");
      
      return json.result;
    },
  });
}

export function useMcpToolCall() {
  return useMutation({
    mutationFn: async ({ name, args }: { name: string; args: Record<string, any> }) => {
      const res = await fetch("/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "tools/call",
          params: { name, arguments: args },
          id: crypto.randomUUID(),
        }),
      });

      if (!res.ok) throw new Error("Tool execution failed");
      
      const json = await res.json();
      if (json.error) throw new Error(json.error.message || "MCP Error");
      
      return json.result;
    },
  });
}
