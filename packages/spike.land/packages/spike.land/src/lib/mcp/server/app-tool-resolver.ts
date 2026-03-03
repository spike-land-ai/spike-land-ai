/**
 * App Tool Resolver
 *
 * Maps store app slugs to their required ToolModuleEntry[] from the manifest.
 * Each store app declares its tools via mcpTools[].category — this module
 * resolves those categories to the actual tool modules that register them.
 */

import { getAppBySlug, STORE_APPS } from "@/app/store/data/store-apps";
import { TOOL_MODULES, type ToolModuleEntry } from "./tool-manifest";

/**
 * Get the tool modules needed for a specific store app.
 * Returns only the ToolModuleEntry[] whose categories overlap
 * with the app's declared mcpTools categories.
 *
 * Gateway-meta tools are NOT included here — callers should
 * register them separately if needed.
 */
export function getToolModulesForApp(slug: string): ToolModuleEntry[] {
  const app = getAppBySlug(slug);
  if (!app) {
    return [];
  }

  // Extract unique categories from the app's declared tools
  const appCategories = new Set(app.mcpTools.map(t => t.category));

  if (appCategories.size === 0) {
    return [];
  }

  // Filter manifest entries to those whose categories intersect with the app's
  return TOOL_MODULES.filter(entry => {
    if (!entry.categories) return false;
    return entry.categories.some(cat => appCategories.has(cat));
  });
}

/**
 * Get all unique categories declared by store apps.
 * Useful for validation and debugging.
 */
export function getAllAppCategories(): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const app of STORE_APPS) {
    const categories = [...new Set(app.mcpTools.map(t => t.category))];
    if (categories.length > 0) {
      result.set(app.slug, categories);
    }
  }
  return result;
}
