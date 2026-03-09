import { readFileSync } from "node:fs";
import type { McpServer, RegisteredTool } from "@modelcontextprotocol/sdk/server/mcp.js";
import { describe, expect, it, vi } from "vitest";
import { registerReactionsTools } from "../../../src/edge-api/spike-land/core-logic/tools/reactions";
import { createDb } from "../../../src/edge-api/spike-land/db/db/db-index";
import { reactionLogs, toolReactions } from "../../../src/edge-api/spike-land/db/db/schema";
import { ToolRegistry } from "../../../src/edge-api/spike-land/lazy-imports/registry";
import { createSqliteD1 } from "../__test-utils__/mock-env";

function createMockMcpServer(): McpServer {
  return {
    registerTool: vi.fn((_name: string, _config: unknown, handler: unknown): RegisteredTool => {
      let isEnabled = true;
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

function extractText(result: { content: Array<{ type: string; text?: string }> }): string {
  return result.content
    .filter((item) => item.type === "text" && typeof item.text === "string")
    .map((item) => item.text)
    .join("\n");
}

function bootstrapReactionSchema(sqlite: ReturnType<typeof createSqliteD1>["sqlite"]): void {
  sqlite.exec("CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT, created_at INTEGER, updated_at INTEGER);");
  sqlite.prepare("INSERT INTO users (id, email, created_at, updated_at) VALUES (?, ?, ?, ?)").run(
    "user-1",
    "user-1@example.com",
    Date.now(),
    Date.now(),
  );
  sqlite.prepare("INSERT INTO users (id, email, created_at, updated_at) VALUES (?, ?, ?, ?)").run(
    "user-2",
    "user-2@example.com",
    Date.now(),
    Date.now(),
  );

  const migration = readFileSync(
    new URL("../../../src/edge-api/spike-land/db/migrations/0013_reactions.sql", import.meta.url),
    "utf8",
  );
  sqlite.exec(migration);
}

function createRegistry(userId = "user-1") {
  const { d1, sqlite } = createSqliteD1();
  bootstrapReactionSchema(sqlite);

  const db = createDb(d1);
  const server = createMockMcpServer();
  const registry = new ToolRegistry(server, userId);

  registerReactionsTools(registry, userId, db);
  registry.enableAll();

  return { db, registry, sqlite };
}

describe("reactions tools", () => {
  it("creates reactions locally and lists only the matching user records", async () => {
    const { db, registry, sqlite } = createRegistry();

    const createResult = await registry.callToolDirect("create_reaction", {
      sourceTool: "arena_submit",
      sourceEvent: "success",
      targetTool: "learnit_get_topic",
      targetInput: { topic: "{{output.topic}}" },
      description: "Open learning context after submit",
    });

    expect(extractText(createResult)).toContain("Reaction created");
    expect(extractText(createResult)).toContain("arena_submit:success");

    await db.insert(toolReactions).values({
      id: "user-2-rule",
      userId: "user-2",
      sourceTool: "arena_submit",
      sourceEvent: "success",
      targetTool: "ignored_tool",
      targetInput: JSON.stringify({ ignored: true }),
      description: "other user",
      enabled: true,
      createdAt: 10,
      updatedAt: 10,
    });

    const listResult = await registry.callToolDirect("list_reactions", {
      sourceTool: "arena_submit",
      enabled: true,
      limit: 10,
    });

    const listText = extractText(listResult);
    expect(listText).toContain("**Reactions (1)**");
    expect(listText).toContain("arena_submit:success → learnit_get_topic [ON]");
    expect(listText).toContain("Open learning context after submit");
    expect(listText).not.toContain("ignored_tool");

    const storedRows = sqlite
      .prepare("SELECT target_input FROM tool_reactions WHERE user_id = ?")
      .all("user-1") as Array<{ target_input: string }>;
    expect(storedRows).toHaveLength(1);
    expect(JSON.parse(storedRows[0]!.target_input)).toEqual({ topic: "{{output.topic}}" });
  });

  it("deletes only owned reactions and returns the empty-state response after removal", async () => {
    const { db, registry } = createRegistry();

    await db.insert(toolReactions).values({
      id: "owned-reaction",
      userId: "user-1",
      sourceTool: "create_site",
      sourceEvent: "success",
      targetTool: "reactions_ping",
      targetInput: JSON.stringify({ id: 1 }),
      description: null,
      enabled: true,
      createdAt: 100,
      updatedAt: 100,
    });

    await db.insert(toolReactions).values({
      id: "foreign-reaction",
      userId: "user-2",
      sourceTool: "create_site",
      sourceEvent: "error",
      targetTool: "reactions_ping",
      targetInput: JSON.stringify({ id: 2 }),
      description: null,
      enabled: true,
      createdAt: 101,
      updatedAt: 101,
    });

    const missingResult = await registry.callToolDirect("delete_reaction", {
      reactionId: "foreign-reaction",
    });
    expect(extractText(missingResult)).toContain("**Error: NOT_FOUND**");

    const deletedResult = await registry.callToolDirect("delete_reaction", {
      reactionId: "owned-reaction",
    });
    expect(extractText(deletedResult)).toContain("Reaction 'owned-reaction' deleted.");

    const listResult = await registry.callToolDirect("list_reactions", {
      sourceTool: "create_site",
      limit: 10,
    });
    expect(extractText(listResult)).toBe("No reactions found.");
  });

  it("shows reaction logs from the local database and honors filters", async () => {
    const { db, registry } = createRegistry();

    await db.insert(toolReactions).values({
      id: "reaction-1",
      userId: "user-1",
      sourceTool: "arena_submit",
      sourceEvent: "success",
      targetTool: "learnit_get_topic",
      targetInput: JSON.stringify({ topic: "React" }),
      description: "primary",
      enabled: true,
      createdAt: 200,
      updatedAt: 200,
    });

    const emptyResult = await registry.callToolDirect("reaction_log", {
      reactionId: "reaction-1",
      limit: 10,
    });
    expect(extractText(emptyResult)).toBe("No reaction logs found.");

    await db.insert(reactionLogs).values([
      {
        id: "log-ok",
        reactionId: "reaction-1",
        userId: "user-1",
        sourceTool: "arena_submit",
        sourceEvent: "success",
        targetTool: "learnit_get_topic",
        isError: false,
        durationMs: 45,
        error: null,
        createdAt: 300,
      },
      {
        id: "log-fail",
        reactionId: "reaction-1",
        userId: "user-1",
        sourceTool: "arena_submit",
        sourceEvent: "success",
        targetTool: "learnit_get_topic",
        isError: true,
        durationMs: 91,
        error: "target tool timeout",
        createdAt: 400,
      },
      {
        id: "log-other-user",
        reactionId: null,
        userId: "user-2",
        sourceTool: "arena_submit",
        sourceEvent: "success",
        targetTool: "ignored_tool",
        isError: true,
        durationMs: 12,
        error: "ignored",
        createdAt: 500,
      },
    ]);

    const filteredResult = await registry.callToolDirect("reaction_log", {
      reactionId: "reaction-1",
      sourceTool: "arena_submit",
      isError: true,
      limit: 10,
    });

    const filteredText = extractText(filteredResult);
    expect(filteredText).toContain("**Reaction Log (1)**");
    expect(filteredText).toContain("arena_submit:success → learnit_get_topic (FAIL, 91ms)");
    expect(filteredText).toContain("Error: target tool timeout");
    expect(filteredText).not.toContain("ignored_tool");
    expect(filteredText).not.toContain("log-ok");
  });
});
