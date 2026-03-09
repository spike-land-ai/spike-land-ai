export interface LocalD1State {
  appliedMigrations: string[];
  tables: string[];
  indexes: string[];
  mcpAppsColumns: string[];
}

export interface LocalD1RepairPlan {
  sql: string[];
  migrationsToMarkApplied: string[];
}

const MCP_APP_INDEXES = ["idx_mcp_apps_status", "idx_mcp_apps_sort"] as const;
const REACTION_TABLES = ["tool_reactions", "reaction_logs"] as const;
const REACTION_INDEXES = [
  "tool_reactions_user_id_idx",
  "tool_reactions_source_idx",
  "tool_reactions_event_idx",
  "reaction_logs_user_created_idx",
  "reaction_logs_reaction_created_idx",
  "reaction_logs_source_idx",
] as const;
const STORE_COLUMNS = [
  "category",
  "tags",
  "tagline",
  "pricing",
  "is_featured",
  "is_new",
] as const;
const STORE_TABLES = ["app_ratings", "app_wishlists", "app_installs"] as const;
const STORE_INDEXES = [
  "idx_mcp_apps_category",
  "idx_mcp_apps_featured",
  "idx_app_ratings_user_app",
  "idx_app_ratings_app",
  "idx_app_ratings_created",
  "idx_app_wishlists_user_app",
  "idx_app_wishlists_user",
  "idx_app_installs_user_app",
  "idx_app_installs_user",
  "idx_app_installs_app",
] as const;

function hasAll(values: readonly string[], candidates: Set<string>): boolean {
  return values.every((value) => candidates.has(value));
}

