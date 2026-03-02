import { SpacetimeClient } from "@spacetime-db/sdk";

type ConnectionState = "disconnected" | "connecting" | "connected" | "error";

interface StdbConnection {
  db: {
    code_session?: {
      onInsert(callback: (ctx: { event: { callerIdentity?: { toHexString(): string } } }, row: Record<string, unknown>) => void): void;
      onUpdate(callback: (ctx: { event: { callerIdentity?: { toHexString(): string } } }, oldRow: Record<string, unknown>, newRow: Record<string, unknown>) => void): void;
    };
  };
  reducers: {
    update_code_session(codeSpace: string, code: string, html: string, css: string, transpiled: string, messagesJson: string): void;
  };
}

interface StdbClient {
  state: ConnectionState;
  error: Error | null;
  connect: (token?: string) => void;
  disconnect: () => void;
}

let _connection: StdbConnection | null = null;
const _connectCallbacks: Array<(conn: StdbConnection) => void> = [];

export function getStdbClient(): StdbConnection | null {
  return _connection;
}

export function connectToSpacetimeDB(): void {
  if (_connection || stdbClient.state === "connecting") return;
  const token = localStorage.getItem("stdb_token") || undefined;
  stdbClient.connect(token);
}

export function onStdbConnect(callback: (conn: StdbConnection) => void): void {
  if (_connection) {
    callback(_connection);
  } else {
    _connectCallbacks.push(callback);
  }
}

function createStdbClient(): StdbClient {
  let state: ConnectionState = "disconnected";
  let error: Error | null = null;
  let retryCount = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  const client = new SpacetimeClient();

  const baseUrl = import.meta.env?.VITE_STDB_URL ?? "ws://localhost:3000";
  const moduleName = import.meta.env?.VITE_STDB_MODULE ?? "rightful-dirt-5033";

  function connect(token?: string) {
    if (state === "connected" || state === "connecting") return;
    state = "connecting";

    try {
      client.connect(
        baseUrl,
        moduleName,
        token || null,
      );
    } catch (e) {
      console.error("Stdb connect error:", e);
    }
  }

  client.onConnect((identity: { toHexString(): string }, token?: { string: string }) => {
    state = "connected";
    retryCount = 0;
    console.log("[SpacetimeDB] Connected with identity:", identity.toHexString());
    if (token) {
      localStorage.setItem("stdb_token", token.string);
    }

    // Notify connection callbacks
    _connection = (client as unknown) as StdbConnection;
    for (const cb of _connectCallbacks) {
      cb(_connection);
    }
    _connectCallbacks.length = 0;
  });

  client.onDisconnect(() => {
    state = "disconnected";
    _connection = null;
    console.log("[SpacetimeDB] Disconnected");

    const delay = Math.min(1000 * 2 ** retryCount, 30000);
    retryCount++;
    retryTimer = setTimeout(() => connect(localStorage.getItem("stdb_token") || undefined), delay);
  });

  client.onConnectError((err: string) => {
    state = "error";
    error = new Error(err);
    console.error("[SpacetimeDB] Connect Error:", err);
  });

  function disconnect() {
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    retryCount = 0;
    client.disconnect();
    state = "disconnected";
    _connection = null;
  }

  return {
    get state() {
      return state;
    },
    get error() {
      return error;
    },
    connect,
    disconnect,
  };
}

export const stdbClient = createStdbClient();
