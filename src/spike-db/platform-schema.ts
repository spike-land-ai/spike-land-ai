import { defineTable, defineReducer, defineDatabase, t } from "./schema/index.js";
import type { ReducerContext } from "./server/reducer-engine.js";

// ---------------------------------------------------------------------------
// Tables — ported from spacetimedb-platform/src/module_bindings/types.ts
// ---------------------------------------------------------------------------

export const UserTable = defineTable("user", {
  columns: {
    identity: t.identity(),
    handle: t.string(),
    displayName: t.string(),
    email: t.string(),
    role: t.string(),
    avatarUrl: t.string(),
    online: t.bool(),
    lastSeen: t.u64(),
    createdAt: t.u64(),
  },
  primaryKey: "identity",
});

export const AgentTable = defineTable("agent", {
  columns: {
    identity: t.identity(),
    displayName: t.string(),
    capabilities: t.array(t.string()),
    online: t.bool(),
    lastSeen: t.u64(),
  },
  primaryKey: "identity",
});

export const AgentMessageTable = defineTable("agent_message", {
  columns: {
    id: t.u64(),
    fromAgent: t.identity(),
    toAgent: t.identity(),
    content: t.string(),
    timestamp: t.u64(),
    delivered: t.bool(),
  },
  primaryKey: "id",
});

export const AlbumTable = defineTable("album", {
  columns: {
    id: t.u64(),
    handle: t.string(),
    userIdentity: t.identity(),
    name: t.string(),
    description: t.option(t.string()),
    coverImageId: t.option(t.string()),
    privacy: t.string(),
    defaultTier: t.string(),
    shareToken: t.option(t.string()),
    sortOrder: t.u32(),
    pipelineId: t.option(t.string()),
    createdAt: t.u64(),
    updatedAt: t.u64(),
  },
  primaryKey: "id",
});

export const AlbumImageTable = defineTable("album_image", {
  columns: {
    id: t.u64(),
    albumId: t.u64(),
    imageId: t.string(),
    sortOrder: t.u32(),
    addedAt: t.u64(),
  },
  primaryKey: "id",
});

export const AppTable = defineTable("app", {
  columns: {
    id: t.u64(),
    slug: t.string(),
    name: t.string(),
    description: t.string(),
    ownerIdentity: t.identity(),
    status: t.string(),
    r2CodeKey: t.string(),
    createdAt: t.u64(),
    updatedAt: t.u64(),
  },
  primaryKey: "id",
});

export const AppMessageTable = defineTable("app_message", {
  columns: {
    id: t.u64(),
    appId: t.u64(),
    role: t.string(),
    content: t.string(),
    createdAt: t.u64(),
  },
  primaryKey: "id",
});

export const AppVersionTable = defineTable("app_version", {
  columns: {
    id: t.u64(),
    appId: t.u64(),
    version: t.u32(),
    codeHash: t.string(),
    changeDescription: t.string(),
    createdBy: t.identity(),
    createdAt: t.u64(),
  },
  primaryKey: "id",
});

export const CodeSessionTable = defineTable("code_session", {
  columns: {
    codeSpace: t.string(),
    code: t.string(),
    html: t.string(),
    css: t.string(),
    transpiled: t.string(),
    messagesJson: t.string(),
    lastUpdatedBy: t.identity(),
    updatedAt: t.u64(),
  },
  primaryKey: "codeSpace",
});

export const CreditsTable = defineTable("credits", {
  columns: {
    userIdentity: t.identity(),
    balance: t.i64(),
    updatedAt: t.u64(),
  },
  primaryKey: "userIdentity",
});

export const DirectMessageTable = defineTable("direct_message", {
  columns: {
    id: t.u64(),
    fromIdentity: t.identity(),
    toIdentity: t.identity(),
    content: t.string(),
    readStatus: t.bool(),
    createdAt: t.u64(),
  },
  primaryKey: "id",
});

export const EnhancementJobTable = defineTable("enhancement_job", {
  columns: {
    id: t.string(),
    imageId: t.string(),
    userIdentity: t.identity(),
    tier: t.string(),
    creditsCost: t.u32(),
    status: t.string(),
    enhancedUrl: t.option(t.string()),
    enhancedR2Key: t.option(t.string()),
    enhancedWidth: t.option(t.u32()),
    enhancedHeight: t.option(t.u32()),
    enhancedSizeBytes: t.option(t.u64()),
    errorMessage: t.option(t.string()),
    retryCount: t.u32(),
    metadataJson: t.option(t.string()),
    processingStartedAt: t.option(t.u64()),
    processingCompletedAt: t.option(t.u64()),
    createdAt: t.u64(),
    updatedAt: t.u64(),
  },
  primaryKey: "id",
});

