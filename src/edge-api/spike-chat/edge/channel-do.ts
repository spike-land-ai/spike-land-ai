import { DurableObject } from "cloudflare:workers";
import type { Env } from "../core-logic/env";
import type { WsAttachment } from "../core-logic/types";

// Messages sent from Client -> Server
type ClientMessage =
  | { type: "auth"; token?: string }
  | { type: "typing_start" }
  | { type: "typing_stop" }
  | { type: "ping" };

export class ChannelDurableObject extends DurableObject {
  private typingUsers: Set<string> = new Set();
  private typingTimeouts: Map<string, number> = new Map();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  override async fetch(request: Request) {
    const url = new URL(request.url);
    if (request.headers.get("Upgrade") === "websocket") {
      // Create a WebSocket pair
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      // Authenticate via attachment? We can pass userId in headers or URL during upgrade
      const userId = request.headers.get("x-user-id") || url.searchParams.get("userId") || "anonymous";
      const displayName = request.headers.get("x-display-name") || url.searchParams.get("displayName") || "Unknown";
      const channelId = url.searchParams.get("channelId") || "unknown";

      const attachment: WsAttachment = {
        userId,
        displayName,
        channelId,
        isBot: false,
      };

      // Accept the connection using Hibernation API
      this.ctx.acceptWebSocket(server!, [channelId]);
      
      // Store attachment
      server!.serializeAttachment(attachment);

      // Broadcast user_joined (optional, maybe too noisy for large channels)
      return new Response(null, { status: 101, webSocket: client || null });
    }

    // HTTP endpoint for internal broadcasts (from Hono API routes)
    if (request.method === "POST" && url.pathname === "/broadcast") {
      const body = await request.json();
      this.broadcast(JSON.stringify(body));
      return new Response("OK", { status: 200 });
    }

    return new Response("Not found", { status: 404 });
  }

  private broadcast(message: string, excludeWs?: WebSocket) {
    const sockets = this.ctx.getWebSockets();
    for (const ws of sockets) {
      if (ws !== excludeWs) {
        try {
          ws.send(message);
        } catch (_e) {
          // ignore
        }
      }
    }
  }

  // --- Hibernation API handlers ---
  override async webSocketMessage(ws: WebSocket, msg: string | ArrayBuffer) {
    if (typeof msg !== "string") return;

    try {
      const data = JSON.parse(msg) as ClientMessage;
      const attachment = ws.deserializeAttachment() as WsAttachment | null;
      if (!attachment) return;

      switch (data.type) {
        case "ping":
          ws.send(JSON.stringify({ type: "pong" }));
          break;
        case "typing_start":
          this.typingUsers.add(attachment.userId);
          // Clear any existing timeout
          const existing = this.typingTimeouts.get(attachment.userId);
          if (existing) clearTimeout(existing);

          this.typingTimeouts.set(
            attachment.userId,
            setTimeout(() => this.clearTyping(attachment.userId), 5000) as unknown as number
          );
          
          this.broadcast(JSON.stringify({ type: "typing", users: Array.from(this.typingUsers) }));
          break;
        case "typing_stop":
          this.clearTyping(attachment.userId);
          break;
      }
    } catch (e) {
      console.error("Invalid WS message", e);
    }
  }

  private clearTyping(userId: string) {
    this.typingUsers.delete(userId);
    this.typingTimeouts.delete(userId);
    this.broadcast(JSON.stringify({ type: "typing", users: Array.from(this.typingUsers) }));
  }

  override async webSocketClose(ws: WebSocket, _code: number, _reason: string, _wasClean: boolean) {
    const attachment = ws.deserializeAttachment() as WsAttachment | null;
    if (attachment) {
      this.clearTyping(attachment.userId);
    }
  }

  override async webSocketError(ws: WebSocket, _error: unknown) {
    const attachment = ws.deserializeAttachment() as WsAttachment | null;
    if (attachment) {
      this.clearTyping(attachment.userId);
    }
  }
}
