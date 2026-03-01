import { describe, expect, it } from "vitest";
import { createMockClient } from "./__test-utils__/index.js";

describe("mock client", () => {
  it("starts disconnected by default", () => {
    const client = createMockClient();
    expect(client.getState().connected).toBe(false);
  });

  it("starts connected when option set", () => {
    const client = createMockClient({ connected: true });
    expect(client.getState().connected).toBe(true);
    expect(client.getState().identity).toBe("mock-identity-abc123");
  });

  it("connects and returns state", async () => {
    const client = createMockClient();
    const state = await client.connect("wss://test", "mod");
    expect(state.connected).toBe(true);
    expect(state.identity).toBe("mock-identity-abc123");
  });

  it("throws when connecting while already connected", async () => {
    const client = createMockClient({ connected: true });
    await expect(client.connect("wss://test", "mod")).rejects.toThrow("Already connected");
  });

  it("throws when failConnect is set", async () => {
    const client = createMockClient({ failConnect: true });
    await expect(client.connect("wss://test", "mod")).rejects.toThrow("Connection refused");
  });

  it("disconnects cleanly", () => {
    const client = createMockClient({ connected: true });
    client.disconnect();
    expect(client.getState().connected).toBe(false);
  });

  it("registers and lists agents", async () => {
    const client = createMockClient({ connected: true });
    await client.registerAgent("TestAgent", ["cap1"]);
    const agents = client.listAgents();
    expect(agents).toHaveLength(1);
    expect(agents[0].displayName).toBe("TestAgent");
  });

  it("sends and retrieves messages", async () => {
    const client = createMockClient({ connected: true });
    await client.sendMessage("mock-identity-abc123", "hello");
    const msgs = client.getMessages(false);
    expect(msgs).toHaveLength(1);
    expect(msgs[0].content).toBe("hello");
  });

  it("filters undelivered messages", async () => {
    const client = createMockClient({ connected: true });
    await client.sendMessage("mock-identity-abc123", "msg1");
    await client.markDelivered(BigInt(1));
    await client.sendMessage("mock-identity-abc123", "msg2");

    const undelivered = client.getMessages(true);
    expect(undelivered).toHaveLength(1);
    expect(undelivered[0].content).toBe("msg2");
  });

  it("creates and lists tasks", async () => {
    const client = createMockClient({ connected: true });
    await client.createTask("Do thing", 10, "ctx");
    const tasks = client.listTasks();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].description).toBe("Do thing");
    expect(tasks[0].status).toBe("pending");
  });

  it("filters tasks by status", async () => {
    const client = createMockClient({ connected: true });
    await client.createTask("A", 10, "");
    await client.createTask("B", 20, "");
    await client.claimTask(BigInt(1));

    expect(client.listTasks("pending")).toHaveLength(1);
    expect(client.listTasks("in_progress")).toHaveLength(1);
  });

  it("claims and completes tasks", async () => {
    const client = createMockClient({ connected: true });
    await client.createTask("Task", 10, "");
    await client.claimTask(BigInt(1));
    expect(client._tasks[0].status).toBe("in_progress");

    await client.completeTask(BigInt(1));
    expect(client._tasks[0].status).toBe("completed");
  });

  it("throws on claim non-existent task", async () => {
    const client = createMockClient({ connected: true });
    await expect(client.claimTask(BigInt(999))).rejects.toThrow("Task not found");
  });

  it("throws operations when not connected", () => {
    const client = createMockClient({ connected: false });
    expect(() => client.listAgents()).toThrow("Not connected");
    expect(() => client.getMessages()).toThrow("Not connected");
    expect(() => client.listTasks()).toThrow("Not connected");
  });
});
