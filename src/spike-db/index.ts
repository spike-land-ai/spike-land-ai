// Schema
export { defineTable, defineReducer, defineDatabase, t } from "./schema/index.js";
export type {
  TableDefinition,
  ReducerDefinition,
  DatabaseSchema,
  ColumnType,
  IndexDef,
  Migration,
  MigrationKind,
  ReducerHandler,
} from "./schema/types.js";
export { generateAllTables, generateCreateTable, generateCreateIndexes } from "./schema/sql-gen.js";
export { diffSchemas, generateMigrationSql } from "./schema/migrations.js";

// Protocol
export {
  DeltaSchema,
  ClientMessage,
  ServerMessage,
  parseClientMessage,
  parseServerMessage,
  serialize,
} from "./protocol/messages.js";
export type { Delta } from "./protocol/messages.js";

// Server
export { TableHandle } from "./server/table-handle.js";
export type { SqlStorage, SqlResult } from "./server/table-handle.js";
export { executeReducer } from "./server/reducer-engine.js";
export type { ReducerContext, ReducerResult } from "./server/reducer-engine.js";
export { SubscriptionManager } from "./server/subscription-engine.js";
export { generateIdentity, verifyToken, signToken } from "./server/identity.js";
export { SpikeDatabase } from "./server/database-do.js";
export { ensureSchedulerTable, scheduleReducer, processAlarm } from "./server/scheduler.js";

// Client
export { SpikeDbClient } from "./client/index.js";
export type { SpikeDbClientOptions } from "./client/index.js";
export { TableCache, ClientTable } from "./client/cache.js";
export { SubscriptionBuilder } from "./client/subscription.js";
export type { SubscriptionHandle } from "./client/subscription.js";
export { Connection } from "./client/connection.js";
export type { ConnectionOptions } from "./client/connection.js";

// Worker
export type { Env } from "./worker/env.js";

// Platform
export { platformDatabase } from "./platform-schema.js";
export { PlatformClient } from "./platform-client.js";
export type {
  UserRow,
  AgentRow,
  AgentMessageRow,
  AlbumRow,
  AlbumImageRow,
  AppRow,
  AppMessageRow,
  AppVersionRow,
  CodeSessionRow,
  CreditsRow,
  DirectMessageRow,
  EnhancementJobRow,
  GenerationJobRow,
  HealthCheckRow,
  ImageRow,
  McpTaskRow,
  OauthLinkRow,
  PageRow,
  PageBlockRow,
  PipelineRow,
  PlatformEventRow,
  RegisteredToolRow,
  SubjectRow,
  ToolUsageRow,
  UserToolPreferenceRow,
} from "./platform-client.js";
