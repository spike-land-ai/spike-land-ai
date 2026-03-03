/**
 * Redis client for Claude Code Agent real-time status tracking
 *
 * Uses Upstash Redis for:
 * - Agent status with TTL (online/sleeping/offline detection)
 * - Activity logs (recent actions)
 * - Tool usage statistics
 * - Task queues for sending tasks to agents
 * - SSE event broadcasting
 */

import { redis } from "@/lib/upstash/client";
import { logger } from "@/lib/logger";

// Key prefixes for organization
const AGENT_KEYS = {
  /** Agent metadata (JSON) - TTL: none, persisted */
  AGENT_DATA: (agentId: string) => `agent:${agentId}:data`,
  /** Agent status flag - TTL: 90s (heartbeat refreshes this) */
  AGENT_STATUS: (agentId: string) => `agent:${agentId}:status`,
  /** Activity log list - TTL: 24h, max 100 entries */
  AGENT_ACTIVITY: (agentId: string) => `agent:${agentId}:activity`,
  /** Tool usage hash (tool name -> count) */
  AGENT_TOOL_STATS: (agentId: string) => `agent:${agentId}:tools`,
  /** Set of agent IDs for a user */
  USER_AGENTS: (userId: string) => `user:${userId}:agents`,
  /** Task queue for sending tasks to agent */
  AGENT_TASK_QUEUE: (agentId: string) => `agent:${agentId}:tasks`,
  /** SSE event channel for real-time updates */
  SSE_AGENT_EVENTS: (userId: string) => `sse:agents:${userId}:events`,
} as const;

// Status values
export type AgentStatus = "online" | "sleeping" | "offline";

