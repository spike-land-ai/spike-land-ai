import type { DatabaseSchema } from "../schema/types.js";
import type { ServerMessage } from "../protocol/messages.js";
import { serialize } from "../protocol/messages.js";
import { Connection } from "./connection.js";
import { TableCache, ClientTable } from "./cache.js";
import { SubscriptionBuilder } from "./subscription.js";

type ClientEvent = "connected" | "disconnected" | "error";
type EventHandler = (...args: unknown[]) => void;

export interface SpikeDbClientOptions {
  url: string;
  token?: string;
  schema: DatabaseSchema;
}

export class SpikeDbClient {
  identity = "";
  private connection: Connection;
  private cache: TableCache;
  private pendingReducers: Map<
    string,
    { resolve: () => void; reject: (err: Error) => void }
  > = new Map();
  private pendingSubscriptions: Map<
    string,
    { builder: SubscriptionBuilder; resolve: () => void }
  > = new Map();
  private eventHandlers: Map<ClientEvent, Set<EventHandler>> = new Map();
  private connectPromise: {
    resolve: () => void;
    reject: (err: Error) => void;
  } | null = null;
  private idCounter = 0;

  constructor(private options: SpikeDbClientOptions) {
    this.cache = new TableCache();

    // Register tables from schema
    for (const [key, tableDef] of Object.entries(options.schema.tables)) {
      this.cache.registerTable(key, tableDef.primaryKey);
    }

    this.connection = new Connection({
      url: options.url,
      token: options.token,
      onMessage: (data: unknown) => this.handleMessage(data),
      onOpen: () => {},
      onClose: () => this.emit("disconnected"),
      onError: (err: Event) => this.emit("error", err),
    });
  }

  connect(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.connectPromise = { resolve, reject };
      this.connection.connect();
    });
  }

  disconnect(): void {
    this.connection.disconnect();
  }

  callReducer(name: string, ...args: unknown[]): Promise<void> {
    const id = this.nextId();
    return new Promise<void>((resolve, reject) => {
      this.pendingReducers.set(id, { resolve, reject });
      this.connection.send(
        serialize({
          type: "reducer_call" as const,
          id,
          reducer: name,
          args,
        }),
      );
    });
  }

  subscribe(
    queries: Array<{ table: string; filter?: Record<string, unknown> }>,
  ): SubscriptionBuilder {
    const id = this.nextId();
    const builder = new SubscriptionBuilder(queries, id, this.connection);
    this.pendingSubscriptions.set(id, {
      builder,
      resolve: () => {},
    });
    return builder;
  }

  table<T>(name: string): ClientTable<T> {
    return new ClientTable<T>(this.cache, name);
  }

  on(event: ClientEvent, handler: EventHandler): () => void {
    let handlers = this.eventHandlers.get(event);
    if (!handlers) {
      handlers = new Set();
      this.eventHandlers.set(event, handlers);
    }
    handlers.add(handler);
    return () => {
      handlers.delete(handler);
    };
  }

  /** Exposed for testing — returns the internal cache. */
  _getCache(): TableCache {
    return this.cache;
  }

  private handleMessage(data: unknown): void {
    const msg = data as ServerMessage;
    switch (msg.type) {
      case "connected":
        this.identity = msg.identity;
        this.emit("connected");
        this.connectPromise?.resolve();
        this.connectPromise = null;
        break;

      case "initial_snapshot": {
        const tables = msg.tables as Record<string, unknown[]>;
        for (const [table, rows] of Object.entries(tables)) {
          this.cache.applySnapshot(
            table,
            rows as Record<string, unknown>[],
          );
        }
        const pending = this.pendingSubscriptions.get(msg.subscriptionId);
        if (pending) {
          pending.builder._notifyApplied();
          this.pendingSubscriptions.delete(msg.subscriptionId);
        }
        break;
      }

      case "transaction_update":
        for (const delta of msg.deltas) {
          this.cache.applyDelta(delta);
        }
        break;

      case "reducer_result": {
        const reducer = this.pendingReducers.get(msg.id);
        if (reducer) {
          if (msg.ok) {
            reducer.resolve();
          } else {
            reducer.reject(new Error(msg.error ?? "Reducer failed"));
          }
          this.pendingReducers.delete(msg.id);
        }
        break;
      }

      case "pong":
        // Keep-alive acknowledged
        break;
    }
  }

  private emit(event: ClientEvent, ...args: unknown[]): void {
    const handlers = this.eventHandlers.get(event);
    if (!handlers) return;
    for (const handler of handlers) {
      handler(...args);
    }
  }

  private nextId(): string {
    return String(++this.idCounter);
  }
}

export { TableCache, ClientTable } from "./cache.js";
export { Connection } from "./connection.js";
export type { ConnectionOptions } from "./connection.js";
export { SubscriptionBuilder } from "./subscription.js";
export type { SubscriptionHandle } from "./subscription.js";
