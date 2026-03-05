import path from "node:path";
import { defineConfig, defineProject } from "vitest/config";

const root = path.resolve(import.meta.dirname, "..");

function src(...segments: string[]) {
  return path.join(root, "src", ...segments);
}

function tests(...segments: string[]) {
  return path.join(root, ".tests", ...segments);
}

// Coverage threshold tiers:
//   Tier 1 (90%+): packages with mature test suites (bazdmeg-mcp, openclaw-mcp)
//   Tier 2 (60%):  standard packages with solid test coverage
//   Tier 3 (40%):  UI/jsdom packages and packages with few tests
const tier2Thresholds = { lines: 60, functions: 55, branches: 50, statements: 60 };
const tier3Thresholds = { lines: 40, functions: 35, branches: 30, statements: 40 };

// Common coverage exclude patterns
const commonCoverageExclude = [
  "**/*.test.ts",
  "**/*.spec.ts",
  "**/__test-utils__/**",
  "vitest.config.ts",
];

// Packages that use pool: "forks" with fileParallelism
const forksPoolConfig = {
  pool: "forks" as const,
  fileParallelism: true,
  silent: true,
};

// Base aliases that all projects inherit (from vitest.base.ts)
const baseAliases = {
  "@spike-land-ai/shared/tool-builder": src("shared/tool-builder/index.ts"),
  "@spike-land-ai/shared": src("shared/index.ts"),
  "@spike-land-ai/block-sdk/storage": src("block-sdk/storage/index.ts"),
  "@spike-land-ai/block-sdk/adapters/d1": src("block-sdk/adapters/d1.ts"),
  "@spike-land-ai/block-sdk/adapters/idb": src("block-sdk/adapters/idb.ts"),
  "@spike-land-ai/block-sdk/react": src("block-sdk/react/index.ts"),
  "@spike-land-ai/block-sdk/mcp": src("block-sdk/mcp/index.ts"),
  "@spike-land-ai/block-sdk": src("block-sdk/index.ts"),
  "@spike-land-ai/block-tasks": src("block-tasks/index.ts"),
  "@spike-land-ai/mcp-server-base": src("mcp-server-base/index.ts"),
};

