import { describe, expect, it } from "vitest";
import {
  getDependencyGroupName,
  deduplicateDepGroup,
  kindToCategory,
  categoryRules,
  fallbackCategory,
  nameOverrides,
  excludedDeps,
} from "../reorganize-config.js";

// ─── getDependencyGroupName ────────────────────────────────────────

describe("getDependencyGroupName", () => {
  it("returns 'core-logic' for empty deps", () => {
    expect(getDependencyGroupName(new Set())).toBe("core-logic");
  });

  it("detects React UI deps", () => {
    expect(getDependencyGroupName(new Set(["react"]))).toBe("ui");
    expect(getDependencyGroupName(new Set(["react-dom"]))).toBe("ui");
    expect(getDependencyGroupName(new Set(["@radix-ui/select"]))).toBe("ui");
  });

  it("detects testing deps", () => {
    expect(getDependencyGroupName(new Set(["playwright"]))).toBe("testing");
    // @testing-library/react matches both "testing" and "react" (ui) tags
    expect(
      getDependencyGroupName(new Set(["@testing-library/react"])),
    ).toBe("testing-ui");
    expect(getDependencyGroupName(new Set(["vitest"]))).toBe("testing");
  });

  it("detects AI deps", () => {
    expect(getDependencyGroupName(new Set(["@ai-sdk/anthropic"]))).toBe("ai");
    expect(
      getDependencyGroupName(new Set(["@anthropic-ai/sdk"])),
    ).toBe("ai");
  });

  it("detects database deps", () => {
    expect(getDependencyGroupName(new Set(["drizzle-orm"]))).toBe("db");
    expect(getDependencyGroupName(new Set(["better-sqlite3"]))).toBe("db");
  });

  it("detects Hono as api", () => {
    expect(getDependencyGroupName(new Set(["hono"]))).toBe("api");
  });

  it("detects remotion as video", () => {
    expect(getDependencyGroupName(new Set(["remotion"]))).toBe("video");
  });

  it("detects commander as cli", () => {
    expect(getDependencyGroupName(new Set(["commander"]))).toBe("cli");
  });

  it("detects monaco as editor", () => {
    expect(getDependencyGroupName(new Set(["monaco-editor"]))).toBe("editor");
  });

  it("detects MCP deps", () => {
    expect(
      getDependencyGroupName(new Set(["@modelcontextprotocol/sdk"])),
    ).toBe("mcp");
  });

  it("detects cloudflare as edge", () => {
    expect(getDependencyGroupName(new Set(["@cloudflare/workers"]))).toBe(
      "edge",
    );
  });

  it("detects better-auth as auth", () => {
    expect(getDependencyGroupName(new Set(["better-auth"]))).toBe("auth");
  });

  it("detects stripe as payments", () => {
    expect(getDependencyGroupName(new Set(["stripe"]))).toBe("payments");
  });

  it("combines multiple tags with hyphen, max 3", () => {
    const deps = new Set(["hono", "drizzle-orm", "react", "@cloudflare/kv"]);
    const result = getDependencyGroupName(deps);
    expect(result.split("-").length).toBeLessThanOrEqual(3);
    expect(result).toContain("db");
    expect(result).toContain("api");
  });

  it("suppresses ui tag when editor tag present", () => {
    const deps = new Set(["react", "monaco-editor"]);
    const result = getDependencyGroupName(deps);
    expect(result).toBe("editor");
    expect(result).not.toContain("ui");
  });

  it("suppresses ui tag when video tag present", () => {
    const deps = new Set(["react", "remotion"]);
    const result = getDependencyGroupName(deps);
    expect(result).toBe("video");
    expect(result).not.toContain("ui");
  });

  it("detects node built-ins only when no other tags", () => {
    expect(getDependencyGroupName(new Set(["node:fs"]))).toBe("node-sys");
    // When combined with other deps, node-sys should not appear
    const deps = new Set(["node:fs", "hono"]);
    expect(getDependencyGroupName(deps)).toBe("api");
  });

  it("uses semantic fallback for known npm packages", () => {
    expect(getDependencyGroupName(new Set(["chess.js"]))).toBe("chess-core");
    expect(getDependencyGroupName(new Set(["async-mutex"]))).toBe(
      "concurrency",
    );
    expect(getDependencyGroupName(new Set(["html2canvas-pro"]))).toBe(
      "rendering",
    );
  });

  it("uses 'lazy-imports' for unknown deps instead of raw dep names", () => {
    expect(
      getDependencyGroupName(new Set(["some-obscure-package"])),
    ).toBe("lazy-imports");
  });

  it("does NOT produce raw dep names like 'spike-land-ai-esbuild-wasm-async-mutex'", () => {
    const result = getDependencyGroupName(
      new Set(["esbuild-wasm", "async-mutex"]),
    );
    expect(result).not.toContain("spike-land-ai");
    // async-mutex is in the semantic map → "concurrency"
    expect(result).toBe("concurrency");
  });

  it("combines multiple semantic names when no tags match", () => {
    const deps = new Set(["chess.js", "async-mutex"]);
    const result = getDependencyGroupName(deps);
    // Should be alphabetically sorted semantic names
    expect(result).toBe("chess-core-concurrency");
  });
});

