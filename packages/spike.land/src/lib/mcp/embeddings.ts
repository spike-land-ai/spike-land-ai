/**
 * Lightweight Semantic Embeddings for MCP Tool Discovery
 *
 * Synonym expansion + sparse TF vectors for instant, zero-API-cost search.
 * Powers the UI sidebar and provides a fallback for the backend.
 */

// ── Synonym Groups ─────────────────────────────────────────────────
const SYNONYM_GROUPS: string[][] = [
  ["create", "generate", "make", "build", "produce", "new"],
  ["delete", "remove", "destroy", "drop", "erase"],
  ["image", "picture", "photo", "graphic", "visual", "img"],
  ["search", "find", "discover", "lookup", "browse", "query"],
  ["update", "edit", "modify", "change", "alter", "patch"],
  ["list", "show", "display", "view", "get", "fetch"],
  ["send", "post", "push", "deliver", "emit", "publish"],
  ["user", "account", "profile", "member", "person"],
  ["file", "document", "page", "content", "resource"],
  ["code", "script", "program", "source", "snippet"],
  ["test", "check", "verify", "validate", "assert"],
  ["deploy", "release", "ship", "launch", "publish"],
  ["config", "settings", "options", "preferences", "configuration"],
  ["error", "bug", "issue", "problem", "fault", "failure"],
  ["log", "trace", "record", "audit", "history"],
  ["auth", "login", "authenticate", "session", "credential"],
  ["store", "save", "persist", "cache", "keep"],
  ["message", "chat", "conversation", "talk", "communicate"],
  ["ai", "artificial", "intelligence", "ml", "machine", "learning", "model"],
  ["audio", "sound", "music", "voice", "speech"],
  ["video", "movie", "clip", "recording", "stream"],
  ["workspace", "project", "environment", "space", "sandbox"],
];

// Build reverse lookup: word → all synonyms in the group
const synonymMap = new Map<string, Set<string>>();
for (const group of SYNONYM_GROUPS) {
  const groupSet = new Set(group);
  for (const word of group) {
    const existing = synonymMap.get(word);
    if (existing) {
      for (const w of groupSet) existing.add(w);
    } else {
      synonymMap.set(word, new Set(groupSet));
    }
  }
}

// ── Tokenization ───────────────────────────────────────────────────

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1);
}

// ── Synonym Expansion ──────────────────────────────────────────────

export function expandWithSynonyms(tokens: string[]): string[] {
  const expanded = new Set<string>();
  for (const token of tokens) {
    expanded.add(token);
    const synonyms = synonymMap.get(token);
    if (synonyms) {
      for (const s of synonyms) expanded.add(s);
    }
  }
  return Array.from(expanded);
}

// ── Vector Building ────────────────────────────────────────────────

export function buildVector(
  name: string,
  category: string,
  description: string,
): Map<string, number> {
  const vec = new Map<string, number>();

  const nameTokens = expandWithSynonyms(tokenize(name));
  const catTokens = expandWithSynonyms(tokenize(category));
  const descTokens = expandWithSynonyms(tokenize(description));

  for (const t of nameTokens) {
    vec.set(t, (vec.get(t) ?? 0) + 3);
  }
  for (const t of catTokens) {
    vec.set(t, (vec.get(t) ?? 0) + 2);
  }
  for (const t of descTokens) {
    vec.set(t, (vec.get(t) ?? 0) + 1);
  }

  // Normalize to unit vector
  let magnitude = 0;
  for (const v of vec.values()) {
    magnitude += v * v;
  }
  magnitude = Math.sqrt(magnitude);
  if (magnitude > 0) {
    for (const [k, v] of vec) {
      vec.set(k, v / magnitude);
    }
  }

  return vec;
}

