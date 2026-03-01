/**
 * SpacetimeDB Platform Module
 *
 * Defines tables and reducers for the spike.land platform:
 * users, OAuth, MCP tools, apps, agents, content, messaging, monitoring.
 *
 * Deploy: spacetime publish --server maincloud spike-platform
 */

import { schema, t, table, SenderError } from "spacetimedb/server";

// ─── Tables: Users & Identity ───

const User = table(
  { name: "user", public: true },
  {
    identity: t.identity().primaryKey(),
    handle: t.string().unique(),
    displayName: t.string(),
    email: t.string(),
    role: t.string(),
    avatarUrl: t.string(),
    online: t.bool(),
    lastSeen: t.u64(),
    createdAt: t.u64(),
  },
);

const OAuthLink = table(
  { name: "oauth_link", public: true },
  {
    id: t.u64().autoInc().primaryKey(),
    userIdentity: t.identity().index("btree"),
    provider: t.string(),
    providerAccountId: t.string(),
    createdAt: t.u64(),
  },
);

// ─── Tables: MCP Tool Registry ───

const ToolEntry = table(
  { name: "tool_entry", public: true },
  {
    id: t.u64().autoInc().primaryKey(),
    name: t.string().unique(),
    category: t.string(),
    description: t.string(),
    tier: t.string(),
    enabled: t.bool(),
    createdAt: t.u64(),
  },
);

const ToolUsage = table(
  { name: "tool_usage", public: true },
  {
    id: t.u64().autoInc().primaryKey(),
    toolName: t.string().index("btree"),
    userIdentity: t.identity(),
    timestamp: t.u64(),
    durationMs: t.u32(),
    success: t.bool(),
  },
);

const UserToolPreference = table(
  { name: "user_tool_preference", public: true },
  {
    id: t.u64().autoInc().primaryKey(),
    userIdentity: t.identity().index("btree"),
    toolName: t.string(),
    enabled: t.bool(),
    customConfig: t.string(),
  },
);

// ─── Tables: Apps / Store ───

const App = table(
  { name: "app", public: true },
  {
    id: t.u64().autoInc().primaryKey(),
    slug: t.string().unique(),
    name: t.string(),
    description: t.string(),
    ownerIdentity: t.identity().index("btree"),
    status: t.string(),
    r2CodeKey: t.string(),
    createdAt: t.u64(),
    updatedAt: t.u64(),
  },
);

const AppVersion = table(
  { name: "app_version", public: true },
  {
    id: t.u64().autoInc().primaryKey(),
    appId: t.u64().index("btree"),
    version: t.u32(),
    codeHash: t.string(),
    changeDescription: t.string(),
    createdBy: t.identity(),
    createdAt: t.u64(),
  },
);

const AppMessage = table(
  { name: "app_message", public: true },
  {
    id: t.u64().autoInc().primaryKey(),
    appId: t.u64().index("btree"),
    role: t.string(),
    content: t.string(),
    createdAt: t.u64(),
  },
);

// ─── Tables: Agent Coordination ───

const Agent = table(
  { name: "agent", public: true },
  {
    identity: t.identity().primaryKey(),
    displayName: t.string(),
    capabilities: t.array(t.string()),
    online: t.bool(),
    lastSeen: t.u64(),
  },
);

const AgentMessage = table(
  { name: "agent_message", public: true },
  {
    id: t.u64().autoInc().primaryKey(),
    fromAgent: t.identity(),
    toAgent: t.identity().index("btree"),
    content: t.string(),
    timestamp: t.u64(),
    delivered: t.bool(),
  },
);

const Task = table(
  { name: "task", public: true },
  {
    id: t.u64().autoInc().primaryKey(),
    description: t.string(),
    assignedTo: t.option(t.identity()),
    status: t.string(),
    priority: t.u8(),
    context: t.string(),
    createdBy: t.identity(),
    createdAt: t.u64(),
  },
);

// ─── Tables: Content ───

