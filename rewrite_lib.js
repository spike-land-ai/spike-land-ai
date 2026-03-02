const fs = require('fs');

let content = fs.readFileSync('packages/spacetimedb-platform/module/src/lib.ts', 'utf8');

// 1. Replace ToolEntry and ToolUsage tables
content = content.replace(
  `const ToolEntry = table(
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
);`,
  `const RegisteredTool = table(
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
);`
);

// 2. Replace Task
content = content.replace(
  `const Task = table(
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
);`,
  `const McpTask = table(
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
);`
);

// 3. Update schema
content = content.replace(
  `  ToolEntry,`,
  `  RegisteredTool,`
);

content = content.replace(
  `  Task,`,
  `  McpTask,`
);

// 4. Update clientDisconnected
content = content.replace(
  `spacetimedb.clientDisconnected((ctx) => {
  const existing = ctx.db.user.identity.find(ctx.sender);
  if (existing) {
    ctx.db.user.identity.update({
      ...existing,
      online: false,
      lastSeen: BigInt(ctx.timestamp.microsSinceEpoch),
    });
  }
});`,
  `spacetimedb.clientDisconnected((ctx) => {
  const existingUser = ctx.db.user.identity.find(ctx.sender);
  if (existingUser) {
    ctx.db.user.identity.update({
      ...existingUser,
      online: false,
      lastSeen: BigInt(ctx.timestamp.microsSinceEpoch),
    });
  }
  const existingAgent = ctx.db.agent.identity.find(ctx.sender);
  if (existingAgent) {
    ctx.db.agent.identity.update({
      ...existingAgent,
      online: false,
      lastSeen: BigInt(ctx.timestamp.microsSinceEpoch),
    });
  }
  // Remove registered tools from this disconnected leaf server
  for (const tool of ctx.db.registered_tool.providerIdentity.filter(ctx.sender)) {
    ctx.db.registered_tool.id.delete(tool.id);
  }
});`
);

// 5. Replace Tool Registry Reducers
content = content.replace(
  /\/\/ ─── Tool Registry Reducers ───[\s\S]*?(?=\/\/ ─── App Reducers ───)/,
  `// ─── MCP Tool Swarm Reducers ───

spacetimedb.reducer(
  "register_tool",
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
      createdAt: BigInt(ctx.timestamp.microsSinceEpoch),
    });
  },
);

spacetimedb.reducer(
  "unregister_tool",
  { name: t.string() },
  (ctx, { name }) => {
    for (const tool of ctx.db.registered_tool.providerIdentity.filter(ctx.sender)) {
      if (tool.name === name) {
        ctx.db.registered_tool.id.delete(tool.id);
      }
    }
  }
);

spacetimedb.reducer(
  "invoke_tool_request",
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
      createdAt: BigInt(ctx.timestamp.microsSinceEpoch),
      completedAt: undefined,
    });
  }
);

spacetimedb.reducer(
  "claim_mcp_task",
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

spacetimedb.reducer(
  "complete_mcp_task",
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
      completedAt: BigInt(ctx.timestamp.microsSinceEpoch),
    });
  }
);

`
);

// 6. Delete old Task reducers
content = content.replace(
  /\/\/ ─── Task Reducers ───[\s\S]*?(?=\/\/ ─── Page Reducers ───)/,
  ``
);

fs.writeFileSync('packages/spacetimedb-platform/module/src/lib.ts', content);
console.log('Done!');
