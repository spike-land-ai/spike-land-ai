export interface ConnectionOptions {
  url: string;
  token?: string;
  onMessage: (data: unknown) => void;
  onOpen: () => void;
  onClose: () => void;
  onError: (err: Event) => void;
}

export class Connection {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectDelay = 30000;
  private pendingMessages: string[] = [];
  private shouldReconnect = true;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private disconnecting = false;

  constructor(private options: ConnectionOptions) {}

  connect(): void {
    this.shouldReconnect = true;
    this.disconnecting = false;
    const url = this.options.token
      ? `${this.options.url}?token=${encodeURIComponent(this.options.token)}`
      : this.options.url;

    this.ws = new WebSocket(url);

    this.ws.addEventListener("open", () => {
      this.reconnectAttempts = 0;
      this.flushPending();
      this.options.onOpen();
    });

    this.ws.addEventListener("message", (ev: MessageEvent) => {
      try {
        const data: unknown = JSON.parse(String(ev.data));
        this.options.onMessage(data);
      } catch {
        // Ignore malformed messages
      }
    });

    this.ws.addEventListener("close", () => {
      this.ws = null;
      if (!this.disconnecting) {
        this.options.onClose();
      }
      if (this.shouldReconnect) {
        this.scheduleReconnect();
      }
    });

    this.ws.addEventListener("error", (err: Event) => {
      this.options.onError(err);
    });
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this.disconnecting = true;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  send(data: string): void {
    if (this.isConnected) {
      this.ws!.send(data);
    } else {
      this.pendingMessages.push(data);
    }
  }

  get isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  private flushPending(): void {
    while (this.pendingMessages.length > 0 && this.isConnected) {
      const msg = this.pendingMessages.shift()!;
      this.ws!.send(msg);
    }
  }

  private scheduleReconnect(): void {
    const delay = Math.min(
      1000 * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay,
    );
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }
}
