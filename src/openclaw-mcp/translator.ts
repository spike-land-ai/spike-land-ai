import type { McpCallResult, ToolLike } from "./types.js";

export function createToolExecutor(tools: ToolLike[]) {
  const toolMap = new Map(tools.map((t) => [t.name, t]));

  return {
    listTools: () => tools,
    executeTool: async (name: string, args: Record<string, unknown>): Promise<McpCallResult> => {
      const tool = toolMap.get(name);
      if (!tool) {
        return {
          content: [{ type: "text" as const, text: `Unknown tool: ${name}` }],
          isError: true,
        };
      }
      const result = await tool.execute(`mcp-${Date.now()}`, args);
      return {
        content: result.content.map((c) => ({
          type: "text" as const,
          text: c.text ?? "",
        })),
      };
    },
  };
}
