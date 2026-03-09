import type { McpServer, RegisteredTool } from "@modelcontextprotocol/sdk/server/mcp.js";
import { describe, expect, it, vi } from "vitest";
import { registerLearnItTools } from "../../../src/edge-api/spike-land/core-logic/tools/learnit";
import { ToolRegistry } from "../../../src/edge-api/spike-land/lazy-imports/registry";

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

interface MockQuery {
  from: ReturnType<typeof vi.fn>;
  innerJoin: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  then: <TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: unknown[]) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) => Promise<TResult1 | TResult2>;
}

function createSelectQuery(response: unknown[], whereConditions: unknown[]): MockQuery {
  const query: MockQuery = {
    from: vi.fn(() => query),
    innerJoin: vi.fn(() => query),
    where: vi.fn((condition: unknown) => {
      whereConditions.push(condition);
      return query;
    }),
    limit: vi.fn(async () => response),
    then: (onfulfilled, onrejected) => Promise.resolve(response).then(onfulfilled, onrejected),
  };

  return query;
}

function createMockDb(selectResponses: unknown[][]) {
  const whereConditions: unknown[] = [];
  const select = vi.fn(() => createSelectQuery(selectResponses.shift() ?? [], whereConditions));
  const updateWhereConditions: unknown[] = [];

  const update = vi.fn(() => {
    const updateQuery = {
      set: vi.fn(() => updateQuery),
      where: vi.fn(async (condition: unknown) => {
        updateWhereConditions.push(condition);
        return { rowsAffected: 1 };
      }),
    };

    return updateQuery;
  });

  return {
    db: { select, update },
    whereConditions,
    updateWhereConditions,
  };
}

function hasChunk(
  node: unknown,
  predicate: (value: unknown) => boolean,
  visited = new WeakSet<object>(),
): boolean {
  if (predicate(node)) {
    return true;
  }

  if (Array.isArray(node)) {
    return node.some((item) => hasChunk(item, predicate, visited));
  }

  if (node && typeof node === "object") {
    if (visited.has(node)) {
      return false;
    }
    visited.add(node);

    return Object.values(node).some((value) => hasChunk(value, predicate, visited));
  }

  return false;
}

function hasPublishedStatusFilter(condition: unknown): boolean {
  const hasStatusColumn = hasChunk(
    condition,
    (value) =>
      Boolean(
        value &&
          typeof value === "object" &&
          "name" in value &&
          value.name === "status" &&
          "table" in value,
      ),
  );
  const hasPublishedValue = hasChunk(
    condition,
    (value) => Boolean(value && typeof value === "object" && "value" in value && value.value === "published"),
  );

  return hasStatusColumn && hasPublishedValue;
}

function createRegistry(selectResponses: unknown[][]) {
  const { db, whereConditions, updateWhereConditions } = createMockDb(selectResponses);
  const server = createMockMcpServer();
  const registry = new ToolRegistry(server, "user-1");

  registerLearnItTools(
    registry,
    "user-1",
    db as unknown as Parameters<typeof registerLearnItTools>[2],
  );
  registry.enableAll();

  return { registry, whereConditions, updateWhereConditions };
}

describe("learnit tools", () => {
  it("adds a published filter to direct topic lookups and parent joins", async () => {
    const { registry, whereConditions, updateWhereConditions } = createRegistry([
      [{ id: "topic-1", slug: "topic", title: "Topic", description: "desc", content: "body", status: "published", viewCount: 3 }],
      [],
    ]);

    await registry.callToolDirect("learnit_get_topic", { slug: "topic" });

    expect(whereConditions).toHaveLength(2);
    expect(hasPublishedStatusFilter(whereConditions[0])).toBe(true);
    expect(hasPublishedStatusFilter(whereConditions[1])).toBe(true);
    expect(updateWhereConditions).toHaveLength(1);
  });

  it("adds published filters to relation lookups for the topic and joined neighbors", async () => {
    const { registry, whereConditions } = createRegistry([
      [{ id: "topic-1", title: "Topic" }],
      [],
      [],
    ]);

    await registry.callToolDirect("learnit_get_relations", { slug: "topic" });

    expect(whereConditions).toHaveLength(3);
    expect(hasPublishedStatusFilter(whereConditions[0])).toBe(true);
    expect(hasPublishedStatusFilter(whereConditions[1])).toBe(true);
    expect(hasPublishedStatusFilter(whereConditions[2])).toBe(true);
  });
});
