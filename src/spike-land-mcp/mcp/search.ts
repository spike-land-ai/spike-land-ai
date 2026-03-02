/**
 * Tool Search Module
 *
 * Provides keyword and semantic search over registered tools.
 * Extracted from ToolRegistry for independent testability.
 *
 * Ported from spike.land — Gemini semantic search removed (keyword + TF-IDF only).
 */

import type { RegisteredTool } from "@modelcontextprotocol/sdk/server/mcp.js";
import { suggestParameters, ToolEmbeddingIndex } from "./embeddings";
import type { ToolComplexity, ToolDefinition, SearchResult } from "./registry";

interface TrackedToolRef {
  definition: ToolDefinition;
  registered: RegisteredTool;
}

export class ToolSearch {
  private embeddingIndex = new ToolEmbeddingIndex();

  /** Register a tool in the in-memory TF-IDF embedding index. */
  index(name: string, category: string, description: string): void {
    this.embeddingIndex.embed(name, category, description);
  }

  /** Keyword search over registered tools. */
  search(tools: Map<string, TrackedToolRef>, query: string, limit = 10): SearchResult[] {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return [];

    const scored: Array<{ result: SearchResult; score: number }> = [];

    for (const [, { definition, registered }] of tools) {
      if (definition.category === "gateway-meta") continue;

      const nameLC = definition.name.toLowerCase();
      const descLC = definition.description.toLowerCase();
      const catLC = definition.category.toLowerCase();

      let score = 0;
      for (const term of terms) {
        if (nameLC.includes(term)) score += 3;
        if (catLC.includes(term)) score += 2;
        if (descLC.includes(term)) score += 1;
      }

      scored.push({
        result: {
          name: definition.name,
          category: definition.category,
          description: (definition.description.split("\n")[0] ?? "").slice(0, 200),
          tier: definition.tier,
          ...(definition.complexity ? { complexity: definition.complexity } : {}),
          enabled: registered.enabled ?? false,
        },
        score,
      });
    }

    const validScores = scored.filter((s) => s.score > 0);
    validScores.sort((a, b) => b.score - a.score);
    return validScores.slice(0, limit).map((s) => s.result);
  }

  /** In-memory TF-IDF semantic search (no external API). */
  searchSemantic(tools: Map<string, TrackedToolRef>, query: string, limit = 10): SearchResult[] {
    const results = this.embeddingIndex.search(query, limit);
    if (results.length === 0) return [];

    const suggested = suggestParameters(query);

    return results
      .filter((r) => {
        const tracked = tools.get(r.name);
        return tracked && tracked.definition.category !== "gateway-meta";
      })
      .map((r) => {
        const tracked = tools.get(r.name)!;
        return {
          name: tracked.definition.name,
          category: tracked.definition.category,
          description: (tracked.definition.description.split("\n")[0] ?? "").slice(0, 200),
          tier: tracked.definition.tier,
          ...(tracked.definition.complexity
            ? { complexity: tracked.definition.complexity as ToolComplexity }
            : {}),
          enabled: tracked.registered.enabled ?? false,
          score: Math.round(r.score * 100) / 100,
          ...(Object.keys(suggested).length > 0 ? { suggestedParams: suggested } : {}),
        };
      });
  }
}
