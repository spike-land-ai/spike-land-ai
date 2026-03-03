import type {
  CallToolResult,
  ImageStudioDeps,
  ImageStudioToolRegistry,
} from "@spike-land-ai/mcp-image-studio";
import { registerImageStudioTools } from "@spike-land-ai/mcp-image-studio/register";

interface StoredTool {
  name: string;
  description: string;
  category: string;
  tier: string;
  inputSchema?: Record<string, unknown>;
  handler: (input: unknown) => Promise<CallToolResult> | CallToolResult;
}

export function createToolRegistry(userId: string, deps: ImageStudioDeps) {
  const tools = new Map<string, StoredTool>();

  const registry: ImageStudioToolRegistry = {
    register(def) {
      const d = def as unknown as StoredTool;
      tools.set(d.name, {
        name: d.name,
        description: d.description,
        category: d.category ?? "general",
        tier: d.tier ?? "free",
        inputSchema: d.inputSchema as Record<string, unknown> | undefined,
        handler: d.handler as (input: unknown) => Promise<CallToolResult> | CallToolResult,
      });
    },
  };

  registerImageStudioTools(registry, userId, deps);

  return {
    list(): Array<{
      name: string;
      description: string;
      category: string;
      tier: string;
      inputSchema?: Record<string, unknown>;
    }> {
      return Array.from(tools.values()).map(({ handler: _, ...rest }) => rest);
    },
    async call(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
      const tool = tools.get(name);
      if (!tool) {
        return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
      }

      const startTime = Date.now();
      let result: CallToolResult;
      let isError = false;
      let callId: string | undefined;

      // Log immediately as PENDING
      if (deps.db.toolCallCreate) {
        try {
          callId = await deps.db.toolCallCreate({
            id: deps.nanoid(),
            userId,
            toolName: name,
            args: JSON.stringify(args),
            durationMs: 0,
            isError: false,
            status: "PENDING",
            result: null,
          });
        } catch (err) {
          console.error("Failed to log initial PENDING tool call:", err);
        }
      }

      try {
        result = await tool.handler(args);
        isError = !!result.isError;
      } catch (err) {
        isError = true;
        result = { content: [{ type: "text", text: String(err) }], isError: true };
      }
      const durationMs = Date.now() - startTime;

      // Update log to COMPLETED / ERROR
      if (deps.db.toolCallUpdate && callId) {
        let resultStr = JSON.stringify(result);
        if (resultStr.length > 5000) {
          resultStr = resultStr.substring(0, 5000) + "... (truncated)";
        }
        try {
          await deps.db.toolCallUpdate(callId, {
            durationMs,
            isError,
            status: isError ? "ERROR" : "COMPLETED",
            result: resultStr,
          });
        } catch (err) {
          console.error("Failed to log tool call completion:", err);
        }
      }

      return result;
    },
  };
}