const Page = table(
  { name: "page", public: true },
  {
    id: t.u64().autoInc().primaryKey(),
    slug: t.string().unique(),
    title: t.string(),
    description: t.string(),
    published: t.bool(),
    createdAt: t.u64(),
    updatedAt: t.u64(),
  },
);

const PageBlock = table(
  { name: "page_block", public: true },
  {
    id: t.u64().autoInc().primaryKey(),
    pageId: t.u64().index("btree"),
    blockType: t.string(),
    contentJson: t.string(),
    sortOrder: t.u32(),
  },
);

// ─── Tables: Messaging ───

const DirectMessage = table(
  { name: "direct_message", public: true },
  {
    id: t.u64().autoInc().primaryKey(),
    fromIdentity: t.identity(),
    toIdentity: t.identity().index("btree"),
    content: t.string(),
    readStatus: t.bool(),
    createdAt: t.u64(),
  },
);

// ─── Tables: Monitoring ───

const PlatformEvent = table(
  { name: "platform_event", public: true },
  {
    id: t.u64().autoInc().primaryKey(),
    source: t.string(),
    eventType: t.string(),
    metadataJson: t.string(),
    userIdentity: t.option(t.identity()),
    timestamp: t.u64(),
  },
);

const HealthCheck = table(
  { name: "health_check", public: true },
  {
    id: t.u64().autoInc().primaryKey(),
    service: t.string(),
    status: t.string(),
    latencyMs: t.u32(),
    checkedAt: t.u64(),
  },
);

// ─── Schema ───

const spacetimedb = schema(
  User,
  OAuthLink,
  ToolEntry,
  ToolUsage,
  UserToolPreference,
  App,
  AppVersion,
  AppMessage,
  Agent,
  AgentMessage,
  Task,
  Page,
  PageBlock,
  DirectMessage,
  PlatformEvent,
  HealthCheck,
);

// ─── Lifecycle ───

spacetimedb.init((_ctx) => {});

spacetimedb.clientConnected((ctx) => {
  const existing = ctx.db.user.identity.find(ctx.sender);
  if (existing) {
    ctx.db.user.identity.update({
      ...existing,
      online: true,
      lastSeen: BigInt(ctx.timestamp.microsSinceEpoch),
    });
  }
});

spacetimedb.clientDisconnected((ctx) => {
  const existing = ctx.db.user.identity.find(ctx.sender);
  if (existing) {
    ctx.db.user.identity.update({
      ...existing,
      online: false,
      lastSeen: BigInt(ctx.timestamp.microsSinceEpoch),
    });
  }
});

// ─── User Reducers ───

spacetimedb.reducer(
  "register_user",
  {
    handle: t.string(),
    displayName: t.string(),
    email: t.string(),
    avatarUrl: t.string(),
  },
  (ctx, { handle, displayName, email, avatarUrl }) => {
    if (!handle) {
      throw new SenderError("Handle must not be empty");
    }
    const existing = ctx.db.user.identity.find(ctx.sender);
    if (existing) {
      throw new SenderError("User already registered");
    }
    ctx.db.user.insert({
      identity: ctx.sender,
      handle,
      displayName,
      email,
      avatarUrl,
      role: "user",
      online: true,
      lastSeen: BigInt(ctx.timestamp.microsSinceEpoch),
      createdAt: BigInt(ctx.timestamp.microsSinceEpoch),
    });
  },
);

spacetimedb.reducer(
  "update_profile",
  {
    displayName: t.string(),
    email: t.string(),
    avatarUrl: t.string(),
  },
  (ctx, { displayName, email, avatarUrl }) => {
    const user = ctx.db.user.identity.find(ctx.sender);
    if (!user) {
      throw new SenderError("User not registered");
    }
    ctx.db.user.identity.update({
      ...user,
      displayName,
      email,
      avatarUrl,
    });
  },
);

