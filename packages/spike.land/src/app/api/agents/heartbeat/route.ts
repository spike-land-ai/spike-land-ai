/**
 * Agent Heartbeat API
 *
 * POST /api/agents/heartbeat
 * Called periodically (every 30s) by agents to maintain online status
 * and report activity/metrics.
 */

import { auth } from "@/lib/auth";
import {
  getAgentData,
  getPendingTasks,
  processHeartbeat,
} from "@/lib/agents/redis-client";
import prisma from "@/lib/prisma";
import { tryCatch } from "@/lib/try-catch";
import {
  type AgentHeartbeatResponse,
  generateAgentId,
  validateAgentHeartbeat,
} from "@/lib/validations/agent";
import { type NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  // Authenticate the request
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
  }

  const userId = session.user.id;

  // Parse and validate request body
  const { data: body, error: jsonError } = await tryCatch(req.json());
  if (jsonError) {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const validation = validateAgentHeartbeat(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error },
      { status: 400 },
    );
  }

  const {
    machineId,
    sessionId,
    status,
    currentProject,
    workingDirectory,
    toolUsage,
    tokensUsed,
    activity,
  } = validation.data;

  // Generate agent ID
  const agentId = generateAgentId(machineId, sessionId);

  // Verify agent exists and belongs to user
  const { data: agentData, error: redisError } = await tryCatch(
    getAgentData(agentId),
  );

  if (redisError) {
    logger.error("Failed to get agent data from Redis:", redisError);
  }

  // If not in Redis, check database
  if (!agentData) {
    const { data: dbAgent, error: dbError } = await tryCatch(
      prisma.claudeCodeAgent.findUnique({
        where: { id: agentId },
        select: { userId: true },
      }),
    );

    if (dbError) {
      logger.error("Failed to verify agent in database:", dbError);
      return NextResponse.json(
        { error: "Failed to verify agent" },
        { status: 500 },
      );
    }

    if (!dbAgent) {
      return NextResponse.json(
        { error: "Agent not found. Please call /api/agents/connect first." },
        { status: 404 },
      );
    }

    if (dbAgent.userId !== userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 },
      );
    }
  } else if (agentData.userId !== userId) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 403 },
    );
  }

  // Process heartbeat in Redis
  const { error: heartbeatError } = await tryCatch(
    processHeartbeat(agentId, status, {
      ...(currentProject !== undefined ? { projectPath: currentProject } : {}),
      ...(workingDirectory !== undefined ? { workingDirectory } : {}),
      ...(toolUsage !== undefined ? { toolUsage } : {}),
      ...(tokensUsed !== undefined ? { tokensUsed } : {}),
      ...(activity
        ? {
          activity: {
            type: activity.type,
            description: activity.description,
            timestamp: Date.now(),
            ...(activity.metadata !== undefined ? { metadata: activity.metadata } : {}),
          },
        }
        : {}),
    }),
  );

  if (heartbeatError) {
    logger.warn("Failed to process heartbeat in Redis", {
      error: heartbeatError,
    });
  }

  // Update database
  const updateData: Record<string, unknown> = {
    lastSeenAt: new Date(),
  };

  if (currentProject) {
    updateData.projectPath = currentProject;
  }
  if (workingDirectory) {
    updateData.workingDirectory = workingDirectory;
  }
  if (tokensUsed) {
    updateData.totalTokensUsed = { increment: tokensUsed };
  }

  const { error: dbUpdateError } = await tryCatch(
    prisma.claudeCodeAgent.update({
      where: { id: agentId },
      data: updateData,
    }),
  );

  if (dbUpdateError) {
    logger.warn("Failed to update agent in database", { error: dbUpdateError });
  }

  // Get any pending tasks for this agent
  const { data: tasks, error: tasksError } = await tryCatch(
    getPendingTasks(agentId),
  );

  if (tasksError) {
    logger.warn("Failed to get pending tasks", { error: tasksError });
  }

  // Get unread messages for this agent
  const { data: messages, error: messagesError } = await tryCatch(
    prisma.agentMessage.findMany({
      where: {
        agentId,
        isRead: false,
        role: "USER", // Only get user messages (agent doesn't need to see its own messages)
      },
      orderBy: { createdAt: "asc" },
      take: 10, // Limit to 10 unread messages per heartbeat
    }),
  );

  if (messagesError) {
    logger.warn("Failed to get unread messages", { error: messagesError });
  }

  // Mark messages as read
  if (messages && messages.length > 0) {
    await tryCatch(
      prisma.agentMessage.updateMany({
        where: {
          id: { in: messages.map(m => m.id) },
        },
        data: { isRead: true },
      }),
    );
  }

  const mappedTasks = tasks?.map(t => ({
    id: t.id,
    prompt: t.prompt,
    createdAt: t.createdAt,
  }));
  const mappedMessages = messages?.map(m => ({
    id: m.id,
    role: m.role as "USER" | "AGENT" | "SYSTEM",
    content: m.content,
    createdAt: m.createdAt.toISOString(),
  }));
  const response: AgentHeartbeatResponse = {
    success: true,
    timestamp: new Date().toISOString(),
    ...(mappedTasks !== undefined ? { tasks: mappedTasks } : {}),
    ...(mappedMessages !== undefined ? { messages: mappedMessages } : {}),
  };

  return NextResponse.json(response, { status: 200 });
}
