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
import { z } from "zod";

import type { BuiltTool } from "@spike-land-ai/shared/tool-builder";
import { CATEGORY_DESCRIPTIONS } from "../core-logic/mcp/categories";

import { ToolSearch } from "../core-logic/mcp/search";

// Re-export for consumers
export { CATEGORY_DESCRIPTIONS } from "../core-logic/mcp/categories";

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

export function formatExamplesAsDescription(description: string, examples: ToolExample[]): string {
  if (!examples || examples.length === 0) return description;
  let formatted = `${description}\n\n### Examples\n`;
  for (const ex of examples) {
    formatted += `- **${ex.name}**: ${ex.description}\n  \`\`\`json\n  ${JSON.stringify(ex.input)}\n  \`\`\`\n`;
    if (ex.expected_output) {
      formatted += `  Expected: ${ex.expected_output}\n`;
    }
  }
  return formatted;
}

export function compareSemver(a: string, b: string): number {
  const pa = (a.split("-")[0] ?? "").split(".").map(Number);
  const pb = (b.split("-")[0] ?? "").split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (nb > na) return -1;
  }
  return 0;
}

export type ToolComplexity = "primitive" | "composed" | "workflow";

export type ToolStability = "stable" | "beta" | "experimental" | "deprecated" | "not-implemented";

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
  expected_output?: string | undefined;
}

export type EloTier = "free" | "pro" | "business";

const TIER_RANK: Record<EloTier, number> = { free: 0, pro: 1, business: 2 };

export interface ToolDefinition {
  name: string;
  description: string;
  category: string;
  tier: "free" | "workspace";
  /** Minimum ELO tier required to use this tool. Undefined = no gating. */
  requiredTier?: EloTier | undefined;
  complexity?: ToolComplexity | undefined;
  version?: string | undefined;
  stability?: ToolStability | undefined;
  examples?: ToolExample[] | undefined;
  inputSchema?: z.ZodRawShape | undefined;
  annotations?: ToolAnnotations | undefined;
  dependencies?: ToolDependencies | undefined;
  /** Minimum user role required to access this tool. Undefined = no role gating. */
  requiredRole?: "admin" | "super_admin" | undefined;
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
  version?: string;
  stability?: ToolStability;
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
  private versionedTools = new Map<string, TrackedTool>();
  private categoryIndex = new Set<string>(); // O(1) hasCategory lookup
  private mcpServer: McpServer;
  protected userId: string;
  private toolSearch = new ToolSearch();

  private callerElo: number | undefined;
  private callerTier: EloTier | undefined;
  private callerRole: string | undefined;
  private injectExamples: boolean;

  constructor(mcpServer: McpServer, userId: string, options?: { injectExamples?: boolean }) {
    this.mcpServer = mcpServer;
    this.userId = userId;
    this.injectExamples = options?.injectExamples ?? false;
  }

  getUserId(): string {
    return this.userId;
  }

  setCallerElo(elo: number, tier: EloTier, _isAgent = false): void {
    this.callerElo = elo;
    this.callerTier = tier;
  }

  setCallerRole(role: string): void {
    this.callerRole = role;
  }

