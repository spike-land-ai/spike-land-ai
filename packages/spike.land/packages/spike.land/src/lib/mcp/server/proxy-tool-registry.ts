/**
 * Proxy Tool Registry
 *
 * A lightweight registry that collects MCP tool handlers for use by the
 * web UI proxy route. Instead of wiring to a full McpServer (which requires
 * JSON-RPC transport), this stores handlers in a Map and invokes them directly.
 *
 * Implements the same `register()` interface as ToolRegistry so it can be
 * used with `registerAllTools()` from tool-manifest.ts.
 */

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type {
  CategoryInfo,
  SearchResult,
  ToolDefinition,
} from "./tool-registry";
import { CATEGORY_DESCRIPTIONS } from "./tool-registry";
import { z } from "zod";

interface StoredHandler {
  name: string;
  description: string;
  handler: (input: never) => Promise<CallToolResult> | CallToolResult;
  inputSchema?: z.ZodRawShape;
  category: string;
  tier: string;
}

export class ProxyToolRegistry {
  private tools = new Map<string, StoredHandler>();

  register(def: ToolDefinition): void {
    this.tools.set(def.name, {
      name: def.name,
      description: def.description,
      handler: def.handler,
      inputSchema: def.inputSchema,
      category: def.category,
      tier: def.tier,
    });
  }

  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  async callTool(
    name: string,
    params: Record<string, unknown>,
  ): Promise<CallToolResult> {
    const stored = this.tools.get(name);
    if (!stored) {
      return {
        content: [
          {
            type: "text",
            text: `Unknown tool: "${name}". Use search_tools to find available tools.`,
          },
        ],
        isError: true,
      };
    }

    // Validate input against the Zod schema before invoking the handler.
    // This catches missing/invalid params with clear error messages instead
    // of letting them bubble up as cryptic database or runtime errors.
    if (stored.inputSchema) {
      const schema = z.object(stored.inputSchema);
      const parsed = schema.safeParse(params);
      if (!parsed.success) {
        const issues = parsed.error.issues.map(issue => {
          const path = issue.path.join(".");
          return `- **${path || "(root)"}**: ${issue.message}`;
        });
        return {
          content: [
            {
              type: "text",
              text: `**Error: VALIDATION_ERROR**\n`
                + `Invalid parameters for tool "${name}":\n`
                + `${issues.join("\n")}\n\n`
                + `**Hint:** Use \`search_tools\` with query "${name}" to discover this tool's parameters.`,
            },
          ],
          isError: true,
        };
      }
      return stored.handler(parsed.data as never);
    }

    // No schema — invoke directly (e.g. zero-arg tools)
    return stored.handler(params as never);
  }

  getToolCount(): number {
    return this.tools.size;
  }

  // In ProxyToolRegistry all tools are always enabled (no MCP enable/disable concept).
  getEnabledCount(): number {
    return this.tools.size;
  }

  searchTools(query: string, limit = 10): SearchResult[] {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return [];

    const scored: Array<{ result: SearchResult; score: number; }> = [];

    for (const [toolName, stored] of this.tools) {
      if (stored.category === "gateway-meta") continue;

      const nameLC = toolName.toLowerCase();
      const descLC = stored.description.toLowerCase();
      const catLC = stored.category.toLowerCase();

      let score = 0;
      for (const term of terms) {
        if (nameLC.includes(term)) score += 3;
        if (catLC.includes(term)) score += 2;
        if (descLC.includes(term)) score += 1;
      }

      if (score > 0) {
        scored.push({
          result: {
            name: toolName,
            category: stored.category,
            description: (stored.description.split("\n")[0] ?? "").slice(
              0,
              200,
            ),
            tier: stored.tier,
            enabled: true,
          },
          score,
        });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map(s => s.result);
  }

  listCategories(): CategoryInfo[] {
    const categories = new Map<string, { tools: string[]; tier: string; }>();

    for (const [toolName, stored] of this.tools) {
      let cat = categories.get(stored.category);
      if (!cat) {
        cat = { tools: [], tier: stored.tier };
        categories.set(stored.category, cat);
      }
      cat.tools.push(toolName);
    }

    return Array.from(categories.entries()).map(([name, data]) => ({
      name,
      description: CATEGORY_DESCRIPTIONS[name] ?? `${name} tools`,
      tier: data.tier,
      toolCount: data.tools.length,
      enabledCount: data.tools.length, // all tools are always enabled in proxy registry
      tools: data.tools,
    }));
  }

  hasCategory(category: string): boolean {
    for (const [, stored] of this.tools) {
      if (stored.category === category) return true;
    }
    return false;
  }

  // In ProxyToolRegistry all tools are always active — nothing new to enable.
  enableCategory(_category: string): string[] {
    return [];
  }

  enableTools(_names: string[]): string[] {
    return [];
  }
}
