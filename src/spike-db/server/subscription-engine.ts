import type { Delta, TransactionUpdateMessage } from "../protocol/messages";
import { serialize } from "../protocol/messages";

export interface SubscribeQuery {
  table: string;
  filter?: Record<string, unknown>;
}

export interface Subscription {
  id: string;
  ws: WebSocket;
  queries: SubscribeQuery[];
}

function matchesFilter(
  row: Record<string, unknown> | undefined,
  filter?: Record<string, unknown>,
): boolean {
  if (!filter) return true;
  if (!row) return false;
  for (const key of Object.keys(filter)) {
    if (row[key] !== filter[key]) return false;
  }
  return true;
}

function safeSend(ws: WebSocket, data: string): boolean {
  try {
    if (ws.readyState === 1) {
      ws.send(data);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export class SubscriptionManager {
  private subscriptions = new Map<string, Subscription>();

  subscribe(
    ws: WebSocket,
    subscriptionId: string,
    queries: SubscribeQuery[],
    sqlExec: (query: string, ...params: unknown[]) => unknown[],
  ): void {
    this.subscriptions.set(subscriptionId, { id: subscriptionId, ws, queries });

    const tables: Record<string, unknown[]> = {};

    for (const query of queries) {
      const filterEntries = query.filter ? Object.entries(query.filter) : [];

      let sql = `SELECT * FROM ${query.table}`;
      const params: unknown[] = [];

      if (filterEntries.length > 0) {
        const clauses = filterEntries.map(([col, val]) => {
          params.push(val);
          return `${col} = ?`;
        });
        sql += ` WHERE ${clauses.join(" AND ")}`;
      }

      const rows = sqlExec(sql, ...params);
      tables[query.table] = rows;
    }

    const snapshot = serialize({
      type: "initial_snapshot" as const,
      subscriptionId,
      tables,
    });

    if (!safeSend(ws, snapshot)) {
      this.subscriptions.delete(subscriptionId);
    }
  }

  unsubscribe(subscriptionId: string): void {
    this.subscriptions.delete(subscriptionId);
  }

  removeBySocket(ws: WebSocket): void {
    for (const [id, sub] of this.subscriptions) {
      if (sub.ws === ws) {
        this.subscriptions.delete(id);
      }
    }
  }

  broadcastDeltas(
    mutations: Delta[],
    callerIdentity: string,
    reducerName: string,
  ): void {
    const toRemove: string[] = [];

    for (const [id, sub] of this.subscriptions) {
      const matchingDeltas = mutations.filter((delta) =>
        sub.queries.some(
          (query) =>
            query.table === delta.table &&
            (matchesFilter(delta.newRow as Record<string, unknown> | undefined, query.filter) ||
              matchesFilter(delta.oldRow as Record<string, unknown> | undefined, query.filter)),
        ),
      );

      if (matchingDeltas.length === 0) continue;

      const msg: TransactionUpdateMessage = {
        type: "transaction_update",
        reducerName,
        callerIdentity,
        status: "committed",
        deltas: matchingDeltas,
      };

      if (!safeSend(sub.ws, serialize(msg))) {
        toRemove.push(id);
      }
    }

    for (const id of toRemove) {
      this.subscriptions.delete(id);
    }
  }

  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }
}
