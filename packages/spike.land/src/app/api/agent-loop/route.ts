import { auth } from "@/lib/auth";
import { getScriptedResponse, isBot } from "@/lib/chat/bot-detection";
import { createAgentLoopStream } from "@/lib/chat/agent-loop-server";
import { getServerManager } from "@/lib/chat/server-manager-pool";
import { getClientIp } from "@/lib/rate-limit-presets";
import { checkRateLimit } from "@/lib/rate-limiter";
import { tryCatch } from "@/lib/try-catch";
import logger from "@/lib/logger";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export const maxDuration = 120;

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
} as const;

export async function POST(request: NextRequest) {
  const userAgent = request.headers.get("user-agent");

  // Bot detection
  if (isBot(userAgent)) {
    const { data: body } = await tryCatch(request.json());
    const route = (body as { route?: string })?.route || "/";
    return NextResponse.json({
      type: "scripted",
      content: getScriptedResponse(route),
    });
  }

  // Auth check
  const session = await auth();
  const isAuthenticated = !!session;
  const userId = session?.user?.id ?? "anonymous";

  // Rate limit
  const ip = getClientIp(request);
  const rateLimitConfig = isAuthenticated
    ? { maxRequests: 20, windowMs: 60000 }
    : { maxRequests: 5, windowMs: 60000 };

  const { isLimited } = await checkRateLimit(`agent-loop:${ip}`, rateLimitConfig);

  if (isLimited) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment." },
      { status: 429 },
    );
  }

  // Parse body
  const { data: body, error: jsonError } = await tryCatch(request.json());
  if (jsonError) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { question, sessionId, route, pageTitle, attachments } = body as {
    question?: string;
    sessionId?: string;
    route?: string;
    pageTitle?: string;
    attachments?: { type: string; data: string; name: string }[];
  };

  if (!question || typeof question !== "string" || question.trim().length === 0) {
    return NextResponse.json(
      { error: "question is required" },
      {
        status: 400,
      },
    );
  }

  if (question.length > 4000) {
    return NextResponse.json({ error: "Question too long (max 4000 characters)" }, { status: 400 });
  }

  // Get or create the user's ServerManager (pooled)
  let manager;
  try {
    manager = await getServerManager(userId);
  } catch (err) {
    logger.error("Failed to get ServerManager", {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Failed to connect to tools. Please try again." },
      { status: 503 },
    );
  }

  const stream = createAgentLoopStream({
    sessionId: sessionId || crypto.randomUUID(),
    question: question.trim(),
    manager,
    promptContext: {
      route: route || "/",
      ...(pageTitle !== undefined ? { pageTitle } : {}),
      isAuthenticated,
      ...(session?.user?.name ? { userName: session.user.name } : {}),
    },
    ...(attachments !== undefined ? { attachments } : {}),
    maxTurns: 10,
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
