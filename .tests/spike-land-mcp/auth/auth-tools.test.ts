/**
 * Tests for db/tools/auth.ts
 *
 * Covers: auth_check_session, auth_check_route_access, auth_signup,
 * auth_get_profile (with and without workspaces) — using in-memory SQLite DB.
 *
 * Security-sensitive paths tested: admin route access, user-not-found
 * responses, optional session_token field, RBAC via role column.
 */

import type { McpServer, RegisteredTool } from "@modelcontextprotocol/sdk/server/mcp.js";
import { describe, expect, it, vi } from "vitest";
import { registerAuthTools } from "../../../src/edge-api/spike-land/db/tools/auth";
import { createDb } from "../../../src/edge-api/spike-land/db/db/db-index";
import { ToolRegistry } from "../../../src/edge-api/spike-land/lazy-imports/registry";
import { createSqliteD1 } from "../__test-utils__/mock-env";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createMockMcpServer(): McpServer {
  return {
    registerTool: vi.fn((_name: string, _config: unknown, handler: unknown): RegisteredTool => {
      let isEnabled = false;
      return {
        enable: () => {
          isEnabled = true;
        },
        disable: () => {
          isEnabled = false;
        },
        get enabled() {
          return isEnabled;
        },
        update: vi.fn(),
        remove: vi.fn(),
        handler: handler as RegisteredTool["handler"],
      };
    }),
  } as unknown as McpServer;
}

const NOW = Date.now();

