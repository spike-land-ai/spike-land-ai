/**
 * Mock SpacetimeDB Platform client for unit testing.
 * Simulates all 14 tables in memory with auto-increment IDs and vi.fn() spies.
 */

import { vi } from "vitest";
import type { SpacetimePlatformClient } from "../client.js";
import type {
  Agent,
  AgentMessage,
  App,
  AppMessage,
  AppVersion,
  ConnectionState,
  DirectMessage,
  HealthCheck,
  OAuthLink,
  Page,
  PageBlock,
  PlatformEvent,
  Task,
  ToolEntry,
  ToolUsage,
  User,
  UserToolPreference,
} from "../types.js";

export interface MockClientOptions {
  connected?: boolean;
  users?: User[];
  oauthLinks?: OAuthLink[];
  tools?: ToolEntry[];
  toolUsages?: ToolUsage[];
  toolPreferences?: UserToolPreference[];
  apps?: App[];
  appVersions?: AppVersion[];
  appMessages?: AppMessage[];
  agents?: Agent[];
  agentMessages?: AgentMessage[];
  tasks?: Task[];
  pages?: Page[];
  pageBlocks?: PageBlock[];
  directMessages?: DirectMessage[];
  platformEvents?: PlatformEvent[];
  healthChecks?: HealthCheck[];
  failConnect?: boolean;
}

export interface MockPlatformClient extends SpacetimePlatformClient {
  _users: User[];
  _oauthLinks: OAuthLink[];
  _tools: ToolEntry[];
  _toolUsages: ToolUsage[];
  _toolPreferences: UserToolPreference[];
  _apps: App[];
  _appVersions: AppVersion[];
  _appMessages: AppMessage[];
  _agents: Agent[];
  _agentMessages: AgentMessage[];
  _tasks: Task[];
  _pages: Page[];
  _pageBlocks: PageBlock[];
  _directMessages: DirectMessage[];
  _platformEvents: PlatformEvent[];
  _healthChecks: HealthCheck[];
  _nextId: bigint;
}

