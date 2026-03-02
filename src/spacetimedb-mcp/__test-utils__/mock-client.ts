/**
 * Mock SpacetimeDB client for unit testing.
 * Simulates connection, agent registry, messages, and tasks in memory.
 */

import { vi } from "vitest";
import type { SpacetimeClient, SpacetimeMcpClient } from "../client.js";
import type { Agent, AgentMessage, ConnectionState, Task, RegisteredTool, McpTask } from "../types.js";

export interface MockClientOptions {
  /** Start in connected state */
  connected?: boolean;
  /** Pre-populate agents */
  agents?: Agent[];
  /** Pre-populate messages */
  messages?: AgentMessage[];
  /** Pre-populate tasks */
  tasks?: Task[];
  /** Pre-populate mcp tasks */
  mcpTasks?: McpTask[];
  /** Pre-populate tools */
  tools?: RegisteredTool[];
  /** Simulate connection failure */
  failConnect?: boolean;
}

export function createMockClient(options: MockClientOptions = {}): SpacetimeMcpClient & SpacetimeClient & {
  _agents: Agent[];
  _messages: AgentMessage[];
  _tasks: Task[];
  _mcpTasks: McpTask[];
  _tools: RegisteredTool[];
  _nextMessageId: bigint;
  _nextTaskId: bigint;
  _nextMcpTaskId: bigint;
  _nextToolId: bigint;
} {
  const state: ConnectionState = {
    connected: options.connected ?? false,
    uri: options.connected ? "wss://mock.spacetimedb.com" : null,
    moduleName: options.connected ? "test-module" : null,
    identity: options.connected ? "mock-identity-abc123" : null,
    token: options.connected ? "mock-token-xyz" : null,
  };

  const agents: Agent[] = options.agents ? [...options.agents] : [];
  const messages: AgentMessage[] = options.messages ? [...options.messages] : [];
  const tasks: Task[] = options.tasks ? [...options.tasks] : [];
  const mcpTasks: McpTask[] = options.mcpTasks ? [...options.mcpTasks] : [];
  const tools: RegisteredTool[] = options.tools ? [...options.tools] : [];
  
  let nextMessageId = BigInt(messages.length + 1);
  let nextTaskId = BigInt(tasks.length + 1);
  let nextMcpTaskId = BigInt(mcpTasks.length + 1);
  let nextToolId = BigInt(tools.length + 1);

  const eventListeners: Array<() => void> = [];

  function requireConnectedAsync(): Promise<void> {
    if (!state.connected) return Promise.reject(new Error("Not connected"));
    return Promise.resolve();
  }

  function requireConnectedSync(): void {
    if (!state.connected) throw new Error("Not connected");
  }

  function notifyListeners() {
    for (const cb of eventListeners) cb();
  }

  return {
    _agents: agents,
    _messages: messages,
    _tasks: tasks,
    _mcpTasks: mcpTasks,
    _tools: tools,
    get _nextMessageId() { return nextMessageId; },
    get _nextTaskId() { return nextTaskId; },
    get _nextMcpTaskId() { return nextMcpTaskId; },
    get _nextToolId() { return nextToolId; },

    getState: vi.fn(() => ({ ...state })),

    connect: vi.fn(async (uri: string, moduleName: string, token?: string) => {
      if (state.connected) throw new Error("Already connected. Disconnect first.");
      if (options.failConnect) throw new Error("Connection refused");
      state.connected = true;
      state.uri = uri;
      state.moduleName = moduleName;
      state.identity = "mock-identity-abc123";
      state.token = token ?? "mock-token-generated";
      return { ...state };
    }),

    disconnect: vi.fn(() => {
      if (!state.connected) throw new Error("Not connected");
      state.connected = false;
      state.uri = null;
      state.moduleName = null;
      state.identity = null;
      state.token = null;
    }),

    onEvent: vi.fn((cb: () => void) => {
      eventListeners.push(cb);
    }),

    // ─── Swarm Tools ───

    registerTool: vi.fn(async (name: string, description: string, inputSchema: string, category: string) => {
      await requireConnectedAsync();
      tools.push({
        id: nextToolId++,
        name,
        description,
        inputSchema,
        providerIdentity: state.identity!,
        category,
        createdAt: BigInt(Date.now()),
      });
      notifyListeners();
    }),

    unregisterTool: vi.fn(async (name: string) => {
      await requireConnectedAsync();
      const idx = tools.findIndex(t => t.name === name && t.providerIdentity === state.identity);
      if (idx !== -1) tools.splice(idx, 1);
      notifyListeners();
    }),

    listRegisteredTools: vi.fn(async (categoryFilter?: string) => {
      await requireConnectedAsync();
      if (categoryFilter) return tools.filter(t => t.category === categoryFilter);
      return [...tools];
    }),

    invokeToolRequest: vi.fn(async (toolName: string, argumentsJson: string) => {
      await requireConnectedAsync();
      mcpTasks.push({
        id: nextMcpTaskId++,
        toolName,
        argumentsJson,
        requesterIdentity: state.identity!,
        status: "pending",
        createdAt: BigInt(Date.now()),
      });
      notifyListeners();
    }),

    claimMcpTask: vi.fn(async (taskId: bigint) => {
      await requireConnectedAsync();
      const task = mcpTasks.find(t => t.id === taskId);
      if (!task) throw new Error("Task not found");
      task.status = "claimed";
      task.providerIdentity = state.identity!;
      notifyListeners();
    }),

    completeMcpTask: vi.fn(async (taskId: bigint, resultJson?: string, error?: string) => {
      await requireConnectedAsync();
      const task = mcpTasks.find(t => t.id === taskId);
      if (!task) throw new Error("Task not found");
      task.status = error ? "failed" : "completed";
      task.resultJson = resultJson;
      task.error = error;
      task.completedAt = BigInt(Date.now());
      notifyListeners();
    }),

    listMcpTasks: vi.fn(async (statusFilter?: string) => {
      await requireConnectedAsync();
      if (statusFilter) return mcpTasks.filter(t => t.status === statusFilter);
      return [...mcpTasks];
    }),

    // ─── Legacy Agent Tools ───

    registerAgent: vi.fn(async (displayName: string, capabilities: string[]) => {
      await requireConnectedAsync();
      const existing = agents.find((a) => a.identity === state.identity);
      if (existing) {
        existing.displayName = displayName;
        existing.capabilities = capabilities;
        existing.online = true;
        existing.lastSeen = BigInt(Date.now());
      } else {
        agents.push({
          identity: state.identity!,
          displayName,
          capabilities,
          online: true,
          lastSeen: BigInt(Date.now()),
        });
      }
      notifyListeners();
    }),

    unregisterAgent: vi.fn(async () => {
      await requireConnectedAsync();
      const agent = agents.find((a) => a.identity === state.identity);
      if (agent) agent.online = false;
      notifyListeners();
    }),

    listAgents: vi.fn(() => {
      requireConnectedSync();
      return [...agents];
    }),

    sendMessage: vi.fn(async (toAgent: string, content: string) => {
      await requireConnectedAsync();
      messages.push({
        id: nextMessageId++,
        fromAgent: state.identity!,
        toAgent,
        content,
        timestamp: BigInt(Date.now()),
        delivered: false,
      });
      notifyListeners();
    }),

    getMessages: vi.fn((onlyUndelivered = true) => {
      requireConnectedSync();
      return messages.filter((m) => {
        if (m.toAgent !== state.identity) return false;
        if (onlyUndelivered && m.delivered) return false;
        return true;
      });
    }),

    markDelivered: vi.fn(async (messageId: bigint) => {
      await requireConnectedAsync();
      const msg = messages.find((m) => m.id === messageId);
      if (msg) msg.delivered = true;
      notifyListeners();
    }),

    createTask: vi.fn(async (description: string, priority: number, context: string) => {
      await requireConnectedAsync();
      tasks.push({
        id: nextTaskId++,
        description,
        assignedTo: undefined,
        status: "pending",
        priority,
        context,
        createdBy: state.identity!,
        createdAt: BigInt(Date.now()),
      });
      notifyListeners();
    }),

    listTasks: vi.fn((statusFilter?: string) => {
      requireConnectedSync();
      if (statusFilter) return tasks.filter((t) => t.status === statusFilter);
      return [...tasks];
    }),

    claimTask: vi.fn(async (taskId: bigint) => {
      await requireConnectedAsync();
      const task = tasks.find((t) => t.id === taskId);
      if (!task) throw new Error("Task not found");
      task.assignedTo = state.identity!;
      task.status = "in_progress";
      notifyListeners();
    }),

    completeTask: vi.fn(async (taskId: bigint) => {
      await requireConnectedAsync();
      const task = tasks.find((t) => t.id === taskId);
      if (!task) throw new Error("Task not found");
      task.status = "completed";
      notifyListeners();
    }),
  };
}
