import { beforeEach, describe, expect, it, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMockClient, createMockServer } from "../__test-utils__/index.js";
import type { MockMcpServer } from "../__test-utils__/index.js";
import { registerTaskTools } from "./task-tools.js";

describe("task-tools", () => {
  let server: MockMcpServer;
  let client: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    server = createMockServer();
    client = createMockClient({ connected: true });
    registerTaskTools(server as unknown as McpServer, client);
  });

  // ─── Tool Registration ───

  it("registers all task tools", () => {
    const toolNames = [...server.handlers.keys()];
    expect(toolNames).toContain("stdb_create_task");
    expect(toolNames).toContain("stdb_list_tasks");
    expect(toolNames).toContain("stdb_claim_task");
    expect(toolNames).toContain("stdb_complete_task");
    expect(server.tool).toHaveBeenCalledTimes(4);
  });

  // ─── stdb_create_task ───

  describe("stdb_create_task", () => {
    it("creates a task", async () => {
      const result = await server.call("stdb_create_task", {
        description: "Review the PR",
        priority: 10,
        context: '{"pr": 123}',
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.created).toBe(true);
      expect(parsed.description).toBe("Review the PR");
      expect(parsed.priority).toBe(10);
      expect(client.createTask).toHaveBeenCalledWith("Review the PR", 10, '{"pr": 123}');
    });

    it("creates a task with defaults", async () => {
      const result = await server.call("stdb_create_task", {
        description: "Simple task",
        priority: 128,
        context: "",
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.created).toBe(true);
    });

    it("returns NOT_CONNECTED when disconnected", async () => {
      const dcClient = createMockClient({ connected: false });
      const dcServer = createMockServer();
      registerTaskTools(dcServer as unknown as McpServer, dcClient);

      const result = await dcServer.call("stdb_create_task", {
        description: "test",
        priority: 128,
        context: "",
      });

      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe("NOT_CONNECTED");
    });
  });

  // ─── stdb_list_tasks ───

  describe("stdb_list_tasks", () => {
    it("lists all tasks", async () => {
      client._tasks.push(
        {
          id: BigInt(1),
          description: "Task A",
          assignedTo: undefined,
          status: "pending",
          priority: 10,
          context: "",
          createdBy: "a",
          createdAt: BigInt(100),
        },
        {
          id: BigInt(2),
          description: "Task B",
          assignedTo: "agent-1",
          status: "in_progress",
          priority: 20,
          context: "{}",
          createdBy: "b",
          createdAt: BigInt(200),
        },
      );

      const result = await server.call("stdb_list_tasks", {});
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.count).toBe(2);
      expect(parsed.tasks[0].description).toBe("Task A");
      expect(parsed.tasks[0].assignedTo).toBeNull();
      expect(parsed.tasks[1].assignedTo).toBe("agent-1");
    });

    it("filters by status", async () => {
      client._tasks.push(
        {
          id: BigInt(1),
          description: "Pending",
          assignedTo: undefined,
          status: "pending",
          priority: 10,
          context: "",
          createdBy: "a",
          createdAt: BigInt(100),
        },
        {
          id: BigInt(2),
          description: "Done",
          assignedTo: "a",
          status: "completed",
          priority: 20,
          context: "",
          createdBy: "a",
          createdAt: BigInt(200),
        },
      );

      const result = await server.call("stdb_list_tasks", { status: "pending" });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.count).toBe(1);
      expect(parsed.tasks[0].description).toBe("Pending");
    });

    it("returns NOT_CONNECTED when disconnected", async () => {
      const dcClient = createMockClient({ connected: false });
      const dcServer = createMockServer();
      registerTaskTools(dcServer as unknown as McpServer, dcClient);

      const result = await dcServer.call("stdb_list_tasks", {});
      expect(result.isError).toBe(true);
    });
  });

  // ─── stdb_claim_task ───

  describe("stdb_claim_task", () => {
    it("claims a task", async () => {
      client._tasks.push({
        id: BigInt(1),
        description: "Task",
        assignedTo: undefined,
        status: "pending",
        priority: 10,
        context: "",
        createdBy: "a",
        createdAt: BigInt(100),
      });

      const result = await server.call("stdb_claim_task", { taskId: "1" });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.claimed).toBe(true);
      expect(parsed.taskId).toBe("1");
      expect(client.claimTask).toHaveBeenCalledWith(BigInt(1));
    });

    it("returns REDUCER_FAILED for non-existent task", async () => {
      const result = await server.call("stdb_claim_task", { taskId: "999" });
      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe("REDUCER_FAILED");
    });

    it("returns NOT_CONNECTED when disconnected", async () => {
      const dcClient = createMockClient({ connected: false });
      const dcServer = createMockServer();
      registerTaskTools(dcServer as unknown as McpServer, dcClient);

      const result = await dcServer.call("stdb_claim_task", { taskId: "1" });
      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe("NOT_CONNECTED");
    });
  });

  // ─── stdb_complete_task ───

  describe("stdb_complete_task", () => {
    it("completes a task", async () => {
      client._tasks.push({
        id: BigInt(5),
        description: "Task",
        assignedTo: "mock-identity-abc123",
        status: "in_progress",
        priority: 10,
        context: "",
        createdBy: "a",
        createdAt: BigInt(100),
      });

      const result = await server.call("stdb_complete_task", { taskId: "5" });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.completed).toBe(true);
      expect(parsed.taskId).toBe("5");
      expect(client.completeTask).toHaveBeenCalledWith(BigInt(5));
    });

    it("returns REDUCER_FAILED for non-existent task", async () => {
      const result = await server.call("stdb_complete_task", { taskId: "999" });
      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe("REDUCER_FAILED");
    });

    it("returns NOT_CONNECTED when disconnected", async () => {
      const dcClient = createMockClient({ connected: false });
      const dcServer = createMockServer();
      registerTaskTools(dcServer as unknown as McpServer, dcClient);

      const result = await dcServer.call("stdb_complete_task", { taskId: "1" });
      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe("NOT_CONNECTED");
    });
  });

  // ─── Error branch coverage ───

  describe("stdb_create_task error paths", () => {
    it("returns REDUCER_FAILED on non-connection errors", async () => {
      client.createTask = vi.fn(async () => {
        throw new Error("Reducer panicked");
      });
      const result = await server.call("stdb_create_task", {
        description: "fail",
        priority: 10,
        context: "",
      });
      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe("REDUCER_FAILED");
    });

    it("handles non-Error thrown values", async () => {
      client.createTask = vi.fn(async () => {
        throw 42;
      });
      const result = await server.call("stdb_create_task", {
        description: "fail",
        priority: 10,
        context: "",
      });
      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.message).toBe("42");
    });
  });

  describe("stdb_list_tasks error paths", () => {
    it("returns QUERY_FAILED on non-connection errors", async () => {
      client.listTasks = vi.fn(() => {
        throw new Error("DB error");
      });
      const result = await server.call("stdb_list_tasks", {});
      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe("QUERY_FAILED");
    });

    it("handles non-Error thrown values", async () => {
      client.listTasks = vi.fn(() => {
        throw "oops";
      });
      const result = await server.call("stdb_list_tasks", {});
      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.message).toBe("oops");
    });
  });

  describe("stdb_claim_task error paths", () => {
    it("handles non-Error thrown values", async () => {
      client.claimTask = vi.fn(async () => {
        throw "string error";
      });
      const result = await server.call("stdb_claim_task", { taskId: "1" });
      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe("REDUCER_FAILED");
    });
  });

  describe("stdb_complete_task error paths", () => {
    it("handles non-Error thrown values", async () => {
      client.completeTask = vi.fn(async () => {
        throw 42;
      });
      const result = await server.call("stdb_complete_task", { taskId: "1" });
      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe("REDUCER_FAILED");
    });
  });
});
