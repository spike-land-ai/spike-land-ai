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

const RegisteredTool = table(
  { name: "registered_tool", public: true },
  {
    id: t.u64().autoInc().primaryKey(),
    name: t.string().index("btree"),
    description: t.string(),
    inputSchema: t.string(),
    providerIdentity: t.identity().index("btree"),
    category: t.string(),
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

const McpTask = table(
  { name: "mcp_task", public: true },
  {
    id: t.u64().autoInc().primaryKey(),
    toolName: t.string(),
    argumentsJson: t.string(),
    requesterIdentity: t.identity(),
    providerIdentity: t.option(t.identity()),
    status: t.string(), // "pending", "claimed", "completed", "failed"
    resultJson: t.option(t.string()),
    error: t.option(t.string()),
    createdAt: t.u64(),
    completedAt: t.option(t.u64()),
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


const CodeSession = table(
  { name: "code_session", public: true },
  {
    codeSpace: t.string().primaryKey(),
    code: t.string(),
    html: t.string(),
    css: t.string(),
    transpiled: t.string(),
    messagesJson: t.string(),
    lastUpdatedBy: t.identity(),
    updatedAt: t.u64(),
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

const spacetimedb = schema({
  user: User,
  oauth_link: OAuthLink,
  registered_tool: RegisteredTool,
  tool_usage: ToolUsage,
  user_tool_preference: UserToolPreference,
  app: App,
  app_version: AppVersion,
  app_message: AppMessage,
  agent: Agent,
  agent_message: AgentMessage,
  mcp_task: McpTask,
  page: Page,
  page_block: PageBlock,
  code_session: CodeSession,
  direct_message: DirectMessage,
  platform_event: PlatformEvent,
  health_check: HealthCheck,
});

// ─── Lifecycle ───

export const init = spacetimedb.init((_ctx) => {});

export const onConnect = spacetimedb.clientConnected((ctx) => {
  const existing = ctx.db.user.identity.find(ctx.sender);
  if (existing) {
    ctx.db.user.identity.update({
      ...existing,
      online: true,
      lastSeen: BigInt(ctx.timestamp.microsSinceUnixEpoch),
    });
  }
});

export const onDisconnect = spacetimedb.clientDisconnected((ctx) => {
  const existingUser = ctx.db.user.identity.find(ctx.sender);
  if (existingUser) {
    ctx.db.user.identity.update({
      ...existingUser,
      online: false,
      lastSeen: BigInt(ctx.timestamp.microsSinceUnixEpoch),
    });
  }
  const existingAgent = ctx.db.agent.identity.find(ctx.sender);
  if (existingAgent) {
    ctx.db.agent.identity.update({
      ...existingAgent,
      online: false,
      lastSeen: BigInt(ctx.timestamp.microsSinceUnixEpoch),
    });
  }
  // Remove registered tools from this disconnected leaf server
  for (const tool of ctx.db.registered_tool.providerIdentity.filter(ctx.sender)) {
    ctx.db.registered_tool.id.delete(tool.id);
  }
});

// ─── User Reducers ───

export const register_user = spacetimedb.reducer(
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
      lastSeen: BigInt(ctx.timestamp.microsSinceUnixEpoch),
      createdAt: BigInt(ctx.timestamp.microsSinceUnixEpoch),
    });
  },
);

export const update_profile = spacetimedb.reducer(
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

export const link_oauth = spacetimedb.reducer(
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
      createdAt: BigInt(ctx.timestamp.microsSinceUnixEpoch),
    });
  },
);

// ─── MCP Tool Swarm Reducers ───

export const register_tool = spacetimedb.reducer(
  {
    name: t.string(),
    description: t.string(),
    inputSchema: t.string(),
    category: t.string(),
  },
  (ctx, { name, description, inputSchema, category }) => {
    if (!name) {
      throw new SenderError("Tool name must not be empty");
    }
    // Remove if already exists for this provider
    for (const tool of ctx.db.registered_tool.providerIdentity.filter(ctx.sender)) {
      if (tool.name === name) {
        ctx.db.registered_tool.id.delete(tool.id);
      }
    }
    ctx.db.registered_tool.insert({
      id: BigInt(0),
      name,
      description,
      inputSchema,
      providerIdentity: ctx.sender,
      category,
      createdAt: BigInt(ctx.timestamp.microsSinceUnixEpoch),
    });
  },
);

export const unregister_tool = spacetimedb.reducer(
  { name: t.string() },
  (ctx, { name }) => {
    for (const tool of ctx.db.registered_tool.providerIdentity.filter(ctx.sender)) {
      if (tool.name === name) {
        ctx.db.registered_tool.id.delete(tool.id);
      }
    }
  }
);

export const invoke_tool_request = spacetimedb.reducer(
  {
    toolName: t.string(),
    argumentsJson: t.string(),
  },
  (ctx, { toolName, argumentsJson }) => {
    if (!toolName) {
      throw new SenderError("Tool name must not be empty");
    }
    // Auth & Capability Check could go here!
    // For now, any agent can request
    ctx.db.mcp_task.insert({
      id: BigInt(0),
      toolName,
      argumentsJson,
      requesterIdentity: ctx.sender,
      providerIdentity: undefined,
      status: "pending",
      resultJson: undefined,
      error: undefined,
      createdAt: BigInt(ctx.timestamp.microsSinceUnixEpoch),
      completedAt: undefined,
    });
  }
);

export const claim_mcp_task = spacetimedb.reducer(
  { taskId: t.u64() },
  (ctx, { taskId }) => {
    const task = ctx.db.mcp_task.id.find(taskId);
    if (!task) {
      throw new SenderError("Task not found");
    }
    if (task.status !== "pending") {
      throw new SenderError("Task is not available for claiming");
    }
    
    ctx.db.mcp_task.id.update({
      ...task,
      providerIdentity: ctx.sender,
      status: "claimed",
    });
  }
);

export const complete_mcp_task = spacetimedb.reducer(
  {
    taskId: t.u64(),
    resultJson: t.option(t.string()),
    error: t.option(t.string()),
  },
  (ctx, { taskId, resultJson, error }) => {
    const task = ctx.db.mcp_task.id.find(taskId);
    if (!task) {
      throw new SenderError("Task not found");
    }
    if (task.providerIdentity !== ctx.sender) {
      throw new SenderError("Only the claiming provider can complete this task");
    }
    
    ctx.db.mcp_task.id.update({
      ...task,
      status: error ? "failed" : "completed",
      resultJson,
      error,
      completedAt: BigInt(ctx.timestamp.microsSinceUnixEpoch),
    });
  }
);

// ─── App Reducers ───

export const create_app = spacetimedb.reducer(
  {
    slug: t.string(),
    name: t.string(),
    description: t.string(),
  },
  (ctx, { slug, name, description }) => {
    if (!slug || !name) {
      throw new SenderError("Slug and name are required");
    }
    const now = BigInt(ctx.timestamp.microsSinceUnixEpoch);
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

export const update_app = spacetimedb.reducer(
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
      updatedAt: BigInt(ctx.timestamp.microsSinceUnixEpoch),
    });
  },
);

