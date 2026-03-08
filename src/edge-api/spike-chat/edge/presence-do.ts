import { DurableObject } from "cloudflare:workers";
import type { Env } from "../core-logic/env";

interface PresenceData {
  status: "online" | "away" | "dnd" | "offline";
  lastSeen: number;
}

export class PresenceDurableObject extends DurableObject {
  private presence: Map<string, PresenceData> = new Map();
  private ALARM_INTERVAL = 30 * 1000; // 30s
  private TIMEOUT = 60 * 1000; // 60s

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.blockConcurrencyWhile(async () => {
      // Ensure the alarm is set when the DO wakes up
      const currentAlarm = await this.ctx.storage.getAlarm();
      if (!currentAlarm) {
        await this.ctx.storage.setAlarm(Date.now() + this.ALARM_INTERVAL);
      }
    });
  }

  override async fetch(request: Request) {
    const url = new URL(request.url);

    if (request.headers.get("Upgrade") === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      const userId = request.headers.get("x-user-id") || url.searchParams.get("userId");
      if (!userId) {
        return new Response("Missing userId", { status: 400 });
      }

      this.ctx.acceptWebSocket(server, [userId]);
      server.serializeAttachment({ userId });

      // Mark user as online
      this.updatePresence(userId, "online");

      // Send current presence state of everyone to the new client
      const state = Object.fromEntries(this.presence.entries());
      server.send(JSON.stringify({ type: "presence_state", state }));

      return new Response(null, { status: 101, webSocket: client });
    }

    if (request.method === "GET" && url.pathname === "/state") {
      const state = Object.fromEntries(this.presence.entries());
      return new Response(JSON.stringify(state), {
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response("Not found", { status: 404 });
  }

  private broadcast(message: string) {
    const sockets = this.ctx.getWebSockets();
    for (const ws of sockets) {
      try {
        ws.send(message);
      } catch (_e) {
        // ignore
      }
    }
  }

  private updatePresence(userId: string, status: "online" | "away" | "dnd" | "offline") {
    const now = Date.now();
    const existing = this.presence.get(userId);

    if (existing?.status !== status) {
      this.presence.set(userId, { status, lastSeen: now });
      this.broadcast(JSON.stringify({
        type: "presence_changed",
        userId,
        status,
        lastSeen: now
      }));
    } else {
      existing.lastSeen = now;
    }
  }

  override async webSocketMessage(ws: WebSocket, msg: string | ArrayBuffer) {
    if (typeof msg !== "string") return;

    try {
      const data = JSON.parse(msg);
      const attachment = ws.deserializeAttachment() as { userId: string } | null;
      if (!attachment) return;

      if (data.type === "heartbeat" || data.type === "ping") {
        this.updatePresence(attachment.userId, "online");
        if (data.type === "ping") {
          ws.send(JSON.stringify({ type: "pong" }));
        }
      } else if (data.type === "presence_set" && ["online", "away", "dnd", "offline"].includes(data.status)) {
        this.updatePresence(attachment.userId, data.status);
      }
    } catch (e) {
      console.error("Invalid WS message", e);
    }
  }

  override async webSocketClose(ws: WebSocket) {
    const attachment = ws.deserializeAttachment() as { userId: string } | null;
    if (attachment) {
      // Check if user has other active websockets
      const userSockets = this.ctx.getWebSockets(attachment.userId);
      if (userSockets.length === 0) {
        this.updatePresence(attachment.userId, "offline");
      }
    }
  }

  override async webSocketError(ws: WebSocket) {
    const attachment = ws.deserializeAttachment() as { userId: string } | null;
    if (attachment) {
      const userSockets = this.ctx.getWebSockets(attachment.userId);
      if (userSockets.length === 0) {
        this.updatePresence(attachment.userId, "offline");
      }
    }
  }

  override async alarm() {
    const now = Date.now();
    let _changed = false;

    // Check timeouts
    for (const [userId, data] of this.presence.entries()) {
      if (data.status !== "offline" && now - data.lastSeen > this.TIMEOUT) {
        data.status = "offline";
        this.broadcast(JSON.stringify({
          type: "presence_changed",
          userId,
          status: "offline",
          lastSeen: data.lastSeen
        }));
        _changed = true;
      }
    }

    // Optional: cleanup completely offline/old entries to save memory
    for (const [userId, data] of this.presence.entries()) {
      if (data.status === "offline" && now - data.lastSeen > this.TIMEOUT * 2) {
        this.presence.delete(userId);
      }
    }

    // Schedule next alarm
    await this.ctx.storage.setAlarm(now + this.ALARM_INTERVAL);
  }
}