export const GenerationJobTable = defineTable("generation_job", {
  columns: {
    id: t.string(),
    userIdentity: t.identity(),
    jobType: t.string(),
    tier: t.string(),
    creditsCost: t.u32(),
    status: t.string(),
    prompt: t.string(),
    inputImageUrl: t.option(t.string()),
    outputImageUrl: t.option(t.string()),
    outputWidth: t.option(t.u32()),
    outputHeight: t.option(t.u32()),
    outputSizeBytes: t.option(t.u64()),
    errorMessage: t.option(t.string()),
    createdAt: t.u64(),
    updatedAt: t.u64(),
  },
  primaryKey: "id",
});

export const HealthCheckTable = defineTable("health_check", {
  columns: {
    id: t.u64(),
    service: t.string(),
    status: t.string(),
    latencyMs: t.u32(),
    checkedAt: t.u64(),
  },
  primaryKey: "id",
});

export const ImageTable = defineTable("image", {
  columns: {
    id: t.string(),
    userIdentity: t.identity(),
    name: t.string(),
    description: t.option(t.string()),
    originalUrl: t.string(),
    originalR2Key: t.string(),
    originalWidth: t.u32(),
    originalHeight: t.u32(),
    originalSizeBytes: t.u64(),
    originalFormat: t.string(),
    isPublic: t.bool(),
    viewCount: t.u64(),
    tags: t.array(t.string()),
    shareToken: t.option(t.string()),
    createdAt: t.u64(),
    updatedAt: t.u64(),
  },
  primaryKey: "id",
});

export const McpTaskTable = defineTable("mcp_task", {
  columns: {
    id: t.u64(),
    toolName: t.string(),
    argumentsJson: t.string(),
    requesterIdentity: t.identity(),
    providerIdentity: t.option(t.identity()),
    status: t.string(),
    resultJson: t.option(t.string()),
    error: t.option(t.string()),
    createdAt: t.u64(),
    completedAt: t.option(t.u64()),
  },
  primaryKey: "id",
});

export const OauthLinkTable = defineTable("oauth_link", {
  columns: {
    id: t.u64(),
    userIdentity: t.identity(),
    provider: t.string(),
    providerAccountId: t.string(),
    createdAt: t.u64(),
  },
  primaryKey: "id",
});

export const PageTable = defineTable("page", {
  columns: {
    id: t.u64(),
    slug: t.string(),
    title: t.string(),
    description: t.string(),
    published: t.bool(),
    createdAt: t.u64(),
    updatedAt: t.u64(),
  },
  primaryKey: "id",
});

export const PageBlockTable = defineTable("page_block", {
  columns: {
    id: t.u64(),
    pageId: t.u64(),
    blockType: t.string(),
    contentJson: t.string(),
    sortOrder: t.u32(),
  },
  primaryKey: "id",
});

export const PipelineTable = defineTable("pipeline", {
  columns: {
    id: t.string(),
    userIdentity: t.option(t.identity()),
    name: t.string(),
    description: t.option(t.string()),
    visibility: t.string(),
    shareToken: t.option(t.string()),
    tier: t.string(),
    analysisConfigJson: t.option(t.string()),
    autoCropConfigJson: t.option(t.string()),
    promptConfigJson: t.option(t.string()),
    generationConfigJson: t.option(t.string()),
    usageCount: t.u64(),
    createdAt: t.u64(),
    updatedAt: t.u64(),
  },
  primaryKey: "id",
});

export const PlatformEventTable = defineTable("platform_event", {
  columns: {
    id: t.u64(),
    source: t.string(),
    eventType: t.string(),
    metadataJson: t.string(),
    userIdentity: t.option(t.identity()),
    timestamp: t.u64(),
  },
  primaryKey: "id",
});

export const RegisteredToolTable = defineTable("registered_tool", {
  columns: {
    id: t.u64(),
    name: t.string(),
    description: t.string(),
    inputSchema: t.string(),
    providerIdentity: t.identity(),
    category: t.string(),
    createdAt: t.u64(),
  },
  primaryKey: "id",
});

export const SubjectTable = defineTable("subject", {
  columns: {
    id: t.u64(),
    userIdentity: t.identity(),
    imageId: t.string(),
    label: t.string(),
    subjectType: t.string(),
    description: t.option(t.string()),
    createdAt: t.u64(),
  },
  primaryKey: "id",
});

