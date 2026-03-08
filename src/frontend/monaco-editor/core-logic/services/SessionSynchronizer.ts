import type { ICodeSession } from "../../ui/@/lib/interfaces";
import {
  applySessionDelta,
  computeSessionHash,
  sanitizeSession,
  type SessionDelta,
} from "../lib/make-sess";
import { tryCatch } from "../../lazy-imports/try-catch";
import type { ISessionSynchronizer } from "./types";

const REFRESH_INTERVAL_MS = 15000;
const RECONNECT_DELAY_MS = 1500;

interface IncomingSocketMessage extends Partial<SessionDelta> {
  type?: string;
  hash?: string;
}

/**
 * SessionSynchronizer enables communication for code sessions.
 */
export class SessionSynchronizer implements ISessionSynchronizer {
  private session: ICodeSession | null = null;
  private subscribers: Array<(session: ICodeSession & { sender: string }) => void> = [];
  private socket: WebSocket | null = null;
  private refreshInterval: ReturnType<typeof setInterval> | null = null;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private isClosed = false;

  constructor(
    private codeSpace: string,
    session?: ICodeSession,
  ) {
    if (session) {
      this.session = sanitizeSession(session);
    }
    this.registerLifecycleListeners();
    this.startRefreshLoop();
  }

  private notifySubscribers(session: ICodeSession & { sender: string }): void {
    this.subscribers.forEach((cb) => {
      try {
        cb(session);
      } catch (error) {
        console.error("Error notifying subscriber:", error);
      }
    });
  }

  async getCode(): Promise<string> {
    if (!this.session) {
      this.session = await this.init();
    }
    return this.session!.code;
  }

  getSession(): ICodeSession | null {
    return this.session;
  }

  async init(session?: ICodeSession): Promise<ICodeSession> {
    if (session) {
      this.setSession(sanitizeSession(session), "INIT");
      this.ensureRealtimeConnection();
      return this.session!;
    }

    if (this.session) {
      this.ensureRealtimeConnection();
      return this.session;
    }

    const fetchSessionPromise = async () => {
      const response = await fetch(this.getSessionUrl());
      if (!response.ok) {
        throw new Error(`Failed to fetch session: ${response.status}`);
      }
      return response.json();
    };

    const { data, error } = await tryCatch(fetchSessionPromise());

    if (error) {
      console.error("Error initializing session:", error);
      this.setSession(
        sanitizeSession({
          codeSpace: this.codeSpace,
          code: "",
          html: "",
          css: "",
          transpiled: "",
        }),
        "INIT_FALLBACK",
      );
    } else {
      this.setSession(data as ICodeSession, "INIT");
    }

    this.ensureRealtimeConnection();
    return this.session!;
  }

