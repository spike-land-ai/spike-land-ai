import path from "node:path";
import { defineConfig } from "vitest/config";

const root = path.resolve(import.meta.dirname, "..");

function src(...segments: string[]) {
  return path.join(root, "src", ...segments);
}

function tests(...segments: string[]) {
  return path.join(root, ".tests", ...segments);
}

function pkg(...segments: string[]) {
  return path.join(root, "packages", ...segments);
}

const reporter = path.join(root, "vitest-minimal-reporter.ts");

// ── Tier thresholds ────────────────────────────────────────────────
const tier1 = { lines: 90, functions: 90, branches: 90, statements: 90 };
const tier2 = { lines: 60, functions: 55, branches: 50, statements: 60 };
const tier3 = { lines: 40, functions: 35, branches: 30, statements: 40 };

// ── Shared patterns ────────────────────────────────────────────────
const commonCoverageExclude = [
  "**/*.test.ts",
  "**/*.spec.ts",
  "**/__test-utils__/**",
  "vitest.config.ts",
];

const forksPool = {
  pool: "forks" as const,
  fileParallelism: true,
  silent: true,
};

// ── Base aliases (inherited by root-level resolve) ─────────────────
const packagePathMap: Record<string, string> = {
  "bazdmeg-mcp": "mcp-tools/bazdmeg",
  "block-sdk": "core/block-sdk",
  "block-tasks": "core/block-tasks",
  "block-website": "core/block-website",
  "chess-engine": "core/chess",
  code: "frontend/monaco-editor",
  "esbuild-wasm-mcp": "mcp-tools/esbuild-wasm",
  "google-analytics-mcp": "mcp-tools/google-analytics",
  "google-ads-mcp": "mcp-tools/google-ads",
  "hackernews-mcp": "mcp-tools/hackernews",
  "iwd-spotlight-mcp": "mcp-tools/iwd-spotlight",
  "image-studio-worker": "edge-api/image-studio-worker",
  "mcp-auth": "edge-api/auth",
  "mcp-image-studio": "mcp-tools/image-studio",
  "mcp-server-base": "core/server-base",
  "openclaw-mcp": "mcp-tools/openclaw",
  "qa-studio": "core/browser-automation",
  "react-ts-worker": "core/react-engine",
  shared: "core/shared-utils",
  "spike-app": "frontend/platform-frontend",
  "spike-cli": "cli/spike-cli",
  "spike-edge": "edge-api/main",
  "spike-chat": "edge-api/spike-chat",
  "spike-land-backend": "edge-api/backend",
  "spike-land-mcp": "edge-api/spike-land",
  "spike-review": "mcp-tools/code-review",
  "stripe-analytics-mcp": "mcp-tools/stripe-analytics",
  "state-machine": "core/statecharts",
  transpile: "edge-api/transpile",
  "vibe-dev": "cli/docker-dev",
  video: "media/educational-videos",
  "whatsapp-mcp": "utilities/whatsapp",
};

const baseAliases: Record<string, string> = {
  react: path.join(root, "node_modules/react"),
  "react-dom": path.join(root, "node_modules/react-dom"),
  "@spike-land-ai/shared/tool-builder": src("core/shared-utils/core-logic/tool-builder-index.ts"),
  "@spike-land-ai/shared": src("core/shared-utils/core-logic/index.ts"),
  "@spike-land-ai/block-sdk/storage": src("core/block-sdk/core-logic/storage-index.ts"),
  "@spike-land-ai/block-sdk/adapters/d1": src("core/block-sdk/core-logic/d1.ts"),
  "@spike-land-ai/block-sdk/adapters/idb": src("core/block-sdk/db/idb.ts"),
  "@spike-land-ai/block-sdk/react": src("core/block-sdk/ui/react-index.ts"),
  "@spike-land-ai/block-sdk/mcp": src("core/block-sdk/lazy-imports/mcp-index.ts"),
  "@spike-land-ai/block-sdk": src("core/block-sdk/core-logic/index.ts"),
  "@spike-land-ai/block-tasks": src("core/block-tasks/lazy-imports/index.ts"),
  "@spike-land-ai/mcp-server-base": src("core/server-base/core-logic/index.ts"),
  "@spike-land-ai/mcp-image-studio/register": src("mcp-tools/image-studio/lazy-imports/register.ts"),
  "@spike-land-ai/mcp-image-studio": src("mcp-tools/image-studio/core-logic/index.ts"),
  "react/jsx-dev-runtime": src("core/react-engine/core-logic/react/jsx-runtime.ts"),
  "react/jsx-runtime": src("core/react-engine/core-logic/react/jsx-runtime.ts"),
};