export function createMockPlatformClient(options: MockClientOptions = {}): MockPlatformClient {
  const state: ConnectionState = {
    connected: options.connected ?? false,
    uri: options.connected ? "wss://mock.spacetimedb.com" : null,
    moduleName: options.connected ? "test-module" : null,
    identity: options.connected ? "mock-identity-abc123" : null,
    token: options.connected ? "mock-token-xyz" : null,
  };

  const users: User[] = options.users ? [...options.users] : [];
  const oauthLinks: OAuthLink[] = options.oauthLinks ? [...options.oauthLinks] : [];
  const tools: ToolEntry[] = options.tools ? [...options.tools] : [];
  const toolUsages: ToolUsage[] = options.toolUsages ? [...options.toolUsages] : [];
  const toolPreferences: UserToolPreference[] = options.toolPreferences ? [...options.toolPreferences] : [];
  const apps: App[] = options.apps ? [...options.apps] : [];
  const appVersions: AppVersion[] = options.appVersions ? [...options.appVersions] : [];
  const appMessages: AppMessage[] = options.appMessages ? [...options.appMessages] : [];
  const agents: Agent[] = options.agents ? [...options.agents] : [];
  const agentMessages: AgentMessage[] = options.agentMessages ? [...options.agentMessages] : [];
  const tasks: Task[] = options.tasks ? [...options.tasks] : [];
  const pages: Page[] = options.pages ? [...options.pages] : [];
  const pageBlocks: PageBlock[] = options.pageBlocks ? [...options.pageBlocks] : [];
  const directMessages: DirectMessage[] = options.directMessages ? [...options.directMessages] : [];
  const platformEvents: PlatformEvent[] = options.platformEvents ? [...options.platformEvents] : [];
  const healthChecks: HealthCheck[] = options.healthChecks ? [...options.healthChecks] : [];

  let nextId = 1000n;

  function requireConnected(): void {
    if (!state.connected) throw new Error("Not connected");
  }

  return {
    _users: users,
    _oauthLinks: oauthLinks,
    _tools: tools,
    _toolUsages: toolUsages,
    _toolPreferences: toolPreferences,
    _apps: apps,
    _appVersions: appVersions,
    _appMessages: appMessages,
    _agents: agents,
    _agentMessages: agentMessages,
    _tasks: tasks,
    _pages: pages,
    _pageBlocks: pageBlocks,
    _directMessages: directMessages,
    _platformEvents: platformEvents,
    _healthChecks: healthChecks,
    get _nextId() { return nextId; },

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

    // ─── Users ───

    registerUser: vi.fn(async (handle: string, displayName: string, email: string) => {
      requireConnected();
      const existing = users.find((u) => u.identity === state.identity);
      if (existing) {
        existing.handle = handle;
        existing.displayName = displayName;
        existing.email = email;
      } else {
        users.push({
          identity: state.identity!,
          handle,
          displayName,
          email,
          online: true,
          createdAt: BigInt(Date.now()),
          lastSeen: BigInt(Date.now()),
        });
      }
    }),

    getUser: vi.fn((identity: string) => {
      requireConnected();
      return users.find((u) => u.identity === identity);
    }),

    listUsers: vi.fn((onlineOnly = false) => {
      requireConnected();
      if (onlineOnly) return users.filter((u) => u.online);
      return [...users];
    }),

    updateProfile: vi.fn(async (fields: { displayName?: string; email?: string }) => {
      requireConnected();
      const user = users.find((u) => u.identity === state.identity);
      if (user) {
        if (fields.displayName !== undefined) user.displayName = fields.displayName;
        if (fields.email !== undefined) user.email = fields.email;
        user.lastSeen = BigInt(Date.now());
      }
    }),

    // ─── OAuth ───

    linkOAuth: vi.fn(async (provider: string, providerAccountId: string) => {
      requireConnected();
      oauthLinks.push({
        id: nextId++,
        userIdentity: state.identity!,
        provider,
        providerAccountId,
        linkedAt: BigInt(Date.now()),
      });
    }),

    getOAuthLinks: vi.fn((userIdentity: string) => {
      requireConnected();
      return oauthLinks.filter((l) => l.userIdentity === userIdentity);
    }),

    // ─── Tools ───

    searchTools: vi.fn((query?: string, category?: string) => {
      requireConnected();
      return tools.filter((t) => {
        if (category && t.category !== category) return false;
        if (query) {
          const q = query.toLowerCase();
          if (!t.name.toLowerCase().includes(q) && !t.description.toLowerCase().includes(q)) return false;
        }
        return true;
      });
    }),

    getToolEntry: vi.fn((name: string) => {
      requireConnected();
      return tools.find((t) => t.name === name);
    }),

    listCategories: vi.fn(() => {
      requireConnected();
      return [...new Set(tools.map((t) => t.category))];
    }),

    enableTool: vi.fn(async (name: string) => {
      requireConnected();
      const tool = tools.find((t) => t.name === name);
      if (tool) tool.enabled = true;
    }),

    disableTool: vi.fn(async (name: string) => {
      requireConnected();
      const tool = tools.find((t) => t.name === name);
      if (tool) tool.enabled = false;
    }),

    recordToolUsage: vi.fn(async (toolName: string, durationMs: number, success: boolean) => {
      requireConnected();
      toolUsages.push({
        id: nextId++,
        toolName,
        userIdentity: state.identity!,
        durationMs,
        success,
        timestamp: BigInt(Date.now()),
      });
    }),

    getToolUsageStats: vi.fn((toolName?: string) => {
      requireConnected();
      if (toolName) return toolUsages.filter((u) => u.toolName === toolName);
      return [...toolUsages];
    }),

    getUserToolPreferences: vi.fn((userIdentity: string) => {
      requireConnected();
      return toolPreferences.filter((p) => p.userIdentity === userIdentity);
    }),

    // ─── Apps ───

    createApp: vi.fn(async (slug: string, name: string, description: string, r2CodeKey: string) => {
      requireConnected();
      apps.push({
        id: nextId++,
        ownerIdentity: state.identity!,
        slug,
        name,
        description,
        r2CodeKey,
        status: "active",
        createdAt: BigInt(Date.now()),
        updatedAt: BigInt(Date.now()),
      });
    }),

    getApp: vi.fn((slugOrId: string | bigint) => {
      requireConnected();
      if (typeof slugOrId === "bigint") {
        return apps.find((a) => a.id === slugOrId);
      }
      return apps.find((a) => a.slug === slugOrId);
    }),

    listApps: vi.fn((ownerIdentity?: string) => {
      requireConnected();
      if (ownerIdentity) return apps.filter((a) => a.ownerIdentity === ownerIdentity);
      return [...apps];
    }),

    updateAppStatus: vi.fn(async (appId: bigint, status: string) => {
      requireConnected();
      const app = apps.find((a) => a.id === appId);
      if (!app) throw new Error("App not found");
      app.status = status;
      app.updatedAt = BigInt(Date.now());
    }),

    deleteApp: vi.fn(async (appId: bigint) => {
      requireConnected();
      const app = apps.find((a) => a.id === appId);
      if (!app) throw new Error("App not found");
      app.status = "deleted";
      app.updatedAt = BigInt(Date.now());
    }),

    restoreApp: vi.fn(async (appId: bigint) => {
      requireConnected();
      const app = apps.find((a) => a.id === appId);
      if (!app) throw new Error("App not found");
      app.status = "active";
      app.updatedAt = BigInt(Date.now());
    }),

    createAppVersion: vi.fn(async (appId: bigint, version: string, codeHash: string, changeDescription: string) => {
      requireConnected();
      appVersions.push({
        id: nextId++,
        appId,
        version,
        codeHash,
        changeDescription,
        createdAt: BigInt(Date.now()),
      });
    }),

    listAppVersions: vi.fn((appId: bigint) => {
      requireConnected();
      return appVersions.filter((v) => v.appId === appId);
    }),

    sendAppMessage: vi.fn(async (appId: bigint, role: string, content: string) => {
      requireConnected();
      appMessages.push({
        id: nextId++,
        appId,
        role,
        content,
        timestamp: BigInt(Date.now()),
      });
    }),

    getAppMessages: vi.fn((appId: bigint) => {
      requireConnected();
      return appMessages.filter((m) => m.appId === appId);
    }),

    // ─── Content ───

    createPage: vi.fn(async (slug: string, title: string, description: string) => {
      requireConnected();
      pages.push({
        id: nextId++,
        slug,
        title,
        description,
        ownerIdentity: state.identity!,
        createdAt: BigInt(Date.now()),
        updatedAt: BigInt(Date.now()),
      });
    }),

    getPage: vi.fn((slug: string) => {
      requireConnected();
      return pages.find((p) => p.slug === slug);
    }),

    updatePage: vi.fn(async (slug: string, fields: { title?: string; description?: string }) => {
      requireConnected();
      const page = pages.find((p) => p.slug === slug);
      if (!page) throw new Error("Page not found");
      if (fields.title !== undefined) page.title = fields.title;
      if (fields.description !== undefined) page.description = fields.description;
      page.updatedAt = BigInt(Date.now());
    }),

    deletePage: vi.fn(async (slug: string) => {
      requireConnected();
      const idx = pages.findIndex((p) => p.slug === slug);
      if (idx === -1) throw new Error("Page not found");
      pages.splice(idx, 1);
      // Also remove associated blocks
      const pageId = pages[idx]?.id;
      if (pageId !== undefined) {
        const blockIdxs = pageBlocks
          .map((b, i) => b.pageId === pageId ? i : -1)
          .filter((i) => i >= 0)
          .reverse();
        for (const i of blockIdxs) pageBlocks.splice(i, 1);
      }
    }),

    createBlock: vi.fn(async (pageId: bigint, blockType: string, contentJson: string, sortOrder: number) => {
      requireConnected();
      pageBlocks.push({
        id: nextId++,
        pageId,
        blockType,
        contentJson,
        sortOrder,
        createdAt: BigInt(Date.now()),
        updatedAt: BigInt(Date.now()),
      });
    }),

    updateBlock: vi.fn(async (blockId: bigint, fields: { contentJson?: string; sortOrder?: number }) => {
      requireConnected();
      const block = pageBlocks.find((b) => b.id === blockId);
      if (!block) throw new Error("Block not found");
      if (fields.contentJson !== undefined) block.contentJson = fields.contentJson;
      if (fields.sortOrder !== undefined) block.sortOrder = fields.sortOrder;
      block.updatedAt = BigInt(Date.now());
    }),

    deleteBlock: vi.fn(async (blockId: bigint) => {
      requireConnected();
      const idx = pageBlocks.findIndex((b) => b.id === blockId);
      if (idx === -1) throw new Error("Block not found");
      pageBlocks.splice(idx, 1);
    }),

    reorderBlocks: vi.fn(async (_pageId: bigint, blockIds: bigint[]) => {
      requireConnected();
      for (let i = 0; i < blockIds.length; i++) {
        const block = pageBlocks.find((b) => b.id === blockIds[i]);
        if (block) block.sortOrder = i;
      }
    }),

    // ─── Direct Messages ───

    sendDM: vi.fn(async (toIdentity: string, content: string) => {
      requireConnected();
      directMessages.push({
        id: nextId++,
        fromIdentity: state.identity!,
        toIdentity,
        content,
        read: false,
        timestamp: BigInt(Date.now()),
      });
    }),

    listDMs: vi.fn((withIdentity?: string) => {
      requireConnected();
      if (withIdentity) {
        return directMessages.filter((m) => {
          return (m.fromIdentity === withIdentity || m.toIdentity === withIdentity) &&
            (m.fromIdentity === state.identity || m.toIdentity === state.identity);
        });
      }
      return directMessages.filter(
        (m) => m.fromIdentity === state.identity || m.toIdentity === state.identity,
      );
    }),

    markDMRead: vi.fn(async (messageId: bigint) => {
      requireConnected();
      const msg = directMessages.find((m) => m.id === messageId);
      if (msg) msg.read = true;
    }),

    // ─── Agents ───

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

    listAgents: vi.fn((onlineOnly = false) => {
      requireConnected();
      if (onlineOnly) return agents.filter((a) => a.online);
      return [...agents];
    }),

    sendAgentMessage: vi.fn(async (toAgent: string, content: string) => {
      requireConnected();
      agentMessages.push({
        id: nextId++,
        fromAgent: state.identity!,
        toAgent,
        content,
        timestamp: BigInt(Date.now()),
        delivered: false,
      });
    }),

    getAgentMessages: vi.fn((onlyUndelivered = true) => {
      requireConnected();
      return agentMessages.filter((m) => {
        if (m.toAgent !== state.identity) return false;
        if (onlyUndelivered && m.delivered) return false;
        return true;
      });
    }),

    markAgentMessageDelivered: vi.fn(async (messageId: bigint) => {
      requireConnected();
      const msg = agentMessages.find((m) => m.id === messageId);
      if (msg) msg.delivered = true;
    }),

    // ─── Tasks ───

    createTask: vi.fn(async (description: string, priority = 0, context = "") => {
      requireConnected();
      tasks.push({
        id: nextId++,
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

    // ─── Analytics ───

    recordEvent: vi.fn(async (source: string, eventType: string, metadataJson: string, userIdentity?: string) => {
      requireConnected();
      platformEvents.push({
        id: nextId++,
        source,
        eventType,
        metadataJson,
        userIdentity,
        timestamp: BigInt(Date.now()),
      });
    }),

    queryEvents: vi.fn((filters: { source?: string; eventType?: string; userIdentity?: string }) => {
      requireConnected();
      return platformEvents.filter((e) => {
        if (filters.source && e.source !== filters.source) return false;
        if (filters.eventType && e.eventType !== filters.eventType) return false;
        if (filters.userIdentity && e.userIdentity !== filters.userIdentity) return false;
        return true;
      });
    }),

    getHealthStatus: vi.fn(() => {
      requireConnected();
      return [...healthChecks];
    }),
  };
}