spacetimedb.reducer(
  "link_oauth",
  { provider: t.string(), providerAccountId: t.string() },
  (ctx, { provider, providerAccountId }) => {
    if (!provider || !providerAccountId) {
      throw new SenderError("Provider and account ID are required");
    }
    ctx.db.oauth_link.insert({
      id: BigInt(0),
      userIdentity: ctx.sender,
      provider,
      providerAccountId,
      createdAt: BigInt(ctx.timestamp.microsSinceEpoch),
    });
  },
);

// ─── Tool Registry Reducers ───

spacetimedb.reducer(
  "create_tool_entry",
  {
    name: t.string(),
    category: t.string(),
    description: t.string(),
    tier: t.string(),
  },
  (ctx, { name, category, description, tier }) => {
    if (!name) {
      throw new SenderError("Tool name must not be empty");
    }
    ctx.db.tool_entry.insert({
      id: BigInt(0),
      name,
      category,
      description,
      tier: tier || "free",
      enabled: true,
      createdAt: BigInt(ctx.timestamp.microsSinceEpoch),
    });
  },
);

spacetimedb.reducer(
  "update_tool_entry",
  {
    toolId: t.u64(),
    category: t.string(),
    description: t.string(),
    tier: t.string(),
    enabled: t.bool(),
  },
  (ctx, { toolId, category, description, tier, enabled }) => {
    const tool = ctx.db.tool_entry.id.find(toolId);
    if (!tool) {
      throw new SenderError("Tool not found");
    }
    ctx.db.tool_entry.id.update({
      ...tool,
      category,
      description,
      tier,
      enabled,
    });
  },
);

spacetimedb.reducer(
  "record_tool_usage",
  {
    toolName: t.string(),
    durationMs: t.u32(),
    success: t.bool(),
  },
  (ctx, { toolName, durationMs, success }) => {
    if (!toolName) {
      throw new SenderError("Tool name must not be empty");
    }
    ctx.db.tool_usage.insert({
      id: BigInt(0),
      toolName,
      userIdentity: ctx.sender,
      timestamp: BigInt(ctx.timestamp.microsSinceEpoch),
      durationMs,
      success,
    });
  },
);

spacetimedb.reducer(
  "set_user_tool_preference",
  {
    toolName: t.string(),
    enabled: t.bool(),
    customConfig: t.string(),
  },
  (ctx, { toolName, enabled, customConfig }) => {
    if (!toolName) {
      throw new SenderError("Tool name must not be empty");
    }
    ctx.db.user_tool_preference.insert({
      id: BigInt(0),
      userIdentity: ctx.sender,
      toolName,
      enabled,
      customConfig,
    });
  },
);

// ─── App Reducers ───

spacetimedb.reducer(
  "create_app",
  {
    slug: t.string(),
    name: t.string(),
    description: t.string(),
  },
  (ctx, { slug, name, description }) => {
    if (!slug || !name) {
      throw new SenderError("Slug and name are required");
    }
    const now = BigInt(ctx.timestamp.microsSinceEpoch);
    ctx.db.app.insert({
      id: BigInt(0),
      slug,
      name,
      description,
      ownerIdentity: ctx.sender,
      status: "prompting",
      r2CodeKey: "",
      createdAt: now,
      updatedAt: now,
    });
  },
);

spacetimedb.reducer(
  "update_app",
  {
    appId: t.u64(),
    name: t.string(),
    description: t.string(),
    r2CodeKey: t.string(),
  },
  (ctx, { appId, name, description, r2CodeKey }) => {
    const app = ctx.db.app.id.find(appId);
    if (!app) {
      throw new SenderError("App not found");
    }
    if (app.ownerIdentity !== ctx.sender) {
      throw new SenderError("Only the owner can update this app");
    }
    ctx.db.app.id.update({
      ...app,
      name,
      description,
      r2CodeKey,
      updatedAt: BigInt(ctx.timestamp.microsSinceEpoch),
    });
  },
);

