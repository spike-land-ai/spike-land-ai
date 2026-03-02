#!/usr/bin/env tsx
/**
 * Test Cache Manager
 *
 * CLI tool that determines which tests need to run based on coverage-based dependencies.
 * Uses the test cache populated by vitest-coverage-mapper-reporter.ts
 *
 * Commands:
 *   list-tests-to-run  - Returns JSON array of tests needing execution
 *   should-skip-all    - Exit 0 if all cached, exit 1 if tests needed
 *   get-test-filter    - Space-separated test paths for vitest CLI
 *   stats              - Show cache statistics
 */

import { execSync } from "child_process";
import { createHash } from "crypto";
import { existsSync, readdirSync, readFileSync } from "fs";
import path from "path";

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

// Global dependencies that invalidate all cache entries when changed
const GLOBAL_DEPENDENCIES = [
  "vitest.config.ts",
  "vitest.setup.ts",
  "tsconfig.json",
  "tsconfig.test.json",
  "package.json",
];

const PROJECT_ROOT = process.cwd();
const CACHE_DIR = process.env.TEST_CACHE_DIR || path.join(PROJECT_ROOT, ".test-cache");
const CACHE_PATH = path.join(CACHE_DIR, "test-cache.json");
const DEBUG = process.env.DEBUG === "true";

function log(message: string): void {
  if (DEBUG) {
    console.error(`[TestCache] ${message}`);
  }
}

function loadCache(): TestCache | null {
  if (!existsSync(CACHE_PATH)) {
    log("No cache file found");
    return null;
  }
  try {
    const cache = JSON.parse(readFileSync(CACHE_PATH, "utf-8"));
    if (cache.version !== 2) {
      log(`Cache version mismatch: ${cache.version} !== 2`);
      return null;
    }
    return cache;
  } catch (e) {
    log(`Failed to parse cache: ${e}`);
    return null;
  }
}

function getFileHash(filePath: string): string {
  try {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(PROJECT_ROOT, filePath);
    const content = readFileSync(fullPath, "utf-8");
    return createHash("sha256").update(content).digest("hex").slice(0, 16);
  } catch {
    return "missing";
  }
}

function getChangedFiles(sinceCommit: string): Set<string> {
  try {
    // First, check if the commit exists
    execSync(`git cat-file -t ${sinceCommit}`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });

    const output = execSync(`git diff --name-only ${sinceCommit} HEAD`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    const files = new Set(output.trim().split("\n").filter(Boolean));
    log(`Found ${files.size} changed files since ${sinceCommit.slice(0, 8)}`);
    return files;
  } catch {
    log(`Failed to get changed files, returning empty set`);
    return new Set();
  }
}

function getAllTestFiles(): string[] {
  const testFiles: string[] = [];

  function walkDir(dir: string): void {
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        // Skip common non-test directories
        if (entry.isDirectory()) {
          if (
            entry.name === "node_modules" ||
            entry.name === ".git" ||
            entry.name === ".next" ||
            entry.name === "coverage" ||
            entry.name === "dist"
          ) {
            continue;
          }
          walkDir(fullPath);
        } else if (entry.isFile()) {
          if (entry.name.endsWith(".test.ts") || entry.name.endsWith(".test.tsx")) {
            const relativePath = path.relative(PROJECT_ROOT, fullPath);
            testFiles.push(relativePath);
          }
        }
      }
    } catch {
      // Directory doesn't exist or not readable
    }
  }

  // Search in src and apps directories
  walkDir(path.join(PROJECT_ROOT, "src"));
  walkDir(path.join(PROJECT_ROOT, "apps"));

  return testFiles.sort();
}

function checkGlobalDependencies(changedFiles: Set<string>): boolean {
  for (const dep of GLOBAL_DEPENDENCIES) {
    if (changedFiles.has(dep)) {
      log(`Global dependency changed: ${dep}`);
      return true;
    }
  }
  return false;
}

interface TestNeedsRunResult {
  needsRun: boolean;
  reason: string;
}