// ── Per-package config type ────────────────────────────────────────
interface PkgConfig {
  tier: 1 | 2 | 3;
  pool?: "forks";
  env?: "jsdom";
  globals?: boolean;
  setup?: string[];
  includeTests?: string[];
  includeSrc?: string[];
  coverageExclude?: string[];
  coverageReporter?: string[];
  aliases?: Record<string, string>;
  plugins?: Array<Record<string, unknown>>;
  thresholds?: { lines: number; functions: number; branches: number; statements: number };
  provider?: "istanbul";
  reportsDirectory?: string;
  reporters?: string[];
  coverageAll?: boolean;
}

// ── Package registry ───────────────────────────────────────────────
const packages: Record<string, PkgConfig> = {
  "bazdmeg-mcp": { tier: 1, pool: "forks" },

  "block-sdk": {
    tier: 2,
    aliases: {
      "@spike-land-ai/block-sdk/storage": src("core/block-sdk/core-logic/storage-index.ts"),
      "@spike-land-ai/block-sdk/adapters/d1": src("core/block-sdk/core-logic/d1.ts"),
      "@spike-land-ai/block-sdk/adapters/idb": src("core/block-sdk/db/idb.ts"),
      "@spike-land-ai/block-sdk/react": src("core/block-sdk/ui/react-index.ts"),
      "@spike-land-ai/block-sdk/mcp": src("core/block-sdk/lazy-imports/mcp-index.ts"),
      "@spike-land-ai/block-sdk": src("core/block-sdk/core-logic/index.ts"),
      "@spike-land-ai/block-tasks": src("core/block-tasks/lazy-imports/index.ts"),
      "@spike-land-ai/shared": src("core/shared-utils/core-logic/index.ts"),
      "@spike-land-ai/mcp-server-base": src("core/server-base/core-logic/index.ts"),
    },
    coverageExclude: ["**/core-logic/d1.ts", "**/db/idb.ts", "**/core-logic/storage-index.ts"],
    reportsDirectory: path.join(root, "coverage/block-sdk"),
  },

  "block-tasks": {
    tier: 3,
    aliases: {
      "@spike-land-ai/block-sdk/storage": src("core/block-sdk/core-logic/storage-index.ts"),
      "@spike-land-ai/block-sdk": src("core/block-sdk/core-logic/index.ts"),
      "@spike-land-ai/block-tasks": src("core/block-tasks/lazy-imports/index.ts"),
      "@spike-land-ai/shared/tool-builder": src(
        "core/shared-utils/core-logic/tool-builder-index.ts",
      ),
      "@spike-land-ai/shared": src("core/shared-utils/core-logic/index.ts"),
      "@spike-land-ai/mcp-server-base": src("core/server-base/core-logic/index.ts"),
    },
    coverageExclude: ["**/browser.ts", "**/worker.ts"],
    reportsDirectory: path.join(root, "coverage/block-tasks"),
  },

  "block-website": {
    tier: 3,
    env: "jsdom",
    includeTests: [tests("block-website/**/*.test.ts"), tests("block-website/**/*.test.tsx")],
    aliases: {
      // Subpath aliases must be listed before the bare "react" alias so Vite's
      // import-analysis plugin resolves them before falling back to the custom react path.
      "react/jsx-dev-runtime": src("core/react-engine/core-logic/react/jsx-runtime.ts"),
      "react/jsx-runtime": src("core/react-engine/core-logic/react/jsx-runtime.ts"),
      "react-dom": src("core/react-engine/core-logic/react-dom/client.ts"),
      react: src("core/react-engine/core-logic/react/index.ts"),
    },
    includeSrc: [
      src("core/block-website/core-logic/**/*.ts"),
      src("core/block-website/ui/**/*.ts"),
      src("core/block-website/animation/**/*.ts"),
    ],
    coverageExclude: ["**/types.ts"],
  },

  "chess-engine": {
    tier: 2,
    aliases: { "@/": src("core/chess/") },
    coverageExclude: ["**/generated/**", "**/lib/prisma.ts"],
    coverageAll: true,
    reportsDirectory: path.join(root, "coverage/chess-engine"),
  },

  code: {
    tier: 3,
    env: "jsdom",
    globals: true,
    setup: [tests("code/setupTests.ts")],
    includeTests: [
      tests("code/**/*.test.ts"),
      tests("code/**/*.spec.ts"),
      tests("code/**/*.spec.tsx"),
      src("frontend/monaco-editor/file-types/__tests__/**/*.test.ts"),
    ],
    aliases: { "@": src("frontend/monaco-editor/@") },
    includeSrc: [src("frontend/monaco-editor/**/*.ts"), src("frontend/monaco-editor/**/*.tsx")],
    coverageExclude: [],
    reportsDirectory: path.join(root, "coverage/code"),
  },

  "esbuild-wasm-mcp": { tier: 2, pool: "forks" },
  "google-analytics-mcp": { tier: 2, pool: "forks" },
  "google-ads-mcp": { tier: 2, pool: "forks" },
  "hackernews-mcp": { tier: 2, pool: "forks" },
  "iwd-spotlight-mcp": { tier: 2, pool: "forks" },

  "image-studio-worker": {
    tier: 2,
    env: "jsdom",
    includeTests: [tests("image-studio-worker/**/*.test.ts"), tests("image-studio-worker/**/*.test.tsx")],
    aliases: {
      "@/": pkg("image-studio-worker/frontend/src/"),
    },
    coverageExclude: [
      "**/frontend/**",
      "**/migrations/**",
      "**/deps/nanoid.ts",
      "**/deps/db.ts",
      "**/deps/generation.ts",
      "**/server.ts",
      "**/agent/chat-handler.ts",
      "**/tool-registry.ts",
      "**/env.d.ts",
      "**/shared-types.ts",
    ],
  },

  "mcp-auth": {
    tier: 1,
    thresholds: { lines: 100, functions: 100, branches: 95, statements: 100 },
    coverageExclude: [],
  },

  "mcp-image-studio": {
    tier: 2,
    pool: "forks",
    aliases: baseAliases,
    coverageExclude: ["**/generated/**", "**/cli-server.ts"],
  },

  "mcp-server-base": { tier: 3, coverageExclude: [] },

  "openclaw-mcp": {
    tier: 1,
    thresholds: { lines: 95, functions: 85, branches: 96, statements: 95 },
    coverageReporter: ["text-summary"],
    coverageExclude: ["**/types.ts", "**/*.d.ts"],
  },

  "qa-studio": { tier: 2, pool: "forks" },

  "react-ts-worker": {
    tier: 3,
    env: "jsdom",
    aliases: {
      "react-ts-worker/react": src("core/react-engine/core-logic/react/index.ts"),
      "react-ts-worker/react-dom/client": src("core/react-engine/core-logic/react-dom/client.ts"),
      "react-ts-worker/react-dom/server": src("core/react-engine/core-logic/react-dom/server.ts"),
    },
    includeTests: [tests("react-ts-worker/**/*.test.ts"), tests("react-ts-worker/**/*.test.tsx")],
    includeSrc: [src("core/react-engine/**/*.ts"), src("core/react-engine/**/*.tsx")],
    coverageExclude: [],
  },

  shared: {
    tier: 2,
    aliases: {
      "@spike-land-ai/shared/tool-builder": src(
        "core/shared-utils/core-logic/tool-builder-index.ts",
      ),
      "@spike-land-ai/shared": src("core/shared-utils/core-logic/index.ts"),
    },
    coverageReporter: ["text", "text-summary"],
    includeSrc: [
      src("core/shared-utils/core-logic/**/*.ts"),
      src("core/shared-utils/styling/**/*.ts"),
      src("core/shared-utils/ui/**/*.ts"),
    ],
    coverageExclude: ["**/types.ts", "**/types-index.ts"],
  },

  status: {
    tier: 3,
    includeTests: [src("edge-api/status/__tests__/**/*.test.ts")],
    includeSrc: [src("edge-api/status/**/*.ts")],
    coverageExclude: [],
  },

  "spike-app": {
    tier: 3,
    env: "jsdom",
    setup: [tests("spike-app/test-setup.ts")],
    aliases: {
      "@": src("frontend/platform-frontend"),
      "monaco-editor": src("monaco-editor/src/index.ts"),
    },
    includeTests: [tests("spike-app/**/*.test.ts"), tests("spike-app/**/*.test.tsx")],
    includeSrc: [
      src("frontend/platform-frontend/**/*.ts"),
      src("frontend/platform-frontend/**/*.tsx"),
    ],
    coverageExclude: [],
  },

  "spike-cli": {
    tier: 2,
    coverageReporter: ["text"],
    coverageExclude: ["**/dist/**", "**/cli.ts", "**/*.d.ts"],
  },

  "spike-chat": {
    tier: 1,
    aliases: { "cloudflare:workers": src("edge-api/main/core-logic/cloudflare-workers.ts") },
    includeTests: [src("edge-api/spike-chat/__tests__/**/*.test.ts")],
    coverageExclude: [],
  },

  "spike-edge": {
    tier: 2,
    includeTests: [
      tests("spike-edge/**/*.test.ts"),
      src("edge-api/main/api/__tests__/**/*.test.ts"),
    ],
    aliases: { "cloudflare:workers": src("edge-api/main/core-logic/cloudflare-workers.ts") },
    coverageExclude: [],
  },

  "spike-land-backend": {
    tier: 3,
    provider: "istanbul",
    setup: [tests("spike-land-backend/vitest.setup.ts")],
    plugins: [
      {
        name: "html-string-loader",
        enforce: "pre",
        transform(code: string, id: string) {
          if (id.endsWith(".html")) {
            return { code: `export default ${JSON.stringify(code)};`, map: null };
          }
        },
      },
    ],
    aliases: {
      replicate: src("edge-api/backend/__mocks__/replicate.js"),
      "snakecase-keys": src("edge-api/backend/__mocks__/snakecase-keys.js"),
      cookie: src("edge-api/backend/__mocks__/cookie.js"),
      "@spike-land-ai/code": src("edge-api/backend/__mocks__/@spike-land-ai/code.js"),
      "esbuild-wasm": path.join(root, "node_modules/esbuild-wasm"),
    },
    reporters: process.env.COVERAGE ? [reporter] : ["hanging-process", reporter],
    includeTests: [
      tests("spike-land-backend/**/*.test.ts"),
      tests("spike-land-backend/**/*.spec.ts"),
    ],
    coverageReporter: ["text-summary"],
    coverageExclude: [
      "**/*.d.ts",
      "**/frontend/**",
      "**/staticContent.mjs",
      "**/*.html",
      "**/*.wasm",
      "**/esbuild-defs.ts",
    ],
  },

  "spike-land-mcp": {
    tier: 2,
    aliases: {
      "@spike-land-ai/shared/tool-builder": src(
        "core/shared-utils/core-logic/tool-builder-index.ts",
      ),
      "@spike-land-ai/shared": src("core/shared-utils/core-logic/index.ts"),
      "@spike-land-ai/mcp-server-base": src("core/server-base/core-logic/index.ts"),
    },
    includeSrc: [
      src("edge-api/spike-land/api/**/*.ts"),
      src("edge-api/spike-land/core-logic/**/*.ts"),
      src("edge-api/spike-land/db/**/*.ts"),
      src("edge-api/spike-land/lazy-imports/**/*.ts"),
      src("edge-api/spike-land/index.ts"),
    ],
    coverageExclude: [],
  },

  "spike-review": {
    tier: 2,
    coverageExclude: ["**/cli.ts", "**/worker/**", "**/spike-review/worker/**"],
  },

  "stripe-analytics-mcp": { tier: 2, pool: "forks", aliases: baseAliases },

  "state-machine": {
    tier: 2,
    coverageExclude: ["**/cli.ts", "**/types.ts", "**/prisma.d.ts"],
  },

  transpile: {
    tier: 3,
    plugins: [
      {
        name: "wasm-stub",
        enforce: "pre",
        load(id: string) {
          if (id.endsWith(".wasm")) {
            return `export default "https://mock.wasm.url/esbuild.wasm";`;
          }
        },
      },
    ],
    includeTests: [tests("transpile/**/*.test.ts"), tests("transpile/**/*.spec.ts")],
    coverageExclude: ["**/*.d.ts"],
  },

  "vibe-dev": {
    tier: 2,
    coverageExclude: ["**/cli.ts"],
  },

  video: {
    tier: 3,
    env: "jsdom",
    pool: "forks",
    setup: [tests("video/setup.ts")],
    includeTests: [tests("video/**/*.test.ts"), tests("video/**/*.test.tsx")],
    includeSrc: [src("media/educational-videos/**/*.ts"), src("media/educational-videos/**/*.tsx")],
  },

  "whatsapp-mcp": {
    tier: 2,
    pool: "forks",
    includeTests: [src("utilities/whatsapp/__tests__/**/*.test.ts")],
  },
};