spacetimedb.reducer(
  "update_app_status",
  { appId: t.u64(), status: t.string() },
  (ctx, { appId, status }) => {
    const app = ctx.db.app.id.find(appId);
    if (!app) {
      throw new SenderError("App not found");
    }
    if (app.ownerIdentity !== ctx.sender) {
      throw new SenderError("Only the owner can update app status");
    }
    ctx.db.app.id.update({
      ...app,
      status,
      updatedAt: BigInt(ctx.timestamp.microsSinceEpoch),
    });
  },
);

spacetimedb.reducer(
  "delete_app",
  { appId: t.u64() },
  (ctx, { appId }) => {
    const app = ctx.db.app.id.find(appId);
    if (!app) {
      throw new SenderError("App not found");
    }
    if (app.ownerIdentity !== ctx.sender) {
      throw new SenderError("Only the owner can delete this app");
    }
    ctx.db.app.id.update({
      ...app,
      status: "deleted",
      updatedAt: BigInt(ctx.timestamp.microsSinceEpoch),
    });
  },
);

spacetimedb.reducer(
  "restore_app",
  { appId: t.u64() },
  (ctx, { appId }) => {
    const app = ctx.db.app.id.find(appId);
    if (!app) {
      throw new SenderError("App not found");
    }
    if (app.ownerIdentity !== ctx.sender) {
      throw new SenderError("Only the owner can restore this app");
    }
    if (app.status !== "deleted") {
      throw new SenderError("App is not deleted");
    }
    ctx.db.app.id.update({
      ...app,
      status: "prompting",
      updatedAt: BigInt(ctx.timestamp.microsSinceEpoch),
    });
  },
);

spacetimedb.reducer(
  "create_app_version",
  {
    appId: t.u64(),
    version: t.u32(),
    codeHash: t.string(),
    changeDescription: t.string(),
  },
  (ctx, { appId, version, codeHash, changeDescription }) => {
    const app = ctx.db.app.id.find(appId);
    if (!app) {
      throw new SenderError("App not found");
    }
    ctx.db.app_version.insert({
      id: BigInt(0),
      appId,
      version,
      codeHash,
      changeDescription,
      createdBy: ctx.sender,
      createdAt: BigInt(ctx.timestamp.microsSinceEpoch),
    });
  },
);

spacetimedb.reducer(
  "send_app_message",
  {
    appId: t.u64(),
    role: t.string(),
    content: t.string(),
  },
  (ctx, { appId, role, content }) => {
    if (!content) {
      throw new SenderError("Message content must not be empty");
    }
    ctx.db.app_message.insert({
      id: BigInt(0),
      appId,
      role,
      content,
      createdAt: BigInt(ctx.timestamp.microsSinceEpoch),
    });
  },
);

// ─── Agent Reducers ───

spacetimedb.reducer(
  "register_agent",
  { displayName: t.string(), capabilities: t.array(t.string()) },
  (ctx, { displayName, capabilities }) => {
    if (!displayName) {
      throw new SenderError("Display name must not be empty");
    }
    const existing = ctx.db.agent.identity.find(ctx.sender);
    if (existing) {
      ctx.db.agent.identity.update({
        ...existing,
        displayName,
        capabilities,
        online: true,
        lastSeen: BigInt(ctx.timestamp.microsSinceEpoch),
      });
    } else {
      ctx.db.agent.insert({
        identity: ctx.sender,
        displayName,
        capabilities,
        online: true,
        lastSeen: BigInt(ctx.timestamp.microsSinceEpoch),
      });
    }
  },
);

spacetimedb.reducer("unregister_agent", {}, (ctx) => {
  const existing = ctx.db.agent.identity.find(ctx.sender);
  if (!existing) {
    throw new SenderError("Agent not registered");
  }
  ctx.db.agent.identity.update({
    ...existing,
    online: false,
    lastSeen: BigInt(ctx.timestamp.microsSinceEpoch),
  });
});

