/**
 * Documentation Search (client-side via MiniSearch)
 *
 * Loads the pre-built search index and provides fuzzy + prefix search
 * across all documentation types.
 */

"use client";

import MiniSearch from "minisearch";
import type { DocsSearchEntry } from "./types";

let searchInstance: MiniSearch<DocsSearchEntry> | null = null;
let indexData: DocsSearchEntry[] = [];

export async function initSearch(): Promise<void> {
  if (searchInstance) return;

  const res = await fetch("/docs-data/search-index.json");
  if (!res.ok) {
    throw new Error(`Failed to load search index: ${res.status}`);
  }
  indexData = (await res.json()) as DocsSearchEntry[];

  searchInstance = new MiniSearch<DocsSearchEntry>({
    fields: ["title", "description", "category"],
    storeFields: ["id", "type", "title", "description", "category", "href"],
    searchOptions: {
      boost: { title: 3, category: 2, description: 1 },
      fuzzy: 0.2,
      prefix: true,
    },
  });

  searchInstance.addAll(indexData);
}

export function search(query: string, limit = 20): DocsSearchEntry[] {
  if (!searchInstance || !query.trim()) return [];

  const results = searchInstance.search(query).slice(0, limit);
  return results.map((r) => ({
    id: r.id as string,
    type: r.type as DocsSearchEntry["type"],
    title: r.title as string,
    description: r.description as string,
    category: r.category as string,
    href: r.href as string,
  }));
}