export const ToolUsageTable = defineTable("tool_usage", {
  columns: {
    id: t.u64(),
    toolName: t.string(),
    userIdentity: t.identity(),
    timestamp: t.u64(),
    durationMs: t.u32(),
    success: t.bool(),
  },
  primaryKey: "id",
});

export const UserToolPreferenceTable = defineTable("user_tool_preference", {
  columns: {
    id: t.u64(),
    userIdentity: t.identity(),
    toolName: t.string(),
    enabled: t.bool(),
    customConfig: t.string(),
  },
  primaryKey: "id",
});

// ---------------------------------------------------------------------------
// All tables
// ---------------------------------------------------------------------------

const allTables = [
  UserTable,
  AgentTable,
  AgentMessageTable,
  AlbumTable,
  AlbumImageTable,
  AppTable,
  AppMessageTable,
  AppVersionTable,
  CodeSessionTable,
  CreditsTable,
  DirectMessageTable,
  EnhancementJobTable,
  GenerationJobTable,
  HealthCheckTable,
  ImageTable,
  McpTaskTable,
  OauthLinkTable,
  PageTable,
  PageBlockTable,
  PipelineTable,
  PlatformEventTable,
  RegisteredToolTable,
  SubjectTable,
  ToolUsageTable,
  UserToolPreferenceTable,
];

// ---------------------------------------------------------------------------
// Reducers — ported from spacetimedb-platform reducers
// ---------------------------------------------------------------------------

export const registerUserReducer = defineReducer(
  "register_user",
  (ctx: unknown, handle: unknown, displayName: unknown, email: unknown) => {
    const c = ctx as ReducerContext;
    c.db.user.insert({
      identity: c.sender,
      handle: handle as string,
      displayName: displayName as string,
      email: email as string,
      role: "user",
      avatarUrl: "",
      online: true,
      lastSeen: c.timestamp,
      createdAt: c.timestamp,
    });
  },
);

export const updateProfileReducer = defineReducer(
  "update_profile",
  (ctx: unknown, displayName: unknown, email: unknown) => {
    const c = ctx as ReducerContext;
    c.db.user.update(c.sender, {
      displayName: displayName as string,
      email: email as string,
      lastSeen: c.timestamp,
    });
  },
);

export const sendDmReducer = defineReducer(
  "send_dm",
  (ctx: unknown, toIdentity: unknown, content: unknown) => {
    const c = ctx as ReducerContext;
    c.db.direct_message.insert({
      id: c.timestamp,
      fromIdentity: c.sender,
      toIdentity: toIdentity as string,
      content: content as string,
      readStatus: false,
      createdAt: c.timestamp,
    });
  },
);

export const markDmReadReducer = defineReducer(
  "mark_dm_read",
  (ctx: unknown, messageId: unknown) => {
    const c = ctx as ReducerContext;
    c.db.direct_message.update(messageId, { readStatus: true });
  },
);

export const registerAgentReducer = defineReducer(
  "register_agent",
  (ctx: unknown, displayName: unknown, capabilities: unknown) => {
    const c = ctx as ReducerContext;
    c.db.agent.insert({
      identity: c.sender,
      displayName: displayName as string,
      capabilities: capabilities as string[],
      online: true,
      lastSeen: c.timestamp,
    });
  },
);

export const unregisterAgentReducer = defineReducer(
  "unregister_agent",
  (ctx: unknown) => {
    const c = ctx as ReducerContext;
    c.db.agent.delete(c.sender);
  },
);

export const sendAgentMessageReducer = defineReducer(
  "send_agent_message",
  (ctx: unknown, toAgent: unknown, content: unknown) => {
    const c = ctx as ReducerContext;
    c.db.agent_message.insert({
      id: c.timestamp,
      fromAgent: c.sender,
      toAgent: toAgent as string,
      content: content as string,
      timestamp: c.timestamp,
      delivered: false,
    });
  },
);

export const markAgentMessageDeliveredReducer = defineReducer(
  "mark_agent_message_delivered",
  (ctx: unknown, messageId: unknown) => {
    const c = ctx as ReducerContext;
    c.db.agent_message.update(messageId, { delivered: true });
  },
);

export const createAppReducer = defineReducer(
  "create_app",
  (ctx: unknown, slug: unknown, name: unknown, description: unknown, r2CodeKey: unknown) => {
    const c = ctx as ReducerContext;
    c.db.app.insert({
      id: c.timestamp,
      slug: slug as string,
      name: name as string,
      description: description as string,
      ownerIdentity: c.sender,
      status: "active",
      r2CodeKey: r2CodeKey as string,
      createdAt: c.timestamp,
      updatedAt: c.timestamp,
    });
  },
);

