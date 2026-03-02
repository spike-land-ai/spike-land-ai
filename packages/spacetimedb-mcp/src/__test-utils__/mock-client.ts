/**
 * Mock SpacetimeDB client for unit testing.
 * Simulates connection, agent registry, messages, and tasks in memory.
 */

import { vi } from "vitest";
import type { SpacetimeClient } from "../client.js";
import type { Agent, AgentMessage, ConnectionState, Task } from "../types.js";

export interface MockClientOptions {
  /** Start in connected state */
  connected?: boolean;
  /** Pre-populate agents */
  agents?: Agent[];
  /** Pre-populate messages */
  messages?: AgentMessage[];
  /** Pre-populate tasks */
  tasks?: Task[];
  /** Simulate connection failure */
  failConnect?: boolean;
}

export function createMockClient(options: MockClientOptions = {}): SpacetimeClient & {
  _agents: Agent[];
  _messages: AgentMessage[];
  _tasks: Task[];
  _nextMessageId: bigint;
  _nextTaskId: bigint;
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
  let nextMessageId = BigInt(messages.length + 1);
  let nextTaskId = BigInt(tasks.length + 1);

  function requireConnected(): void {
    if (!state.connected) throw new Error("Not connected");
  }

  return {
    _agents: agents,
    _messages: messages,
    _tasks: tasks,
    get _nextMessageId() {
      return nextMessageId;
    },
    get _nextTaskId() {
      return nextTaskId;
    },

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
      state.connected = false;
      state.uri = null;
      state.moduleName = null;
      state.identity = null;
      state.token = null;
    }),

    registerAgent: vi.fn(async (displayName: string, capabilities: string[]) => {
      requireConnected();
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
    }),

    unregisterAgent: vi.fn(async () => {
      requireConnected();
      const agent = agents.find((a) => a.identity === state.identity);
      if (agent) agent.online = false;
    }),

    listAgents: vi.fn(() => {
      requireConnected();
      return [...agents];
    }),

    sendMessage: vi.fn(async (toAgent: string, content: string) => {
      requireConnected();
      messages.push({
        id: nextMessageId++,
        fromAgent: state.identity!,
        toAgent,
        content,
        timestamp: BigInt(Date.now()),
        delivered: false,
      });
    }),

    getMessages: vi.fn((onlyUndelivered = true) => {
      requireConnected();
      return messages.filter((m) => {
        if (m.toAgent !== state.identity) return false;
        if (onlyUndelivered && m.delivered) return false;
        return true;
      });
    }),

    markDelivered: vi.fn(async (messageId: bigint) => {
      requireConnected();
      const msg = messages.find((m) => m.id === messageId);
      if (msg) msg.delivered = true;
    }),

    createTask: vi.fn(async (description: string, priority: number, context: string) => {
      requireConnected();
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
    }),

    listTasks: vi.fn((statusFilter?: string) => {
      requireConnected();
      if (statusFilter) return tasks.filter((t) => t.status === statusFilter);
      return [...tasks];
    }),

    claimTask: vi.fn(async (taskId: bigint) => {
      requireConnected();
      const task = tasks.find((t) => t.id === taskId);
      if (!task) throw new Error("Task not found");
      task.assignedTo = state.identity!;
      task.status = "in_progress";
    }),

    completeTask: vi.fn(async (taskId: bigint) => {
      requireConnected();
      const task = tasks.find((t) => t.id === taskId);
      if (!task) throw new Error("Task not found");
      task.status = "completed";
    }),
  };
}
