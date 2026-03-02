#!/usr/bin/env node

/**
 * Check for undocumented skipped tests
 *
 * This script scans test files for .skip() calls and ensures each one
 * has a SKIP REASON comment within 5 lines above it.
 *
 * Usage: node scripts/check-undocumented-skips.js
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SKIP_REASON_PATTERN = /SKIP REASON:/;
const CATEGORY_PATTERN = /CATEGORY:/;
const TRACKING_PATTERN = /TRACKING:/;
const ACTION_PATTERN = /ACTION:/;
const SKIP_CALL_PATTERN = /(it|describe|test)\.skip\(/;
const CONTEXT_LINES = 10;

const IGNORED_DIRS = ["node_modules", "dist", "build", ".next", "coverage", ".git", ".yarn"];

/**
 * Check if a skip call has all required documentation within context lines
 */
function hasRequiredDocumentation(lines, skipLineIndex) {
  const startIndex = Math.max(0, skipLineIndex - CONTEXT_LINES);
  const contextLines = lines.slice(startIndex, skipLineIndex);
  const contextText = contextLines.join("\n");

  const hasReason = SKIP_REASON_PATTERN.test(contextText);
  const hasCategory = CATEGORY_PATTERN.test(contextText);
  const hasTracking = TRACKING_PATTERN.test(contextText);
  const hasAction = ACTION_PATTERN.test(contextText);

  return {
    complete: hasReason && hasCategory && hasTracking && hasAction,
    missing: {
      reason: !hasReason,
      category: !hasCategory,
      tracking: !hasTracking,
      action: !hasAction,
    },
  };
}

/**
 * Find all undocumented skip calls in a file
 */
function findUndocumentedSkips(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split("\n");
  const undocumented = [];

  lines.forEach((line, index) => {
    if (SKIP_CALL_PATTERN.test(line)) {
      const docStatus = hasRequiredDocumentation(lines, index);
      if (!docStatus.complete) {
        undocumented.push({
          file: filePath,
          line: index + 1,
          code: line.trim(),
          missing: docStatus.missing,
        });
      }
    }
  });

  return undocumented;
}

/**
 * Recursively find all test files
 */
function findTestFiles(dir, testFiles = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.includes(entry.name)) {
        findTestFiles(fullPath, testFiles);
      }
    } else if (entry.isFile()) {
      const isTestFile = /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(entry.name);
      if (isTestFile) {
        testFiles.push(fullPath);
      }
    }
  }

  return testFiles;
}

async function main() {
  console.log("🔍 Checking for undocumented skipped tests...\n");

  const rootDir = path.join(__dirname, "..");
  const testFiles = findTestFiles(rootDir);

  if (testFiles.length === 0) {
    console.log("⚠️  No test files found");
    process.exit(0);
  }

  console.log(`Found ${testFiles.length} test files\n`);

  let allUndocumented = [];

  for (const file of testFiles) {
    const undocumented = findUndocumentedSkips(file);
    if (undocumented.length > 0) {
      allUndocumented = allUndocumented.concat(undocumented);
    }
  }

  if (allUndocumented.length === 0) {
    console.log("✅ All skipped tests are documented\n");
    process.exit(0);
  }

  console.error("❌ Found undocumented skipped tests:\n");

  allUndocumented.forEach(({ file, line, code, missing }) => {
    // Make paths relative to root for cleaner output
    const relativePath = path.relative(rootDir, file);
    console.error(`  ${relativePath}:${line}`);
    console.error(`    ${code}`);

    const missingFields = [];
    if (missing.reason) missingFields.push("SKIP REASON");
    if (missing.category) missingFields.push("CATEGORY");
    if (missing.tracking) missingFields.push("TRACKING");
    if (missing.action) missingFields.push("ACTION");

    if (missingFields.length > 0) {
      console.error(`    Missing: ${missingFields.join(", ")}`);
    }
    console.error("");
  });

  console.error("\n📝 All .skip() calls must have a comment above them with:");
  console.error("   // SKIP REASON: <brief explanation>");
  console.error("   // CATEGORY: [intentional|environment|unfinished]");
  console.error("   // TRACKING: #<issue-number>");
  console.error("   // ACTION: [keep|fix|remove]");
  console.error("");
  console.error("   See docs/SKIPPED_TESTS.md for more information");
  console.error("");

  process.exit(1);
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
