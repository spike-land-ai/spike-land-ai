/**
 * SpacetimeDB Connection Manager for MCP Swarm
 *
 * Wraps the SpacetimeDB TypeScript SDK connection lifecycle.
 * Exposes methods for Leaf Servers (Providers) and Agents (Consumers).
 */

import type { Agent, ConnectionState, McpTask, RegisteredTool } from "./types.js";

// ─── Client Interface ───

export interface SpacetimeMcpClient {
  /** Current connection state */
  getState(): ConnectionState;

  /** Connect to a SpacetimeDB instance */
  connect(uri: string, moduleName: string, token?: string): Promise<ConnectionState>;

  /** Disconnect from the current instance */
  disconnect(): void;

  // ─── Provider Operations (Leaf Servers) ───

  /** Register an MCP tool provided by this connection */
  registerTool(
    name: string,
    description: string,
    inputSchema: string,
    category: string,
  ): Promise<void>;
  
  /** Unregister an MCP tool */
  unregisterTool(name: string): Promise<void>;

  /** Claim a pending task assigned to this tool */
  claimMcpTask(taskId: bigint): Promise<void>;

  /** Complete an execution task with result or error */
  completeMcpTask(taskId: bigint, resultJson?: string, error?: string): Promise<void>;

  // ─── Consumer Operations (Agents) ───

  /** Request the execution of an MCP tool */
  invokeToolRequest(toolName: string, argumentsJson: string): Promise<void>;

  /** List all registered tools from all connected leaf servers */
  listRegisteredTools(categoryFilter?: string): RegisteredTool[];

  /** List tasks, optionally filtering by status */
  listMcpTasks(statusFilter?: string): McpTask[];

  // ─── Agent Registry (Legacy/General) ───

  registerAgent(displayName: string, capabilities: string[]): Promise<void>;
  unregisterAgent(): Promise<void>;
  listAgents(): Agent[];

  // ─── Events ───
  onEvent(cb: () => void): void;
}

// ─── SDK Types ───

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
  onConnect(
    cb: (conn: SdkConnection, identity: { toHexString(): string }, tok: string) => void,
  ): SdkBuilder;
  onConnectError(cb: (conn: unknown, err: Error) => void): SdkBuilder;
  build(): void;
}

interface SdkModule {
  DbConnection: {
    builder(): SdkBuilder;
  };
}

// ─── Live Client ───

export function createLiveSpacetimeMcpClient(): SpacetimeMcpClient {
  let state: ConnectionState = {
    connected: false,
    uri: null,
    moduleName: null,
    identity: null,
    token: null,
  };

  let connection: SdkConnection | null = null;
  const eventListeners: Array<() => void> = [];

  function requireConnection(): SdkConnection {
    if (!connection) throw new Error("Not connected");
    return connection;
  }

  function getTable(
    conn: SdkConnection,
    name: string,
  ): { iter: () => Iterable<Record<string, unknown>> } {
    const table = conn.db[name];
    if (!table) throw new Error(`Table "${name}" not found in subscription`);
    return table;
  }

  function callReducer(conn: SdkConnection, name: string, ...args: unknown[]): void {
    const reducer = conn.reducers[name];
    if (!reducer) throw new Error(`Reducer "${name}" not found`);
    reducer(...args);
  }

  function notifyListeners() {
    for (const cb of eventListeners) {
      cb();
    }
  }

  return {
    getState() {
      return { ...state };
    },

    async connect(uri: string, moduleName: string, token?: string): Promise<ConnectionState> {
      if (state.connected) {
        throw new Error("Already connected. Disconnect first.");
      }

      const sdk: SdkModule = await (Function(
        "return import('spacetimedb')",
      )() as Promise<SdkModule>);

      return new Promise<ConnectionState>((resolve, reject) => {
        let builder = sdk.DbConnection.builder().withUri(uri).withModuleName(moduleName);

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

            conn
              .subscriptionBuilder()
              .onApplied(() => {
                notifyListeners();
                resolve({ ...state });
              })
              .subscribe(
                "SELECT * FROM agent; SELECT * FROM agent_message; SELECT * FROM mcp_task; SELECT * FROM registered_tool;",
              );
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

    // ─── Provider Operations ───

    async registerTool(name: string, description: string, inputSchema: string, category: string) {
      const conn = requireConnection();
      callReducer(conn, "register_tool", name, description, inputSchema, category);
    },

    async unregisterTool(name: string) {
      const conn = requireConnection();
      callReducer(conn, "unregister_tool", name);
    },

    async claimMcpTask(taskId: bigint) {
      const conn = requireConnection();
      callReducer(conn, "claim_mcp_task", taskId);
    },

    async completeMcpTask(taskId: bigint, resultJson?: string, error?: string) {
      const conn = requireConnection();
      callReducer(conn, "complete_mcp_task", taskId, resultJson, error);
    },

    // ─── Consumer Operations ───

    async invokeToolRequest(toolName: string, argumentsJson: string) {
      const conn = requireConnection();
      callReducer(conn, "invoke_tool_request", toolName, argumentsJson);
    },

    listRegisteredTools(categoryFilter?: string): RegisteredTool[] {
      const conn = requireConnection();
      const tools: RegisteredTool[] = [];
      for (const row of getTable(conn, "registered_tool").iter()) {
        if (categoryFilter && String(row.category) !== categoryFilter) continue;
        tools.push({
          id: BigInt(row.id as bigint),
          name: String(row.name),
          description: String(row.description),
          inputSchema: String(row.inputSchema),
          providerIdentity: String(row.providerIdentity),
          category: String(row.category),
          createdAt: BigInt(row.createdAt as bigint),
        });
      }
      return tools;
    },

    listMcpTasks(statusFilter?: string): McpTask[] {
      const conn = requireConnection();
      const tasks: McpTask[] = [];
      for (const row of getTable(conn, "mcp_task").iter()) {
        if (statusFilter && String(row.status) !== statusFilter) continue;
        tasks.push({
          id: BigInt(row.id as bigint),
          toolName: String(row.toolName),
          argumentsJson: String(row.argumentsJson),
          requesterIdentity: String(row.requesterIdentity),
          providerIdentity: row.providerIdentity ? String(row.providerIdentity) : undefined,
          status: String(row.status),
          resultJson: row.resultJson ? String(row.resultJson) : undefined,
          error: row.error ? String(row.error) : undefined,
          createdAt: BigInt(row.createdAt as bigint),
          completedAt: row.completedAt ? BigInt(row.completedAt as bigint) : undefined,
        });
      }
      return tasks;
    },

    // ─── Agent Operations ───

    async registerAgent(displayName: string, capabilities: string[]) {
      const conn = requireConnection();
      callReducer(conn, "register_agent", displayName, capabilities);
    },

    async unregisterAgent() {
      const conn = requireConnection();
      callReducer(conn, "unregister_agent");
    },

    listAgents(): Agent[] {
      const conn = requireConnection();
      const agents: Agent[] = [];
      for (const row of getTable(conn, "agent").iter()) {
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

    onEvent(cb: () => void) {
      eventListeners.push(cb);
    },
  };
}