  subscribe(callback: (session: ICodeSession & { sender: string }) => void): () => void {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter((cb) => cb !== callback);
    };
  }

  broadcastSession(session: ICodeSession & { sender: string }): void {
    try {
      this.setSession(session, session.sender);
    } catch (error) {
      console.error("Error in SessionSynchronizer.broadcastSession", error);
    }
  }

  close(): void {
    this.isClosed = true;
    this.subscribers = [];
    this.unregisterLifecycleListeners();
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.socket) {
      const socket = this.socket;
      this.socket = null;
      try {
        socket.close();
      } catch {
        // Socket may already be closed.
      }
    }
  }

  private setSession(session: Partial<ICodeSession>, sender: string): void {
    const nextSession = sanitizeSession(session);
    const currentHash = this.session ? computeSessionHash(this.session) : null;
    const nextHash = computeSessionHash(nextSession);
    if (currentHash === nextHash) {
      return;
    }

    this.session = nextSession;
    this.notifySubscribers({
      ...nextSession,
      sender,
    });
  }

  private getSessionUrl(): string {
    return `/live/${encodeURIComponent(this.codeSpace)}/session.json`;
  }

  private getWebSocketUrl(): string | null {
    if (typeof window === "undefined") {
      return null;
    }

    const url = new URL(this.getSessionUrl(), window.location.origin);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.pathname = `/live/${encodeURIComponent(this.codeSpace)}/websocket`;
    url.search = "";
    return url.toString();
  }

  private ensureRealtimeConnection(): void {
    if (this.isClosed || typeof WebSocket === "undefined") {
      return;
    }
    if (this.socket && this.socket.readyState !== WebSocket.CLOSED) {
      return;
    }

    const websocketUrl = this.getWebSocketUrl();
    if (!websocketUrl) {
      return;
    }

    const socket = new WebSocket(websocketUrl);
    this.socket = socket;

    socket.onmessage = (event) => {
      void this.handleSocketMessage(event.data);
    };

    socket.onclose = () => {
      if (this.socket === socket) {
        this.socket = null;
      }
      if (!this.isClosed) {
        this.scheduleReconnect();
      }
    };

    socket.onerror = () => {
      try {
        socket.close();
      } catch {
        // Ignore close errors from already-closed sockets.
      }
    };
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout || this.isClosed) {
      return;
    }

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      void this.refreshFromServer("SOCKET_RECONNECT");
      this.ensureRealtimeConnection();
    }, RECONNECT_DELAY_MS);
  }

  private async handleSocketMessage(rawMessage: unknown): Promise<void> {
    if (typeof rawMessage !== "string") {
      return;
    }

    let message: IncomingSocketMessage;
    try {
      const parsed: unknown = JSON.parse(rawMessage);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        return;
      }
      message = parsed as IncomingSocketMessage;
    } catch {
      return;
    }

    if (message.type === "handshake") {
      if (this.session && typeof message.hash === "string") {
        const currentHash = computeSessionHash(this.session);
        if (currentHash !== message.hash) {
          await this.refreshFromServer("SOCKET_HANDSHAKE");
        }
      }
      return;
    }

    if (message.type) {
      return;
    }

    if (
      typeof message.oldHash !== "string" ||
      typeof message.hashCode !== "string" ||
      typeof message.delta === "undefined"
    ) {
      return;
    }

    if (!this.session) {
      await this.refreshFromServer("REMOTE_PATCH_MISS");
      return;
    }

    try {
      const patchedSession = applySessionDelta(this.session, message as SessionDelta);
      this.setSession(patchedSession, "REMOTE_PATCH");
    } catch (error) {
      console.error("Failed to apply live session patch:", error);
      await this.refreshFromServer("REMOTE_PATCH_REFRESH");
    }
  }

  private async refreshFromServer(sender: string): Promise<void> {
    if (this.isClosed) {
      return;
    }

    const fetchSessionPromise = async () => {
      const response = await fetch(this.getSessionUrl());
      if (!response.ok) {
        throw new Error(`Failed to fetch session: ${response.status}`);
      }
      return response.json() as Promise<ICodeSession>;
    };

    const { data, error } = await tryCatch(fetchSessionPromise());
    if (error || !data) {
      if (error) {
        console.error("Error refreshing session:", error);
      }
      return;
    }

    this.setSession(data, sender);
  }

  private startRefreshLoop(): void {
    if (this.refreshInterval || typeof window === "undefined") {
      return;
    }

    this.refreshInterval = setInterval(() => {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
        void this.refreshFromServer("REFRESH_INTERVAL");
      }
    }, REFRESH_INTERVAL_MS);
  }

  private readonly handleLifecycleRefresh = (): void => {
    void this.refreshFromServer("WINDOW_FOCUS");
  };

  private readonly handleVisibilityRefresh = (): void => {
    if (typeof document !== "undefined" && document.visibilityState === "visible") {
      void this.refreshFromServer("VISIBILITY_REFRESH");
    }
  };

  private registerLifecycleListeners(): void {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    window.addEventListener("focus", this.handleLifecycleRefresh);
    window.addEventListener("online", this.handleLifecycleRefresh);
    document.addEventListener("visibilitychange", this.handleVisibilityRefresh);
  }

  private unregisterLifecycleListeners(): void {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    window.removeEventListener("focus", this.handleLifecycleRefresh);
    window.removeEventListener("online", this.handleLifecycleRefresh);
    document.removeEventListener("visibilitychange", this.handleVisibilityRefresh);
  }
}