  register(def: ToolDefinition): void {
    // Validate that all schema fields have .describe() for LLM tool selection
    const missingDescriptions = validateSchemaDescriptions(def.inputSchema);
    if (missingDescriptions.length > 0) {
      const msg =
        `Tool "${def.name}" has schema fields without .describe(): ${missingDescriptions.join(
          ", ",
        )}. ` + `Add .describe() to every Zod field for accurate LLM tool selection.`;
      // In development, throw to catch missing .describe() early
      console.warn(msg);
    }

    const version = def.version ?? "1.0.0";
    const stability = def.stability ?? "stable";

    // Skip registration of not-implemented tools — they stay in code but are invisible
    if (stability === "not-implemented") {
      return;
    }

    const versionKey = `${def.name}@${version}`;

    // Semver check for tools map to keep only the latest version active
    let isLatest = true;
    const existingLatest = this.tools.get(def.name);
    if (existingLatest) {
      const existingVersion = existingLatest.definition.version ?? "1.0.0";
      if (compareSemver(existingVersion, version) > 0) {
        isLatest = false;
      } else if (compareSemver(existingVersion, version) < 0) {
        // We are newer. Deprecate the old version in the versionedTools map if it exists
        const oldKey = `${def.name}@${existingVersion}`;
        const oldTool = this.versionedTools.get(oldKey);
        if (oldTool) {
          oldTool.definition.stability = "deprecated";
          if (oldTool.registered && oldTool.registered._meta) {
            oldTool.registered._meta.stability = "deprecated";
          }
        }
      }
    }

    let finalDescription = def.description;
    if (this.injectExamples && def.examples && def.examples.length > 0) {
      finalDescription = formatExamplesAsDescription(def.description, def.examples);
    }

    const wrappedHandler = async (input: never) => {
      const required = def.requiredTier;
      if (required && this.callerTier) {
        if ((TIER_RANK[this.callerTier] ?? 0) < (TIER_RANK[required] ?? 0)) {
          return {
            content: [
              {
                type: "text",
                text: `Insufficient ELO: This tool requires ${required} tier (current tier: ${this.callerTier}, elo: ${this.callerElo ?? "unknown"}).`,
              },
            ],
            isError: true,
          };
        }
      }
      // RBAC role check — deny when callerRole is undefined or insufficient
      const requiredRole = def.requiredRole;
      if (requiredRole) {
        const ROLE_RANK: Record<string, number> = { user: 0, admin: 1, super_admin: 2 };
        const callerRank = ROLE_RANK[this.callerRole ?? ""] ?? -1;
        if (callerRank < (ROLE_RANK[requiredRole] ?? 0)) {
          return {
            content: [
              {
                type: "text",
                text: `Insufficient permissions: This tool requires ${requiredRole} role (current role: ${this.callerRole ?? "anonymous"}).`,
              },
            ],
            isError: true,
          };
        }
      }
      return def.handler(input);
    };

    // If it's the latest version, we register it with the MCP server using its normal name
    let registered: RegisteredTool | undefined;

    if (isLatest) {
      registered = this.mcpServer.registerTool(
        def.name,
        {
          description: finalDescription,
          ...(def.inputSchema !== undefined ? { inputSchema: def.inputSchema } : {}),
          ...(def.annotations !== undefined ? { annotations: def.annotations } : {}),
          ...(def.examples !== undefined ? { examples: def.examples } : {}),
          _meta: { category: def.category, tier: def.tier, version, stability },
        },
        wrappedHandler as unknown as Parameters<McpServer["registerTool"]>[2],
      );

      if (!def.alwaysEnabled) {
        registered.disable();
      }

      this.tools.set(def.name, { definition: def, registered });
      this.categoryIndex.add(def.category);
      this.toolSearch.index(def.name, def.category, finalDescription, version, stability);
    }

    // Always store in versionedTools (even if it's not the latest, we might just store a mock RegisteredTool or omit it if not strictly required, but TrackedTool requires it).
    // For non-latest, we don't register it to the active MCP server endpoints, but we keep the definition.
    this.versionedTools.set(versionKey, {
      definition: def,
      registered: registered || ({} as RegisteredTool), // fallback if not registered actively
    });
  }