spacetimedb.reducer(
  "send_agent_message",
  { toAgent: t.identity(), content: t.string() },
  (ctx, { toAgent, content }) => {
    if (!content) {
      throw new SenderError("Message content must not be empty");
    }
    ctx.db.agent_message.insert({
      id: BigInt(0),
      fromAgent: ctx.sender,
      toAgent,
      content,
      timestamp: BigInt(ctx.timestamp.microsSinceEpoch),
      delivered: false,
    });
  },
);

spacetimedb.reducer(
  "mark_agent_message_delivered",
  { messageId: t.u64() },
  (ctx, { messageId }) => {
    const msg = ctx.db.agent_message.id.find(messageId);
    if (!msg) {
      throw new SenderError("Message not found");
    }
    if (msg.toAgent !== ctx.sender) {
      throw new SenderError("Can only mark own messages as delivered");
    }
    ctx.db.agent_message.id.update({ ...msg, delivered: true });
  },
);

// ─── Task Reducers ───

spacetimedb.reducer(
  "create_task",
  {
    description: t.string(),
    priority: t.u8(),
    context: t.string(),
  },
  (ctx, { description, priority, context: taskContext }) => {
    if (!description) {
      throw new SenderError("Task description must not be empty");
    }
    ctx.db.task.insert({
      id: BigInt(0),
      description,
      assignedTo: undefined,
      status: "pending",
      priority,
      context: taskContext,
      createdBy: ctx.sender,
      createdAt: BigInt(ctx.timestamp.microsSinceEpoch),
    });
  },
);

spacetimedb.reducer("claim_task", { taskId: t.u64() }, (ctx, { taskId }) => {
  const task = ctx.db.task.id.find(taskId);
  if (!task) {
    throw new SenderError("Task not found");
  }
  if (task.status !== "pending") {
    throw new SenderError("Task is not available for claiming");
  }
  if (task.assignedTo !== undefined) {
    throw new SenderError("Task is already assigned");
  }
  ctx.db.task.id.update({
    ...task,
    assignedTo: ctx.sender,
    status: "in_progress",
  });
});

spacetimedb.reducer(
  "complete_task",
  { taskId: t.u64() },
  (ctx, { taskId }) => {
    const task = ctx.db.task.id.find(taskId);
    if (!task) {
      throw new SenderError("Task not found");
    }
    if (task.assignedTo !== ctx.sender) {
      throw new SenderError("Can only complete tasks assigned to you");
    }
    ctx.db.task.id.update({ ...task, status: "completed" });
  },
);

// ─── Page Reducers ───

spacetimedb.reducer(
  "create_page",
  {
    slug: t.string(),
    title: t.string(),
    description: t.string(),
  },
  (ctx, { slug, title, description }) => {
    if (!slug || !title) {
      throw new SenderError("Slug and title are required");
    }
    const now = BigInt(ctx.timestamp.microsSinceEpoch);
    ctx.db.page.insert({
      id: BigInt(0),
      slug,
      title,
      description,
      published: false,
      createdAt: now,
      updatedAt: now,
    });
  },
);

spacetimedb.reducer(
  "update_page",
  {
    pageId: t.u64(),
    title: t.string(),
    description: t.string(),
    published: t.bool(),
  },
  (ctx, { pageId, title, description, published }) => {
    const page = ctx.db.page.id.find(pageId);
    if (!page) {
      throw new SenderError("Page not found");
    }
    ctx.db.page.id.update({
      ...page,
      title,
      description,
      published,
      updatedAt: BigInt(ctx.timestamp.microsSinceEpoch),
    });
  },
);

spacetimedb.reducer(
  "delete_page",
  { pageId: t.u64() },
  (ctx, { pageId }) => {
    const page = ctx.db.page.id.find(pageId);
    if (!page) {
      throw new SenderError("Page not found");
    }
    ctx.db.page.id.delete(pageId);
  },
);

