/**
 * SpacetimeDB Connection Manager
 *
 * Wraps the SpacetimeDB TypeScript SDK connection lifecycle.
 * Designed for dependency injection — tests can replace with a mock.
 */

import type {
  Agent,
  AgentMessage,
  ConnectionState,
  Task,
} from "./types.js";

// ─── Client Interface ───

export interface SpacetimeClient {
  /** Current connection state */
  getState(): ConnectionState;

  /** Connect to a SpacetimeDB instance */
  connect(uri: string, moduleName: string, token?: string): Promise<ConnectionState>;

  /** Disconnect from the current instance */
  disconnect(): void;

  // ─── Agent Operations ───

  registerAgent(displayName: string, capabilities: string[]): Promise<void>;
  unregisterAgent(): Promise<void>;
  listAgents(): Agent[];

  // ─── Message Operations ───

  sendMessage(toAgent: string, content: string): Promise<void>;
  getMessages(onlyUndelivered?: boolean): AgentMessage[];
  markDelivered(messageId: bigint): Promise<void>;

  // ─── Task Operations ───

  createTask(description: string, priority: number, context: string): Promise<void>;
  listTasks(statusFilter?: string): Task[];
  claimTask(taskId: bigint): Promise<void>;
  completeTask(taskId: bigint): Promise<void>;
}

// ─── SDK Types (minimal, for the dynamically-imported spacetimedb package) ───

interface SdkConnection {
  db: Record<string, { iter: () => Iterable<Record<string, unknown>> }>;
  reducers: Record<string, (...args: unknown[]) => void>;
  disconnect: () => void;
  subscriptionBuilder: () => {
    onApplied: (cb: () => void) => { subscribe: (query: string) => void };
  };
}

// Builder uses a fluent API where each method returns the same builder
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

// ─── Live Client (uses real SpacetimeDB SDK) ───

export function createLiveClient(): SpacetimeClient {
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

      // Dynamic import — spacetimedb is an optional runtime dependency
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
              .subscribe("SELECT * FROM agent; SELECT * FROM agent_message; SELECT * FROM task");
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

    // ─── Agent Operations ───

    async registerAgent(displayName: string, capabilities: string[]) {
      const conn = requireConnection();
      callReducer(conn, "registerAgent", displayName, capabilities);
    },

    async unregisterAgent() {
      const conn = requireConnection();
      callReducer(conn, "unregisterAgent");
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

    // ─── Message Operations ───

    async sendMessage(toAgent: string, content: string) {
      const conn = requireConnection();
      callReducer(conn, "sendMessage", toAgent, content);
    },

    getMessages(onlyUndelivered = true): AgentMessage[] {
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

    async markDelivered(messageId: bigint) {
      const conn = requireConnection();
      callReducer(conn, "markDelivered", messageId);
    },

    // ─── Task Operations ───

    async createTask(description: string, priority: number, context: string) {
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
  };
}
