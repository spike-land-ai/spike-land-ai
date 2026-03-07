#!/usr/bin/env tsx
/**
 * Seed MCP apps from MD files into D1.
 *
 * Usage:
 *   tsx scripts/seed-apps.ts          # local D1
 *   tsx scripts/seed-apps.ts --remote # remote D1
 */
import { readdir, readFile, writeFile, unlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  type McpApp,
  parseMdContent,
  generateSQL,
} from "./seed-apps-lib.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = resolve(__dirname, "..");
const APPS_DIR = resolve(ROOT, "content/apps");
const SPIKE_LAND_MCP_DIR = resolve(ROOT, "packages/spike-land-mcp");
const DB_NAME = "spike-land-mcp";

const isRemote = process.argv.includes("--remote");

async function parseMdFiles(): Promise<McpApp[]> {
  const entries = await readdir(APPS_DIR, { withFileTypes: true });
  const apps: McpApp[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;

    const fullPath = join(APPS_DIR, entry.name);
    const fileContent = await readFile(fullPath, "utf-8");
    const app = parseMdContent(fileContent, entry.name);
    if (app) apps.push(app);
  }

  return apps.sort((a, b) => a.sort_order - b.sort_order);
}

async function seedD1(apps: McpApp[]): Promise<void> {
  const sql = generateSQL(apps);
  const tmpFile = resolve(SPIKE_LAND_MCP_DIR, ".seed-apps-tmp.sql");

  try {
    await writeFile(tmpFile, sql, "utf-8");
    const remoteFlag = isRemote ? "--remote" : "--local";
    const cmd = `npx wrangler d1 execute ${DB_NAME} --file="${tmpFile}" ${remoteFlag}`;
    console.log(`Executing: ${cmd}`);
    execSync(cmd, { cwd: SPIKE_LAND_MCP_DIR, stdio: "inherit" });
    console.log(
      `Seeded ${apps.length} MCP apps to D1 (${isRemote ? "remote" : "local"}).`,
    );
  } finally {
    await unlink(tmpFile).catch(() => {});
  }
}

async function main(): Promise<void> {
  console.log(`Seeding MCP apps from ${APPS_DIR}...`);
  console.log(`Mode: ${isRemote ? "REMOTE" : "LOCAL"}`);

  const apps = await parseMdFiles();
  console.log(`Parsed ${apps.length} MCP apps.`);

  await seedD1(apps);

  console.log("Done!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