function bootstrapSchema(sqlite: ReturnType<typeof createSqliteD1>["sqlite"]): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT,
      image TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      plan TEXT NOT NULL DEFAULT 'free',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS workspace_members (
      user_id TEXT NOT NULL,
      workspace_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      created_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, workspace_id)
    );
  `);
}

function insertUser(
  sqlite: ReturnType<typeof createSqliteD1>["sqlite"],
  user: { id: string; email: string; name?: string | null; image?: string | null; role?: string },
): void {
  sqlite
    .prepare(
      "INSERT OR REPLACE INTO users (id, email, name, image, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .run(user.id, user.email, user.name ?? null, user.image ?? null, user.role ?? "user", NOW, NOW);
}

function insertWorkspace(
  sqlite: ReturnType<typeof createSqliteD1>["sqlite"],
  ws: { id: string; name: string; slug: string; plan?: string },
): void {
  sqlite
    .prepare(
      "INSERT OR REPLACE INTO workspaces (id, name, slug, plan, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run(ws.id, ws.name, ws.slug, ws.plan ?? "free", NOW, NOW);
}

function insertMembership(
  sqlite: ReturnType<typeof createSqliteD1>["sqlite"],
  userId: string,
  workspaceId: string,
  role: string,
): void {
  sqlite
    .prepare(
      "INSERT OR REPLACE INTO workspace_members (user_id, workspace_id, role, created_at) VALUES (?, ?, ?, ?)",
    )
    .run(userId, workspaceId, role, NOW);
}

function createRegistry(userId: string) {
  const { d1, sqlite } = createSqliteD1();
  bootstrapSchema(sqlite);
  const db = createDb(d1);
  const server = createMockMcpServer();
  const registry = new ToolRegistry(server, userId);
  registerAuthTools(
    registry as unknown as import("../../../src/edge-api/spike-land/lazy-imports/registry").ToolRegistry,
    userId,
    db,
  );
  registry.enableAll();
  return { registry, sqlite, db };
}

function getText(result: { content: Array<{ type: string; text?: string }> }): string {
  return result.content
    .filter((c) => c.type === "text" && typeof c.text === "string")
    .map((c) => c.text!)
    .join("\n");
}

// ─── auth_check_session ───────────────────────────────────────────────────────

describe("auth_check_session", () => {
  it("returns session valid with user details", async () => {
    const { registry, sqlite } = createRegistry("user-abc");
    insertUser(sqlite, {
      id: "user-abc",
      email: "alice@example.com",
      name: "Alice Smith",
      role: "user",
    });

    const result = await registry.callToolDirect("auth_check_session", {});
    const text = getText(result);
    expect(result.isError).toBeUndefined();
    expect(text).toContain("Session Valid");
    expect(text).toContain("Alice Smith");
    expect(text).toContain("alice@example.com");
    expect(text).toContain("user");
    expect(text).toContain("Member since:");
  });

  it("shows 'unnamed' when user has no name", async () => {
    const { registry, sqlite } = createRegistry("user-abc");
    insertUser(sqlite, { id: "user-abc", email: "alice@example.com", name: null, role: "user" });

    const result = await registry.callToolDirect("auth_check_session", {});
    expect(getText(result)).toContain("unnamed");
  });

  it("returns NOT_FOUND error when user does not exist in DB", async () => {
    const { registry } = createRegistry("ghost-user");
    // No user inserted — ghost-user doesn't exist

    const result = await registry.callToolDirect("auth_check_session", {});
    const text = getText(result);
    expect(text).toContain("NOT_FOUND");
    expect(text).toContain("User session invalid or user not found");
  });

  it("accepts optional session_token without error (field is unused by handler)", async () => {
    const { registry, sqlite } = createRegistry("user-abc");
    insertUser(sqlite, { id: "user-abc", email: "alice@example.com", name: "Alice" });

    const result = await registry.callToolDirect("auth_check_session", {
      session_token: "tok-xyz",
    });
    expect(result.isError).toBeUndefined();
    expect(getText(result)).toContain("Session Valid");
  });

  it("formats member since as ISO string", async () => {
    const { registry, sqlite } = createRegistry("user-abc");
    insertUser(sqlite, { id: "user-abc", email: "alice@example.com" });

    const result = await registry.callToolDirect("auth_check_session", {});
    const text = getText(result);
    expect(text).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});

// ─── auth_check_route_access ─────────────────────────────────────────────────

describe("auth_check_route_access", () => {
  it("grants access to a regular route for any user", async () => {
    const { registry, sqlite } = createRegistry("user-abc");
    insertUser(sqlite, { id: "user-abc", email: "alice@example.com", role: "user" });

    const result = await registry.callToolDirect("auth_check_route_access", {
      path: "/dashboard",
    });
    const text = getText(result);
    expect(result.isError).toBeUndefined();
    expect(text).toContain("**Access:** GRANTED");
    expect(text).toContain("**Requires Admin:** false");
    expect(text).toContain("/dashboard");
  });

  it("denies admin route for regular user", async () => {
    const { registry, sqlite } = createRegistry("user-abc");
    insertUser(sqlite, { id: "user-abc", email: "alice@example.com", role: "user" });

    const result = await registry.callToolDirect("auth_check_route_access", {
      path: "/admin",
    });
    const text = getText(result);
    expect(text).toContain("**Access:** DENIED");
    expect(text).toContain("**Requires Admin:** true");
  });

  it("grants admin route for admin user", async () => {
    const { registry, sqlite } = createRegistry("admin-xyz");
    insertUser(sqlite, { id: "admin-xyz", email: "admin@example.com", role: "admin" });

    const result = await registry.callToolDirect("auth_check_route_access", {
      path: "/admin/agents",
    });
    const text = getText(result);
    expect(text).toContain("**Access:** GRANTED");
    expect(text).toContain("**Requires Admin:** true");
    expect(text).toContain("admin");
  });

  it("recognizes all admin sub-routes as restricted", async () => {
    const adminRoutes = [
      "/admin",
      "/admin/agents",
      "/admin/emails",
      "/admin/gallery",
      "/admin/jobs",
      "/admin/photos",
    ];
    for (const path of adminRoutes) {
      const { registry, sqlite } = createRegistry("user-abc");
      insertUser(sqlite, { id: "user-abc", email: "alice@example.com", role: "user" });
      const result = await registry.callToolDirect("auth_check_route_access", { path });
      expect(getText(result)).toContain("**Requires Admin:** true");
    }
  });

  it("handles paths starting with admin sub-paths via prefix matching", async () => {
    const { registry, sqlite } = createRegistry("user-abc");
    insertUser(sqlite, { id: "user-abc", email: "alice@example.com", role: "user" });

    const result = await registry.callToolDirect("auth_check_route_access", {
      path: "/admin/gallery/bulk-upload",
    });
    expect(getText(result)).toContain("**Requires Admin:** true");
    expect(getText(result)).toContain("**Access:** DENIED");
  });

  it("returns DENIED when user not found in DB", async () => {
    const { registry } = createRegistry("ghost");
    // No user inserted

    const result = await registry.callToolDirect("auth_check_route_access", {
      path: "/dashboard",
    });
    const text = getText(result);
    expect(text).toContain("**Access: DENIED**");
    expect(text).toContain("User not authenticated");
  });

  it("non-admin path gives GRANTED for regular user", async () => {
    const { registry, sqlite } = createRegistry("user-abc");
    insertUser(sqlite, { id: "user-abc", email: "alice@example.com", role: "user" });

    const result = await registry.callToolDirect("auth_check_route_access", {
      path: "/profile",
    });
    expect(getText(result)).toContain("**Access:** GRANTED");
    expect(getText(result)).toContain("**Requires Admin:** false");
  });
});

// ─── auth_signup ──────────────────────────────────────────────────────────────

describe("auth_signup", () => {
  it("returns the spike.land login URL", async () => {
    const { registry } = createRegistry("any-user");
    const result = await registry.callToolDirect("auth_signup", {});
    const text = getText(result);
    expect(result.isError).toBeUndefined();
    expect(text).toContain("Registration Required");
    expect(text).toContain("https://spike.land/login");
  });

  it("mentions supported OAuth providers", async () => {
    const { registry } = createRegistry("any-user");
    const result = await registry.callToolDirect("auth_signup", {});
    const text = getText(result);
    expect(text).toContain("GitHub");
    expect(text).toContain("Google");
    expect(text).toContain("Email");
  });

  it("does not require user to exist in DB", async () => {
    // auth_signup handler takes no ctx db/userId, so it works for anyone
    const { registry } = createRegistry("ghost-user");
    const result = await registry.callToolDirect("auth_signup", {});
    expect(result.isError).toBeUndefined();
  });

  it("includes MCP connection mention", async () => {
    const { registry } = createRegistry("any-user");
    const result = await registry.callToolDirect("auth_signup", {});
    expect(getText(result)).toContain("MCP");
  });
});

// ─── auth_get_profile ────────────────────────────────────────────────────────

describe("auth_get_profile", () => {
  it("returns full user profile without workspaces", async () => {
    const { registry, sqlite } = createRegistry("user-abc");
    insertUser(sqlite, {
      id: "user-abc",
      email: "alice@example.com",
      name: "Alice Smith",
      image: "https://example.com/avatar.jpg",
      role: "user",
    });

    const result = await registry.callToolDirect("auth_get_profile", {
      include_workspaces: false,
    });
    const text = getText(result);
    expect(result.isError).toBeUndefined();
    expect(text).toContain("User Profile");
    expect(text).toContain("Alice Smith");
    expect(text).toContain("alice@example.com");
    expect(text).toContain("user");
    expect(text).toContain("https://example.com/avatar.jpg");
    expect(text).not.toContain("Workspaces:");
  });

  it("shows (none) when user has no avatar", async () => {
    const { registry, sqlite } = createRegistry("user-abc");
    insertUser(sqlite, { id: "user-abc", email: "alice@example.com", image: null });

    const result = await registry.callToolDirect("auth_get_profile", {});
    expect(getText(result)).toContain("(none)");
  });

  it("shows 'unnamed' when user has no name", async () => {
    const { registry, sqlite } = createRegistry("user-abc");
    insertUser(sqlite, { id: "user-abc", email: "alice@example.com", name: null });

    const result = await registry.callToolDirect("auth_get_profile", {});
    expect(getText(result)).toContain("unnamed");
  });

  it("returns NOT_FOUND when user does not exist", async () => {
    const { registry } = createRegistry("ghost");
    // No user inserted

    const result = await registry.callToolDirect("auth_get_profile", {});
    const text = getText(result);
    expect(text).toContain("NOT_FOUND");
    expect(text).toContain("User not found");
  });

  it("includes workspace memberships when include_workspaces is true", async () => {
    const { registry, sqlite } = createRegistry("user-abc");
    insertUser(sqlite, { id: "user-abc", email: "alice@example.com", name: "Alice" });
    insertWorkspace(sqlite, { id: "ws-1", name: "Acme Corp", slug: "acme-corp", plan: "pro" });
    insertWorkspace(sqlite, { id: "ws-2", name: "Open Source", slug: "open-source", plan: "free" });
    insertMembership(sqlite, "user-abc", "ws-1", "owner");
    insertMembership(sqlite, "user-abc", "ws-2", "member");

    const result = await registry.callToolDirect("auth_get_profile", {
      include_workspaces: true,
    });
    const text = getText(result);
    expect(text).toContain("Workspaces:");
    expect(text).toContain("Acme Corp");
    expect(text).toContain("acme-corp");
    expect(text).toContain("owner");
    expect(text).toContain("Open Source");
    expect(text).toContain("member");
  });

  it("does not show workspaces section when include_workspaces is false", async () => {
    const { registry, sqlite } = createRegistry("user-abc");
    insertUser(sqlite, { id: "user-abc", email: "alice@example.com" });
    insertWorkspace(sqlite, { id: "ws-1", name: "Acme Corp", slug: "acme-corp" });
    insertMembership(sqlite, "user-abc", "ws-1", "owner");

    const result = await registry.callToolDirect("auth_get_profile", {
      include_workspaces: false,
    });
    expect(getText(result)).not.toContain("Workspaces:");
  });

  it("does not show workspaces section when user has no memberships", async () => {
    const { registry, sqlite } = createRegistry("user-abc");
    insertUser(sqlite, { id: "user-abc", email: "alice@example.com" });
    // No workspace memberships

    const result = await registry.callToolDirect("auth_get_profile", {
      include_workspaces: true,
    });
    // memberships array empty → section not rendered
    expect(getText(result)).not.toContain("Workspaces:");
  });

  it("formats joined date as ISO string", async () => {
    const { registry, sqlite } = createRegistry("user-abc");
    insertUser(sqlite, { id: "user-abc", email: "alice@example.com" });

    const result = await registry.callToolDirect("auth_get_profile", {});
    expect(getText(result)).toMatch(/Joined:.*\d{4}-\d{2}-\d{2}T/);
  });

  it("shows admin role for admin user", async () => {
    const { registry, sqlite } = createRegistry("admin-xyz");
    insertUser(sqlite, {
      id: "admin-xyz",
      email: "admin@example.com",
      name: "Admin User",
      role: "admin",
    });

    const result = await registry.callToolDirect("auth_get_profile", {});
    expect(getText(result)).toContain("**Role:** admin");
  });
});