// ── Project generator ──────────────────────────────────────────────
function buildProject(name: string, cfg: PkgConfig) {
  const tierThresholds = cfg.tier === 1 ? tier1 : cfg.tier === 2 ? tier2 : tier3;
  const thresholds = cfg.thresholds ?? tierThresholds;

  const mappedPath = packagePathMap[name] ?? name;
  const defaultIncludeTests = [tests(`${name}/**/*.test.ts`)];
  const defaultIncludeSrc = [src(`${mappedPath}/**/*.ts`)];
  const _defaultCoverageExclude = [...commonCoverageExclude, "**/index.ts"];

  const coverageExclude =
    cfg.coverageExclude !== undefined && cfg.coverageExclude.length === 0
      ? commonCoverageExclude
      : [...commonCoverageExclude, "**/index.ts", ...(cfg.coverageExclude ?? [])];

  const testConfig: Record<string, unknown> = {
    name,
    include: cfg.includeTests ?? defaultIncludeTests,
    reporters: cfg.reporters ?? [reporter],
    coverage: {
      provider: cfg.provider ?? "v8",
      ...(cfg.coverageReporter ? { reporter: cfg.coverageReporter } : {}),
      ...(cfg.coverageAll ? { all: true } : {}),
      include: cfg.includeSrc ?? defaultIncludeSrc,
      exclude: coverageExclude,
      ...(cfg.reportsDirectory ? { reportsDirectory: cfg.reportsDirectory } : {}),
      thresholds,
    },
  };

  if (cfg.pool === "forks") Object.assign(testConfig, forksPool);
  if (cfg.env) testConfig.environment = cfg.env;
  if (cfg.globals) testConfig.globals = true;
  if (cfg.setup) testConfig.setupFiles = cfg.setup;

  const project: Record<string, unknown> = { test: testConfig };
  // Merge aliases so that subpath specifiers (e.g. "react/jsx-dev-runtime") are
  // checked before their prefix ("react"). We achieve this by sorting the merged
  // entries from longest key to shortest before building the final object.
  const mergedAliasEntries = Object.entries({ ...baseAliases, ...(cfg.aliases ?? {}) }).sort(
    ([a], [b]) => b.length - a.length,
  );
  project.resolve = { alias: Object.fromEntries(mergedAliasEntries) };
  if (cfg.plugins) project.plugins = cfg.plugins;

  return project;
}