export const updateAppReducer = defineReducer(
  "update_app",
  (ctx: unknown, appId: unknown, name: unknown, description: unknown) => {
    const c = ctx as ReducerContext;
    c.db.app.update(appId, {
      name: name as string,
      description: description as string,
      updatedAt: c.timestamp,
    });
  },
);

export const deleteAppReducer = defineReducer(
  "delete_app",
  (ctx: unknown, appId: unknown) => {
    const c = ctx as ReducerContext;
    c.db.app.update(appId, { status: "deleted", updatedAt: c.timestamp });
  },
);

export const restoreAppReducer = defineReducer(
  "restore_app",
  (ctx: unknown, appId: unknown) => {
    const c = ctx as ReducerContext;
    c.db.app.update(appId, { status: "active", updatedAt: c.timestamp });
  },
);

export const updateAppStatusReducer = defineReducer(
  "update_app_status",
  (ctx: unknown, appId: unknown, status: unknown) => {
    const c = ctx as ReducerContext;
    c.db.app.update(appId, { status: status as string, updatedAt: c.timestamp });
  },
);

export const createPageReducer = defineReducer(
  "create_page",
  (ctx: unknown, slug: unknown, title: unknown, description: unknown) => {
    const c = ctx as ReducerContext;
    c.db.page.insert({
      id: c.timestamp,
      slug: slug as string,
      title: title as string,
      description: description as string,
      published: false,
      createdAt: c.timestamp,
      updatedAt: c.timestamp,
    });
  },
);

export const updatePageReducer = defineReducer(
  "update_page",
  (ctx: unknown, pageId: unknown, title: unknown, description: unknown) => {
    const c = ctx as ReducerContext;
    c.db.page.update(pageId, {
      title: title as string,
      description: description as string,
      updatedAt: c.timestamp,
    });
  },
);

export const deletePageReducer = defineReducer(
  "delete_page",
  (ctx: unknown, pageId: unknown) => {
    const c = ctx as ReducerContext;
    c.db.page.delete(pageId);
  },
);

export const sendAppMessageReducer = defineReducer(
  "send_app_message",
  (ctx: unknown, appId: unknown, role: unknown, content: unknown) => {
    const c = ctx as ReducerContext;
    c.db.app_message.insert({
      id: c.timestamp,
      appId: appId as number,
      role: role as string,
      content: content as string,
      createdAt: c.timestamp,
    });
  },
);

export const registerToolReducer = defineReducer(
  "register_tool",
  (ctx: unknown, name: unknown, description: unknown, inputSchema: unknown, category: unknown) => {
    const c = ctx as ReducerContext;
    c.db.registered_tool.insert({
      id: c.timestamp,
      name: name as string,
      description: description as string,
      inputSchema: inputSchema as string,
      providerIdentity: c.sender,
      category: category as string,
      createdAt: c.timestamp,
    });
  },
);

export const recordPlatformEventReducer = defineReducer(
  "record_platform_event",
  (ctx: unknown, source: unknown, eventType: unknown, metadataJson: unknown) => {
    const c = ctx as ReducerContext;
    c.db.platform_event.insert({
      id: c.timestamp,
      source: source as string,
      eventType: eventType as string,
      metadataJson: metadataJson as string,
      userIdentity: c.sender,
      timestamp: c.timestamp,
    });
  },
);

export const recordHealthCheckReducer = defineReducer(
  "record_health_check",
  (ctx: unknown, service: unknown, status: unknown, latencyMs: unknown) => {
    const c = ctx as ReducerContext;
    c.db.health_check.insert({
      id: c.timestamp,
      service: service as string,
      status: status as string,
      latencyMs: latencyMs as number,
      checkedAt: c.timestamp,
    });
  },
);

const allReducers = [
  registerUserReducer,
  updateProfileReducer,
  sendDmReducer,
  markDmReadReducer,
  registerAgentReducer,
  unregisterAgentReducer,
  sendAgentMessageReducer,
  markAgentMessageDeliveredReducer,
  createAppReducer,
  updateAppReducer,
  deleteAppReducer,
  restoreAppReducer,
  updateAppStatusReducer,
  createPageReducer,
  updatePageReducer,
  deletePageReducer,
  sendAppMessageReducer,
  registerToolReducer,
  recordPlatformEventReducer,
  recordHealthCheckReducer,
];

// ---------------------------------------------------------------------------
// Database schema
// ---------------------------------------------------------------------------

export const platformDatabase = defineDatabase("spike-platform", {
  tables: allTables,
  reducers: allReducers,
});