spacetimedb.reducer(
  "create_page_block",
  {
    pageId: t.u64(),
    blockType: t.string(),
    contentJson: t.string(),
    sortOrder: t.u32(),
  },
  (ctx, { pageId, blockType, contentJson, sortOrder }) => {
    const page = ctx.db.page.id.find(pageId);
    if (!page) {
      throw new SenderError("Page not found");
    }
    ctx.db.page_block.insert({
      id: BigInt(0),
      pageId,
      blockType,
      contentJson,
      sortOrder,
    });
  },
);

spacetimedb.reducer(
  "update_page_block",
  {
    blockId: t.u64(),
    blockType: t.string(),
    contentJson: t.string(),
    sortOrder: t.u32(),
  },
  (ctx, { blockId, blockType, contentJson, sortOrder }) => {
    const block = ctx.db.page_block.id.find(blockId);
    if (!block) {
      throw new SenderError("Page block not found");
    }
    ctx.db.page_block.id.update({
      ...block,
      blockType,
      contentJson,
      sortOrder,
    });
  },
);

spacetimedb.reducer(
  "delete_page_block",
  { blockId: t.u64() },
  (ctx, { blockId }) => {
    const block = ctx.db.page_block.id.find(blockId);
    if (!block) {
      throw new SenderError("Page block not found");
    }
    ctx.db.page_block.id.delete(blockId);
  },
);

spacetimedb.reducer(
  "reorder_page_blocks",
  {
    blockIds: t.array(t.u64()),
  },
  (ctx, { blockIds }) => {
    for (let i = 0; i < blockIds.length; i++) {
      const block = ctx.db.page_block.id.find(blockIds[i]);
      if (!block) {
        throw new SenderError(`Page block ${blockIds[i]} not found`);
      }
      ctx.db.page_block.id.update({ ...block, sortOrder: i });
    }
  },
);

// ─── Direct Message Reducers ───

spacetimedb.reducer(
  "send_dm",
  { toIdentity: t.identity(), content: t.string() },
  (ctx, { toIdentity, content }) => {
    if (!content) {
      throw new SenderError("Message content must not be empty");
    }
    ctx.db.direct_message.insert({
      id: BigInt(0),
      fromIdentity: ctx.sender,
      toIdentity,
      content,
      readStatus: false,
      createdAt: BigInt(ctx.timestamp.microsSinceEpoch),
    });
  },
);

spacetimedb.reducer(
  "mark_dm_read",
  { messageId: t.u64() },
  (ctx, { messageId }) => {
    const dm = ctx.db.direct_message.id.find(messageId);
    if (!dm) {
      throw new SenderError("Message not found");
    }
    if (dm.toIdentity !== ctx.sender) {
      throw new SenderError("Can only mark own messages as read");
    }
    ctx.db.direct_message.id.update({ ...dm, readStatus: true });
  },
);

// ─── Monitoring Reducers ───

spacetimedb.reducer(
  "record_platform_event",
  {
    source: t.string(),
    eventType: t.string(),
    metadataJson: t.string(),
  },
  (ctx, { source, eventType, metadataJson }) => {
    if (!source || !eventType) {
      throw new SenderError("Source and event type are required");
    }
    ctx.db.platform_event.insert({
      id: BigInt(0),
      source,
      eventType,
      metadataJson,
      userIdentity: ctx.sender,
      timestamp: BigInt(ctx.timestamp.microsSinceEpoch),
    });
  },
);

spacetimedb.reducer(
  "record_health_check",
  {
    service: t.string(),
    status: t.string(),
    latencyMs: t.u32(),
  },
  (ctx, { service, status, latencyMs }) => {
    if (!service) {
      throw new SenderError("Service name must not be empty");
    }
    ctx.db.health_check.insert({
      id: BigInt(0),
      service,
      status,
      latencyMs,
      checkedAt: BigInt(ctx.timestamp.microsSinceEpoch),
    });
  },
);

export default spacetimedb;