export const update_app_status = spacetimedb.reducer(
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
      updatedAt: BigInt(ctx.timestamp.microsSinceUnixEpoch),
    });
  },
);

export const delete_app = spacetimedb.reducer(
  { appId: t.u64() }, (ctx, { appId }) => {
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
    updatedAt: BigInt(ctx.timestamp.microsSinceUnixEpoch),
  });
});

export const restore_app = spacetimedb.reducer(
  { appId: t.u64() }, (ctx, { appId }) => {
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
    updatedAt: BigInt(ctx.timestamp.microsSinceUnixEpoch),
  });
});

export const create_app_version = spacetimedb.reducer(
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
      createdAt: BigInt(ctx.timestamp.microsSinceUnixEpoch),
    });
  },
);

export const send_app_message = spacetimedb.reducer(
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
      createdAt: BigInt(ctx.timestamp.microsSinceUnixEpoch),
    });
  },
);

// ─── Agent Reducers ───

export const register_agent = spacetimedb.reducer(
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
        lastSeen: BigInt(ctx.timestamp.microsSinceUnixEpoch),
      });
    } else {
      ctx.db.agent.insert({
        identity: ctx.sender,
        displayName,
        capabilities,
        online: true,
        lastSeen: BigInt(ctx.timestamp.microsSinceUnixEpoch),
      });
    }
  },
);

