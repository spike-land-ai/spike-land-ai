#!/usr/bin/env tsx
/**
 * Vitest Coverage Mapper Reporter
 *
 * Custom Vitest reporter that extracts per-test-file coverage mappings
 * and stores them in a cache for intelligent test skipping.
 *
 * The cache tracks which source files each test file touches,
 * enabling subsequent builds to skip tests whose dependencies haven't changed.
 */

import { execSync } from "child_process";
import { createHash } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import type { RunnerTestFile as File } from "vitest";
import type { Reporter, Vitest } from "vitest/node";

interface TestCacheEntry {
  lastPassedCommit: string;
  lastPassedTimestamp: string;
  testFileHash: string;
  dependencies: string[];
  dependencyHashes: Record<string, string>;
}

interface TestCache {
  version: number;
  lastFullRun: string;
  entries: Record<string, TestCacheEntry>;
}

interface TestResult {
  passed: boolean;
  sourceFiles: Set<string>;
}

/**
 * Vitest internal module graph interface (not exported in public types).
 * Used to traverse module dependencies for coverage mapping.
 */
interface ViteModuleGraph {
  getModuleById(id: string): ViteModuleNode | undefined;
}

interface ViteModuleNode {
  id: string | null;
  importedModules: Set<ViteModuleNode>;
}

/**
 * Vitest project with internal vite server access.
 * These properties exist at runtime but aren't in the public type definitions.
 */
interface VitestProjectWithInternals {
  browser?: { vite?: { moduleGraph?: ViteModuleGraph } };
  server?: { moduleGraph?: ViteModuleGraph };
}

export default class CoverageMapperReporter implements Reporter {
  private ctx!: Vitest;
  private projectRoot: string;
  private cacheDir: string;
  private currentCommit: string;
  private testResults: Map<string, TestResult> = new Map();

  constructor() {
    this.projectRoot = process.cwd();
    this.cacheDir = process.env.TEST_CACHE_DIR || path.join(this.projectRoot, ".test-cache");
    this.currentCommit = this.getCurrentCommit();
  }

  onInit(ctx: Vitest): void {
    this.ctx = ctx;
  }

  private getCurrentCommit(): string {
    try {
      return execSync("git rev-parse HEAD", {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim();
    } catch {
      return "unknown";
    }
  }

  private getFileHash(filePath: string): string {
    try {
      const fullPath = path.isAbsolute(filePath) ? filePath : path.join(this.projectRoot, filePath);
      const content = readFileSync(fullPath, "utf-8");
      return createHash("sha256").update(content).digest("hex").slice(0, 16);
    } catch {
      return "missing";
    }
  }

  private toRelativePath(absolutePath: string): string {
    let p = absolutePath;
    // Handle file:// URLs
    if (p.startsWith("file://")) {
      p = p.replace("file://", "");
    }
    // Convert to relative path
    if (p.startsWith(this.projectRoot)) {
      p = p.slice(this.projectRoot.length + 1);
    }
    return p;
  }

  onFinished(files?: File[]): void {
    if (!files) return;

    // Process test files and their results
    for (const file of files) {
      const testPath = this.toRelativePath(file.filepath);
      const passed = file.result?.state === "pass";

      this.testResults.set(testPath, {
        passed,
        sourceFiles: new Set(),
      });
    }

    // Extract coverage mappings from v8 coverage data
    this.extractCoverageMappings();

    // Update cache with results
    this.updateTestCache();
  }

  private extractCoverageMappings(): void {
    // Check for coverage JSON in various locations
    const coveragePaths = [
      path.join(this.projectRoot, "coverage", "coverage-final.json"),
      path.join(this.projectRoot, "coverage", ".tmp", "coverage-final.json"),
    ];

    for (const coveragePath of coveragePaths) {
      if (existsSync(coveragePath)) {
        try {
          const coverageData = JSON.parse(readFileSync(coveragePath, "utf-8"));

          // Extract all covered source files
          for (const [filePath] of Object.entries(coverageData)) {
            const relativePath = this.toRelativePath(filePath);

            // Skip test files themselves and node_modules
            if (
              relativePath.includes(".test.") ||
              relativePath.includes(".spec.") ||
              relativePath.includes("node_modules")
            ) {
              continue;
            }

            // Add to all test results (coverage is aggregated per run)
            for (const [, result] of this.testResults) {
              result.sourceFiles.add(relativePath);
            }
          }
        } catch (e) {
          console.error(`[CoverageMapper] Failed to parse coverage: ${e}`);
        }
        break;
      }
    }

    // If no coverage file found, try to get file dependencies from Vitest's module graph
    if (this.ctx?.projects) {
      for (const project of this.ctx.projects) {
        // Cast to internal type - these properties exist at runtime but not in public types
        const projectWithInternals = project as unknown as VitestProjectWithInternals;
        const moduleGraph =
          projectWithInternals.browser?.vite?.moduleGraph ||
          projectWithInternals.server?.moduleGraph;
        if (moduleGraph) {
          for (const [testPath, result] of this.testResults) {
            const fullTestPath = path.join(this.projectRoot, testPath);
            const mod = moduleGraph.getModuleById(fullTestPath);

            if (mod) {
              // Traverse imported modules
              const visited = new Set<string>();
              const queue = [...mod.importedModules];

              while (queue.length > 0) {
                const imported = queue.shift();
                if (!imported?.id || visited.has(imported.id)) continue;
                visited.add(imported.id);

                const relativePath = this.toRelativePath(imported.id);
                if (
                  !relativePath.includes("node_modules") &&
                  !relativePath.includes(".test.") &&
                  !relativePath.includes(".spec.")
                ) {
                  result.sourceFiles.add(relativePath);
                }

                queue.push(...imported.importedModules);
              }
            }
          }
        }
      }
    }
  }

  private updateTestCache(): void {
    // Ensure cache directory exists
    if (!existsSync(this.cacheDir)) {
      mkdirSync(this.cacheDir, { recursive: true });
    }

    const cachePath = path.join(this.cacheDir, "test-cache.json");

    // Load existing cache or create new
    let cache: TestCache = {
      version: 2,
      lastFullRun: this.currentCommit,
      entries: {},
    };

    if (existsSync(cachePath)) {
      try {
        const existing = JSON.parse(readFileSync(cachePath, "utf-8"));
        if (existing.version === 2) {
          cache = existing;
        }
      } catch {
        // Start fresh if corrupted
      }
    }

    // Update cache with results from this run
    let updatedCount = 0;
    for (const [testPath, result] of this.testResults) {
      if (result.passed) {
        const dependencies = Array.from(result.sourceFiles).sort();
        const dependencyHashes: Record<string, string> = {};

        for (const dep of dependencies) {
          dependencyHashes[dep] = this.getFileHash(dep);
        }

        cache.entries[testPath] = {
          lastPassedCommit: this.currentCommit,
          lastPassedTimestamp: new Date().toISOString(),
          testFileHash: this.getFileHash(testPath),
          dependencies,
          dependencyHashes,
        };
        updatedCount++;
      }
    }

    // Update last full run commit
    cache.lastFullRun = this.currentCommit;

    // Write updated cache
    writeFileSync(cachePath, JSON.stringify(cache, null, 2));
    console.log(
      `\n[CoverageMapper] Updated test cache: ${updatedCount}/${this.testResults.size} tests cached`,
    );
    console.log(`[CoverageMapper] Cache location: ${cachePath}`);
  }
}