// ── Build all projects ─────────────────────────────────────────────
const projects = Object.entries(packages).map(([name, cfg]) => buildProject(name, cfg));

export default defineConfig({
  resolve: { alias: baseAliases },
  test: {
    passWithNoTests: true,
    reporters: [reporter],
    coverage: {
      exclude: [
        // spike-land-backend: CF Workers runtime paths not exercisable in Node
        src("edge-api/backend/types/cloudflare.ts"),
        src("edge-api/backend/chatRoom.ts"),
        src("edge-api/backend/chat.ts"),
        src("edge-api/backend/anthropicHandler.ts"),
        src("edge-api/backend/websocketHandler.ts"),
        src("edge-api/backend/handlers/postHandler.ts"),
        src("edge-api/backend/mcp/handler.ts"),
        src("edge-api/backend/routes/apiRoutes.ts"),
        src("edge-api/backend/replicateHandler.ts"),
        src("edge-api/backend/Logs.ts"),
        src("edge-api/backend/fetchHandler.ts"),
        src("edge-api/backend/mainFetchHandler.ts"),
        src("edge-api/backend/mcp/tools/edit-tools.ts"),
        src("edge-api/backend/mcp/tools/find-tools.ts"),
        src("edge-api/backend/utils/jsonSchemaToZod.ts"),
        // Monaco DOM-only files
        src("frontend/monaco-editor/@/lib/ws.ts"),
        src("frontend/monaco-editor/@/lib/shared-w-polyfill.ts"),
        src("frontend/monaco-editor/@/lib/code-session.ts"),
        src("frontend/monaco-editor/@/services/editorUtils.ts"),
      ],
    },
    projects,
  },
});