// Activity log entry
export interface AgentActivity {
  type: string;
  description: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

// Agent data stored in Redis
export interface AgentRedisData {
  agentId: string;
  userId: string;
  machineId: string;
  sessionId: string;
  displayName: string;
  projectPath?: string;
  workingDirectory?: string;
  connectedAt: number;
  lastHeartbeat: number;
}

// Task sent to an agent
export interface AgentTask {
  id: string;
  prompt: string;
  createdAt: number;
  status: "pending" | "acknowledged" | "completed" | "failed";
  result?: string;
  error?: string;
}

// SSE event for agent updates
export interface AgentSSEEvent {
  type:
    | "agent_connected"
    | "agent_disconnected"
    | "agent_status_changed"
    | "agent_activity"
    | "task_update";
  agentId: string;
  data: unknown;
  timestamp: number;
}

// TTL constants (in seconds)
const STATUS_TTL = 90; // 90 seconds - agent is offline if no heartbeat
const AGENT_DATA_TTL = 30 * 24 * 60 * 60; // 30 days - cleaned up by removeAgent, but expire prevents orphans
const ACTIVITY_TTL = 24 * 60 * 60; // 24 hours
const TOOL_STATS_TTL = 7 * 24 * 60 * 60; // 7 days - rolling stats window
const MAX_ACTIVITY_ENTRIES = 100;
const SSE_EVENT_TTL = 60; // 1 minute
const TASK_TTL = 24 * 60 * 60; // 24 hours

/**
 * Register a new agent connection
 */
export async function registerAgent(data: AgentRedisData): Promise<void> {
  const { agentId, userId } = data;

  await Promise.all([
    // Store agent data with TTL to prevent orphaned keys
    redis.set(AGENT_KEYS.AGENT_DATA(agentId), JSON.stringify(data), { ex: AGENT_DATA_TTL }),
    // Set initial status as online
    redis.set(AGENT_KEYS.AGENT_STATUS(agentId), "online", { ex: STATUS_TTL }),
    // Add to user's agent set
    redis.sadd(AGENT_KEYS.USER_AGENTS(userId), agentId),
    // Log connection activity
    logAgentActivity(agentId, {
      type: "connected",
      description: "Agent connected",
      timestamp: Date.now(),
      metadata: { projectPath: data.projectPath },
    }),
    // Publish SSE event
    publishAgentEvent(userId, {
      type: "agent_connected",
      agentId,
      data,
      timestamp: Date.now(),
    }),
  ]);
}

/**
 * Process agent heartbeat - refresh status TTL
 */
export async function processHeartbeat(
  agentId: string,
  status: "online" | "sleeping" = "online",
  updates?: {
    projectPath?: string;
    workingDirectory?: string;
    toolUsage?: Record<string, number>;
    tokensUsed?: number;
    activity?: AgentActivity;
  },
): Promise<void> {
  const promises: Promise<unknown>[] = [
    // Refresh status TTL
    redis.set(AGENT_KEYS.AGENT_STATUS(agentId), status, { ex: STATUS_TTL }),
  ];

  // Update agent data if needed
  if (updates?.projectPath || updates?.workingDirectory) {
    const existingData = await redis.get<string>(
      AGENT_KEYS.AGENT_DATA(agentId),
    );
    if (existingData) {
      const data = JSON.parse(existingData) as AgentRedisData;
      if (updates.projectPath) data.projectPath = updates.projectPath;
      if (updates.workingDirectory) {
        data.workingDirectory = updates.workingDirectory;
      }
      data.lastHeartbeat = Date.now();
      promises.push(
        redis.set(AGENT_KEYS.AGENT_DATA(agentId), JSON.stringify(data), { ex: AGENT_DATA_TTL }),
      );
    }
  }

  // Update tool usage stats with TTL refresh to prevent orphaned hash keys
  if (updates?.toolUsage) {
    for (const [tool, count] of Object.entries(updates.toolUsage)) {
      promises.push(
        redis.hincrby(AGENT_KEYS.AGENT_TOOL_STATS(agentId), tool, count),
      );
    }
    promises.push(
      redis.expire(AGENT_KEYS.AGENT_TOOL_STATS(agentId), TOOL_STATS_TTL),
    );
  }

  // Log activity if provided
  if (updates?.activity) {
    promises.push(logAgentActivity(agentId, updates.activity));
  }

  await Promise.all(promises);
}

/**
 * Log agent activity
 */
export async function logAgentActivity(
  agentId: string,
  activity: AgentActivity,
): Promise<void> {
  const key = AGENT_KEYS.AGENT_ACTIVITY(agentId);
  await Promise.all([
    redis.lpush(key, JSON.stringify(activity)),
    redis.ltrim(key, 0, MAX_ACTIVITY_ENTRIES - 1),
    redis.expire(key, ACTIVITY_TTL),
  ]);
}

/**
 * Get agent activity log
 */
export async function getAgentActivity(
  agentId: string,
  limit = 50,
): Promise<AgentActivity[]> {
  const items = await redis.lrange<string>(
    AGENT_KEYS.AGENT_ACTIVITY(agentId),
    0,
    limit - 1,
  );
  return items.map(item => JSON.parse(item) as AgentActivity);
}

/**
 * Get agent status
 */
export async function getAgentStatus(agentId: string): Promise<AgentStatus> {
  const status = await redis.get<AgentStatus>(AGENT_KEYS.AGENT_STATUS(agentId));
  return status || "offline";
}

/**
 * Get agent data
 */
export async function getAgentData(
  agentId: string,
): Promise<AgentRedisData | null> {
  const data = await redis.get<string>(AGENT_KEYS.AGENT_DATA(agentId));
  return data ? (JSON.parse(data) as AgentRedisData) : null;
}

/**
 * Get all agents for a user with their status
 */
export async function getUserAgents(
  userId: string,
): Promise<Array<AgentRedisData & { status: AgentStatus; }>> {
  const agentIds = await redis.smembers(AGENT_KEYS.USER_AGENTS(userId));

  if (agentIds.length === 0) return [];

  const results = await Promise.all(
    agentIds.map(async agentId => {
      const [data, status] = await Promise.all([
        getAgentData(agentId),
        getAgentStatus(agentId),
      ]);
      return data ? { ...data, status } : null;
    }),
  );

  return results.filter(Boolean) as Array<
    AgentRedisData & { status: AgentStatus; }
  >;
}

/**
 * Get tool usage statistics for an agent
 */
export async function getAgentToolStats(
  agentId: string,
): Promise<Record<string, number>> {
  const stats = await redis.hgetall<Record<string, string>>(
    AGENT_KEYS.AGENT_TOOL_STATS(agentId),
  );
  if (!stats) return {};

  const result: Record<string, number> = {};
  for (const [tool, count] of Object.entries(stats)) {
    result[tool] = parseInt(count, 10);
  }
  return result;
}

/**
 * Disconnect an agent (mark as offline)
 */
export async function disconnectAgent(
  agentId: string,
  userId: string,
): Promise<void> {
  await Promise.all([
    // Remove status key (will show as offline)
    redis.del(AGENT_KEYS.AGENT_STATUS(agentId)),
    // Log disconnect activity
    logAgentActivity(agentId, {
      type: "disconnected",
      description: "Agent disconnected",
      timestamp: Date.now(),
    }),
    // Publish SSE event
    publishAgentEvent(userId, {
      type: "agent_disconnected",
      agentId,
      data: null,
      timestamp: Date.now(),
    }),
  ]);
}

/**
 * Permanently remove an agent
 */
export async function removeAgent(
  agentId: string,
  userId: string,
): Promise<void> {
  await Promise.all([
    redis.del(AGENT_KEYS.AGENT_DATA(agentId)),
    redis.del(AGENT_KEYS.AGENT_STATUS(agentId)),
    redis.del(AGENT_KEYS.AGENT_ACTIVITY(agentId)),
    redis.del(AGENT_KEYS.AGENT_TOOL_STATS(agentId)),
    redis.del(AGENT_KEYS.AGENT_TASK_QUEUE(agentId)),
    redis.srem(AGENT_KEYS.USER_AGENTS(userId), agentId),
  ]);
}

/**
 * Send a task to an agent
 */
export async function sendTaskToAgent(
  agentId: string,
  task: Omit<AgentTask, "status">,
): Promise<void> {
  const fullTask: AgentTask = { ...task, status: "pending" };
  const key = AGENT_KEYS.AGENT_TASK_QUEUE(agentId);

  await Promise.all([
    redis.lpush(key, JSON.stringify(fullTask)),
    redis.expire(key, TASK_TTL),
  ]);
}

/**
 * Get pending tasks for an agent (called by agent during heartbeat)
 */
export async function getPendingTasks(agentId: string): Promise<AgentTask[]> {
  const items = await redis.lrange<string>(
    AGENT_KEYS.AGENT_TASK_QUEUE(agentId),
    0,
    -1,
  );
  return items
    .map(item => JSON.parse(item) as AgentTask)
    .filter(task => task.status === "pending");
}

/**
 * Pop a task from the queue (agent acknowledges it)
 */
export async function popTask(agentId: string): Promise<AgentTask | null> {
  const item = await redis.rpop<string>(AGENT_KEYS.AGENT_TASK_QUEUE(agentId));
  return item ? (JSON.parse(item) as AgentTask) : null;
}

/**
 * Publish SSE event for agent updates
 */
export async function publishAgentEvent(
  userId: string,
  event: AgentSSEEvent,
): Promise<void> {
  const channel = `sse:agents:${userId}`;
  const key = AGENT_KEYS.SSE_AGENT_EVENTS(userId);
  const payload = JSON.stringify(event);

  await Promise.all([
    // Publish to Pub/Sub for real-time delivery
    redis.publish(channel, payload).catch(err => {
      logger.error(`[Agent SSE] Failed to publish to channel ${channel}:`, err);
    }),
    // Store in List for reliable delivery
    (async () => {
      await redis.lpush(key, payload);
      await redis.expire(key, SSE_EVENT_TTL);
      await redis.ltrim(key, 0, 49); // Keep last 50 events
    })().catch(err => {
      logger.error("[Agent SSE] Failed to store event in list:", err);
    }),
  ]);
}

/**
 * Get SSE events for a user (for polling fallback)
 * Uses a Lua script to filter server-side, reducing bandwidth for frequent polling.
 */
export async function getAgentSSEEvents(
  userId: string,
  afterTimestamp: number,
): Promise<AgentSSEEvent[]> {
  const key = AGENT_KEYS.SSE_AGENT_EVENTS(userId);

  const script = `
    local items = redis.call("LRANGE", KEYS[1], 0, -1)
    local matches = {}
    local min_ts = tonumber(ARGV[1])
    for i, item in ipairs(items) do
      local status, decoded = pcall(cjson.decode, item)
      if status and decoded and decoded.timestamp > min_ts then
        table.insert(matches, item)
      end
    end
    return matches
  `;

  try {
    const events = (await redis.eval(script, [key], [afterTimestamp])) as string[];
    return events
      .map(e => JSON.parse(e) as AgentSSEEvent)
      .reverse(); // Oldest first
  } catch {
    // Fallback to client-side filtering if Lua script fails
    const events = await redis.lrange<string>(key, 0, -1);
    return events
      .map(e => JSON.parse(e) as AgentSSEEvent)
      .filter(e => e.timestamp > afterTimestamp)
      .reverse();
  }
}

/**
 * Check if Redis is configured and available
 */
export async function isRedisAvailable(): Promise<boolean> {
  try {
    await redis.ping();
    return true;
  } catch {
    return false;
  }
}
