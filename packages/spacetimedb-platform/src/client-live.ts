/**
 * Live SpacetimeDB Platform Client
 *
 * Uses the real SpacetimeDB SDK via dynamic import.
 * Subscribes to all 14 tables and exposes typed operations.
 */

import type { SpacetimePlatformClient } from "./client.js";
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
  PlatformEvent,
  Task,
  ToolEntry,
  ToolUsage,
  User,
  UserToolPreference,
} from "./types.js";

// ─── SDK Types (minimal, for the dynamically-imported spacetimedb package) ───

interface SdkConnection {
  db: Record<string, { iter: () => Iterable<Record<string, unknown>> }>;
  reducers: Record<string, (...args: unknown[]) => void>;
  disconnect: () => void;
  subscriptionBuilder: () => {
    onApplied: (cb: () => void) => { subscribe: (query: string) => void };
  };
}

interface SdkBuilder {
  withUri(u: string): SdkBuilder;
  withModuleName(m: string): SdkBuilder;
  withToken(t: string): SdkBuilder;
  onConnect(cb: (conn: SdkConnection, identity: { toHexString(): string }, tok: string) => void): SdkBuilder;
  onConnectError(cb: (conn: unknown, err: Error) => void): SdkBuilder;
  build(): void;
}

interface SdkModule {
  DbConnection: {
    builder(): SdkBuilder;
  };
}

// ─── All tables for subscription ───

const ALL_TABLES_QUERY = [
  "SELECT * FROM user",
  "SELECT * FROM oauth_link",
  "SELECT * FROM tool_entry",
  "SELECT * FROM tool_usage",
  "SELECT * FROM user_tool_preference",
  "SELECT * FROM app",
  "SELECT * FROM app_version",
  "SELECT * FROM app_message",
  "SELECT * FROM agent",
  "SELECT * FROM agent_message",
  "SELECT * FROM task",
  "SELECT * FROM page",
  "SELECT * FROM page_block",
  "SELECT * FROM direct_message",
].join("; ");

// ─── Live Client Factory ───

