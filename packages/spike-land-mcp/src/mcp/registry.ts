/**
 * Server-Side Progressive Tool Registry
 *
 * Progressive disclosure pattern: 5 always-on gateway-meta tools,
 * all others discoverable via search_tools and enable_category.
 *
 * Ported from spike.land — removed recordSkillUsage (D1 logging TBD),
 * removed Gemini semantic search (keyword + TF-IDF only).
 */

import type { McpServer, RegisteredTool } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult, ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import type { z } from "zod";
import type { BuiltTool } from "@spike-land-ai/shared/tool-builder";
import { CATEGORY_DESCRIPTIONS } from "./categories";
import { ToolSearch } from "./search";

// Re-export for consumers
export { CATEGORY_DESCRIPTIONS } from "./categories";

/**
 * Validate that all fields in a Zod input schema have `.describe()` calls.
 * Returns an array of field names missing descriptions.
 */
export function validateSchemaDescriptions(inputSchema: z.ZodRawShape | undefined): string[] {
  if (!inputSchema) return [];
  const missing: string[] = [];
  for (const [fieldName, zodType] of Object.entries(inputSchema)) {
    const desc = (zodType as { description?: string }).description;
    if (!desc) {
      missing.push(fieldName);
    }
  }
  return missing;
}

export type ToolComplexity = "primitive" | "composed" | "workflow";

export type ToolStability = "stable" | "beta" | "experimental";

/**
 * Tool dependency declarations for progressive tool activation.
 * Used by standalone store apps and enforced in the registry.
 */
export interface ToolDependencies {
  dependsOn?: string[] | undefined;
  enables?: string[] | undefined;
  requires?: string[] | undefined;
}

export interface ToolExample {
  name: string;
  input: Record<string, unknown>;
  description: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  category: string;
  tier: "free" | "workspace";
  complexity?: ToolComplexity | undefined;
  version?: string | undefined;
  stability?: ToolStability | undefined;
  examples?: ToolExample[] | undefined;
  inputSchema?: z.ZodRawShape | undefined;
  annotations?: ToolAnnotations | undefined;
  dependencies?: ToolDependencies | undefined;
  handler: (input: never) => Promise<CallToolResult> | CallToolResult;
  alwaysEnabled?: boolean | undefined;
}

export interface SearchResult {
  name: string;
  category: string;
  description: string;
  tier: string;
  complexity?: ToolComplexity;
  enabled: boolean;
  score?: number;
  suggestedParams?: Record<string, string>;
}

export interface CategoryInfo {
  name: string;
  description: string;
  tier: string;
  toolCount: number;
  enabledCount: number;
  tools: string[];
}

interface TrackedTool {
  definition: ToolDefinition;
  registered: RegisteredTool;
}

export class ToolRegistry {
  private tools = new Map<string, TrackedTool>();
  private categoryIndex = new Set<string>(); // O(1) hasCategory lookup
  private mcpServer: McpServer;
  protected userId: string;
  private toolSearch = new ToolSearch();

  constructor(mcpServer: McpServer, userId: string) {
    this.mcpServer = mcpServer;
    this.userId = userId;
  }

  getUserId(): string {
    return this.userId;
  }

  register(def: ToolDefinition): void {
    // Validate that all schema fields have .describe() for LLM tool selection
    const missingDescriptions = validateSchemaDescriptions(def.inputSchema);
    if (missingDescriptions.length > 0) {
      const msg =
        `Tool "${def.name}" has schema fields without .describe(): ${missingDescriptions.join(", ")}. ` +
        `Add .describe() to every Zod field for accurate LLM tool selection.`;
      // In development, throw to catch missing .describe() early
      console.warn(msg);
    }

    const version = def.version ?? "1.0.0";
    const stability = def.stability ?? "stable";

    const registered = this.mcpServer.registerTool(
      def.name,
      {
        description: def.description,
        ...(def.inputSchema !== undefined ? { inputSchema: def.inputSchema } : {}),
        ...(def.annotations !== undefined ? { annotations: def.annotations } : {}),
        ...(def.examples !== undefined ? { examples: def.examples } : {}),
        _meta: { category: def.category, tier: def.tier, version, stability },
      },
      def.handler as unknown as Parameters<McpServer["registerTool"]>[2],
    );

    if (!def.alwaysEnabled) {
      registered.disable();
    }

    this.tools.set(def.name, { definition: def, registered });
    this.categoryIndex.add(def.category);
    this.toolSearch.index(def.name, def.category, def.description);
  }

  /**
   * Register a tool built with the shared tool-builder.
   * Adapts BuiltTool to ToolDefinition internally -- zero breaking changes.
   */
  registerBuilt<TInput, TOutput>(built: BuiltTool<TInput, TOutput>): void {
    this.register({
      name: built.name,
      description: built.description,
      category: built.meta.category ?? "uncategorized",
      tier: built.meta.tier ?? "free",
      ...(built.meta.complexity ? { complexity: built.meta.complexity } : {}),
      ...(built.meta.annotations ? { annotations: built.meta.annotations as ToolAnnotations } : {}),
      ...(built.meta.alwaysEnabled !== undefined
        ? { alwaysEnabled: built.meta.alwaysEnabled }
        : {}),
      ...((built.meta as Record<string, unknown>).version
        ? { version: (built.meta as Record<string, unknown>).version as string }
        : {}),
      ...((built.meta as Record<string, unknown>).stability
        ? { stability: (built.meta as Record<string, unknown>).stability as ToolStability }
        : {}),
      ...((built.meta as Record<string, unknown>).examples
        ? { examples: (built.meta as Record<string, unknown>).examples as ToolExample[] }
        : {}),
      inputSchema: built.inputSchema,
      handler: built.handler as unknown as ToolDefinition["handler"],
    });
  }

