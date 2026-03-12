export const excludedDeps = new Set([
  "@modelcontextprotocol/sdk",
  "zod",
  "vitest",
  "mcp-server-base",
  "types", // assuming local types package
  "typescript",
  "@types/node",
]);

export interface CategoryRule {
  predicate: (deps: Set<string>, originalDeps: Set<string>, pkgKind?: string) => boolean;
  category: string;
}

// File-level category rules (used only to compute per-package dominant category
// when packages.yaml doesn't specify a kind)
export const categoryRules: CategoryRule[] = [
  {
    predicate: (_, originalDeps) => originalDeps.has("@modelcontextprotocol/sdk"),
    category: "mcp-tools",
  },
  {
    predicate: (_, originalDeps) => originalDeps.has("react") || originalDeps.has("react-dom"),
    category: "frontend",
  },
  {
    predicate: (_, originalDeps) => originalDeps.has("hono"),
    category: "edge-api",
  },
  {
    predicate: (_, originalDeps) => originalDeps.has("remotion"),
    category: "media",
  },
  {
    predicate: (_, originalDeps) => originalDeps.has("commander"),
    category: "cli",
  },
  {
    predicate: (_, originalDeps) =>
      originalDeps.has("playwright") || originalDeps.has("@playwright/test"),
    category: "testing",
  },
  {
    predicate: (_, originalDeps) =>
      originalDeps.has("@ai-sdk/anthropic") ||
      originalDeps.has("@ai-sdk/google") ||
      originalDeps.has("@anthropic-ai/sdk") ||
      originalDeps.has("replicate"),
    category: "ai",
  },
  {
    predicate: (_, __, pkgKind) => pkgKind === "library" || pkgKind === "block",
    category: "core",
  },
];

export const fallbackCategory = "utilities";

// Maps packages.yaml `kind` to a top-level category.
// Used for package-level classification (all files in the package
// inherit this category instead of being classified individually).
export const kindToCategory: Record<string, string> = {
  "mcp-server": "mcp-tools",
  worker: "edge-api",
  browser: "frontend",
  video: "media",
  cli: "cli",
  library: "core",
  block: "core",
};

export const nameOverrides: Record<string, string> = {
  "spike-app": "platform-frontend",
  "spike-edge": "main", // Avoid edge-api/edge-api stutter
  "spike-land-backend": "backend",
  code: "monaco-editor",
  "react-ts-worker": "react-engine",
  shared: "shared-utils",
  video: "educational-videos",
  "chess-engine": "chess",
  "qa-studio": "browser-automation",
  "state-machine": "statecharts",
  "vibe-dev": "docker-dev",
  "spike-cli": "spike-cli",
  "spike-review": "code-review",
};

export const excludeGlobs = [
  "**/dist/**",
  "**/node_modules/**",
  "**/*.d.ts",
  "**/routeTree.gen.ts",
];

// Semantic names for common npm packages (used when no tag matches)
const depSemanticMap: Record<string, string> = {
  "chess.js": "chess-core",
  "async-mutex": "concurrency",
  "worker-rpc": "messaging",
  "diff-match-patch": "text-diff",
  jsondiffpatch: "json-diff",
  "html2canvas-pro": "rendering",
  recordrtc: "media-capture",
  immutable: "data-structures",
  "ts-md5": "crypto",
  "better-auth": "auth",
  "tailwind-merge": "styling",
  "class-variance-authority": "styling",
  stripe: "payments",
  googleapis: "google-api",
  puppeteer: "browser-automation",
};

function semanticName(dep: string): string {
  // Check exact match first
  if (depSemanticMap[dep]) return depSemanticMap[dep];
  // Check partial matches (e.g. "@scope/package" → "package")
  const short = dep.includes("/") ? dep.split("/").pop()! : dep;
  if (depSemanticMap[short]) return depSemanticMap[short];
  return "";
}

export function getDependencyGroupName(deps: Set<string>): string {
  if (deps.size === 0) return "core-logic";

  const has = (name: string) => [...deps].some((d) => d.includes(name));

  const tags: string[] = [];

  if (has("playwright") || has("testing-library") || has("vitest")) tags.push("testing");
  if (has("ai-sdk") || has("anthropic") || has("google/genai") || has("replicate")) tags.push("ai");
  if (has("drizzle") || has("sql.js") || has("sqlite") || has("better-sqlite3")) tags.push("db");
  if (has("hono")) tags.push("api");
  if (has("remotion")) tags.push("video");
  if (has("commander") || has("dotenv") || has("xterm") || has("readline")) tags.push("cli");
  if (has("react-three")) tags.push("3d");
  if (has("framer-motion") || has("tw-animate")) tags.push("animation");
  if (has("monaco")) tags.push("editor");
  if (has("mcp-server-base") || has("modelcontextprotocol") || has("mcp-image-studio"))
    tags.push("mcp");
  if (has("cloudflare") || has("workbox")) tags.push("edge");
  if (has("better-auth")) tags.push("auth");
  if (has("stripe")) tags.push("payments");

  // React / UI
  if (has("react") || has("radix-ui") || has("lucide") || has("emotion") || has("tailwindcss")) {
    if (!tags.includes("editor") && !tags.includes("video") && !tags.includes("3d")) {
      tags.push("ui");
    }
  }

  // Node built-ins
  if (has("node:") || has("child_process")) {
    if (tags.length === 0) tags.push("node-sys");
  }

  if (tags.length > 0) {
    return tags.slice(0, 3).join("-");
  }

  // Fallback: try semantic mapping for all deps
  const semanticNames = new Set<string>();
  for (const dep of deps) {
    const name = semanticName(dep);
    if (name) semanticNames.add(name);
  }
  if (semanticNames.size > 0) {
    return [...semanticNames].sort().slice(0, 2).join("-");
  }

  // Last resort: use "lazy-imports" bucket instead of raw dep names
  return "lazy-imports";
}

// When dep-group name matches category name, collapse to avoid stutter
// e.g. cli/spike-cli/cli → cli/spike-cli/core-logic
export function deduplicateDepGroup(depGroup: string, category: string): string {
  if (depGroup === category) return "core-logic";
  // Also handle partial matches like "cli" in "cli" category
  const parts = depGroup.split("-");
  if (parts.length === 1 && parts[0] === category) return "core-logic";
  return depGroup;
}
