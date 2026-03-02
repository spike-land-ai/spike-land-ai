import { DurableObject } from "cloudflare:workers";
import type { Delta } from "../protocol/messages.js";
import { parseClientMessage, serialize } from "../protocol/messages.js";
import { generateCreateTable, generateCreateIndexes } from "../schema/sql-gen.js";
import type { DatabaseSchema } from "../schema/types.js";
import type { Env } from "../worker/env.js";
import { generateIdentity, verifyToken } from "./identity.js";
import { executeReducer } from "./reducer-engine.js";
import { ensureSchedulerTable, processAlarm, scheduleReducer } from "./scheduler.js";
import { SubscriptionManager } from "./subscription-engine.js";
import type { SqlStorage } from "./table-handle.js";

/**
 * SpikeDatabase — Durable Object that hosts a SQLite-backed database
 * with WebSocket subscriptions and reducer execution.
 */
export class SpikeDatabase extends DurableObject<Env> {
  private sql: SqlStorage;
  private schema: DatabaseSchema | null = null;
  private subscriptionManager = new SubscriptionManager();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = this.ctx.storage.sql as unknown as SqlStorage;
  }

  /** Initialize schema tables. Called by the worker before first use. */
  initSchema(schema: DatabaseSchema): void {
    this.schema = schema;

    this.ctx.blockConcurrencyWhile(async () => {
      for (const table of Object.values(schema.tables)) {
        this.sql.exec(generateCreateTable(table));
        for (const indexSql of generateCreateIndexes(table)) {
          this.sql.exec(indexSql);
        }
      }
      ensureSchedulerTable(this.sql);
    });
  }

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/ws" && request.headers.get("Upgrade") === "websocket") {
      return this.handleWebSocketUpgrade(url);
    }

    const reducerMatch = url.pathname.match(/^\/reducer\/(.+)$/);
    if (reducerMatch && request.method === "POST") {
      return this.handleReducerHttp(reducerMatch[1], request);
    }

    if (url.pathname === "/health") {
      const tableCount = this.schema ? Object.keys(this.schema.tables).length : 0;
      return Response.json({ ok: true, tables: tableCount });
    }

    return new Response("Not Found", { status: 404 });
  }

  private async handleWebSocketUpgrade(url: URL): Promise<Response> {
    const token = url.searchParams.get("token");
    let identity: string;
    let tokenToSend: string | undefined;

    if (token) {
      const verified = await verifyToken(token, this.env.IDENTITY_SECRET);
      if (!verified) {
        return new Response("Invalid token", { status: 401 });
      }
      identity = verified;
    } else {
      const gen = await generateIdentity(this.env.IDENTITY_SECRET);
      identity = gen.identity;
      tokenToSend = gen.token;
    }

    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    this.ctx.acceptWebSocket(server, [identity]);

    const connected: Record<string, unknown> = {
      type: "connected",
      identity,
      dbIdentity: this.ctx.id.toString(),
    };
    if (tokenToSend) {
      connected.token = tokenToSend;
    }
    server.send(JSON.stringify(connected));

    return new Response(null, { status: 101, webSocket: client });
  }

  private async handleReducerHttp(reducerName: string, request: Request): Promise<Response> {
    if (!this.schema) {
      return Response.json({ ok: false, error: "Schema not initialized" }, { status: 500 });
    }

    const body = await request.json() as { args?: unknown[]; sender?: string };
    const args = body.args ?? [];
    const sender = body.sender ?? "http";

    const scheduleFn = (name: string, delay: number, scheduledArgs: unknown[]) => {
      scheduleReducer(this.sql, (t) => this.ctx.storage.setAlarm(t), name, delay, scheduledArgs);
    };

    const result = executeReducer(this.sql, this.schema, reducerName, args, sender, scheduleFn);

    if (!result.error && result.mutations.length > 0) {
      this.subscriptionManager.broadcastDeltas(result.mutations, sender, reducerName);
    }

    return Response.json({
      ok: !result.error,
      error: result.error,
      mutations: result.mutations,
    });
  }

  override async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const data = typeof message === "string" ? message : new TextDecoder().decode(message);

    let parsed: ReturnType<typeof parseClientMessage>;
    try {
      parsed = parseClientMessage(JSON.parse(data));
    } catch {
      ws.send(serialize({ type: "pong" }));
      return;
    }

    switch (parsed.type) {
      case "reducer_call":
        this.handleReducerCall(ws, parsed.id, parsed.reducer, parsed.args);
        break;

      case "subscribe":
        this.subscriptionManager.subscribe(
          ws,
          parsed.id,
          parsed.queries,
          (query: string, ...params: unknown[]) => this.sql.exec(query, ...params).toArray(),
        );
        break;

      case "unsubscribe":
        this.subscriptionManager.unsubscribe(parsed.subscriptionId);
        break;

      case "ping":
        ws.send(serialize({ type: "pong" }));
        break;
    }
  }

  private handleReducerCall(ws: WebSocket, id: string, reducerName: string, args: unknown[]): void {
    if (!this.schema) {
      ws.send(serialize({ type: "reducer_result", id, ok: false, error: "Schema not initialized" }));
      return;
    }

    const tags = this.ctx.getTags(ws);
    const sender = tags[0] ?? "anonymous";

    const scheduleFn = (name: string, delay: number, scheduledArgs: unknown[]) => {
      scheduleReducer(this.sql, (t) => this.ctx.storage.setAlarm(t), name, delay, scheduledArgs);
    };

    const result = executeReducer(this.sql, this.schema, reducerName, args, sender, scheduleFn);

    ws.send(serialize({
      type: "reducer_result",
      id,
      ok: !result.error,
      error: result.error,
    }));

    if (!result.error && result.mutations.length > 0) {
      this.subscriptionManager.broadcastDeltas(result.mutations, sender, reducerName);
    }
  }

  override async webSocketClose(ws: WebSocket): Promise<void> {
    this.subscriptionManager.removeBySocket(ws);
  }

  override async webSocketError(ws: WebSocket): Promise<void> {
    this.subscriptionManager.removeBySocket(ws);
  }

  override async alarm(): Promise<void> {
    if (!this.schema) return;

    const scheduleFn = (name: string, delay: number, args: unknown[]) => {
      scheduleReducer(this.sql, (t) => this.ctx.storage.setAlarm(t), name, delay, args);
    };

    const mutations: Delta[] = processAlarm(
      this.sql,
      this.schema,
      executeReducer,
      (t) => this.ctx.storage.setAlarm(t),
      scheduleFn,
    );

    if (mutations.length > 0) {
      this.subscriptionManager.broadcastDeltas(mutations, "__scheduler__", "__alarm__");
    }
  }
}