  async searchTools(query: string, limit = 10): Promise<SearchResult[]> {
    return this.toolSearch.search(this.tools, query, limit);
  }

  searchToolsSemantic(query: string, limit = 10): SearchResult[] {
    return this.toolSearch.searchSemantic(this.tools, query, limit);
  }

  enableTools(names: string[]): string[] {
    const enabled: string[] = [];
    for (const name of names) {
      const tracked = this.tools.get(name);
      if (tracked && !tracked.registered.enabled) {
        tracked.registered.enable();
        enabled.push(name);
      }
    }
    return enabled;
  }

  enableCategory(category: string): string[] {
    const enabled: string[] = [];
    for (const [, { definition, registered }] of this.tools) {
      if (definition.category === category && !registered.enabled) {
        registered.enable();
        enabled.push(definition.name);
      }
    }
    return enabled;
  }

  disableCategory(category: string): string[] {
    const disabled: string[] = [];
    for (const [, { definition, registered }] of this.tools) {
      if (definition.category === category && registered.enabled && !definition.alwaysEnabled) {
        registered.disable();
        disabled.push(definition.name);
      }
    }
    return disabled;
  }

  listCategories(): CategoryInfo[] {
    const categories = new Map<string, { tools: string[]; enabledCount: number; tier: string }>();

    for (const [, { definition, registered }] of this.tools) {
      let cat = categories.get(definition.category);
      if (!cat) {
        cat = { tools: [], enabledCount: 0, tier: definition.tier };
        categories.set(definition.category, cat);
      }
      cat.tools.push(definition.name);
      if (registered.enabled) cat.enabledCount++;
    }

    return Array.from(categories.entries()).map(([name, data]) => ({
      name,
      description: CATEGORY_DESCRIPTIONS[name] || `${name} tools`,
      tier: data.tier,
      toolCount: data.tools.length,
      enabledCount: data.enabledCount,
      tools: data.tools,
    }));
  }

  /**
   * Get the set of non-gateway categories that currently have at least one enabled tool.
   * Used by category persistence to snapshot state for KV storage.
   */
  getEnabledCategories(): string[] {
    const categories = new Set<string>();
    for (const [, { definition, registered }] of this.tools) {
      if (
        registered.enabled &&
        !definition.alwaysEnabled &&
        definition.category !== "gateway-meta"
      ) {
        categories.add(definition.category);
      }
    }
    return Array.from(categories);
  }

  /**
   * Restore previously enabled categories (e.g. from KV).
   * Enables all tools in each listed category.
   */
  restoreCategories(categories: string[]): void {
    for (const category of categories) {
      this.enableCategory(category);
    }
  }

  hasCategory(category: string): boolean {
    return this.categoryIndex.has(category);
  }

  getToolCount(): number {
    return this.tools.size;
  }

  getEnabledCount(): number {
    let count = 0;
    for (const [, { registered }] of this.tools) {
      if (registered.enabled) count++;
    }
    return count;
  }

  /**
   * Return tool definitions for direct (in-process) invocation.
   * Used by InProcessToolProvider to build NamespacedTool[] without MCP transport.
   */
  getToolDefinitions(): Array<{
    name: string;
    description: string;
    category: string;
    handler: ToolDefinition["handler"];
    inputSchema?: z.ZodRawShape;
    enabled: boolean;
    alwaysEnabled?: boolean;
    version: string;
    stability: ToolStability;
    examples?: ToolExample[];
  }> {
    return Array.from(this.tools.values()).map(({ definition, registered }) => ({
      name: definition.name,
      description: definition.description,
      category: definition.category,
      handler: definition.handler,
      ...(definition.inputSchema !== undefined ? { inputSchema: definition.inputSchema } : {}),
      enabled: registered.enabled ?? false,
      ...(definition.alwaysEnabled !== undefined
        ? { alwaysEnabled: definition.alwaysEnabled }
        : {}),
      version: definition.version ?? "1.0.0",
      stability: definition.stability ?? "stable",
      ...(definition.examples !== undefined ? { examples: definition.examples } : {}),
    }));
  }

  /**
   * Call a tool handler directly, bypassing MCP transport.
   * Used by InProcessToolProvider for Docker/production environments.
   */
  async callToolDirect(name: string, input: Record<string, unknown>): Promise<CallToolResult> {
    const tracked = this.tools.get(name);
    if (!tracked) {
      return {
        content: [{ type: "text", text: `Tool not found: ${name}` }],
        isError: true,
      };
    }
    if (!tracked.registered.enabled) {
      return {
        content: [{ type: "text", text: `Tool disabled: ${name}` }],
        isError: true,
      };
    }
    return tracked.definition.handler(input as never);
  }

  /**
   * Enable ALL registered tool categories at once.
   * Used by InProcessToolProvider to skip progressive disclosure for agent loops.
   */
  enableAll(): number {
    let count = 0;
    for (const [, { registered }] of this.tools) {
      if (!registered.enabled) {
        registered.enable();
        count++;
      }
    }
    return count;
  }
}