export function buildQueryVector(query: string): Map<string, number> {
  const tokens = expandWithSynonyms(tokenize(query));
  const vec = new Map<string, number>();

  for (const t of tokens) {
    vec.set(t, (vec.get(t) ?? 0) + 1);
  }

  // Normalize to unit vector
  let magnitude = 0;
  for (const v of vec.values()) {
    magnitude += v * v;
  }
  magnitude = Math.sqrt(magnitude);
  if (magnitude > 0) {
    for (const [k, v] of vec) {
      vec.set(k, v / magnitude);
    }
  }

  return vec;
}

// ── Cosine Similarity (sparse) ─────────────────────────────────────

export function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  // Iterate over the smaller map for efficiency
  const [smaller, larger] = a.size <= b.size ? [a, b] : [b, a];
  for (const [key, val] of smaller) {
    const otherVal = larger.get(key);
    if (otherVal !== undefined) {
      dot += val * otherVal;
    }
  }
  return dot;
}

// ── Tool Embedding Index ───────────────────────────────────────────

interface IndexEntry {
  name: string;
  vector: Map<string, number>;
}

export class ToolEmbeddingIndex {
  private index = new Map<string, IndexEntry>();

  embed(name: string, category: string, description: string): void {
    const vector = buildVector(name, category, description);
    this.index.set(name, { name, vector });
  }

  remove(name: string): boolean {
    return this.index.delete(name);
  }

  has(name: string): boolean {
    return this.index.has(name);
  }

  get size(): number {
    return this.index.size;
  }

  search(query: string, limit = 10, threshold = 0.01): Array<{ name: string; score: number }> {
    const queryVec = buildQueryVector(query);
    if (queryVec.size === 0) return [];

    const results: Array<{ name: string; score: number }> = [];

    for (const entry of this.index.values()) {
      const score = cosineSimilarity(queryVec, entry.vector);
      if (score >= threshold) {
        results.push({ name: entry.name, score });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }
}

// ── Parameter Suggestion ───────────────────────────────────────────

const KNOWN_FORMATS = new Set([
  "json",
  "csv",
  "xml",
  "html",
  "yaml",
  "toml",
  "markdown",
  "md",
  "text",
  "png",
  "jpg",
  "jpeg",
  "svg",
  "pdf",
]);
const KNOWN_LANGUAGES = new Set([
  "typescript",
  "javascript",
  "python",
  "rust",
  "go",
  "java",
  "ruby",
  "php",
  "swift",
  "kotlin",
  "scala",
  "haskell",
  "elixir",
  "clojure",
  "cpp",
  "csharp",
  "c",
  "r",
  "sql",
  "bash",
  "shell",
  "zsh",
  "powershell",
  "lua",
  "perl",
  "dart",
  "zig",
  "nim",
  "ocaml",
  "fsharp",
  "erlang",
  "tsx",
  "jsx",
  "ts",
  "js",
]);

export function suggestParameters(query: string): Record<string, string> {
  const params: Record<string, string> = {};
  const lower = query.toLowerCase();

  // "of <something>" → prompt or content
  const ofMatch = lower.match(
    /\bof\s+(?:a\s+|an\s+|the\s+)?(.+?)(?:\s+(?:in|to|called|named|from|with)\b|$)/,
  );
  if (ofMatch?.[1]) {
    params.prompt = ofMatch[1].trim();
  }

  // "called/named <name>" → name
  const namedMatch = lower.match(/\b(?:called|named)\s+["']?([a-z0-9_-]+)["']?/);
  if (namedMatch?.[1]) {
    params.name = namedMatch[1];
  }

  // "to <format>" → format
  const formatMatch = lower.match(/\bto\s+([a-z]+)\b/);
  if (formatMatch?.[1] && KNOWN_FORMATS.has(formatMatch[1])) {
    params.format = formatMatch[1];
  }

  // "in <language>" → language
  const langMatch = lower.match(/\bin\s+([a-z]+)\b/);
  if (langMatch?.[1] && KNOWN_LANGUAGES.has(langMatch[1])) {
    params.language = langMatch[1];
  }

  return params;
}
