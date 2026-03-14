/**
 * Next.js → Edge-native transform engine.
 *
 * Converts Next.js source code to TanStack Router + Hono + Vite equivalents.
 * All transforms are regex-based (no AST) for Cloudflare Workers compatibility.
 */

export type {
  TransformResult,
  RepoFile,
  MigrationReport,
  RouteEntry,
  TransformOptions,
} from "./types.ts";

export { DEFAULT_TRANSFORM_OPTIONS } from "./types.ts";
export { rewriteImports } from "./import-rewriter.ts";
export { convertApiRoute, buildRouteTree } from "./route-converter.ts";
export { convertDataLoaders } from "./data-loader-converter.ts";
export { convertConfig, rewriteEnvVars, convertRewritesAndRedirects } from "./config-converter.ts";
export { convertMiddleware } from "./middleware-converter.ts";

import type { RepoFile, MigrationReport, TransformResult } from "./types.ts";
import { rewriteImports } from "./import-rewriter.ts";
import { buildRouteTree, convertApiRoute } from "./route-converter.ts";
import { convertDataLoaders } from "./data-loader-converter.ts";
import { convertConfig, rewriteEnvVars, convertRewritesAndRedirects } from "./config-converter.ts";
import { convertMiddleware } from "./middleware-converter.ts";

/**
 * Run the full migration pipeline on a set of repo files.
 */
export function migrateNextjsProject(
  files: RepoFile[],
  routerType: "pages" | "app" | "mixed" | "unknown",
): MigrationReport {
  const results: TransformResult[] = [];
  const allWarnings: string[] = [];

  // 1. Convert config files
  const configFiles = files.filter((f) => f.path.match(/next\.config\.(js|mjs|ts)$/));
  for (const f of configFiles) {
    const result = convertConfig(f.path, f.content);
    results.push(result);
    allWarnings.push(...result.warnings);
  }

  // 2. Convert rewrites and redirects from config
  for (const f of configFiles) {
    const rewriteResult = convertRewritesAndRedirects(f.content);
    if (rewriteResult.code && !rewriteResult.code.startsWith("// No rewrites")) {
      results.push({
        filename: "middleware/rewrites.ts",
        original: "",
        transformed: rewriteResult.code,
        warnings: rewriteResult.warnings,
      });
      allWarnings.push(...rewriteResult.warnings);
    }
  }

  // 3. Convert middleware
  const middlewareFiles = files.filter((f) => f.path.match(/middleware\.(ts|js)$/));
  for (const f of middlewareFiles) {
    const result = convertMiddleware(f.path, f.content);
    results.push(result);
    allWarnings.push(...result.warnings);
  }

  // 4. Convert API routes
  const apiFiles = files.filter(
    (f) => f.path.match(/pages\/api\//) || f.path.match(/app\/api\/.*\/route\.(ts|js)$/),
  );
  for (const f of apiFiles) {
    const apiResult = convertApiRoute(f.path, f.content);
    results.push({
      filename: f.path.replace(/pages\/api\//, "api/").replace(/app\/api\//, "api/"),
      original: f.content,
      transformed: apiResult.code,
      warnings: apiResult.warnings,
    });
    allWarnings.push(...apiResult.warnings);
  }

  // 5. Convert source files (imports + data loaders + env vars)
  const sourceFiles = files.filter(
    (f) =>
      f.path.match(/\.(tsx?|jsx?)$/) &&
      !f.path.match(/next\.config/) &&
      !f.path.match(/^middleware\./),
  );

  for (const f of sourceFiles) {
    // Chain transforms: imports → data loaders → env vars
    let result = rewriteImports(f.path, f.content);
    const loaderResult = convertDataLoaders(f.path, result.transformed);
    result = {
      ...result,
      transformed: loaderResult.transformed,
      warnings: [...result.warnings, ...loaderResult.warnings],
    };

    // Rewrite env vars
    const envResult = rewriteEnvVars(f.path, result.transformed);
    if (envResult.transformed !== result.transformed) {
      result.transformed = envResult.transformed;
      result.warnings.push(...envResult.warnings);
    }

    // Only include files that actually changed
    if (result.transformed !== f.content || result.warnings.length > 0) {
      results.push(result);
    }
    allWarnings.push(...result.warnings);
  }

  // 6. Generate route tree
  const routeFiles = files.filter((f) => {
    if (routerType === "pages" || routerType === "mixed") {
      return f.path.startsWith("pages/") && !f.path.startsWith("pages/api/");
    }
    if (routerType === "app") {
      return f.path.startsWith("app/") && f.path.endsWith("page.tsx");
    }
    return false;
  });

  let routeTree = "";
  if (routeFiles.length > 0) {
    const convention = routerType === "app" ? "app" : "pages";
    const routeResult = buildRouteTree(routeFiles, convention);
    routeTree = routeResult.routeTreeCode;
    allWarnings.push(...routeResult.warnings);
  }

  // 7. Config output
  const configResult = results.find((r) => r.filename === "vite.config.ts");
  const config = configResult?.transformed ?? generateDefaultViteConfig();

  return {
    files: results,
    routeTree,
    config,
    warnings: allWarnings,
  };
}

function generateDefaultViteConfig(): string {
  return `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";

export default defineConfig({
  plugins: [
    TanStackRouterVite(),
    react(),
  ],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },
    },
  },
  build: {
    target: "esnext",
    minify: "esbuild",
  },
});
`;
}