  /**
   * Register a tool built with the shared tool-builder.
   * Adapts BuiltTool to ToolDefinition internally -- zero breaking changes.
   */
  registerBuilt<TInput, TOutput>(built: BuiltTool<TInput, TOutput>): void {
    const stability = built.meta.stability ?? "stable";
    if (stability === "not-implemented") {
      return;
    }
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
      ...(built.meta.version ? { version: built.meta.version } : {}),
      ...(built.meta.stability ? { stability: built.meta.stability as ToolStability } : {}),
      ...(built.meta.examples ? { examples: built.meta.examples as ToolExample[] } : {}),
      inputSchema: built.inputSchema,
      handler: built.handler as unknown as ToolDefinition["handler"],
    });
  }

  getToolExamples(name: string): ToolExample[] | undefined {
    return this.tools.get(name)?.definition.examples;
  }

  getToolsWithExamples(): Array<{ name: string; exampleCount: number }> {
    const result: Array<{ name: string; exampleCount: number }> = [];
    for (const [, { definition }] of this.tools) {
      if (definition.examples && definition.examples.length > 0) {
        result.push({ name: definition.name, exampleCount: definition.examples.length });
      }
    }
    return result;
  }

  getToolByVersion(name: string, version: string): ToolDefinition | undefined {
    return this.versionedTools.get(`${name}@${version}`)?.definition;
  }

  listVersions(name: string): Array<{ version: string; stability: string }> {
    const versions: Array<{ version: string; stability: string }> = [];
    for (const [key, tool] of this.versionedTools) {
      if (key.startsWith(`${name}@`)) {
        versions.push({
          version: tool.definition.version ?? "1.0.0",
          stability: tool.definition.stability ?? "stable",
        });
      }
    }
    return versions.sort((a, b) => compareSemver(b.version, a.version));
  }

  async searchTools(query: string, limit = 10, includeDeprecated = false): Promise<SearchResult[]> {
    return this.toolSearch.search(this.tools, query, limit, includeDeprecated);
  }

  searchToolsSemantic(query: string, limit = 10, includeDeprecated = false): SearchResult[] {
    return this.toolSearch.searchSemantic(this.tools, query, limit, includeDeprecated);
  }

  enableTools(names: string[]): string[] {
    const enabled: string[] = [];
    for (const name of names) {
      const tracked = this.tools.get(name);
      if (tracked && tracked.registered.enabled !== undefined && !tracked.registered.enabled) {
        tracked.registered.enable();
        enabled.push(name);
      }
    }
    return enabled;
  }

  enableCategory(category: string): string[] {
    const enabled: string[] = [];
    for (const [, { definition, registered }] of this.tools) {
      if (
        definition.category === category &&
        registered.enabled !== undefined &&
        !registered.enabled
      ) {
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
   * @param userTier - caller's ELO tier for access gating (optional)
   */
  async callToolDirect(
    name: string,
    input: Record<string, unknown>,
    userTier?: EloTier,
    version?: string,
  ): Promise<CallToolResult> {
    let tracked = this.tools.get(name);
    if (version) {
      tracked = this.versionedTools.get(`${name}@${version}`);
    }

    if (!tracked) {
      return {
        content: [{ type: "text", text: `Tool not found: ${name}${version ? `@${version}` : ""}` }],
        isError: true,
      };
    }

    // Skip enabled check if accessing a specific older version, or enforce it?
    // We enforce it for the latest version.
    if (!version && tracked.registered.enabled !== undefined && !tracked.registered.enabled) {
      return {
        content: [{ type: "text", text: `Tool disabled: ${name}` }],
        isError: true,
      };
    }

    // ELO tier gating
    const required = tracked.definition.requiredTier;
    if (required && userTier) {
      if ((TIER_RANK[userTier] ?? 0) < (TIER_RANK[required] ?? 0)) {
        return {
          content: [
            {
              type: "text",
              text: `This tool requires ${required} tier (your tier: ${userTier}). Improve your ELO rating to unlock it.`,
            },
          ],
          isError: true,
        };
      }
    }

    // RBAC role gating — deny when callerRole is undefined or insufficient
    const requiredRole = tracked.definition.requiredRole;
    if (requiredRole) {
      const ROLE_RANK: Record<string, number> = { user: 0, admin: 1, super_admin: 2 };
      const callerRank = ROLE_RANK[this.callerRole ?? ""] ?? -1;
      if (callerRank < (ROLE_RANK[requiredRole] ?? 0)) {
        return {
          content: [
            {
              type: "text",
              text: `Insufficient permissions: This tool requires ${requiredRole} role (current role: ${this.callerRole ?? "anonymous"}).`,
            },
          ],
          isError: true,
        };
      }
    }

    return tracked.definition.handler(input as never);
  }

  /**
   * Filter tool definitions by stability tag.
   * Returns matching ToolDefinitions (without modifying enabled state).
   */
  filterByStability(stability: ToolStability): ToolDefinition[] {
    const results: ToolDefinition[] = [];
    for (const [, { definition }] of this.tools) {
      const toolStability = definition.stability ?? "stable";
      if (toolStability === stability) {
        results.push(definition);
      }
    }
    return results;
  }

  /**
   * Enable all tools matching a given stability tag.
   * Returns names of newly enabled tools.
   */
  enableByStability(stability: ToolStability): string[] {
    const enabled: string[] = [];
    for (const [, { definition, registered }] of this.tools) {
      const toolStability = definition.stability ?? "stable";
      if (toolStability === stability && registered.enabled !== undefined && !registered.enabled) {
        registered.enable();
        enabled.push(definition.name);
      }
    }
    return enabled;
  }

  /**
   * Return a count of registered tools grouped by stability tag.
   * Only counts tools in the active `tools` map (not versionedTools).
   */
  getStabilityBreakdown(): Record<string, number> {
    const breakdown: Record<string, number> = {};
    for (const [, { definition }] of this.tools) {
      const stability = definition.stability ?? "stable";
      breakdown[stability] = (breakdown[stability] ?? 0) + 1;
    }
    return breakdown;
  }

  /**
   * Enable ALL registered tool categories at once.
   * Used by InProcessToolProvider to skip progressive disclosure for agent loops.
   */
  enableAll(): number {
    let count = 0;
    for (const [, { registered }] of this.tools) {
      if (registered.enabled !== undefined && !registered.enabled) {
        registered.enable();
        count++;
      }
    }
    return count;
  }
}
