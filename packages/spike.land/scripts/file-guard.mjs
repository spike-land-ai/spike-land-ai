#!/usr/bin/env node

/**
 * File Guard: watches source files for changes and runs vitest --changed
 * to verify tests still pass. Reports failures to .dev-logs/ for MCP tools to read.
 */

import { watch } from "chokidar";
import { execSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const LOG_DIR = ".dev-logs";
const GUARD_LOG = `${LOG_DIR}/file-guard.log`;
const FAILED_CHANGES = `${LOG_DIR}/failed-changes.json`;
const NOTIFICATIONS = `${LOG_DIR}/notifications.json`;
const DEBOUNCE_MS = 2000;

mkdirSync(LOG_DIR, { recursive: true });

let debounceTimer = null;
const pendingFiles = new Set();

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  appendFileSync(GUARD_LOG, line + "\n");
}

function addNotification(event, message, severity = "info") {
  let existing = [];
  if (existsSync(NOTIFICATIONS)) {
    try {
      existing = JSON.parse(readFileSync(NOTIFICATIONS, "utf-8"));
    } catch {
      existing = [];
    }
  }
  existing.push({
    timestamp: new Date().toISOString(),
    event,
    message,
    severity,
  });
  if (existing.length > 50) existing = existing.slice(-50);
  writeFileSync(NOTIFICATIONS, JSON.stringify(existing, null, 2));
}

function storeFailure(files, error) {
  let existing = [];
  if (existsSync(FAILED_CHANGES)) {
    try {
      existing = JSON.parse(readFileSync(FAILED_CHANGES, "utf-8"));
    } catch {
      existing = [];
    }
  }
  existing.push({
    timestamp: new Date().toISOString(),
    files,
    error: error.slice(0, 2000),
  });
  if (existing.length > 50) existing = existing.slice(-50);
  writeFileSync(FAILED_CHANGES, JSON.stringify(existing, null, 2));
}

function runGuard() {
  const files = [...pendingFiles];
  pendingFiles.clear();

  log(`Running file guard for ${files.length} changed file(s): ${files.join(", ")}`);

  try {
    const result = execSync("yarn vitest run --changed HEAD --reporter=dot 2>&1", {
      encoding: "utf-8",
      timeout: 120_000,
    });
    log(`PASS - all tests passed`);
    addNotification("file_guard_pass", `Tests passed for: ${files.join(", ")}`, "info");
  } catch (err) {
    const output = err.stdout || err.stderr || String(err);
    log(`FAIL - tests failed:\n${output.slice(0, 500)}`);
    storeFailure(files, output);
    addNotification(
      "file_guard_fail",
      `Tests FAILED for: ${files.join(", ")}. Check .dev-logs/failed-changes.json`,
      "error",
    );
  }
}

log("File guard started - watching src/**/*.{ts,tsx}");

const watcher = watch("src/**/*.{ts,tsx}", {
  ignoreInitial: true,
  ignored: ["**/*.test.*", "**/*.spec.*", "**/node_modules/**"],
});

watcher.on("change", (filePath) => {
  pendingFiles.add(filePath);
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => runGuard(), DEBOUNCE_MS);
});

watcher.on("add", (filePath) => {
  pendingFiles.add(filePath);
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => runGuard(), DEBOUNCE_MS);
});