export const unregister_agent = spacetimedb.reducer(
  {}, (ctx) => {
  const existing = ctx.db.agent.identity.find(ctx.sender);
  if (!existing) {
    throw new SenderError("Agent not registered");
  }
  ctx.db.agent.identity.update({
    ...existing,
    online: false,
    lastSeen: BigInt(ctx.timestamp.microsSinceUnixEpoch),
  });
});

export const send_agent_message = spacetimedb.reducer(
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
      timestamp: BigInt(ctx.timestamp.microsSinceUnixEpoch),
      delivered: false,
    });
  },
);

export const mark_agent_message_delivered = spacetimedb.reducer(
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

// ─── Page Reducers ───

export const create_page = spacetimedb.reducer(
  {
    slug: t.string(),
    title: t.string(),
    description: t.string(),
  },
  (ctx, { slug, title, description }) => {
    if (!slug || !title) {
      throw new SenderError("Slug and title are required");
    }
    const now = BigInt(ctx.timestamp.microsSinceUnixEpoch);
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

export const update_page = spacetimedb.reducer(
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
      updatedAt: BigInt(ctx.timestamp.microsSinceUnixEpoch),
    });
  },
);

export const delete_page = spacetimedb.reducer(
  { pageId: t.u64() }, (ctx, { pageId }) => {
  const page = ctx.db.page.id.find(pageId);
  if (!page) {
    throw new SenderError("Page not found");
  }
  ctx.db.page.id.delete(pageId);
});

export const create_page_block = spacetimedb.reducer(
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

export const update_page_block = spacetimedb.reducer(
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

export const delete_page_block = spacetimedb.reducer(
  { blockId: t.u64() }, (ctx, { blockId }) => {
  const block = ctx.db.page_block.id.find(blockId);
  if (!block) {
    throw new SenderError("Page block not found");
  }
  ctx.db.page_block.id.delete(blockId);
});

export const reorder_page_blocks = spacetimedb.reducer(
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

export const send_dm = spacetimedb.reducer(
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
      createdAt: BigInt(ctx.timestamp.microsSinceUnixEpoch),
    });
  },
);

export const mark_dm_read = spacetimedb.reducer(
  { messageId: t.u64() }, (ctx, { messageId }) => {
  const dm = ctx.db.direct_message.id.find(messageId);
  if (!dm) {
    throw new SenderError("Message not found");
  }
  if (dm.toIdentity !== ctx.sender) {
    throw new SenderError("Can only mark own messages as read");
  }
  ctx.db.direct_message.id.update({ ...dm, readStatus: true });
});

// ─── Monitoring Reducers ───

export const record_platform_event = spacetimedb.reducer(
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
      timestamp: BigInt(ctx.timestamp.microsSinceUnixEpoch),
    });
  },
);

export const record_health_check = spacetimedb.reducer(
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
      checkedAt: BigInt(ctx.timestamp.microsSinceUnixEpoch),
    });
  },
);

export default spacetimedb;


// ─── Code Session Reducers ───

export const update_code_session = spacetimedb.reducer(
  {
    codeSpace: t.string(),
    code: t.string(),
    html: t.string(),
    css: t.string(),
    transpiled: t.string(),
    messagesJson: t.string(),
  },
  (ctx, { codeSpace, code, html, css, transpiled, messagesJson }) => {
    if (!codeSpace) {
      throw new SenderError("CodeSpace is required");
    }
    const now = BigInt(ctx.timestamp.microsSinceUnixEpoch);
    const existing = ctx.db.code_session.codeSpace.find(codeSpace);
    
    if (existing) {
      ctx.db.code_session.codeSpace.update({
        ...existing,
        code,
        html,
        css,
        transpiled,
        messagesJson,
        lastUpdatedBy: ctx.sender,
        updatedAt: now,
      });
    } else {
      ctx.db.code_session.insert({
        codeSpace,
        code,
        html,
        css,
        transpiled,
        messagesJson,
        lastUpdatedBy: ctx.sender,
        updatedAt: now,
      });
    }
  },
);
