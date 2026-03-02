/**
 * SpacetimeDB Agent Coordination Module
 *
 * Defines tables and reducers for real-time agent state,
 * point-to-point messaging, and task coordination.
 *
 * Deploy: spacetime publish --server maincloud agent-coordination
 */

import { schema, t, table, SenderError } from "spacetimedb/server";

// ─── Tables ───

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

const spacetimedb = schema(Agent, AgentMessage, Task);

// ─── Lifecycle ───

spacetimedb.init((_ctx) => {});

spacetimedb.clientConnected((ctx) => {
  const existing = ctx.db.agent.identity.find(ctx.sender);
  if (existing) {
    ctx.db.agent.identity.update({
      ...existing,
      online: true,
      lastSeen: BigInt(ctx.timestamp.microsSinceEpoch),
    });
  }
});

spacetimedb.clientDisconnected((ctx) => {
  const existing = ctx.db.agent.identity.find(ctx.sender);
  if (existing) {
    ctx.db.agent.identity.update({
      ...existing,
      online: false,
      lastSeen: BigInt(ctx.timestamp.microsSinceEpoch),
    });
  }
});

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

// ─── Message Reducers ───

spacetimedb.reducer(
  "send_message",
  { toAgent: t.identity(), content: t.string() },
  (ctx, { toAgent, content }) => {
    if (!content) {
      throw new SenderError("Message content must not be empty");
    }
    ctx.db.agent_message.insert({
      id: BigInt(0), // auto-inc
      fromAgent: ctx.sender,
      toAgent,
      content,
      timestamp: BigInt(ctx.timestamp.microsSinceEpoch),
      delivered: false,
    });
  },
);

spacetimedb.reducer("mark_delivered", { messageId: t.u64() }, (ctx, { messageId }) => {
  const msg = ctx.db.agent_message.id.find(messageId);
  if (!msg) {
    throw new SenderError("Message not found");
  }
  if (msg.toAgent !== ctx.sender) {
    throw new SenderError("Can only mark own messages as delivered");
  }
  ctx.db.agent_message.id.update({ ...msg, delivered: true });
});

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
      id: BigInt(0), // auto-inc
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

spacetimedb.reducer("complete_task", { taskId: t.u64() }, (ctx, { taskId }) => {
  const task = ctx.db.task.id.find(taskId);
  if (!task) {
    throw new SenderError("Task not found");
  }
  if (task.assignedTo !== ctx.sender) {
    throw new SenderError("Can only complete tasks assigned to you");
  }
  ctx.db.task.id.update({ ...task, status: "completed" });
});

export default spacetimedb;