export default defineConfig({
  resolve: {
    alias: baseAliases,
  },
  test: {
    reporters: [path.join(root, "vitest-minimal-reporter.ts")],
    projects: [
  // ── bazdmeg-mcp ──────────────────────────────────────────
  {
    test: {
      name: "bazdmeg-mcp",
      ...forksPoolConfig,
      include: [tests("bazdmeg-mcp/**/*.test.ts")],
      reporters: [path.join(root, "vitest-minimal-reporter.ts")],
      coverage: {
        provider: "v8",
        include: [src("bazdmeg-mcp/**/*.ts")],
        exclude: [...commonCoverageExclude, "**/index.ts"],
        thresholds: { lines: 90, functions: 90, branches: 90, statements: 90 },
      },
    },
  },

  // ── block-sdk ────────────────────────────────────────────
  {
    resolve: {
      alias: {
        "@spike-land-ai/block-sdk/storage": src("block-sdk/storage/index.ts"),
        "@spike-land-ai/block-sdk/adapters/d1": src("block-sdk/adapters/d1.ts"),
        "@spike-land-ai/block-sdk/adapters/idb": src("block-sdk/adapters/idb.ts"),
        "@spike-land-ai/block-sdk/react": src("block-sdk/react/index.ts"),
        "@spike-land-ai/block-sdk/mcp": src("block-sdk/mcp/index.ts"),
        "@spike-land-ai/block-sdk": src("block-sdk/index.ts"),
        "@spike-land-ai/block-tasks": src("block-tasks/index.ts"),
        "@spike-land-ai/shared": src("shared/index.ts"),
        "@spike-land-ai/mcp-server-base": src("mcp-server-base/index.ts"),
      },
    },
    test: {
      name: "block-sdk",
      include: [tests("block-sdk/**/*.test.ts")],
      reporters: [path.join(root, "vitest-minimal-reporter.ts")],
      coverage: {
        provider: "v8",
        include: [src("block-sdk/**/*.ts")],
        exclude: [
          ...commonCoverageExclude,
          "**/adapters/d1.ts",
          "**/adapters/idb.ts",
          "**/index.ts",
          "**/storage/**",
        ],
        reportsDirectory: path.join(root, "coverage/block-sdk"),
        thresholds: tier2Thresholds,
      },
    },
  },

  // ── block-tasks ──────────────────────────────────────────
  {
    resolve: {
      alias: {
        "@spike-land-ai/block-sdk/storage": src("block-sdk/storage/index.ts"),
        "@spike-land-ai/block-sdk": src("block-sdk/index.ts"),
        "@spike-land-ai/block-tasks": src("block-tasks/index.ts"),
        "@spike-land-ai/shared": src("shared/index.ts"),
        "@spike-land-ai/mcp-server-base": src("mcp-server-base/index.ts"),
      },
    },
    test: {
      name: "block-tasks",
      include: [tests("block-tasks/**/*.test.ts")],
      reporters: [path.join(root, "vitest-minimal-reporter.ts")],
      coverage: {
        provider: "v8",
        include: [src("block-tasks/**/*.ts")],
        exclude: [
          ...commonCoverageExclude,
          "**/browser.ts",
          "**/worker.ts",
        ],
        reportsDirectory: path.join(root, "coverage/block-tasks"),
        thresholds: tier3Thresholds,
      },
    },
  },

  // ── chess-engine ─────────────────────────────────────────
  {
    resolve: {
      alias: {
        "@/": src("chess-engine/"),
      },
    },
    test: {
      name: "chess-engine",
      include: [tests("chess-engine/**/*.test.ts")],
      reporters: [path.join(root, "vitest-minimal-reporter.ts")],
      coverage: {
        provider: "v8",
        include: [src("chess-engine/**/*.ts")],
        exclude: [
          ...commonCoverageExclude,
          "**/index.ts",
          "**/generated/**",
          "**/lib/prisma.ts",
        ],
        thresholds: tier2Thresholds,
      },
    },
  },

  // ── code ─────────────────────────────────────────────────
  {
    resolve: {
      alias: {
        "@": src("code"),
      },
    },
    test: {
      name: "code",
      environment: "jsdom",
      setupFiles: [tests("code/setupTests.ts")],
      include: [tests("code/**/*.test.ts")],
      reporters: [path.join(root, "vitest-minimal-reporter.ts")],
      coverage: {
        provider: "v8",
        include: [src("code/**/*.ts"), src("code/**/*.tsx")],
        exclude: commonCoverageExclude,
        thresholds: tier3Thresholds,
      },
    },
  },

  // ── esbuild-wasm-mcp ────────────────────────────────────
  {
    test: {
      name: "esbuild-wasm-mcp",
      ...forksPoolConfig,
      include: [tests("esbuild-wasm-mcp/**/*.test.ts")],
      reporters: [path.join(root, "vitest-minimal-reporter.ts")],
      coverage: {
        provider: "v8",
        include: [src("esbuild-wasm-mcp/**/*.ts")],
        exclude: [...commonCoverageExclude, "**/index.ts"],
        thresholds: tier2Thresholds,
      },
    },
  },

  // ── hackernews-mcp ───────────────────────────────────────
  {
    test: {
      name: "hackernews-mcp",
      ...forksPoolConfig,
      include: [tests("hackernews-mcp/**/*.test.ts")],
      reporters: [path.join(root, "vitest-minimal-reporter.ts")],
      coverage: {
        provider: "v8",
        include: [src("hackernews-mcp/**/*.ts")],
        exclude: [...commonCoverageExclude, "**/index.ts"],
        thresholds: tier2Thresholds,
      },
    },
  },

  // ── image-studio-worker ──────────────────────────────────
  {
    test: {
      name: "image-studio-worker",
      environment: "node",
      include: [tests("image-studio-worker/**/*.test.ts")],
      reporters: [path.join(root, "vitest-minimal-reporter.ts")],
      coverage: {
        provider: "v8",
        include: [src("image-studio-worker/**/*.ts")],
        exclude: [
          ...commonCoverageExclude,
          "**/frontend/**",
          "**/migrations/**",
          "**/deps/nanoid.ts",
          "**/deps/db.ts",
          "**/deps/generation.ts",
          "**/index.ts",
          "**/server.ts",
          "**/agent/chat-handler.ts",
          "**/tool-registry.ts",
          "**/env.d.ts",
          "**/shared-types.ts",
        ],
        thresholds: tier2Thresholds,
      },
    },
  },

  // ── incremental-test-mcp ─────────────────────────────────
  {
    test: {
      name: "incremental-test-mcp",
      include: [tests("incremental-test-mcp/**/*.test.ts")],
      reporters: [path.join(root, "vitest-minimal-reporter.ts")],
      coverage: {
        provider: "v8",
        include: [src("incremental-test-mcp/**/*.ts")],
        exclude: commonCoverageExclude,
        thresholds: tier3Thresholds,
      },
    },
  },

  // ── mcp-auth ─────────────────────────────────────────────
  {
    test: {
      name: "mcp-auth",
      include: [tests("mcp-auth/**/*.test.ts")],
      reporters: [path.join(root, "vitest-minimal-reporter.ts")],
      coverage: {
        provider: "v8",
        include: [src("mcp-auth/**/*.ts")],
        exclude: commonCoverageExclude,
        thresholds: tier3Thresholds,
      },
    },
  },

  // ── mcp-image-studio ─────────────────────────────────────
  {
    test: {
      name: "mcp-image-studio",
      ...forksPoolConfig,
      include: [tests("mcp-image-studio/**/*.test.ts")],
      reporters: [path.join(root, "vitest-minimal-reporter.ts")],
      coverage: {
        provider: "v8",
        include: [src("mcp-image-studio/**/*.ts")],
        exclude: [
          ...commonCoverageExclude,
          "**/index.ts",
          "**/generated/**",
          "**/cli-server.ts",
        ],
        thresholds: tier2Thresholds,
      },
    },
  },

  // ── mcp-server-base ──────────────────────────────────────
  {
    test: {
      name: "mcp-server-base",
      include: [tests("mcp-server-base/**/*.test.ts")],
      reporters: [path.join(root, "vitest-minimal-reporter.ts")],
      coverage: {
        provider: "v8",
        include: [src("mcp-server-base/**/*.ts")],
        exclude: commonCoverageExclude,
        thresholds: tier3Thresholds,
      },
    },
  },

  // ── openclaw-mcp ─────────────────────────────────────────
  {
    test: {
      name: "openclaw-mcp",
      include: [tests("openclaw-mcp/**/*.test.ts")],
      reporters: [path.join(root, "vitest-minimal-reporter.ts")],
      coverage: {
        provider: "v8",
        reporter: ["text-summary"],
        include: [src("openclaw-mcp/**/*.ts")],
        exclude: [
          ...commonCoverageExclude,
          "**/index.ts",
          "**/types.ts",
          "**/*.d.ts",
        ],
        thresholds: { lines: 95, functions: 85, branches: 96, statements: 95 },
      },
    },
  },

  // ── qa-studio ────────────────────────────────────────────
  {
    test: {
      name: "qa-studio",
      ...forksPoolConfig,
      include: [tests("qa-studio/**/*.test.ts")],
      reporters: [path.join(root, "vitest-minimal-reporter.ts")],
      coverage: {
        provider: "v8",
        include: [src("qa-studio/**/*.ts")],
        exclude: [...commonCoverageExclude, "**/index.ts"],
        thresholds: tier2Thresholds,
      },
    },
  },

  // ── react-ts-worker ──────────────────────────────────────
  {
    resolve: {
      alias: {
        "react-ts-worker/react": src("react-ts-worker/react/index.ts"),
        "react-ts-worker/react-dom/client": src("react-ts-worker/react-dom/client.ts"),
        "react-ts-worker/react-dom/server": src("react-ts-worker/react-dom/server.ts"),
      },
    },
    test: {
      name: "react-ts-worker",
      environment: "jsdom",
      include: [tests("react-ts-worker/**/*.test.ts"), tests("react-ts-worker/**/*.test.tsx")],
      reporters: [path.join(root, "vitest-minimal-reporter.ts")],
      coverage: {
        provider: "v8",
        include: [src("react-ts-worker/**/*.ts"), src("react-ts-worker/**/*.tsx")],
        exclude: commonCoverageExclude,
        thresholds: tier3Thresholds,
      },
    },
  },

  // ── shared ───────────────────────────────────────────────
  {
    resolve: {
      alias: {
        "@spike-land-ai/shared/tool-builder": src("shared/tool-builder/index.ts"),
        "@spike-land-ai/shared": src("shared/index.ts"),
      },
    },
    test: {
      name: "shared",
      include: [tests("shared/**/*.test.ts")],
      reporters: [path.join(root, "vitest-minimal-reporter.ts")],
      coverage: {
        provider: "v8",
        reporter: ["text", "text-summary"],
        include: [
          src("shared/constants/**/*.ts"),
          src("shared/validations/**/*.ts"),
          src("shared/utils/**/*.ts"),
          src("shared/tool-builder/**/*.ts"),
        ],
        exclude: [
          ...commonCoverageExclude,
          "**/types/**",
          "**/tsup.config.ts",
          "**/index.ts",
          "**/tool-builder/types.ts",
        ],
        thresholds: tier2Thresholds,
      },
    },
  },

  // ── spike-app ────────────────────────────────────────────
  {
    resolve: {
      alias: {
        "@": src("spike-app"),
      },
    },
    test: {
      name: "spike-app",
      environment: "jsdom",
      setupFiles: [tests("spike-app/test-setup.ts")],
      include: [tests("spike-app/**/*.test.ts"), tests("spike-app/**/*.test.tsx")],
      reporters: [path.join(root, "vitest-minimal-reporter.ts")],
      coverage: {
        provider: "v8",
        include: [src("spike-app/**/*.ts"), src("spike-app/**/*.tsx")],
        exclude: commonCoverageExclude,
        thresholds: tier3Thresholds,
      },
    },
  },

  // ── spike-cli ────────────────────────────────────────────
  {
    test: {
      name: "spike-cli",
      include: [tests("spike-cli/**/*.test.ts")],
      reporters: [path.join(root, "vitest-minimal-reporter.ts")],
      coverage: {
        provider: "v8",
        reporter: ["text"],
        include: [src("spike-cli/**/*.ts")],
        exclude: [
          ...commonCoverageExclude,
          "**/dist/**",
          "**/index.ts",
          "**/cli.ts",
          "**/*.d.ts",
        ],
        thresholds: tier2Thresholds,
      },
    },
  },

  // ── spike-edge ───────────────────────────────────────────
  {
    resolve: {
      alias: {
        "cloudflare:workers": src("spike-edge/__mocks__/cloudflare-workers.ts"),
      },
    },
    test: {
      name: "spike-edge",
      include: [tests("spike-edge/**/*.test.ts")],
      reporters: [path.join(root, "vitest-minimal-reporter.ts")],
      coverage: {
        provider: "v8",
        include: [src("spike-edge/**/*.ts")],
        exclude: commonCoverageExclude,
        thresholds: tier2Thresholds,
      },
    },
  },

  // ── spike-land-backend ───────────────────────────────────
  {
    plugins: [
      {
        name: "html-string-loader",
        enforce: "pre" as const,
        transform(code: string, id: string) {
          if (id.endsWith(".html")) {
            return {
              code: `export default ${JSON.stringify(code)};`,
              map: null,
            };
          }
        },
      },
    ],
    resolve: {
      alias: {
        replicate: src("spike-land-backend/__mocks__/replicate.js"),
        "snakecase-keys": src("spike-land-backend/__mocks__/snakecase-keys.js"),
        cookie: src("spike-land-backend/__mocks__/cookie.js"),
        "@spike-land-ai/code": src("spike-land-backend/__mocks__/@spike-land-ai/code.js"),
        "@spike-land-ai/esbuild-wasm": path.join(
          root,
          "node_modules/@spike-land-ai/esbuild-wasm",
        ),
      },
    },
    test: {
      name: "spike-land-backend",
      setupFiles: [tests("spike-land-backend/vitest.setup.ts")],
      reporters: process.env["COVERAGE"]
        ? [path.join(root, "vitest-minimal-reporter.ts")]
        : ["hanging-process", path.join(root, "vitest-minimal-reporter.ts")],
      include: [tests("spike-land-backend/**/*.test.ts"), tests("spike-land-backend/**/*.spec.ts")],
      coverage: {
        provider: "istanbul",
        reporter: ["text-summary"],
        include: [src("spike-land-backend/**/*.ts")],
        exclude: [
          ...commonCoverageExclude,
          "**/*.d.ts",
          "**/frontend/**",
          "**/staticContent.mjs",
          "**/*.html",
          "**/*.wasm",
          "**/esbuild-defs.ts",
        ],
        thresholds: tier3Thresholds,
      },
    },
  },

  // ── spike-land-mcp ───────────────────────────────────────
  {
    test: {
      name: "spike-land-mcp",
      include: [tests("spike-land-mcp/**/*.test.ts")],
      reporters: [path.join(root, "vitest-minimal-reporter.ts")],
      coverage: {
        provider: "v8",
        include: [
          src("spike-land-mcp/auth/**/*.ts"),
          src("spike-land-mcp/db/**/*.ts"),
          src("spike-land-mcp/kv/**/*.ts"),
          src("spike-land-mcp/mcp/**/*.ts"),
          src("spike-land-mcp/procedures/**/*.ts"),
          src("spike-land-mcp/routes/**/*.ts"),
          src("spike-land-mcp/tools/tool-helpers.ts"),
          src("spike-land-mcp/tools/tool-factory.ts"),
          src("spike-land-mcp/tools/types.ts"),
          src("spike-land-mcp/app.ts"),
          src("spike-land-mcp/env.ts"),
        ],
        exclude: commonCoverageExclude,
        thresholds: tier2Thresholds,
      },
    },
  },

  // ── spike-review ─────────────────────────────────────────
  {
    test: {
      name: "spike-review",
      include: [tests("spike-review/**/*.test.ts")],
      reporters: [path.join(root, "vitest-minimal-reporter.ts")],
      coverage: {
        provider: "v8",
        include: [src("spike-review/**/*.ts")],
        exclude: [
          ...commonCoverageExclude,
          "**/cli.ts",
          "**/worker/**",
          "**/index.ts",
        ],
        thresholds: tier2Thresholds,
      },
    },
  },

  // ── state-machine ────────────────────────────────────────
  {
    test: {
      name: "state-machine",
      include: [tests("state-machine/**/*.test.ts")],
      reporters: [path.join(root, "vitest-minimal-reporter.ts")],
      coverage: {
        provider: "v8",
        include: [src("state-machine/**/*.ts")],
        exclude: [
          ...commonCoverageExclude,
          "**/cli.ts",
          "**/index.ts",
          "**/types.ts",
          "**/prisma.d.ts",
        ],
        thresholds: tier2Thresholds,
      },
    },
  },

  // ── transpile ────────────────────────────────────────────
  {
    plugins: [
      {
        name: "wasm-stub",
        enforce: "pre" as const,
        load(id: string) {
          if (id.endsWith(".wasm")) {
            return `export default "https://mock.wasm.url/esbuild.wasm";`;
          }
        },
      },
    ],
    test: {
      name: "transpile",
      include: [tests("transpile/**/*.test.ts"), tests("transpile/**/*.spec.ts")],
      reporters: [path.join(root, "vitest-minimal-reporter.ts")],
      coverage: {
        provider: "v8",
        include: [src("transpile/**/*.ts")],
        exclude: [...commonCoverageExclude, "**/*.d.ts"],
        thresholds: tier3Thresholds,
      },
    },
  },

  // ── vibe-dev ─────────────────────────────────────────────
  {
    test: {
      name: "vibe-dev",
      include: [tests("vibe-dev/**/*.test.ts")],
      reporters: [path.join(root, "vitest-minimal-reporter.ts")],
      coverage: {
        provider: "v8",
        include: [src("vibe-dev/**/*.ts")],
        exclude: [...commonCoverageExclude, "**/cli.ts"],
        thresholds: tier2Thresholds,
      },
    },
  },

  // ── video ────────────────────────────────────────────────
  {
    test: {
      name: "video",
      environment: "jsdom",
      ...forksPoolConfig,
      include: [tests("video/**/*.test.ts"), tests("video/**/*.test.tsx")],
      reporters: [path.join(root, "vitest-minimal-reporter.ts")],
      coverage: {
        provider: "v8",
        include: [src("video/**/*.ts"), src("video/**/*.tsx")],
        exclude: [...commonCoverageExclude, "**/index.ts"],
        thresholds: tier3Thresholds,
      },
    },
  },
    ],
  },
});