function testNeedsRun(
  testPath: string,
  entry: TestCacheEntry | undefined,
  changedFiles: Set<string>,
): TestNeedsRunResult {
  // No cache entry - must run
  if (!entry) {
    return { needsRun: true, reason: "no-cache-entry" };
  }

  // Test file itself changed (check hash)
  const currentTestHash = getFileHash(testPath);
  if (currentTestHash !== entry.testFileHash) {
    return { needsRun: true, reason: "test-file-hash-changed" };
  }

  // Check if test file is in git diff
  if (changedFiles.has(testPath)) {
    return { needsRun: true, reason: "test-in-git-diff" };
  }

  // Check each dependency
  for (const dep of entry.dependencies) {
    // Check git diff first (faster)
    if (changedFiles.has(dep)) {
      return { needsRun: true, reason: `dependency-in-git-diff:${dep}` };
    }

    // Check hash for files that might have changed outside git
    const currentHash = getFileHash(dep);
    const cachedHash = entry.dependencyHashes[dep];
    if (currentHash !== cachedHash) {
      return { needsRun: true, reason: `dependency-hash-changed:${dep}` };
    }
  }

  return { needsRun: false, reason: "all-dependencies-unchanged" };
}

function listTestsToRun(): string[] {
  const cache = loadCache();

  if (!cache) {
    log("No cache available, all tests must run");
    return getAllTestFiles();
  }

  const changedFiles = getChangedFiles(cache.lastFullRun);

  // Check global dependencies
  if (checkGlobalDependencies(changedFiles)) {
    log("Global dependency changed, all tests must run");
    return getAllTestFiles();
  }

  const allTests = getAllTestFiles();
  const testsToRun: string[] = [];

  for (const testPath of allTests) {
    const entry = cache.entries[testPath];
    const { needsRun, reason } = testNeedsRun(testPath, entry, changedFiles);

    if (needsRun) {
      testsToRun.push(testPath);
      log(`${testPath}: ${reason}`);
    }
  }

  return testsToRun;
}

function shouldSkipAll(): boolean {
  const testsToRun = listTestsToRun();
  return testsToRun.length === 0;
}

function showStats(): void {
  const cache = loadCache();
  const allTests = getAllTestFiles();

  console.log("=== Test Cache Statistics ===\n");

  if (!cache) {
    console.log("No cache file found.");
    console.log(`Total test files: ${allTests.length}`);
    return;
  }

  const cachedCount = Object.keys(cache.entries).length;
  const testsToRun = listTestsToRun();

  console.log(`Cache version: ${cache.version}`);
  console.log(`Last full run: ${cache.lastFullRun.slice(0, 8)}`);
  console.log(`Total test files: ${allTests.length}`);
  console.log(`Cached entries: ${cachedCount}`);
  console.log(`Tests to run: ${testsToRun.length}`);
  console.log(`Tests skippable: ${allTests.length - testsToRun.length}`);
  console.log(
    `\nCache hit rate: ${(((allTests.length - testsToRun.length) / allTests.length) * 100).toFixed(
      1,
    )}%`,
  );

  if (testsToRun.length > 0 && testsToRun.length <= 10) {
    console.log("\nTests that need to run:");
    for (const test of testsToRun) {
      console.log(`  - ${test}`);
    }
  }
}

// CLI interface
const command = process.argv[2];

switch (command) {
  case "list-tests-to-run": {
    const tests = listTestsToRun();
    console.log(JSON.stringify(tests));
    break;
  }

  case "should-skip-all": {
    if (shouldSkipAll()) {
      console.log("true");
      process.exit(0);
    } else {
      console.log("false");
      process.exit(1); // Non-zero to indicate tests need to run
    }
    break;
  }

  case "get-test-filter": {
    // Output test files for vitest CLI
    const testsForFilter = listTestsToRun();
    if (testsForFilter.length === 0) {
      // Special flag to make vitest pass with no tests
      console.log("--passWithNoTests");
    } else {
      console.log(testsForFilter.join(" "));
    }
    break;
  }

  case "stats": {
    showStats();
    break;
  }

  default: {
    console.error("Test Cache Manager");
    console.error("");
    console.error("Usage: test-cache-manager <command>");
    console.error("");
    console.error("Commands:");
    console.error("  list-tests-to-run  Returns JSON array of tests needing execution");
    console.error("  should-skip-all    Exit 0 if all cached, exit 1 if tests needed");
    console.error("  get-test-filter    Space-separated test paths for vitest CLI");
    console.error("  stats              Show cache statistics");
    console.error("");
    console.error("Environment:");
    console.error("  TEST_CACHE_DIR     Cache directory (default: .test-cache)");
    console.error("  DEBUG=true         Enable debug logging");
    process.exit(1);
  }
}
