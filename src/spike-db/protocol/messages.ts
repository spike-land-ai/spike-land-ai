import { z } from "zod";

// Delta type (shared between client and server)
export const DeltaSchema = z.object({
  table: z.string(),
  op: z.enum(["insert", "update", "delete"]),
  oldRow: z.unknown().optional(),
  newRow: z.unknown().optional(),
});
export type Delta = z.infer<typeof DeltaSchema>;

// ---------------------------------------------------------------------------
// Client → Server messages
// ---------------------------------------------------------------------------

export const ReducerCallMessage = z.object({
  type: z.literal("reducer_call"),
  id: z.string(),
  reducer: z.string(),
  args: z.array(z.unknown()),
});
export type ReducerCallMessage = z.infer<typeof ReducerCallMessage>;

const SubscribeQuerySchema = z.object({
  table: z.string(),
  filter: z.record(z.string(), z.unknown()).optional(),
});

export const SubscribeMessage = z.object({
  type: z.literal("subscribe"),
  id: z.string(),
  queries: z.array(SubscribeQuerySchema),
});
export type SubscribeMessage = z.infer<typeof SubscribeMessage>;

export const UnsubscribeMessage = z.object({
  type: z.literal("unsubscribe"),
  subscriptionId: z.string(),
});
export type UnsubscribeMessage = z.infer<typeof UnsubscribeMessage>;

export const PingMessage = z.object({ type: z.literal("ping") });
export type PingMessage = z.infer<typeof PingMessage>;

export const ClientMessage = z.discriminatedUnion("type", [
  ReducerCallMessage,
  SubscribeMessage,
  UnsubscribeMessage,
  PingMessage,
]);
export type ClientMessage = z.infer<typeof ClientMessage>;

// ---------------------------------------------------------------------------
// Server → Client messages
// ---------------------------------------------------------------------------

export const ConnectedMessage = z.object({
  type: z.literal("connected"),
  identity: z.string(),
  dbIdentity: z.string(),
});
export type ConnectedMessage = z.infer<typeof ConnectedMessage>;

export const InitialSnapshotMessage = z.object({
  type: z.literal("initial_snapshot"),
  subscriptionId: z.string(),
  tables: z.record(z.string(), z.array(z.unknown())),
});
export type InitialSnapshotMessage = z.infer<typeof InitialSnapshotMessage>;

export const TransactionUpdateMessage = z.object({
  type: z.literal("transaction_update"),
  reducerName: z.string(),
  callerIdentity: z.string(),
  status: z.enum(["committed", "failed"]),
  error: z.string().optional(),
  deltas: z.array(DeltaSchema),
});
export type TransactionUpdateMessage = z.infer<typeof TransactionUpdateMessage>;

export const ReducerResultMessage = z.object({
  type: z.literal("reducer_result"),
  id: z.string(),
  ok: z.boolean(),
  error: z.string().optional(),
});
export type ReducerResultMessage = z.infer<typeof ReducerResultMessage>;

export const PongMessage = z.object({ type: z.literal("pong") });
export type PongMessage = z.infer<typeof PongMessage>;

export const ServerMessage = z.discriminatedUnion("type", [
  ConnectedMessage,
  InitialSnapshotMessage,
  TransactionUpdateMessage,
  ReducerResultMessage,
  PongMessage,
]);
export type ServerMessage = z.infer<typeof ServerMessage>;

// ---------------------------------------------------------------------------
// Parse & serialize helpers
// ---------------------------------------------------------------------------

export function parseClientMessage(data: unknown): ClientMessage {
  return ClientMessage.parse(data);
}

export function parseServerMessage(data: unknown): ServerMessage {
  return ServerMessage.parse(data);
}

export function serialize(msg: ClientMessage | ServerMessage): string {
  return JSON.stringify(msg);
}
