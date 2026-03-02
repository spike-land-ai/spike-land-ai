#!/usr/bin/env node

/**
 * Dev workflow orchestrator: starts Next.js dev server with log persistence,
 * waits for it to be ready, optionally starts file guard, then launches Claude Code with MCP tools.
 */

import { execSync, spawn } from "node:child_process";
import { createWriteStream, mkdirSync, writeFileSync } from "node:fs";

const DEV_URL = "http://localhost:3000";
const POLL_INTERVAL_MS = 1000;
const TIMEOUT_MS = 60_000;
const LOG_DIR = ".dev-logs";
const LOG_FILE = `${LOG_DIR}/dev-server.log`;
const META_FILE = `${LOG_DIR}/dev-meta.json`;

// Ensure log directory exists
mkdirSync(LOG_DIR, { recursive: true });

// Open log file stream
const logStream = createWriteStream(LOG_FILE);
logStream.write(`\n=== Dev server started at ${new Date().toISOString()} ===\n\n`);

/** Poll URL until it responds with 2xx or 3xx */
async function waitForServer(url, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || (res.status >= 300 && res.status < 400)) {
        return true;
      }
    } catch {
      // Server not ready yet
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error(`Server at ${url} did not respond within ${timeoutMs}ms`);
}

// Start Next.js dev server
const devServer = spawn("yarn", ["dev"], {
  stdio: ["ignore", "pipe", "pipe"],
  cwd: process.cwd(),
});

// Tee stdout/stderr to both console and log file
devServer.stdout.on("data", (chunk) => {
  process.stdout.write(chunk);
  logStream.write(chunk);
});

devServer.stderr.on("data", (chunk) => {
  process.stderr.write(chunk);
  logStream.write(chunk);
});

devServer.on("error", (err) => {
  console.error("Failed to start dev server:", err.message);
  logStream.write(`[ERROR] Failed to start: ${err.message}\n`);
  process.exit(1);
});

// Write metadata file
let commitHash = "unknown";
try {
  commitHash = execSync("git rev-parse HEAD", { encoding: "utf-8" }).trim();
} catch {
  // git not available
}

writeFileSync(
  META_FILE,
  JSON.stringify(
    {
      pid: devServer.pid,
      startTime: new Date().toISOString(),
      port: 3000,
      commitHash,
    },
    null,
    2,
  ),
);

console.log("Starting Next.js dev server...");
console.log(`Logs: ${LOG_FILE}`);

try {
  await waitForServer(DEV_URL, TIMEOUT_MS);
  console.log(`Dev server ready at ${DEV_URL}`);
  logStream.write(`\n=== Server ready at ${new Date().toISOString()} ===\n\n`);
} catch (err) {
  console.error(err.message);
  logStream.write(`[ERROR] ${err.message}\n`);
  devServer.kill();
  process.exit(1);
}

// Optionally start file guard (FILE_GUARD=1 to enable)
let fileGuard = null;
if (process.env.FILE_GUARD === "1") {
  console.log("Starting file guard (auto-test on change)...");
  fileGuard = spawn("node", ["scripts/file-guard.mjs"], {
    stdio: ["ignore", "pipe", "pipe"],
    cwd: process.cwd(),
  });
  fileGuard.stdout.on("data", (chunk) => {
    logStream.write(`[file-guard] ${chunk}`);
  });
  fileGuard.stderr.on("data", (chunk) => {
    logStream.write(`[file-guard:err] ${chunk}`);
  });
  fileGuard.on("error", (err) => {
    console.error("File guard failed:", err.message);
  });
}

// Launch Claude Code
const claude = spawn("claude", ["--dangerously-skip-permissions", "--model", "opus"], {
  stdio: "inherit",
  cwd: process.cwd(),
});

claude.on("error", (err) => {
  console.error("Failed to start Claude:", err.message);
  devServer.kill();
  fileGuard?.kill();
  process.exit(1);
});

claude.on("exit", (code) => {
  devServer.kill();
  fileGuard?.kill();
  logStream.write(`\n=== Session ended at ${new Date().toISOString()} ===\n`);
  logStream.end();
  process.exit(code ?? 0);
});

// Handle cleanup
function cleanup() {
  devServer.kill();
  fileGuard?.kill();
  logStream.write(`\n=== Cleanup at ${new Date().toISOString()} ===\n`);
  logStream.end();
  process.exit(0);
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
