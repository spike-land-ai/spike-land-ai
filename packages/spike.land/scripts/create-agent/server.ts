/**
 * Create Agent Server — "Spike"
 *
 * Generates app code via Anthropic SDK.
 * Auth: CLAUDE_CODE_OAUTH_TOKEN > CLAUDE_CODE_OAUTH_TOKEN (OAuth-only)
 */

import Anthropic from "@anthropic-ai/sdk";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { buildFullSystemPrompt, buildUserPrompt } from "../../src/lib/create/prompt-builder";
import { getClaudeCliVersion } from "../../src/lib/ai/claude-client";

const PORT = parseInt(process.env.CREATE_AGENT_PORT ?? "4892", 10);
const AGENT_NAME = "Spike";
const CLAUDE_MODEL = "claude-opus-4-6";
// SECURITY: No hardcoded fallback — server must not start without a real secret.
// Set CREATE_AGENT_SECRET in environment before running.
const AGENT_SECRET = process.env.CREATE_AGENT_SECRET;
if (!AGENT_SECRET) {
  console.error(
    "FATAL: CREATE_AGENT_SECRET environment variable is not set. " +
      "The server refuses to start with a default secret.",
  );
  process.exit(1);
}

// Auth resolution: CLAUDE_CODE_OAUTH_TOKEN > CLAUDE_CODE_OAUTH_TOKEN (OAuth-only)
const authToken = process.env.CLAUDE_CODE_OAUTH_TOKEN ?? process.env.CLAUDE_CODE_OAUTH_TOKEN;

if (!authToken) {
  console.error(
    "No Anthropic credentials found. Set CLAUDE_CODE_OAUTH_TOKEN or CLAUDE_CODE_OAUTH_TOKEN.",
  );
  process.exit(1);
}

const authMethod = "oauth-token";

const anthropic = new Anthropic({
  apiKey: null,
  authToken,
  defaultHeaders: {
    accept: "application/json",
    "anthropic-beta":
      "claude-code-20250219,oauth-2025-04-20,fine-grained-tool-streaming-2025-05-14",
    "user-agent": `claude-cli/${getClaudeCliVersion()} (external, cli)`,
    "x-app": "cli",
  },
});

async function handleGenerate(req: IncomingMessage, res: ServerResponse): Promise<void> {
  // SECURITY: Restrict CORS to the spike.land origin only.
  // This server is an internal agent sidecar; it must not accept cross-origin
  // requests from arbitrary websites. Wildcard CORS on an authenticated
  // endpoint undermines the Bearer token auth (OWASP A01:2021).
  const allowedOrigin =
    process.env.NODE_ENV === "development" ? "http://localhost:3000" : "https://spike.land";
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Vary", "Origin");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  if (req.method !== "POST") {
    res.writeHead(405, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  if (req.headers.authorization !== `Bearer ${AGENT_SECRET}`) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Unauthorized" }));
    return;
  }

  let body = "";
  for await (const chunk of req) body += chunk;

  let path: string[];
  try {
    const parsed = JSON.parse(body) as { path: unknown };
    if (!Array.isArray(parsed.path) || parsed.path.length === 0) {
      throw new Error("Invalid path");
    }
    path = parsed.path as string[];
  } catch {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid request body" }));
    return;
  }

  const topic = path.join("/");
  console.log(`[${new Date().toISOString()}] Generating app: ${topic}`);

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });

  res.write(
    `data: ${JSON.stringify({ type: "agent", name: AGENT_NAME, model: CLAUDE_MODEL })}\n\n`,
  );
  res.write(
    `data: ${JSON.stringify({
      type: "status",
      message: "Generating with Claude Opus 4.6...",
    })}\n\n`,
  );

  try {
    const stream = anthropic.messages.stream({
      model: CLAUDE_MODEL,
      max_tokens: 16384,
      system: buildFullSystemPrompt(topic),
      messages: [{ role: "user", content: buildUserPrompt(topic) }],
    });

    let text = "";
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        text += event.delta.text;
      }
    }

    if (!text) throw new Error("Empty response from Claude");

    let appData: {
      title: string;
      description: string;
      code: string;
      relatedApps: string[];
    };
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      appData = JSON.parse(jsonMatch[0]) as typeof appData;
    } catch {
      appData = {
        title: path[path.length - 1]?.replace(/-/g, " ") ?? "App",
        description: "Generated application",
        code: text,
        relatedApps: [],
      };
    }

    res.write(`data: ${JSON.stringify({ type: "status", message: "Writing code..." })}\n\n`);
    res.write(
      `data: ${JSON.stringify({
        type: "complete",
        slug: path.join("/").toLowerCase(),
        url: "",
        title: appData.title,
        description: appData.description,
        code: appData.code,
        relatedApps: appData.relatedApps,
      })}\n\n`,
    );

    console.log(`[${new Date().toISOString()}] Completed: ${topic} (${text.length} chars)`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Generation failed";
    if (message.includes("401") || message.includes("Invalid bearer token")) {
      console.error(
        `[AUTH] OAuth token may be expired. Update CLAUDE_CODE_OAUTH_TOKEN in .env.local`,
      );
    }
    console.error(`[${new Date().toISOString()}] Error:`, error);
    res.write(`data: ${JSON.stringify({ type: "error", message })}\n\n`);
  }

  res.end();
}

function handleHealth(_req: IncomingMessage, res: ServerResponse): void {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      status: "ok",
      agent: AGENT_NAME,
      model: CLAUDE_MODEL,
      authMethod,
      timestamp: new Date().toISOString(),
    }),
  );
}

const server = createServer((req, res) => {
  if (req.url === "/health") {
    handleHealth(req, res);
    return;
  }
  if (req.url === "/generate") {
    void handleGenerate(req, res);
    return;
  }
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, () => {
  console.log(`Create Agent (${AGENT_NAME}) listening on http://localhost:${PORT}`);
  console.log(`   Model: ${CLAUDE_MODEL} via ${authMethod}`);
});
