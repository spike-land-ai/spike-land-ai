/**
 * Agent processing logic for vibe-dev
 *
 * Handles message processing, E2E test keywords, and Claude CLI spawning.
 * Extracted from scripts/agent-poll.ts for use in Docker container.
 */

import { type ChildProcess } from "child_process";
import spawn from "cross-spawn";
import { existsSync, mkdirSync } from "fs";
import { mkdir, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

import type { ApiConfig, AppContext, ChatMessage } from "../core-logic/api.js";
import { getAppContext, markMessageRead, postAgentResponse, updateApp } from "../core-logic/api.js";
import type { RedisConfig } from "../core-logic/redis.js";
import { dequeueMessage, getAppsWithPending, setAgentWorking } from "../core-logic/redis.js";

// ============================================================
// Configuration
// ============================================================

/**
 * Claude CLI timeout in milliseconds.
 * Configurable via CLAUDE_TIMEOUT_MS environment variable.
 * Default: 300000 (5 minutes)
 */
const CLAUDE_TIMEOUT_MS = parseInt(process.env.CLAUDE_TIMEOUT_MS || "300000", 10);
const getTestingSpikeLandUrl = (): string =>
  process.env.TESTING_SPIKE_LAND_URL || "https://testing.spike.land";
const getLiveDir = (): string => process.env.LIVE_DIR || "/app/live";

// Permission control for Claude CLI
const SKIP_PERMISSIONS = process.env.AGENT_REQUIRE_PERMISSIONS !== "true";

// ============================================================
// E2E Test Keyword Handlers
// ============================================================

interface TestKeywordResult {
  response: string;
  codeUpdated: boolean;
  codespaceId?: string;
  error?: string;
}

type TestKeywordHandler = (content: string, appId: string) => Promise<TestKeywordResult>;

/**
 * Test keyword handlers - bypass Claude CLI for E2E testing
 */
export const TEST_KEYWORD_HANDLERS: Record<string, TestKeywordHandler> = {
  "E2E_TEST_ECHO:": async (content) => {
    const message = content.replace("E2E_TEST_ECHO:", "").trim();
    return { response: `ECHO: ${message}`, codeUpdated: false };
  },

  E2E_TEST_CODE_UPDATE: async (_content, appId) => {
    return {
      response: `Mock code update completed for app ${appId}. The preview should reload.`,
      codeUpdated: true,
      codespaceId: `e2e-test-${appId}`,
    };
  },

  E2E_TEST_ERROR: async () => {
    return {
      response: "Simulated error for E2E testing",
      codeUpdated: false,
      error: "E2E_TEST_ERROR triggered",
    };
  },

  "E2E_TEST_DELAY:": async (content) => {
    const delayMatch = content.match(/E2E_TEST_DELAY:(\d+)/);
    const delayMs = delayMatch ? parseInt(delayMatch[1]!, 10) : 1000;
    const clampedDelay = Math.min(delayMs, 30000);
    await new Promise((resolve) => setTimeout(resolve, clampedDelay));
    return {
      response: `Delayed response after ${clampedDelay}ms`,
      codeUpdated: false,
    };
  },

  "E2E_TEST_MCP:": async (content, appId) => {
    const codespaceId = content.replace("E2E_TEST_MCP:", "").trim() || `e2e-mcp-${appId}`;
    return {
      response: `MCP integration test completed for codespace: ${codespaceId}`,
      codeUpdated: true,
      codespaceId,
    };
  },
};

/**
 * Find test keyword handler for a message
 */
export function findTestKeywordHandler(
  content: string,
): { keyword: string; handler: TestKeywordHandler } | null {
  for (const [keyword, handler] of Object.entries(TEST_KEYWORD_HANDLERS)) {
    if (content.startsWith(keyword)) {
      return { keyword, handler };
    }
  }
  return null;
}

// ============================================================
// File Sync Utilities
// ============================================================

function sanitizeCodeSpace(codeSpace: string): string {
  return codeSpace.replace(/[^a-z0-9._-]/gi, "-");
}

export function getLocalFilePath(codeSpace: string): string {
  const sanitized = sanitizeCodeSpace(codeSpace);
  return join(getLiveDir(), `${sanitized}.tsx`);
}

function ensureLiveDir(): void {
  const liveDir = getLiveDir();
  if (!existsSync(liveDir)) {
    mkdirSync(liveDir, { recursive: true });
  }
}

interface SessionResponse {
  code?: string;
  cSess?: { code?: string };
}

/**
 * Download code from testing.spike.land to local file
 */
export async function downloadCodeToLocal(codeSpace: string): Promise<string> {
  ensureLiveDir();
  const sessionUrl = `${getTestingSpikeLandUrl()}/live/${codeSpace}/session.json`;
  console.log(`  Downloading code from: ${sessionUrl}`);

  const response = await fetch(sessionUrl);
  const localPath = getLocalFilePath(codeSpace);

  if (!response.ok) {
    if (response.status === 404) {
      // Create placeholder for new codespace
      const placeholderCode = `// New codespace: ${codeSpace}
export default function App() {
  return <div className="p-4"><h1>Hello from ${codeSpace}</h1></div>;
}
`;
      await writeFile(localPath, placeholderCode, "utf-8");
      return localPath;
    }
    throw new Error(`Failed to fetch session: HTTP ${response.status}`);
  }

  const session = (await response.json()) as SessionResponse;
  const code = session.code || session.cSess?.code || "";
  await writeFile(localPath, code, "utf-8");
  console.log(`  Saved code to: ${localPath} (${code.length} bytes)`);
  return localPath;
}

/**
 * Sync code from local file to testing.spike.land
 */
export async function syncCodeToServer(codeSpace: string, code: string): Promise<void> {
  const apiUrl = `${getTestingSpikeLandUrl()}/live/${codeSpace}/api/code`;
  const response = await fetch(apiUrl, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, run: true }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Sync failed: ${response.status} - ${errorText}`);
  }
}

// ============================================================
// Claude Code Integration
// ============================================================

interface ClaudeStreamEvent {
  type: string;
  name?: string;
  content?: unknown;
  text?: string;
  delta?: { text?: string };
  input?: { codespace_id?: string };
}

interface SpawnResult {
  success: boolean;
  response: string;
  codeUpdated: boolean;
  toolCalls: string[];
  codespaceId?: string | undefined;
  error?: string | undefined;
}

/**
 * Build system prompt for Claude
 */
export function buildSystemPrompt(app: {
  name: string;
  codespaceId: string | null;
  codespaceUrl: string | null;
  localFilePath?: string | undefined;
}): string {
  const codespaceInfo = app.codespaceId
    ? `Current codespace ID: ${app.codespaceId}
Live URL: ${app.codespaceUrl || `https://spike.land/live/${app.codespaceId}`}`
    : `No codespace yet. Create one using codespace_update with a descriptive codespace_id.`;

  const localFileInstructions = app.localFilePath
    ? `

## LOCAL FILE MODE (Recommended - Faster!)

The code is synced to a local file for faster editing:
- **File path**: ${app.localFilePath}
- **Auto-sync**: Changes are automatically synced to the server
- **Use Read/Edit/Write tools directly** - no MCP tools needed!`
    : "";

  return `You are an AI agent building a React application called "${app.name}".

${codespaceInfo}
${localFileInstructions}

## MCP Tools (Alternative Method)

Available spike-land MCP tools:
- mcp__spike-land__codespace_update: Create or update React code
- mcp__spike-land__codespace_run: Transpile and run code
- mcp__spike-land__codespace_screenshot: Get a screenshot
- mcp__spike-land__codespace_link: Get a shareable link

## Guidelines
1. ${
    app.localFilePath
      ? "PREFER editing the local file for faster updates"
      : "ALWAYS use codespace_update to modify code"
  }
2. Write complete, working React/TypeScript code with Tailwind CSS
3. After updating, confirm what you changed`;
}

/**
 * Format chat history into prompt
 */
export function formatPromptWithHistory(
  messages: ChatMessage[],
  app: {
    name: string;
    description: string | null;
    codespaceId: string | null;
    codespaceUrl: string | null;
  },
): string {
  let prompt = `# App Context\n`;
  prompt += `Name: ${app.name}\n`;
  prompt += `Description: ${app.description || "No description yet"}\n`;
  prompt += `Codespace ID: ${app.codespaceId || "Not yet created"}\n\n`;
  prompt += `# Chat History (last ${messages.length} messages)\n\n`;

  for (const msg of messages) {
    const roleLabel = msg.role === "USER" ? "User" : msg.role === "AGENT" ? "Assistant" : "System";
    prompt += `## ${roleLabel} (${msg.createdAt})\n\n${msg.content}\n\n`;
    if (msg.attachments && msg.attachments.length > 0) {
      prompt += `### Attached Images:\n`;
      for (const att of msg.attachments) {
        prompt += `- Image URL: ${att.image.originalUrl}\n`;
        if (att.image.aiDescription) {
          prompt += `  Description: ${att.image.aiDescription}\n`;
        }
      }
      prompt += "\n";
    }
  }

  return prompt;
}

/**
 * Create temporary MCP config file
 */
async function createTempMcpConfig(): Promise<string> {
  const tmpDir = join(tmpdir(), `claude-mcp-${Date.now()}`);
  await mkdir(tmpDir, { recursive: true });
  const configPath = join(tmpDir, "mcp-config.json");

  const config = {
    mcpServers: {
      "spike-land": {
        type: "url",
        url: "https://spike.land/api/mcp",
      },
      playwright: {
        type: "stdio",
        command: "npx",
        args: ["-y", "@anthropic/mcp-server-playwright"],
        env: {},
      },
    },
  };

  await writeFile(configPath, JSON.stringify(config, null, 2));
  return configPath;
}

async function cleanupMcpConfig(configPath: string): Promise<void> {
  try {
    const dir = configPath.replace(/\/[^/]+$/, "");
    await rm(dir, { recursive: true, force: true });
  } catch (err) {
    console.warn("MCP config cleanup error:", err instanceof Error ? err.message : String(err));
  }
}

function extractResponseText(output: string): string {
  const lines = output.split("\n").filter(Boolean);
  for (const line of lines) {
    try {
      const event = JSON.parse(line);
      if (event.type === "result" && event.result) return event.result;
      if (event.type === "assistant" && event.message?.content?.[0]?.text) {
        return event.message.content[0].text;
      }
    } catch {
      // Not JSON
    }
  }
  return output;
}

/**
 * Spawn Claude CLI and process response
 */
export async function spawnClaudeCode(
  prompt: string,
  systemPrompt: string,
  mcpConfigPath: string,
): Promise<SpawnResult> {
  return new Promise((resolve) => {
    const args = [
      "--print",
      "--verbose",
      "--output-format",
      "stream-json",
      "--mcp-config",
      mcpConfigPath,
      "--system-prompt",
      systemPrompt,
      ...(SKIP_PERMISSIONS ? ["--dangerously-skip-permissions"] : []),
      "-",
    ];

    console.log("  Spawning Claude CLI...");
    const claude: ChildProcess = spawn("claude", args, {
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    claude.stdin?.write(prompt);
    claude.stdin?.end();

    let output = "";
    let errorOutput = "";
    const toolCalls: string[] = [];
    let codeUpdated = false;
    let codespaceId: string | undefined;

    claude.stdout?.on("data", (data: Buffer) => {
      const chunk = data.toString();
      output += chunk;

      const lines = chunk.split("\n").filter(Boolean);
      for (const line of lines) {
        try {
          const event: ClaudeStreamEvent = JSON.parse(line);
          if (event.type === "tool_use" && event.name) {
            toolCalls.push(event.name);
            console.log(`    Tool call: ${event.name}`);
            if (event.name.includes("codespace_update")) {
              codeUpdated = true;
              if (event.input?.codespace_id) {
                codespaceId = event.input.codespace_id;
              }
            } else if (
              event.name.includes("codespace_run") ||
              event.name.includes("codespace_link")
            ) {
              codeUpdated = true;
            }
          }
        } catch {
          // Not JSON
        }
      }
    });

    claude.stderr?.on("data", (data: Buffer) => {
      errorOutput += data.toString();
    });

    const timeoutId = setTimeout(() => {
      claude.kill("SIGTERM");
      resolve({
        success: false,
        response: "Claude CLI timed out after 5 minutes",
        codeUpdated: false,
        toolCalls,
        error: "timeout",
      });
    }, CLAUDE_TIMEOUT_MS);

    claude.on("close", (code) => {
      clearTimeout(timeoutId);
      if (code !== 0) {
        resolve({
          success: false,
          response: `Claude CLI exited with code ${code}: ${errorOutput}`,
          codeUpdated: false,
          toolCalls,
          error: errorOutput,
        });
        return;
      }
      resolve({
        success: true,
        response: extractResponseText(output),
        codeUpdated,
        toolCalls,
        ...(codespaceId !== undefined ? { codespaceId } : {}),
      });
    });

    claude.on("error", (err) => {
      clearTimeout(timeoutId);
      resolve({
        success: false,
        response: `Failed to spawn Claude CLI: ${err.message}`,
        codeUpdated: false,
        toolCalls,
        error: err.message,
      });
    });
  });
}

// ============================================================
// Message Processing
// ============================================================

interface ProcessResult {
  success: boolean;
  agentMessage?: string | undefined;
  codeUpdated?: boolean | undefined;
  codespaceId?: string | undefined;
  error?: string | undefined;
}

/**
 * Process a single message
 */
export async function processMessage(
  apiConfig: ApiConfig,
  appId: string,
  messageId: string,
  context: AppContext,
): Promise<ProcessResult> {
  // Find the message content
  const message = context.chatHistory.find((m) => m.id === messageId);
  if (!message) {
    return { success: false, error: "Message not found in context" };
  }

  const content = message.content;
  console.log(`  Processing message: "${content.substring(0, 50)}..."`);
  console.log(`  App: ${context.app.name} (${context.app.status})`);

  // Mark message as read
  await markMessageRead(apiConfig, messageId);

  // Check for E2E test keywords
  const testHandler = findTestKeywordHandler(content);
  if (testHandler) {
    console.log(`  [TEST MODE] Detected keyword: ${testHandler.keyword}`);
    const testResult = await testHandler.handler(content, appId);

    if (testResult.error) {
      return { success: false, error: testResult.error };
    }

    // Update codespace if provided
    if (testResult.codespaceId) {
      await updateApp(apiConfig, appId, {
        codespaceId: testResult.codespaceId,
      });
    }

    // Post response via API
    await postAgentResponse(apiConfig, appId, {
      content: testResult.response,
      codeUpdated: testResult.codeUpdated,
      processedMessageIds: [messageId],
    });

    return {
      success: true,
      agentMessage: testResult.response,
      codeUpdated: testResult.codeUpdated,
      ...(testResult.codespaceId !== undefined ? { codespaceId: testResult.codespaceId } : {}),
    };
  }

  // Normal Claude CLI processing
  let localFilePath: string | undefined;

  if (context.app.codespaceId) {
    try {
      localFilePath = await downloadCodeToLocal(context.app.codespaceId);
      console.log(`  Local file ready: ${localFilePath}`);
    } catch (syncError) {
      console.warn(`  Local file sync failed: ${syncError}`);
    }
  }

  const systemPrompt = buildSystemPrompt({
    name: context.app.name,
    codespaceId: context.app.codespaceId,
    codespaceUrl: context.app.codespaceUrl,
    ...(localFilePath !== undefined ? { localFilePath } : {}),
  });

  const prompt = formatPromptWithHistory(context.chatHistory, {
    name: context.app.name,
    description: context.app.description,
    codespaceId: context.app.codespaceId,
    codespaceUrl: context.app.codespaceUrl,
  });

  let mcpConfigPath: string | null = null;
  try {
    mcpConfigPath = await createTempMcpConfig();
    const result = await spawnClaudeCode(prompt, systemPrompt, mcpConfigPath);

    if (!result.success) {
      return { success: false, error: result.error || result.response };
    }

    // Update codespace if created
    if (result.codespaceId) {
      await updateApp(apiConfig, appId, { codespaceId: result.codespaceId });
    }

    // Final sync if local file was used
    if (localFilePath && context.app.codespaceId) {
      try {
        const finalCode = await readFile(localFilePath, "utf-8");
        await syncCodeToServer(context.app.codespaceId, finalCode);
      } catch (err) {
        console.warn("Final sync failed:", err instanceof Error ? err.message : String(err));
      }
    }

    // Post response via API
    await postAgentResponse(apiConfig, appId, {
      content: result.response,
      codeUpdated: result.codeUpdated,
      processedMessageIds: [messageId],
    });

    return {
      success: true,
      agentMessage: result.response,
      codeUpdated: result.codeUpdated,
      ...(result.codespaceId !== undefined ? { codespaceId: result.codespaceId } : {}),
    };
  } finally {
    if (mcpConfigPath) {
      await cleanupMcpConfig(mcpConfigPath);
    }
  }
}

/**
 * Process all pending messages for an app
 */
export async function processApp(
  redisConfig: RedisConfig,
  apiConfig: ApiConfig,
  appId: string,
): Promise<number> {
  console.log(`\nProcessing app: ${appId}`);

  // Track current message ID for error recovery logging
  let currentMessageId: string | null = null;

  try {
    // Mark agent as working
    await setAgentWorking(redisConfig, appId, true);

    // Get app context
    const context = await getAppContext(apiConfig, appId);

    // Process messages one by one
    let processedCount = 0;
    let messageId = await dequeueMessage(redisConfig, appId);

    while (messageId) {
      currentMessageId = messageId;
      console.log(`  Message: ${messageId}`);

      const result = await processMessage(apiConfig, appId, messageId, context);

      if (result.success) {
        processedCount++;
      } else {
        console.error(`  Failed to process message ${messageId}: ${result.error}`);
        // Post error message to chat
        await postAgentResponse(apiConfig, appId, {
          content: `Error processing message: ${result.error}`,
          codeUpdated: false,
          processedMessageIds: [messageId],
        });
      }

      messageId = await dequeueMessage(redisConfig, appId);
    }

    console.log(`  Processed ${processedCount} messages`);
    return processedCount;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    // Log which message ID failed for easier debugging
    if (currentMessageId) {
      console.error(`  Error processing app ${appId} at message ${currentMessageId}:`, errorMsg);
    } else {
      console.error(`  Error processing app ${appId} (during setup):`, errorMsg);
    }
    throw error;
  } finally {
    await setAgentWorking(redisConfig, appId, false);
  }
}

/**
 * Main polling function
 */
export async function poll(redisConfig: RedisConfig, apiConfig: ApiConfig): Promise<number> {
  const appIds = await getAppsWithPending(redisConfig);

  if (appIds.length === 0) {
    return 0;
  }

  console.log(`Found ${appIds.length} apps with pending messages`);

  let totalProcessed = 0;
  for (const appId of appIds) {
    try {
      totalProcessed += await processApp(redisConfig, apiConfig, appId);
    } catch (error) {
      console.error(`Failed to process app ${appId}:`, error);
    }
  }

  return totalProcessed;
}
