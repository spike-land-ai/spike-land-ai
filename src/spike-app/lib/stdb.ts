type ConnectionState = "disconnected" | "connecting" | "connected" | "error";

type Listener = () => void;

interface StdbClient {
  state: ConnectionState;
  error: Error | null;
  ws: WebSocket | null;
  connect: (token?: string) => void;
  disconnect: () => void;
  subscribe: (listener: Listener) => () => void;
  getSnapshot: () => ConnectionState;
  recordEvent: (event: string, data?: Record<string, unknown>) => void;
}

function createStdbClient(): StdbClient {
  let state: ConnectionState = "disconnected";
  let error: Error | null = null;
  let ws: WebSocket | null = null;
  let retryCount = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  const listeners = new Set<Listener>();

  const baseUrl = import.meta.env.VITE_STDB_URL ?? "ws://localhost:3000/stdb/ws";

  function notify() {
    for (const listener of listeners) {
      listener();
    }
  }

  function setState(next: ConnectionState, err?: Error) {
    state = next;
    error = err ?? null;
    notify();
  }

  function connect(token?: string) {
    if (ws) return;
    setState("connecting");

    const url = token ? `${baseUrl}?token=${token}` : baseUrl;
    const socket = new WebSocket(url);
    ws = socket;

    socket.addEventListener("open", () => {
      retryCount = 0;
      setState("connected");
    });

    socket.addEventListener("close", () => {
      ws = null;
      setState("disconnected");
      const delay = Math.min(1000 * 2 ** retryCount, 30000);
      retryCount++;
      retryTimer = setTimeout(() => connect(token), delay);
    });

    socket.addEventListener("error", () => {
      setState("error", new Error("WebSocket connection failed"));
    });
  }

  function disconnect() {
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    retryCount = 0;
    if (ws) {
      ws.close();
      ws = null;
    }
    setState("disconnected");
  }

  function subscribe(listener: Listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  function getSnapshot() {
    return state;
  }

  function recordEvent(event: string, data?: Record<string, unknown>) {
    if (ws && state === "connected") {
      ws.send(JSON.stringify({ type: "event", event, data }));
    }
  }

  return {
    get state() {
      return state;
    },
    get error() {
      return error;
    },
    get ws() {
      return ws;
    },
    connect,
    disconnect,
    subscribe,
    getSnapshot,
    recordEvent,
  };
}

export const stdbClient = createStdbClient();