export function computeLocalD1RepairPlan(state: LocalD1State): LocalD1RepairPlan {
  const applied = new Set(state.appliedMigrations);
  const tables = new Set(state.tables);
  const indexes = new Set(state.indexes);
  const mcpAppsColumns = new Set(state.mcpAppsColumns);
  const plannedTables = new Set(state.tables);
  const plannedIndexes = new Set(state.indexes);
  const plannedColumns = new Set(state.mcpAppsColumns);
  const sql: string[] = [];
  const migrationsToMarkApplied: string[] = [];

  if (tables.has("mcp_apps")) {
    for (const indexName of MCP_APP_INDEXES) {
      if (!indexes.has(indexName)) {
        if (indexName === "idx_mcp_apps_status") {
          sql.push("CREATE INDEX IF NOT EXISTS idx_mcp_apps_status ON mcp_apps(status);");
          plannedIndexes.add(indexName);
        } else if (indexName === "idx_mcp_apps_sort") {
          sql.push("CREATE INDEX IF NOT EXISTS idx_mcp_apps_sort ON mcp_apps(sort_order);");
          plannedIndexes.add(indexName);
        }
      }
    }

    if (!applied.has("0012_mcp_apps.sql")) {
      migrationsToMarkApplied.push("0012_mcp_apps.sql");
    }
  }

  const hasAnyReactionArtifacts =
    tables.has("tool_reactions") || tables.has("reaction_logs") || hasAll(REACTION_INDEXES, indexes);

  if (hasAnyReactionArtifacts || tables.has("users")) {
    if (!tables.has("tool_reactions")) {
      sql.push(`CREATE TABLE IF NOT EXISTS tool_reactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_tool TEXT NOT NULL,
  source_event TEXT NOT NULL CHECK (source_event IN ('success', 'error')),
  target_tool TEXT NOT NULL,
  target_input TEXT NOT NULL DEFAULT '{}',
  description TEXT,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);`);
      plannedTables.add("tool_reactions");
    }
    if (!tables.has("reaction_logs")) {
      sql.push(`CREATE TABLE IF NOT EXISTS reaction_logs (
  id TEXT PRIMARY KEY,
  reaction_id TEXT REFERENCES tool_reactions(id) ON DELETE SET NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_tool TEXT NOT NULL,
  source_event TEXT NOT NULL CHECK (source_event IN ('success', 'error')),
  target_tool TEXT NOT NULL,
  is_error INTEGER NOT NULL DEFAULT 0 CHECK (is_error IN (0, 1)),
  duration_ms INTEGER,
  error TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);`);
      plannedTables.add("reaction_logs");
    }

    if (!indexes.has("tool_reactions_user_id_idx")) {
      sql.push("CREATE INDEX IF NOT EXISTS tool_reactions_user_id_idx ON tool_reactions(user_id);");
      plannedIndexes.add("tool_reactions_user_id_idx");
    }
    if (!indexes.has("tool_reactions_source_idx")) {
      sql.push(
        "CREATE INDEX IF NOT EXISTS tool_reactions_source_idx ON tool_reactions(user_id, source_tool, enabled);",
      );
      plannedIndexes.add("tool_reactions_source_idx");
    }
    if (!indexes.has("tool_reactions_event_idx")) {
      sql.push(
        "CREATE INDEX IF NOT EXISTS tool_reactions_event_idx ON tool_reactions(user_id, source_tool, source_event);",
      );
      plannedIndexes.add("tool_reactions_event_idx");
    }
    if (!indexes.has("reaction_logs_user_created_idx")) {
      sql.push(
        "CREATE INDEX IF NOT EXISTS reaction_logs_user_created_idx ON reaction_logs(user_id, created_at);",
      );
      plannedIndexes.add("reaction_logs_user_created_idx");
    }
    if (!indexes.has("reaction_logs_reaction_created_idx")) {
      sql.push(
        "CREATE INDEX IF NOT EXISTS reaction_logs_reaction_created_idx ON reaction_logs(reaction_id, created_at);",
      );
      plannedIndexes.add("reaction_logs_reaction_created_idx");
    }
    if (!indexes.has("reaction_logs_source_idx")) {
      sql.push(
        "CREATE INDEX IF NOT EXISTS reaction_logs_source_idx ON reaction_logs(user_id, source_tool, is_error);",
      );
      plannedIndexes.add("reaction_logs_source_idx");
    }

    if (
      !applied.has("0013_reactions.sql") &&
      hasAll(REACTION_TABLES, plannedTables) &&
      hasAll(REACTION_INDEXES, plannedIndexes)
    ) {
      migrationsToMarkApplied.push("0013_reactions.sql");
    }
  }

  if (tables.has("mcp_apps")) {
    for (const column of STORE_COLUMNS) {
      if (mcpAppsColumns.has(column)) continue;

      if (column === "category") {
        sql.push("ALTER TABLE mcp_apps ADD COLUMN category TEXT NOT NULL DEFAULT '';");
        plannedColumns.add(column);
      } else if (column === "tags") {
        sql.push("ALTER TABLE mcp_apps ADD COLUMN tags TEXT NOT NULL DEFAULT '[]';");
        plannedColumns.add(column);
      } else if (column === "tagline") {
        sql.push("ALTER TABLE mcp_apps ADD COLUMN tagline TEXT NOT NULL DEFAULT '';");
        plannedColumns.add(column);
      } else if (column === "pricing") {
        sql.push("ALTER TABLE mcp_apps ADD COLUMN pricing TEXT NOT NULL DEFAULT 'free';");
        plannedColumns.add(column);
      } else if (column === "is_featured") {
        sql.push("ALTER TABLE mcp_apps ADD COLUMN is_featured INTEGER NOT NULL DEFAULT 0;");
        plannedColumns.add(column);
      } else if (column === "is_new") {
        sql.push("ALTER TABLE mcp_apps ADD COLUMN is_new INTEGER NOT NULL DEFAULT 0;");
        plannedColumns.add(column);
      }
    }

    if (!tables.has("app_ratings")) {
      sql.push(`CREATE TABLE IF NOT EXISTS app_ratings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  app_slug TEXT NOT NULL REFERENCES mcp_apps(slug) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  body TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);`);
      plannedTables.add("app_ratings");
    }

    if (!tables.has("app_wishlists")) {
      sql.push(`CREATE TABLE IF NOT EXISTS app_wishlists (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  app_slug TEXT NOT NULL REFERENCES mcp_apps(slug) ON DELETE CASCADE,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);`);
      plannedTables.add("app_wishlists");
    }

    if (!tables.has("app_installs")) {
      sql.push(`CREATE TABLE IF NOT EXISTS app_installs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  app_slug TEXT NOT NULL REFERENCES mcp_apps(slug) ON DELETE CASCADE,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);`);
      plannedTables.add("app_installs");
    }

    if (!indexes.has("idx_mcp_apps_category")) {
      sql.push("CREATE INDEX IF NOT EXISTS idx_mcp_apps_category ON mcp_apps(category);");
      plannedIndexes.add("idx_mcp_apps_category");
    }
    if (!indexes.has("idx_mcp_apps_featured")) {
      sql.push("CREATE INDEX IF NOT EXISTS idx_mcp_apps_featured ON mcp_apps(is_featured);");
      plannedIndexes.add("idx_mcp_apps_featured");
    }
    if (!indexes.has("idx_app_ratings_user_app")) {
      sql.push(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_app_ratings_user_app ON app_ratings(user_id, app_slug);",
      );
      plannedIndexes.add("idx_app_ratings_user_app");
    }
    if (!indexes.has("idx_app_ratings_app")) {
      sql.push("CREATE INDEX IF NOT EXISTS idx_app_ratings_app ON app_ratings(app_slug);");
      plannedIndexes.add("idx_app_ratings_app");
    }
    if (!indexes.has("idx_app_ratings_created")) {
      sql.push(
        "CREATE INDEX IF NOT EXISTS idx_app_ratings_created ON app_ratings(app_slug, created_at);",
      );
      plannedIndexes.add("idx_app_ratings_created");
    }
    if (!indexes.has("idx_app_wishlists_user_app")) {
      sql.push(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_app_wishlists_user_app ON app_wishlists(user_id, app_slug);",
      );
      plannedIndexes.add("idx_app_wishlists_user_app");
    }
    if (!indexes.has("idx_app_wishlists_user")) {
      sql.push("CREATE INDEX IF NOT EXISTS idx_app_wishlists_user ON app_wishlists(user_id);");
      plannedIndexes.add("idx_app_wishlists_user");
    }
    if (!indexes.has("idx_app_installs_user_app")) {
      sql.push(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_app_installs_user_app ON app_installs(user_id, app_slug);",
      );
      plannedIndexes.add("idx_app_installs_user_app");
    }
    if (!indexes.has("idx_app_installs_user")) {
      sql.push("CREATE INDEX IF NOT EXISTS idx_app_installs_user ON app_installs(user_id);");
      plannedIndexes.add("idx_app_installs_user");
    }
    if (!indexes.has("idx_app_installs_app")) {
      sql.push("CREATE INDEX IF NOT EXISTS idx_app_installs_app ON app_installs(app_slug);");
      plannedIndexes.add("idx_app_installs_app");
    }

    if (
      !applied.has("0014_store_social.sql") &&
      hasAll(STORE_COLUMNS, plannedColumns) &&
      hasAll(STORE_TABLES, plannedTables) &&
      hasAll(STORE_INDEXES, plannedIndexes)
    ) {
      migrationsToMarkApplied.push("0014_store_social.sql");
    }
  }

  return { sql, migrationsToMarkApplied };
}

export function buildMigrationInsertSql(migrations: string[]): string[] {
  return migrations.map((name) => `INSERT INTO d1_migrations (name) VALUES ('${name}');`);
}
