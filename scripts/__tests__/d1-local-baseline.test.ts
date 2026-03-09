import { describe, expect, it } from "vitest";
import {
  buildMigrationInsertSql,
  computeLocalD1RepairPlan,
  type LocalD1State,
} from "../d1-local-baseline-lib.js";

describe("d1 local baseline reconciliation", () => {
  it("marks mcp_apps migration when the table already exists", () => {
    const state: LocalD1State = {
      appliedMigrations: ["0011_persona_audit.sql"],
      tables: ["users", "mcp_apps"],
      indexes: [],
      mcpAppsColumns: ["slug", "name", "description", "emoji", "status", "tools", "graph", "markdown", "tool_count", "sort_order"],
    };

    const plan = computeLocalD1RepairPlan(state);

    expect(plan.migrationsToMarkApplied).toContain("0012_mcp_apps.sql");
    expect(plan.sql).toContain("CREATE INDEX IF NOT EXISTS idx_mcp_apps_status ON mcp_apps(status);");
    expect(plan.sql).toContain("CREATE INDEX IF NOT EXISTS idx_mcp_apps_sort ON mcp_apps(sort_order);");
  });

  it("repairs partial store-social state before marking the migration", () => {
    const state: LocalD1State = {
      appliedMigrations: ["0012_mcp_apps.sql"],
      tables: ["users", "mcp_apps"],
      indexes: ["idx_mcp_apps_status", "idx_mcp_apps_sort"],
      mcpAppsColumns: [
        "slug",
        "name",
        "description",
        "emoji",
        "status",
        "tools",
        "graph",
        "markdown",
        "tool_count",
        "sort_order",
        "category",
      ],
    };

    const plan = computeLocalD1RepairPlan(state);

    expect(plan.sql.some((sql) => sql.includes("ADD COLUMN tags"))).toBe(true);
    expect(plan.sql.some((sql) => sql.includes("CREATE TABLE IF NOT EXISTS app_ratings"))).toBe(true);
    expect(plan.migrationsToMarkApplied).toContain("0014_store_social.sql");
  });

  it("marks reactions applied when it can fully repair the schema in one pass", () => {
    const state: LocalD1State = {
      appliedMigrations: ["0012_mcp_apps.sql"],
      tables: ["users", "mcp_apps"],
      indexes: ["idx_mcp_apps_status", "idx_mcp_apps_sort"],
      mcpAppsColumns: [
        "slug",
        "name",
        "description",
        "emoji",
        "status",
        "tools",
        "graph",
        "markdown",
        "tool_count",
        "sort_order",
      ],
    };

    const plan = computeLocalD1RepairPlan(state);

    expect(plan.sql.some((sql) => sql.includes("CREATE TABLE IF NOT EXISTS tool_reactions"))).toBe(true);
    expect(plan.sql.some((sql) => sql.includes("CREATE TABLE IF NOT EXISTS reaction_logs"))).toBe(true);
    expect(plan.migrationsToMarkApplied).toContain("0013_reactions.sql");
  });

  it("builds insert statements for reconciled migrations", () => {
    expect(buildMigrationInsertSql(["0012_mcp_apps.sql", "0014_store_social.sql"])).toEqual([
      "INSERT INTO d1_migrations (name) VALUES ('0012_mcp_apps.sql');",
      "INSERT INTO d1_migrations (name) VALUES ('0014_store_social.sql');",
    ]);
  });
});