export function createLivePlatformClient(): SpacetimePlatformClient {
  let state: ConnectionState = {
    connected: false,
    uri: null,
    moduleName: null,
    identity: null,
    token: null,
  };

  let connection: SdkConnection | null = null;

  function requireConnection(): SdkConnection {
    if (!connection) throw new Error("Not connected");
    return connection;
  }

  function getTable(conn: SdkConnection, name: string): { iter: () => Iterable<Record<string, unknown>> } {
    const table = conn.db[name];
    if (!table) throw new Error(`Table "${name}" not found in subscription`);
    return table;
  }

  function callReducer(conn: SdkConnection, name: string, ...args: unknown[]): void {
    const reducer = conn.reducers[name];
    if (!reducer) throw new Error(`Reducer "${name}" not found`);
    reducer(...args);
  }

  return {
    getState() {
      return { ...state };
    },

    async connect(uri: string, moduleName: string, token?: string): Promise<ConnectionState> {
      if (state.connected) {
        throw new Error("Already connected. Disconnect first.");
      }

      const sdk: SdkModule = await (Function("return import('spacetimedb')")() as Promise<SdkModule>);

      return new Promise<ConnectionState>((resolve, reject) => {
        let builder = sdk.DbConnection.builder()
          .withUri(uri)
          .withModuleName(moduleName);

        if (token) {
          builder = builder.withToken(token);
        }

        builder
          .onConnect((conn, identity, tok) => {
            connection = conn;
            state = {
              connected: true,
              uri,
              moduleName,
              identity: identity.toHexString(),
              token: tok,
            };

            conn.subscriptionBuilder()
              .onApplied(() => {
                resolve({ ...state });
              })
              .subscribe(ALL_TABLES_QUERY);
          })
          .onConnectError((_conn, err) => {
            state = { connected: false, uri: null, moduleName: null, identity: null, token: null };
            connection = null;
            reject(err);
          })
          .build();
      });
    },

    disconnect() {
      if (connection) {
        connection.disconnect();
      }
      connection = null;
      state = { connected: false, uri: null, moduleName: null, identity: null, token: null };
    },

    // ─── Users ───

    async registerUser(handle: string, displayName: string, email: string) {
      const conn = requireConnection();
      callReducer(conn, "registerUser", handle, displayName, email);
    },

    getUser(identity: string): User | undefined {
      const conn = requireConnection();
      for (const row of getTable(conn, "user").iter()) {
        if (String(row.identity) === identity) {
          return {
            identity: String(row.identity),
            handle: String(row.handle),
            displayName: String(row.displayName),
            email: String(row.email),
            online: Boolean(row.online),
            createdAt: BigInt(row.createdAt as bigint),
            lastSeen: BigInt(row.lastSeen as bigint),
          };
        }
      }
      return undefined;
    },

    listUsers(onlineOnly = false): User[] {
      const conn = requireConnection();
      const users: User[] = [];
      for (const row of getTable(conn, "user").iter()) {
        if (onlineOnly && !row.online) continue;
        users.push({
          identity: String(row.identity),
          handle: String(row.handle),
          displayName: String(row.displayName),
          email: String(row.email),
          online: Boolean(row.online),
          createdAt: BigInt(row.createdAt as bigint),
          lastSeen: BigInt(row.lastSeen as bigint),
        });
      }
      return users;
    },

    async updateProfile(fields: { displayName?: string; email?: string }) {
      const conn = requireConnection();
      callReducer(conn, "updateProfile", fields.displayName, fields.email);
    },

    // ─── OAuth ───

    async linkOAuth(provider: string, providerAccountId: string) {
      const conn = requireConnection();
      callReducer(conn, "linkOAuth", provider, providerAccountId);
    },

    getOAuthLinks(userIdentity: string): OAuthLink[] {
      const conn = requireConnection();
      const links: OAuthLink[] = [];
      for (const row of getTable(conn, "oauth_link").iter()) {
        if (String(row.userIdentity) !== userIdentity) continue;
        links.push({
          id: BigInt(row.id as bigint),
          userIdentity: String(row.userIdentity),
          provider: String(row.provider),
          providerAccountId: String(row.providerAccountId),
          linkedAt: BigInt(row.linkedAt as bigint),
        });
      }
      return links;
    },

    // ─── Tools ───

    searchTools(query?: string, category?: string): ToolEntry[] {
      const conn = requireConnection();
      const tools: ToolEntry[] = [];
      for (const row of getTable(conn, "tool_entry").iter()) {
        if (category && String(row.category) !== category) continue;
        if (query) {
          const q = query.toLowerCase();
          const nameMatch = String(row.name).toLowerCase().includes(q);
          const descMatch = String(row.description).toLowerCase().includes(q);
          if (!nameMatch && !descMatch) continue;
        }
        tools.push({
          name: String(row.name),
          description: String(row.description),
          category: String(row.category),
          inputSchema: String(row.inputSchema),
          enabled: Boolean(row.enabled),
          createdAt: BigInt(row.createdAt as bigint),
        });
      }
      return tools;
    },

    getToolEntry(name: string): ToolEntry | undefined {
      const conn = requireConnection();
      for (const row of getTable(conn, "tool_entry").iter()) {
        if (String(row.name) === name) {
          return {
            name: String(row.name),
            description: String(row.description),
            category: String(row.category),
            inputSchema: String(row.inputSchema),
            enabled: Boolean(row.enabled),
            createdAt: BigInt(row.createdAt as bigint),
          };
        }
      }
      return undefined;
    },

    listCategories(): string[] {
      const conn = requireConnection();
      const categories = new Set<string>();
      for (const row of getTable(conn, "tool_entry").iter()) {
        categories.add(String(row.category));
      }
      return [...categories];
    },

    async enableTool(name: string) {
      const conn = requireConnection();
      callReducer(conn, "enableTool", name);
    },

    async disableTool(name: string) {
      const conn = requireConnection();
      callReducer(conn, "disableTool", name);
    },

    async recordToolUsage(toolName: string, durationMs: number, success: boolean) {
      const conn = requireConnection();
      callReducer(conn, "recordToolUsage", toolName, durationMs, success);
    },

    getToolUsageStats(toolName?: string): ToolUsage[] {
      const conn = requireConnection();
      const stats: ToolUsage[] = [];
      for (const row of getTable(conn, "tool_usage").iter()) {
        if (toolName && String(row.toolName) !== toolName) continue;
        stats.push({
          id: BigInt(row.id as bigint),
          toolName: String(row.toolName),
          userIdentity: String(row.userIdentity),
          durationMs: Number(row.durationMs),
          success: Boolean(row.success),
          timestamp: BigInt(row.timestamp as bigint),
        });
      }
      return stats;
    },

    getUserToolPreferences(userIdentity: string): UserToolPreference[] {
      const conn = requireConnection();
      const prefs: UserToolPreference[] = [];
      for (const row of getTable(conn, "user_tool_preference").iter()) {
        if (String(row.userIdentity) !== userIdentity) continue;
        prefs.push({
          id: BigInt(row.id as bigint),
          userIdentity: String(row.userIdentity),
          toolName: String(row.toolName),
          enabled: Boolean(row.enabled),
          updatedAt: BigInt(row.updatedAt as bigint),
        });
      }
      return prefs;
    },

    // ─── Apps ───

    async createApp(slug: string, name: string, description: string, r2CodeKey: string) {
      const conn = requireConnection();
      callReducer(conn, "createApp", slug, name, description, r2CodeKey);
    },

    getApp(slugOrId: string | bigint): App | undefined {
      const conn = requireConnection();
      for (const row of getTable(conn, "app").iter()) {
        if (typeof slugOrId === "bigint") {
          if (BigInt(row.id as bigint) === slugOrId) {
            return {
              id: BigInt(row.id as bigint),
              ownerIdentity: String(row.ownerIdentity),
              slug: String(row.slug),
              name: String(row.name),
              description: String(row.description),
              r2CodeKey: String(row.r2CodeKey),
              status: String(row.status),
              createdAt: BigInt(row.createdAt as bigint),
              updatedAt: BigInt(row.updatedAt as bigint),
            };
          }
        } else {
          if (String(row.slug) === slugOrId) {
            return {
              id: BigInt(row.id as bigint),
              ownerIdentity: String(row.ownerIdentity),
              slug: String(row.slug),
              name: String(row.name),
              description: String(row.description),
              r2CodeKey: String(row.r2CodeKey),
              status: String(row.status),
              createdAt: BigInt(row.createdAt as bigint),
              updatedAt: BigInt(row.updatedAt as bigint),
            };
          }
        }
      }
      return undefined;
    },

    listApps(ownerIdentity?: string): App[] {
      const conn = requireConnection();
      const apps: App[] = [];
      for (const row of getTable(conn, "app").iter()) {
        if (ownerIdentity && String(row.ownerIdentity) !== ownerIdentity) continue;
        apps.push({
          id: BigInt(row.id as bigint),
          ownerIdentity: String(row.ownerIdentity),
          slug: String(row.slug),
          name: String(row.name),
          description: String(row.description),
          r2CodeKey: String(row.r2CodeKey),
          status: String(row.status),
          createdAt: BigInt(row.createdAt as bigint),
          updatedAt: BigInt(row.updatedAt as bigint),
        });
      }
      return apps;
    },

    async updateAppStatus(appId: bigint, status: string) {
      const conn = requireConnection();
      callReducer(conn, "updateAppStatus", appId, status);
    },

    async deleteApp(appId: bigint) {
      const conn = requireConnection();
      callReducer(conn, "deleteApp", appId);
    },

    async restoreApp(appId: bigint) {
      const conn = requireConnection();
      callReducer(conn, "restoreApp", appId);
    },

    async createAppVersion(appId: bigint, version: string, codeHash: string, changeDescription: string) {
      const conn = requireConnection();
      callReducer(conn, "createAppVersion", appId, version, codeHash, changeDescription);
    },

    listAppVersions(appId: bigint): AppVersion[] {
      const conn = requireConnection();
      const versions: AppVersion[] = [];
      for (const row of getTable(conn, "app_version").iter()) {
        if (BigInt(row.appId as bigint) !== appId) continue;
        versions.push({
          id: BigInt(row.id as bigint),
          appId: BigInt(row.appId as bigint),
          version: String(row.version),
          codeHash: String(row.codeHash),
          changeDescription: String(row.changeDescription),
          createdAt: BigInt(row.createdAt as bigint),
        });
      }
      return versions;
    },

    async sendAppMessage(appId: bigint, role: string, content: string) {
      const conn = requireConnection();
      callReducer(conn, "sendAppMessage", appId, role, content);
    },

    getAppMessages(appId: bigint): AppMessage[] {
      const conn = requireConnection();
      const msgs: AppMessage[] = [];
      for (const row of getTable(conn, "app_message").iter()) {
        if (BigInt(row.appId as bigint) !== appId) continue;
        msgs.push({
          id: BigInt(row.id as bigint),
          appId: BigInt(row.appId as bigint),
          role: String(row.role),
          content: String(row.content),
          timestamp: BigInt(row.timestamp as bigint),
        });
      }
      return msgs;
    },

    // ─── Content ───

    async createPage(slug: string, title: string, description: string) {
      const conn = requireConnection();
      callReducer(conn, "createPage", slug, title, description);
    },

    getPage(slug: string): Page | undefined {
      const conn = requireConnection();
      for (const row of getTable(conn, "page").iter()) {
        if (String(row.slug) === slug) {
          return {
            id: BigInt(row.id as bigint),
            slug: String(row.slug),
            title: String(row.title),
            description: String(row.description),
            ownerIdentity: String(row.ownerIdentity),
            createdAt: BigInt(row.createdAt as bigint),
            updatedAt: BigInt(row.updatedAt as bigint),
          };
        }
      }
      return undefined;
    },

    async updatePage(slug: string, fields: { title?: string; description?: string }) {
      const conn = requireConnection();
      callReducer(conn, "updatePage", slug, fields.title, fields.description);
    },

    async deletePage(slug: string) {
      const conn = requireConnection();
      callReducer(conn, "deletePage", slug);
    },

    async createBlock(pageId: bigint, blockType: string, contentJson: string, sortOrder: number) {
      const conn = requireConnection();
      callReducer(conn, "createBlock", pageId, blockType, contentJson, sortOrder);
    },

    async updateBlock(blockId: bigint, fields: { contentJson?: string; sortOrder?: number }) {
      const conn = requireConnection();
      callReducer(conn, "updateBlock", blockId, fields.contentJson, fields.sortOrder);
    },

    async deleteBlock(blockId: bigint) {
      const conn = requireConnection();
      callReducer(conn, "deleteBlock", blockId);
    },

    async reorderBlocks(pageId: bigint, blockIds: bigint[]) {
      const conn = requireConnection();
      callReducer(conn, "reorderBlocks", pageId, blockIds);
    },

    // ─── Direct Messages ───

    async sendDM(toIdentity: string, content: string) {
      const conn = requireConnection();
      callReducer(conn, "sendDM", toIdentity, content);
    },

    listDMs(withIdentity?: string): DirectMessage[] {
      const conn = requireConnection();
      const dms: DirectMessage[] = [];
      for (const row of getTable(conn, "direct_message").iter()) {
        if (withIdentity) {
          const from = String(row.fromIdentity);
          const to = String(row.toIdentity);
          if (from !== withIdentity && to !== withIdentity) continue;
        }
        dms.push({
          id: BigInt(row.id as bigint),
          fromIdentity: String(row.fromIdentity),
          toIdentity: String(row.toIdentity),
          content: String(row.content),
          read: Boolean(row.read),
          timestamp: BigInt(row.timestamp as bigint),
        });
      }
      return dms;
    },

    async markDMRead(messageId: bigint) {
      const conn = requireConnection();
      callReducer(conn, "markDMRead", messageId);
    },

    // ─── Agents ───

    async registerAgent(displayName: string, capabilities: string[]) {
      const conn = requireConnection();
      callReducer(conn, "registerAgent", displayName, capabilities);
    },

    listAgents(onlineOnly = false): Agent[] {
      const conn = requireConnection();
      const agents: Agent[] = [];
      for (const row of getTable(conn, "agent").iter()) {
        if (onlineOnly && !row.online) continue;
        agents.push({
          identity: String(row.identity),
          displayName: String(row.displayName),
          capabilities: row.capabilities as string[],
          online: Boolean(row.online),
          lastSeen: BigInt(row.lastSeen as bigint),
        });
      }
      return agents;
    },

    async sendAgentMessage(toAgent: string, content: string) {
      const conn = requireConnection();
      callReducer(conn, "sendMessage", toAgent, content);
    },

    getAgentMessages(onlyUndelivered = true): AgentMessage[] {
      const conn = requireConnection();
      const messages: AgentMessage[] = [];
      for (const row of getTable(conn, "agent_message").iter()) {
        if (onlyUndelivered && row.delivered) continue;
        if (String(row.toAgent) !== state.identity) continue;
        messages.push({
          id: BigInt(row.id as bigint),
          fromAgent: String(row.fromAgent),
          toAgent: String(row.toAgent),
          content: String(row.content),
          timestamp: BigInt(row.timestamp as bigint),
          delivered: Boolean(row.delivered),
        });
      }
      return messages;
    },

    async markAgentMessageDelivered(messageId: bigint) {
      const conn = requireConnection();
      callReducer(conn, "markDelivered", messageId);
    },

    // ─── Tasks ───

    async createTask(description: string, priority = 0, context = "") {
      const conn = requireConnection();
      callReducer(conn, "createTask", description, priority, context);
    },

    listTasks(statusFilter?: string): Task[] {
      const conn = requireConnection();
      const tasks: Task[] = [];
      for (const row of getTable(conn, "task").iter()) {
        if (statusFilter && String(row.status) !== statusFilter) continue;
        tasks.push({
          id: BigInt(row.id as bigint),
          description: String(row.description),
          assignedTo: row.assignedTo ? String(row.assignedTo) : undefined,
          status: String(row.status),
          priority: Number(row.priority),
          context: String(row.context),
          createdBy: String(row.createdBy),
          createdAt: BigInt(row.createdAt as bigint),
        });
      }
      return tasks;
    },

    async claimTask(taskId: bigint) {
      const conn = requireConnection();
      callReducer(conn, "claimTask", taskId);
    },

    async completeTask(taskId: bigint) {
      const conn = requireConnection();
      callReducer(conn, "completeTask", taskId);
    },

    // ─── Analytics ───

    async recordEvent(source: string, eventType: string, metadataJson: string, userIdentity?: string) {
      const conn = requireConnection();
      callReducer(conn, "recordEvent", source, eventType, metadataJson, userIdentity);
    },

    queryEvents(filters: { source?: string; eventType?: string; userIdentity?: string }): PlatformEvent[] {
      const conn = requireConnection();
      const events: PlatformEvent[] = [];
      for (const row of getTable(conn, "platform_event").iter()) {
        if (filters.source && String(row.source) !== filters.source) continue;
        if (filters.eventType && String(row.eventType) !== filters.eventType) continue;
        if (filters.userIdentity && String(row.userIdentity) !== filters.userIdentity) continue;
        events.push({
          id: BigInt(row.id as bigint),
          source: String(row.source),
          eventType: String(row.eventType),
          metadataJson: String(row.metadataJson),
          userIdentity: row.userIdentity ? String(row.userIdentity) : undefined,
          timestamp: BigInt(row.timestamp as bigint),
        });
      }
      return events;
    },

    getHealthStatus(): HealthCheck[] {
      const conn = requireConnection();
      const checks: HealthCheck[] = [];
      for (const row of getTable(conn, "health_check").iter()) {
        checks.push({
          id: BigInt(row.id as bigint),
          service: String(row.service),
          status: String(row.status),
          latencyMs: Number(row.latencyMs),
          checkedAt: BigInt(row.checkedAt as bigint),
        });
      }
      return checks;
    },
  };
}
