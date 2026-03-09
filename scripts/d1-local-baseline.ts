#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildMigrationInsertSql,
  computeLocalD1RepairPlan,
  type LocalD1State,
} from "./d1-local-baseline-lib.js";

interface SqliteRow extends Record<string, unknown> {}

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const SOURCE_MIGRATIONS_DIR = resolve(REPO_ROOT, "src/edge-api/spike-land/db/migrations");

function parseArgs(argv: string[]): { databaseName: string; applyPending: boolean } {
  const [databaseName, ...rest] = argv;

  if (!databaseName) {
    console.error("Usage: node --import tsx scripts/d1-local-baseline.ts <database-name> [--apply-pending]");
    process.exit(1);
  }

  return {
    databaseName,
    applyPending: rest.includes("--apply-pending"),
  };
}

function findLocalSqlitePath(packageDir: string): string {
  const d1Dir = join(packageDir, ".wrangler/state/v3/d1/miniflare-D1DatabaseObject");
  const entry = readdirSync(d1Dir).find((name) => name.endsWith(".sqlite"));
  if (!entry) {
    throw new Error(`No local D1 sqlite database found under ${d1Dir}`);
  }
  return join(d1Dir, entry);
}

function querySqlite(dbPath: string, sql: string): SqliteRow[] {
  const output = execFileSync("sqlite3", ["-json", dbPath, sql], {
    cwd: REPO_ROOT,
    encoding: "utf-8",
    maxBuffer: 10 * 1024 * 1024,
  }).trim();

  if (!output) {
    return [];
  }

  return JSON.parse(output) as SqliteRow[];
}

function executeSqlite(dbPath: string, sql: string): void {
  execFileSync("sqlite3", [dbPath, sql], {
    cwd: REPO_ROOT,
    encoding: "utf-8",
    maxBuffer: 10 * 1024 * 1024,
  });
}

function collectState(dbPath: string): LocalD1State {
  const objects = querySqlite(
    dbPath,
    "SELECT name, type FROM sqlite_master WHERE type IN ('table', 'index') ORDER BY type, name;",
  );
  const appliedMigrations = querySqlite(dbPath, "SELECT name FROM d1_migrations ORDER BY id;");
  const columns = querySqlite(dbPath, "PRAGMA table_info(mcp_apps);");

  return {
    appliedMigrations: appliedMigrations.map((row) => String(row.name)),
    tables: objects.filter((row) => row.type === "table").map((row) => String(row.name)),
    indexes: objects.filter((row) => row.type === "index").map((row) => String(row.name)),
    mcpAppsColumns: columns.map((row) => String(row.name)),
  };
}

function listSourceMigrations(): Array<{ name: string; sql: string }> {
  return readdirSync(SOURCE_MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => ({
      name,
      sql: readFileSync(join(SOURCE_MIGRATIONS_DIR, name), "utf-8"),
    }));
}

function applyMissingSourceMigrations(dbPath: string, applied: Set<string>): string[] {
  const appliedNow: string[] = [];

  for (const migration of listSourceMigrations()) {
    if (applied.has(migration.name)) {
      continue;
    }

    executeSqlite(
      dbPath,
      ["BEGIN;", migration.sql, ...buildMigrationInsertSql([migration.name]), "COMMIT;"].join("\n"),
    );
    applied.add(migration.name);
    appliedNow.push(migration.name);
  }

  return appliedNow;
}

function main(): void {
  const { databaseName, applyPending } = parseArgs(process.argv.slice(2));
  const packageDir = process.cwd();
  const dbPath = findLocalSqlitePath(packageDir);

  const initialState = collectState(dbPath);
  const repairPlan = computeLocalD1RepairPlan(initialState);
  const repairStatements = [
    ...repairPlan.sql,
    ...buildMigrationInsertSql(repairPlan.migrationsToMarkApplied),
  ];

  if (repairStatements.length > 0) {
    executeSqlite(dbPath, ["BEGIN;", ...repairStatements, "COMMIT;"].join("\n"));
  }

  const repairedState = collectState(dbPath);
  const applied = new Set(repairedState.appliedMigrations);
  const pendingApplied = applyPending ? applyMissingSourceMigrations(dbPath, applied) : [];

  if (repairPlan.sql.length === 0 && repairPlan.migrationsToMarkApplied.length === 0 && pendingApplied.length === 0) {
    console.log(`[d1-local-baseline] ${databaseName}: no reconciliation needed`);
    return;
  }

  if (repairPlan.sql.length > 0) {
    console.log(`[d1-local-baseline] executed ${repairPlan.sql.length} schema repair statement(s)`);
  }
  if (repairPlan.migrationsToMarkApplied.length > 0) {
    console.log(
      `[d1-local-baseline] marked migrations as applied: ${repairPlan.migrationsToMarkApplied.join(", ")}`,
    );
  }
  if (pendingApplied.length > 0) {
    console.log(`[d1-local-baseline] applied source migrations: ${pendingApplied.join(", ")}`);
  }
}

main();