// ─── deduplicateDepGroup ───────────────────────────────────────────

describe("deduplicateDepGroup", () => {
  it("collapses when dep-group matches category exactly", () => {
    expect(deduplicateDepGroup("cli", "cli")).toBe("core-logic");
  });

  it("does NOT collapse when they differ", () => {
    expect(deduplicateDepGroup("api", "edge-api")).toBe("api");
    expect(deduplicateDepGroup("ui", "frontend")).toBe("ui");
    expect(deduplicateDepGroup("mcp", "mcp-tools")).toBe("mcp");
  });

  it("preserves compound dep-group names", () => {
    expect(deduplicateDepGroup("db-api", "edge-api")).toBe("db-api");
  });

  it("handles core-logic passthrough", () => {
    expect(deduplicateDepGroup("core-logic", "core")).toBe("core-logic");
  });
});

// ─── kindToCategory ────────────────────────────────────────────────

describe("kindToCategory", () => {
  it("maps mcp-server to mcp-tools", () => {
    expect(kindToCategory["mcp-server"]).toBe("mcp-tools");
  });

  it("maps worker to edge-api", () => {
    expect(kindToCategory["worker"]).toBe("edge-api");
  });

  it("maps browser to frontend", () => {
    expect(kindToCategory["browser"]).toBe("frontend");
  });

  it("maps video to media", () => {
    expect(kindToCategory["video"]).toBe("media");
  });

  it("maps cli to cli", () => {
    expect(kindToCategory["cli"]).toBe("cli");
  });

  it("maps library to core", () => {
    expect(kindToCategory["library"]).toBe("core");
  });

  it("maps block to core", () => {
    expect(kindToCategory["block"]).toBe("core");
  });
});

// ─── categoryRules ─────────────────────────────────────────────────

describe("categoryRules", () => {
  const emptyDeps = new Set<string>();

  it("MCP rule matches @modelcontextprotocol/sdk", () => {
    const mcpRule = categoryRules.find((r) => r.category === "mcp-tools")!;
    expect(
      mcpRule.predicate(
        emptyDeps,
        new Set(["@modelcontextprotocol/sdk"]),
        undefined,
      ),
    ).toBe(true);
    expect(mcpRule.predicate(emptyDeps, new Set(["react"]), undefined)).toBe(
      false,
    );
  });

  it("frontend rule matches react", () => {
    const frontendRule = categoryRules.find(
      (r) => r.category === "frontend",
    )!;
    expect(
      frontendRule.predicate(emptyDeps, new Set(["react"]), undefined),
    ).toBe(true);
    expect(
      frontendRule.predicate(emptyDeps, new Set(["react-dom"]), undefined),
    ).toBe(true);
  });

  it("AI rule matches various AI SDKs", () => {
    const aiRule = categoryRules.find((r) => r.category === "ai")!;
    expect(
      aiRule.predicate(
        emptyDeps,
        new Set(["@ai-sdk/anthropic"]),
        undefined,
      ),
    ).toBe(true);
    expect(
      aiRule.predicate(
        emptyDeps,
        new Set(["@anthropic-ai/sdk"]),
        undefined,
      ),
    ).toBe(true);
    expect(
      aiRule.predicate(emptyDeps, new Set(["replicate"]), undefined),
    ).toBe(true);
  });

  it("core rule matches library and block kinds", () => {
    const coreRule = categoryRules.find((r) => r.category === "core")!;
    expect(coreRule.predicate(emptyDeps, emptyDeps, "library")).toBe(true);
    expect(coreRule.predicate(emptyDeps, emptyDeps, "block")).toBe(true);
    expect(coreRule.predicate(emptyDeps, emptyDeps, "worker")).toBe(false);
  });
});

// ─── nameOverrides ─────────────────────────────────────────────────

describe("nameOverrides", () => {
  it("spike-cli maps to spike-cli (not 'cli' to avoid stutter)", () => {
    expect(nameOverrides["spike-cli"]).toBe("spike-cli");
  });

  it("spike-app maps to platform-frontend", () => {
    expect(nameOverrides["spike-app"]).toBe("platform-frontend");
  });

  it("spike-edge maps to main (to avoid edge-api/edge-api stutter)", () => {
    expect(nameOverrides["spike-edge"]).toBe("main");
  });
});

// ─── excludedDeps ──────────────────────────────────────────────────

describe("excludedDeps", () => {
  it("excludes common utility deps that shouldn't affect classification", () => {
    expect(excludedDeps.has("zod")).toBe(true);
    expect(excludedDeps.has("vitest")).toBe(true);
    expect(excludedDeps.has("typescript")).toBe(true);
  });

  it("excludes MCP SDK (has its own category rule)", () => {
    expect(excludedDeps.has("@modelcontextprotocol/sdk")).toBe(true);
  });
});
