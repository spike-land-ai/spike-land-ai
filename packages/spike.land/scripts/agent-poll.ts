/**
 * Agent Polling Script
 *
 * Polls for pending messages from the Redis queue and processes them.
 * Can update app properties: status, description, name, etc.
 *
 * Usage: yarn agent:poll [--once] [--interval=5000] [--prod] [--stats] [--debug]
 *
 * Flags:
 *   --once        Run once and exit (don't loop)
 *   --interval=N  Set polling interval in ms (default: 5000)
 *   --prod        Use production API (https://spike.land) instead of localhost
 *   --stats       Show queue statistics and exit
 *   --debug       Enable verbose auth and API debugging
 *
 * E2E TEST KEYWORDS:
 * ==================
 * Messages starting with these keywords bypass Claude CLI for E2E testing:
 *
 *   E2E_TEST_ECHO:<message>     - Echo back the message (fast, no LLM)
 *   E2E_TEST_CODE_UPDATE        - Simulate code update (triggers codeUpdated=true)
 *   E2E_TEST_ERROR              - Simulate agent error
 *   E2E_TEST_DELAY:<ms>         - Wait N milliseconds, then respond
 *   E2E_TEST_MCP:<codespaceId>  - Call real MCP tools with test codespace
 *
 * SECURITY WARNING: Claude CLI Permissions
 * =========================================
 *
 * This script uses --dangerously-skip-permissions to allow the agent to
 * execute MCP tool calls without interactive confirmation. This is required
 * for autonomous operation but has security implications:
 *
 * 1. The Claude subprocess has unrestricted access to configured MCP tools:
 *    - spike-land: Codespace creation/update operations
 *    - MCP_DOCKER: Browser automation capabilities
 *
 * 2. ISOLATION REQUIREMENTS:
 *    - Run this script in an isolated environment (Docker container, VM)
 *    - Limit network access to required services only
 *    - Use least-privilege credentials for SPIKE_LAND_API_KEY
 *    - Monitor agent activities via lastAgentActivity timestamps
 *
 * 3. Set AGENT_REQUIRE_PERMISSIONS=true to re-enable permission prompts
 *    (useful for debugging but breaks autonomous operation)
 */

import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";

// Load environment variables
// Use quiet: true to suppress verbose logging
dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });

import { type AppBuildStatus, PrismaClient } from "@prisma/client";
import { Redis } from "@upstash/redis";
import { type ChildProcess, spawn } from "child_process";
import chokidar, { type FSWatcher } from "chokidar";
import { existsSync, mkdirSync } from "fs";
import { mkdir, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

// Initialize Prisma with proper adapter
function createPrismaClient() {
  // Use production database when --prod flag is passed
  const isProdMode = process.argv.includes("--prod");
  const connectionString = isProdMode
    ? process.env.DATABASE_URL_PROD || process.env.DATABASE_URL
    : process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      `${
        isProdMode ? "DATABASE_URL_PROD or " : ""
      }DATABASE_URL environment variable is required for database access. ` +
        "Please ensure it is set in your environment.",
    );
  }

  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({
    adapter,
    log: ["error", "warn"],
  });
}

// Lazy Prisma initialization - only created when needed (not at import time)
// This allows the module to be imported for testing without DATABASE_URL
let prisma: PrismaClient | null = null;

/**
 * Get the Prisma client, creating it lazily on first use.
 * Throws an error if DATABASE_URL is not configured.
 */
function getPrisma(): PrismaClient {
  if (!prisma) {
    prisma = createPrismaClient();
  }
  return prisma;
}

// Lazy Redis initialization - only created when needed (not at import time)
// This allows the module to be imported for testing without Redis credentials
let redis: Redis | null = null;

/**
 * Get the Redis client, creating it lazily on first use.
 * Throws an error if Redis credentials are not configured.
 */
function getRedis(): Redis {
  if (!redis) {
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

    if (!redisUrl || !redisToken) {
      throw new Error(
        "Redis credentials not configured. Set UPSTASH_REDIS_REST_URL/TOKEN or KV_REST_API_URL/TOKEN",
      );
    }

    redis = new Redis({ url: redisUrl, token: redisToken });
  }
  return redis;
}

// Redis key helpers
const KEYS = {
  APP_PENDING_MESSAGES: (appId: string) => `app:${appId}:pending_messages`,
  APPS_WITH_PENDING: "apps:with_pending",
  AGENT_WORKING: (appId: string) => `app:${appId}:agent_working`,
} as const;

// Live directory for local file sync
// Use process.cwd() since this script is always run from the project root
const LIVE_DIR = join(process.cwd(), "live");
const TESTING_SPIKE_LAND_URL = "https://testing.spike.land";

// Debounce delay for file watcher (ms)
const FILE_SYNC_DEBOUNCE_MS = 100;

// Retry configuration for syncing to server
const MAX_SYNC_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 100;

// Valid status transitions
const VALID_STATUSES: AppBuildStatus[] = [
  "PROMPTING",
  "WAITING",
  "DRAFTING",
  "BUILDING",
  "FINE_TUNING",
  "TEST",
  "LIVE",
  "ARCHIVED",
  "FAILED",
];

/**
 * Permission control for Claude CLI
 * Set AGENT_REQUIRE_PERMISSIONS=true to enable interactive permission prompts
 * (breaks autonomous operation but useful for debugging)
 */
const SKIP_PERMISSIONS = process.env.AGENT_REQUIRE_PERMISSIONS !== "true";

interface AppUpdate {
  name?: string;
  description?: string;
  status?: AppBuildStatus;
  codespaceId?: string;
  codespaceUrl?: string;
  isPublic?: boolean;
  isCurated?: boolean;
  slug?: string;
}

interface ProcessResult {
  success: boolean;
  agentMessage?: string;
  appUpdate?: AppUpdate;
  statusMessage?: string;
}

// Claude Code spawn interfaces
interface ChatMessage {
  id: string;
  role: "USER" | "AGENT" | "SYSTEM";
  content: string;
  createdAt: Date;
  attachments: Array<{
    image: {
      id: string;
      originalUrl: string;
      aiDescription: string | null;
      tags: string[];
    };
  }>;
}

interface ClaudeStreamEvent {
  type: string;
  name?: string;
  content?: unknown;
  text?: string;
  delta?: { text?: string };
  input?: { codespace_id?: string }; // For tool_use events
}

interface SpawnResult {
  success: boolean;
  response: string;
  codeUpdated: boolean;
  toolCalls: string[];
  codespaceId?: string; // Extracted from codespace_update tool calls
  error?: string;
}

/**
 * Type-safe response from testing.spike.land session.json endpoint
 */
interface SessionResponse {
  code?: string;
  cSess?: { code?: string };
}

// Constants for Claude Code spawning
const CLAUDE_TIMEOUT_MS = 300000; // 5 minutes

// Environment detection: --prod flag uses production URL
const isProd = process.argv.includes("--prod");
const isDebug = process.argv.includes("--debug");
const PROD_URL = "https://spike.land";
const LOCAL_URL = "http://localhost:3000";
const AGENT_API_URL = isProd ? PROD_URL : process.env.NEXT_PUBLIC_APP_URL || LOCAL_URL;

// ============================================================
// E2E Test Mode - Keyword-based handlers for testing without Claude
// ============================================================

interface TestKeywordResult {
  response: string;
  codeUpdated: boolean;
  codespaceId?: string;
  error?: string;
}

type TestKeywordHandler = (content: string, appId: string) => Promise<TestKeywordResult>;

/**
 * Test keyword handlers - these bypass Claude CLI for E2E testing
 * Each handler returns a mock response without invoking the LLM
 */
const TEST_KEYWORD_HANDLERS: Record<string, TestKeywordHandler> = {
  // Echo back the message content (fast, no external calls)
  "E2E_TEST_ECHO:": async (content) => {
    const message = content.replace("E2E_TEST_ECHO:", "").trim();
    return {
      response: `ECHO: ${message}`,
      codeUpdated: false,
    };
  },

  // Simulate a code update (triggers codeUpdated=true, SSE broadcast)
  E2E_TEST_CODE_UPDATE: async (_content, appId) => {
    return {
      response: `Mock code update completed for app ${appId}. The preview should reload.`,
      codeUpdated: true,
      codespaceId: `e2e-test-${appId}`,
    };
  },

  // Simulate an agent error
  E2E_TEST_ERROR: async () => {
    return {
      response: "Simulated error for E2E testing",
      codeUpdated: false,
      error: "E2E_TEST_ERROR triggered",
    };
  },

  // Wait N milliseconds, then respond (for testing timeout/loading states)
  "E2E_TEST_DELAY:": async (content) => {
    const delayMatch = content.match(/E2E_TEST_DELAY:(\d+)/);
    // Safe non-null assertion: regex capture group (\d+) guarantees index 1 exists when match succeeds
    const delayMs = delayMatch ? parseInt(delayMatch[1]!, 10) : 1000;
    const clampedDelay = Math.min(delayMs, 30000); // Max 30 seconds

    await new Promise((resolve) => setTimeout(resolve, clampedDelay));

    return {
      response: `Delayed response after ${clampedDelay}ms`,
      codeUpdated: false,
    };
  },

  // Call real MCP tools with a test codespace (for deeper integration testing)
  "E2E_TEST_MCP:": async (content, appId) => {
    const codespaceId = content.replace("E2E_TEST_MCP:", "").trim() || `e2e-mcp-${appId}`;
    // This keyword could be extended to actually call MCP tools if needed
    // For now, it just simulates the behavior
    return {
      response: `MCP integration test completed for codespace: ${codespaceId}`,
      codeUpdated: true,
      codespaceId,
    };
  },
};

/**
 * Check if a message starts with a test keyword
 * Returns the handler if found, null otherwise
 */
function findTestKeywordHandler(
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
// Live Directory File Sync Functions
// ============================================================

/**
 * Ensure the live directory exists
 */
function ensureLiveDir(): void {
  if (!existsSync(LIVE_DIR)) {
    mkdirSync(LIVE_DIR, { recursive: true });
  }
}

/**
 * Sanitize a codeSpace identifier to prevent path traversal attacks
 * Replaces any characters that aren't alphanumeric, dash, underscore, or dot
 */
function sanitizeCodeSpace(codeSpace: string): string {
  return codeSpace.replace(/[^a-z0-9._-]/gi, "-");
}

/**
 * Get the local file path for a codespace
 * Path is sanitized to prevent traversal attacks
 */
function getLocalFilePath(codeSpace: string): string {
  const sanitized = sanitizeCodeSpace(codeSpace);
  return join(LIVE_DIR, `${sanitized}.tsx`);
}

/**
 * Get the metadata file path for a codespace
 * Path is sanitized to prevent traversal attacks
 */
function getMetadataFilePath(codeSpace: string): string {
  const sanitized = sanitizeCodeSpace(codeSpace);
  return join(LIVE_DIR, `${sanitized}.meta.json`);
}

/**
 * Download code from testing.spike.land to local live/ directory
 *
 * @param codeSpace - The codespace ID
 * @returns The local file path where code was saved
 */
async function downloadCodeToLive(codeSpace: string): Promise<string> {
  ensureLiveDir();

  const sessionUrl = `${TESTING_SPIKE_LAND_URL}/live/${codeSpace}/session.json`;
  console.log(`  Downloading code from: ${sessionUrl}`);

  try {
    const response = await fetch(sessionUrl);

    if (!response.ok) {
      if (response.status === 404) {
        // Codespace doesn't exist yet - create an empty placeholder
        console.log(`  Codespace ${codeSpace} not found - creating placeholder`);
        const placeholderCode = `// New codespace: ${codeSpace}
// This file will be synced to testing.spike.land automatically

export default function App() {
  return (
    <div className="p-4">
      <h1>Hello from ${codeSpace}</h1>
    </div>
  );
}
`;
        const localPath = getLocalFilePath(codeSpace);
        await writeFile(localPath, placeholderCode, "utf-8");

        // Write metadata
        const metadataPath = getMetadataFilePath(codeSpace);
        await writeFile(
          metadataPath,
          JSON.stringify(
            {
              codeSpace,
              downloadedAt: new Date().toISOString(),
              source: "placeholder",
            },
            null,
            2,
          ),
          "utf-8",
        );

        return localPath;
      }
      throw new Error(`Failed to fetch session: HTTP ${response.status}`);
    }

    const session = (await response.json()) as SessionResponse;
    const code = session.code || session.cSess?.code || "";

    // Write code to local file
    const localPath = getLocalFilePath(codeSpace);
    await writeFile(localPath, code, "utf-8");
    console.log(`  Saved code to: ${localPath} (${code.length} bytes)`);

    // Write metadata
    const metadataPath = getMetadataFilePath(codeSpace);
    await writeFile(
      metadataPath,
      JSON.stringify(
        {
          codeSpace,
          downloadedAt: new Date().toISOString(),
          source: sessionUrl,
          originalLength: code.length,
        },
        null,
        2,
      ),
      "utf-8",
    );

    return localPath;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error(`  Failed to download code: ${errorMsg}`);
    throw error;
  }
}

async function notifySyncStatus(
  appId: string,
  isSyncing: boolean,
  codeUpdated = false,
): Promise<void> {
  try {
    const uiBaseUrl = process.env.UI_BASE_URL || "http://localhost:3000";
    const response = await fetch(`${uiBaseUrl}/api/apps/${appId}/sync-status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-api-key": process.env.INTERNAL_API_KEY || "",
      },
      body: JSON.stringify({ isSyncing, codeUpdated }),
    });
    if (!response.ok) {
      console.warn(`[Sync] Failed to notify UI: ${response.status}`);
    }
  } catch (_error) {
    // Best effort - UI notification is not critical
    console.debug("[Sync] UI notification failed (dev server may be down)");
  }
}

/**
 * Sync code from local file to testing.spike.land
 * Includes retry logic with exponential backoff
 *
 * Uses PUT /api/code endpoint which updates the code and optionally transpiles it.
 * See @spike-land-ai/spike-land-backend for API details.
 *
 * @param codeSpace - The codespace ID
 * @param code - The code to sync
 * @param appId - The app ID (optional, but needed for UI notifications)
 */
async function syncCodeToServer(codeSpace: string, code: string, appId?: string): Promise<void> {
  // Notify UI that sync is starting
  if (appId) {
    void notifySyncStatus(appId, true);
  }
  // The API endpoint structure is: /live/{codeSpace}/api/code
  // Method: PUT (not POST!)
  // Body: { code: string, run?: boolean }
  const apiUrl = `${TESTING_SPIKE_LAND_URL}/live/${codeSpace}/api/code`;

  let lastError: Error | null = null;
  let delay = INITIAL_RETRY_DELAY_MS;

  for (let attempt = 1; attempt <= MAX_SYNC_RETRIES; attempt++) {
    try {
      const response = await fetch(apiUrl, {
        method: "PUT", // Important: API uses PUT, not POST
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code,
          run: true, // Also transpile the code for instant preview updates
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log(
        `  Synced code to server (${code.length} bytes) - ${result.message || "success"}`,
      );

      // Notify UI that sync is complete AND code is updated
      if (appId) {
        void notifySyncStatus(appId, false, true);
      }
      return;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unknown error");
      console.warn(`  Sync attempt ${attempt}/${MAX_SYNC_RETRIES} failed: ${lastError.message}`);

      if (attempt < MAX_SYNC_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
      }
    }
  }

  console.error(`  Failed to sync code after ${MAX_SYNC_RETRIES} attempts`);
  throw lastError;
}

/**
 * Start watching a local codespace file for changes
 * Changes are debounced and synced to testing.spike.land
 *
 * @param codeSpace - The codespace ID to watch
 * @param appId - The app ID (for UI notifications)
 * @param onSync - Optional callback when sync occurs
 * @returns The FSWatcher instance (call .close() to stop)
 */
function startFileWatcher(codeSpace: string, appId: string, onSync?: () => void): FSWatcher {
  const localPath = getLocalFilePath(codeSpace);
  console.log(`  Starting file watcher for: ${localPath}`);

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const watcher = chokidar.watch(localPath, {
    persistent: true,
    ignoreInitial: true, // Don't fire on initial add
    awaitWriteFinish: {
      stabilityThreshold: 50,
      pollInterval: 10,
    },
  });

  watcher.on("change", async () => {
    // Debounce rapid changes
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(async () => {
      try {
        const code = await readFile(localPath, "utf-8");
        console.log(`  File changed, syncing ${code.length} bytes...`);
        await syncCodeToServer(codeSpace, code, appId);
        if (onSync) onSync();
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        console.error(`  File sync error: ${errorMsg}`);
      }
    }, FILE_SYNC_DEBOUNCE_MS);
  });

  watcher.on("error", (error: unknown) => {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`  Watcher error: ${errorMsg}`);
  });

  return watcher;
}

/**
 * Stop the file watcher and clean up resources
 *
 * @param watcher - The FSWatcher to stop
 * @param debounceTimer - Optional debounce timer to clear
 */
async function stopFileWatcher(
  watcher: FSWatcher,
  debounceTimer?: ReturnType<typeof setTimeout> | null,
): Promise<void> {
  console.log("  Stopping file watcher...");
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  await watcher.close();
}

/**
 * Debug logging helper - only logs when --debug flag is set
 */
function debugLog(message: string, data?: unknown): void {
  if (isDebug) {
    console.log(`  [DEBUG] ${message}`);
    if (data !== undefined) {
      console.log(`          ${JSON.stringify(data, null, 2).split("\n").join("\n          ")}`);
    }
  }
}

/**
 * Mask an API key for safe display in logs
 */
function maskApiKey(key: string | undefined): string {
  if (!key) return "(not set)";
  if (key.length < 12) return `${key.substring(0, 4)}...`;
  return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
}

/**
 * Get all app IDs that have pending messages
 */
async function getAppsWithPending(): Promise<string[]> {
  return getRedis().smembers(KEYS.APPS_WITH_PENDING);
}

/**
 * Dequeue oldest message from an app's queue
 */
async function dequeueMessage(appId: string): Promise<string | null> {
  const redisClient = getRedis();
  const messageId = await redisClient.rpop<string>(KEYS.APP_PENDING_MESSAGES(appId));

  // Check if queue is now empty
  const remaining = await redisClient.llen(KEYS.APP_PENDING_MESSAGES(appId));
  if (remaining === 0) {
    await redisClient.srem(KEYS.APPS_WITH_PENDING, appId);
  }

  return messageId;
}

/**
 * Clean up Redis queue for a deleted/orphan app
 */
async function cleanupAppQueue(appId: string): Promise<void> {
  const redisClient = getRedis();

  // Remove from pending apps set
  await redisClient.srem(KEYS.APPS_WITH_PENDING, appId);

  // Delete the app's pending messages list
  await redisClient.del(KEYS.APP_PENDING_MESSAGES(appId));

  // Delete any agent working flag
  await redisClient.del(KEYS.AGENT_WORKING(appId));

  console.log(`  Cleaned up queue for deleted app ${appId}`);
}

/**
 * Mark agent as working on an app
 */
async function setAgentWorking(appId: string, isWorking: boolean): Promise<void> {
  const redisClient = getRedis();
  if (isWorking) {
    await redisClient.set(KEYS.AGENT_WORKING(appId), "1", { ex: 300 }); // 5 min TTL
  } else {
    await redisClient.del(KEYS.AGENT_WORKING(appId));
  }

  // Use updateMany to avoid P2025 error when app doesn't exist
  await getPrisma().app.updateMany({
    where: { id: appId },
    data: {
      lastAgentActivity: isWorking ? new Date() : undefined,
    },
  });
}

/**
 * Add an agent message to the app's chat
 */
async function addAgentMessage(appId: string, content: string): Promise<void> {
  await getPrisma().appMessage.create({
    data: {
      appId,
      role: "AGENT",
      content,
    },
  });
}

/**
 * Add a system message to the app's chat
 */
async function addSystemMessage(appId: string, content: string): Promise<void> {
  await getPrisma().appMessage.create({
    data: {
      appId,
      role: "SYSTEM",
      content,
    },
  });
}

/**
 * Update app properties
 */
async function updateApp(appId: string, update: AppUpdate): Promise<void> {
  const data: Record<string, unknown> = {};

  if (update.name !== undefined) data.name = update.name;
  if (update.description !== undefined) {
    data.description = update.description;
  }
  if (update.codespaceId !== undefined) {
    data.codespaceId = update.codespaceId;
  }
  if (update.codespaceUrl !== undefined) {
    data.codespaceUrl = update.codespaceUrl;
  }
  if (update.isPublic !== undefined) data.isPublic = update.isPublic;
  if (update.isCurated !== undefined) data.isCurated = update.isCurated;
  if (update.slug !== undefined) data.slug = update.slug;

  // Handle status update separately (with history)
  if (update.status !== undefined) {
    data.status = update.status;
  }

  if (Object.keys(data).length > 0) {
    await getPrisma().app.update({
      where: { id: appId },
      data,
    });
  }
}

/**
 * Update app status with history entry
 */
async function updateAppStatus(
  appId: string,
  status: AppBuildStatus,
  message?: string,
): Promise<void> {
  await getPrisma().$transaction([
    getPrisma().app.update({
      where: { id: appId },
      data: { status },
    }),
    getPrisma().appStatusHistory.create({
      data: {
        appId,
        status,
        message: message || `Status changed to ${status}`,
      },
    }),
  ]);
}

/**
 * Get the user message content by ID
 */
async function getMessageContent(messageId: string): Promise<string | null> {
  const message = await getPrisma().appMessage.findUnique({
    where: { id: messageId },
    select: { content: true, role: true },
  });

  return message?.content || null;
}

/**
 * Get app details for context
 */
async function getAppContext(appId: string) {
  return getPrisma().app.findUnique({
    where: { id: appId },
    include: {
      requirements: true,
      messages: {
        take: 10,
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

// ============================================================
// Claude Code Spawning Functions
// ============================================================

/**
 * Get the last N messages with their attachments for context
 */
async function getChatHistory(appId: string, limit = 10): Promise<ChatMessage[]> {
  const messages = await getPrisma().appMessage.findMany({
    where: { appId },
    include: {
      attachments: {
        include: {
          image: {
            select: {
              id: true,
              originalUrl: true,
              aiDescription: true,
              tags: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  // Return in chronological order (oldest first)
  return messages.reverse() as unknown as ChatMessage[];
}

/**
 * Format chat history into a prompt string with image references
 */
function formatPromptWithHistory(
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
  prompt += `Codespace ID: ${app.codespaceId || "Not yet created - you need to create one"}\n`;
  prompt += `Codespace URL: ${
    app.codespaceUrl || "Will be available after codespace creation"
  }\n\n`;
  prompt += `# Chat History (last ${messages.length} messages)\n\n`;

  for (const msg of messages) {
    const roleLabel = msg.role === "USER" ? "User" : msg.role === "AGENT" ? "Assistant" : "System";
    const timestamp = msg.createdAt.toISOString();
    prompt += `## ${roleLabel} (${timestamp})\n\n`;
    prompt += msg.content + "\n\n";

    if (msg.attachments && msg.attachments.length > 0) {
      prompt += `### Attached Images:\n`;
      for (const att of msg.attachments) {
        prompt += `- Image URL: ${att.image.originalUrl}\n`;
        if (att.image.aiDescription) {
          prompt += `  Description: ${att.image.aiDescription}\n`;
        }
        if (att.image.tags && att.image.tags.length > 0) {
          prompt += `  Tags: ${att.image.tags.join(", ")}\n`;
        }
      }
      prompt += "\n";
    }
  }

  return prompt;
}

/**
 * Build the system prompt for the agent
 *
 * Tool names follow the pattern: mcp__<server-name>__<tool-name>
 * The spike-land MCP server provides these codespace tools:
 * - codespace_update: Create/update React code
 * - codespace_run: Transpile and run code
 * - codespace_screenshot: Get a screenshot
 * - codespace_link: Get link to app
 */
function buildSystemPrompt(app: {
  name: string;
  codespaceId: string | null;
  codespaceUrl: string | null;
  localFilePath?: string; // Local file for faster editing (when available)
}): string {
  const codespaceInfo = app.codespaceId
    ? `Current codespace ID: ${app.codespaceId}
Live URL: ${app.codespaceUrl || `https://spike.land/live/${app.codespaceId}`}`
    : `No codespace yet. You MUST create one using codespace_update with a descriptive codespace_id.`;

  // Build local file mode instructions if available
  const localFileInstructions = app.localFilePath
    ? `

## LOCAL FILE MODE (Recommended - Faster!)

The code is synced to a local file for faster editing:
- **File path**: ${app.localFilePath}
- **Auto-sync**: Changes are automatically synced to the server
- **Use Read/Edit/Write tools directly** - no MCP tools needed!

### To modify the code (PREFERRED METHOD):
1. Read the file: \`Read ${app.localFilePath}\`
2. Edit the file: \`Edit ${app.localFilePath}\` with your changes
3. Changes sync automatically to the live preview!

This is FASTER than MCP tools because file operations are instant and the watcher syncs changes in real-time.

You can still use MCP tools as a fallback if needed, but local file editing is recommended.`
    : "";

  return `You are an AI agent building a React application called "${app.name}".

${codespaceInfo}
${localFileInstructions}

## MCP Tools (Alternative Method)

Available spike-land MCP tools:
- mcp__spike-land__codespace_update: Create or update React code
  Parameters: { codespace_id: string, code: string, run?: boolean }

- mcp__spike-land__codespace_run: Transpile and run the code
  Parameters: { codespace_id: string }

- mcp__spike-land__codespace_screenshot: Get a screenshot of the app
  Parameters: { codespace_id: string }

- mcp__spike-land__codespace_link: Get a shareable link to the app
  Parameters: { codespace_id: string }

## Guidelines
1. ${
    app.localFilePath
      ? "PREFER editing the local file at " + app.localFilePath + " for faster updates"
      : "ALWAYS use codespace_update to modify code - do NOT just describe changes"
  }
2. For new apps, use a codespace_id like "my-app-name" (lowercase, hyphens)
3. Write complete, working React/TypeScript code with Tailwind CSS
4. After updating, confirm what you changed
5. If the user asks for colors/styling, ACTUALLY update the code with those changes`;
}

/**
 * Create temporary MCP config file
 *
 * Uses Streamable HTTP transport via the server-side MCP endpoint.
 */
async function createTempMcpConfig(): Promise<string> {
  const tmpDir = join(tmpdir(), `claude-mcp-${Date.now()}`);
  await mkdir(tmpDir, { recursive: true });
  const configPath = join(tmpDir, "mcp-config.json");

  const mcpDockerUrl = process.env.MCP_DOCKER_URL || "http://localhost:8808/sse";

  const config = {
    mcpServers: {
      "spike-land": {
        type: "url",
        url: "https://spike.land/api/mcp",
      },
      MCP_DOCKER: {
        type: "sse",
        url: mcpDockerUrl,
      },
    },
  };

  await writeFile(configPath, JSON.stringify(config, null, 2));
  return configPath;
}

/**
 * Clean up temporary MCP config directory
 */
async function cleanupMcpConfig(configPath: string): Promise<void> {
  try {
    const dir = configPath.replace(/\/[^/]+$/, "");
    await rm(dir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Extract final response text from stream-json output
 */
function extractResponseText(output: string): string {
  const lines = output.split("\n").filter(Boolean);

  for (const line of lines) {
    try {
      const event = JSON.parse(line);

      // Check for "result" type (final output)
      if (event.type === "result" && event.result) {
        return event.result;
      }

      // Check for "assistant" type (message content)
      if (event.type === "assistant" && event.message?.content?.[0]?.text) {
        return event.message.content[0].text;
      }
    } catch {
      // Not JSON, skip
    }
  }

  // Fallback: return raw output (shouldn't happen normally)
  return output;
}

/**
 * Spawn Claude CLI and process the response
 */
async function spawnClaudeCode(
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
      // Conditionally skip permissions for autonomous operation
      // See security warning in file header for implications
      ...(SKIP_PERMISSIONS ? ["--dangerously-skip-permissions"] : []),
      "-", // Read prompt from stdin
    ];

    console.log("  Spawning Claude CLI...");
    if (SKIP_PERMISSIONS) {
      console.log(
        "  WARNING: Running with --dangerously-skip-permissions (see file header for security implications)",
      );
    }
    console.log(`  Prompt length: ${prompt.length} chars`);
    console.log(`  System prompt: ${systemPrompt.substring(0, 100)}...`);

    const claude: ChildProcess = spawn("claude", args, {
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Write prompt to stdin
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

      // Parse streaming JSON lines
      const lines = chunk.split("\n").filter(Boolean);
      for (const line of lines) {
        try {
          const event: ClaudeStreamEvent = JSON.parse(line);

          // Track tool calls
          if (event.type === "tool_use" && event.name) {
            toolCalls.push(event.name);
            console.log(`    Tool call: ${event.name}`);

            // Detect codespace updates and extract codespace_id
            if (event.name.includes("codespace_update")) {
              codeUpdated = true;
              if (event.input?.codespace_id) {
                codespaceId = event.input.codespace_id;
                console.log(`    Codespace ID: ${codespaceId}`);
              }
            } else if (
              event.name.includes("codespace_run") ||
              event.name.includes("codespace_link")
            ) {
              codeUpdated = true;
            }
          }
        } catch {
          // Not JSON, might be plain text
        }
      }
    });

    claude.stderr?.on("data", (data: Buffer) => {
      errorOutput += data.toString();
    });

    // Set timeout
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
        console.error(`  Claude CLI exited with code ${code}`);
        resolve({
          success: false,
          response: `Claude CLI exited with code ${code}: ${errorOutput}`,
          codeUpdated: false,
          toolCalls,
          error: errorOutput,
        });
        return;
      }

      // Extract the final response text from streaming output
      const responseText = extractResponseText(output);

      console.log(`  Claude completed. Tools called: ${toolCalls.length}`);
      if (codespaceId) {
        console.log(`  Extracted codespace ID: ${codespaceId}`);
      }

      resolve({
        success: true,
        response: responseText,
        codeUpdated,
        toolCalls,
        codespaceId,
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

/**
 * Post agent response via API (triggers SSE broadcast)
 */
async function postAgentResponse(
  appId: string,
  content: string,
  codeUpdated: boolean,
  processedMessageIds: string[],
): Promise<void> {
  const apiKey = process.env.AGENT_API_KEY;
  if (!apiKey) {
    throw new Error("AGENT_API_KEY not configured in environment");
  }

  const url = `${AGENT_API_URL}/api/agent/apps/${appId}/respond`;

  debugLog("Posting agent response", {
    url,
    appId,
    codeUpdated,
    contentLength: content.length,
    processedMessageIds,
    apiKeyPreview: maskApiKey(apiKey),
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      content,
      codeUpdated,
      processedMessageIds,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    const errorDetails = {
      status: response.status,
      statusText: response.statusText,
      url,
      apiKeyPreview: maskApiKey(apiKey),
      body: errorBody.substring(0, 500),
    };

    debugLog("API request failed", errorDetails);

    // Provide helpful error message based on status code
    if (response.status === 401 || response.status === 403) {
      throw new Error(
        `Authentication failed (HTTP ${response.status}): ` +
          `Check that AGENT_API_KEY in .env.local matches Vercel production. ` +
          `Key preview: ${maskApiKey(apiKey)}. ` +
          `Run 'yarn agent:test-auth:prod' to verify. ` +
          `Error: ${errorBody}`,
      );
    }

    throw new Error(`Failed to post agent response (HTTP ${response.status}): ${errorBody}`);
  }

  debugLog("API request succeeded", { status: response.status });
}

/**
 * Update app's codespace info via agent API
 */
async function updateAppCodespace(appId: string, codespaceId: string): Promise<void> {
  const apiKey = process.env.AGENT_API_KEY;
  if (!apiKey) {
    throw new Error("AGENT_API_KEY not configured");
  }

  console.log(`  Updating app codespace: ${codespaceId}`);

  const response = await fetch(`${AGENT_API_URL}/api/apps/${appId}/agent`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      codespaceId,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`  Failed to update app codespace: ${error}`);
  } else {
    console.log(`  App codespace updated successfully`);
  }
}

/**
 * Process a single message - Spawns Claude Code to handle it
 */
async function processMessage(appId: string, messageId: string): Promise<ProcessResult> {
  const content = await getMessageContent(messageId);
  if (!content) {
    return { success: false, agentMessage: "Could not find message content" };
  }

  const app = await getAppContext(appId);
  if (!app) {
    return { success: false, agentMessage: "Could not find app" };
  }

  // Mark message as read
  await getPrisma().appMessage.update({
    where: { id: messageId },
    data: { isRead: true },
  });

  console.log(`  Processing message: "${content.substring(0, 50)}..."`);
  console.log(`  App: ${app.name} (${app.status})`);

  // ============================================================
  // E2E Test Mode Check - Handle test keywords without Claude CLI
  // ============================================================
  const testHandler = findTestKeywordHandler(content);
  if (testHandler) {
    console.log(`  [TEST MODE] Detected keyword: ${testHandler.keyword}`);
    debugLog("Processing test keyword", {
      keyword: testHandler.keyword,
      content,
    });

    try {
      const testResult = await testHandler.handler(content, appId);

      // Check for simulated error
      if (testResult.error) {
        console.log(`  [TEST MODE] Simulating error: ${testResult.error}`);
        return {
          success: false,
          agentMessage: testResult.response,
        };
      }

      // Update codespace if provided
      if (testResult.codespaceId) {
        try {
          await updateAppCodespace(appId, testResult.codespaceId);
        } catch (updateError) {
          console.error(`  [TEST MODE] Failed to update codespace: ${updateError}`);
        }
      }

      // Post response via API (still exercises real infrastructure)
      try {
        await postAgentResponse(appId, testResult.response, testResult.codeUpdated, [messageId]);
        console.log(
          `  [TEST MODE] Posted response via API (codeUpdated: ${testResult.codeUpdated})`,
        );
      } catch (apiError) {
        console.error(`  [TEST MODE] API error: ${apiError}`);
        // Fall back to direct database insert
        return {
          success: true,
          agentMessage: testResult.response,
          appUpdate: testResult.codeUpdated
            ? {
                status: "BUILDING" as AppBuildStatus,
                codespaceId: testResult.codespaceId,
              }
            : undefined,
          statusMessage: testResult.codeUpdated ? "Code updated by agent (test mode)" : undefined,
        };
      }

      // Success via API
      return {
        success: true,
        appUpdate: testResult.codeUpdated ? { status: "BUILDING" as AppBuildStatus } : undefined,
        statusMessage: testResult.codeUpdated ? "Code updated by agent (test mode)" : undefined,
      };
    } catch (testError) {
      const errorMsg = testError instanceof Error ? testError.message : "Unknown test error";
      console.error(`  [TEST MODE] Error: ${errorMsg}`);
      return {
        success: false,
        agentMessage: `Test mode error: ${errorMsg}`,
      };
    }
  }

  // ============================================================
  // Normal Claude CLI Processing
  // ============================================================

  // Get chat history with images
  const chatHistory = await getChatHistory(appId, 10);
  console.log(`  Chat history: ${chatHistory.length} messages`);

  // Format the prompt with full context
  const prompt = formatPromptWithHistory(chatHistory, {
    name: app.name,
    description: app.description,
    codespaceId: app.codespaceId,
    codespaceUrl: app.codespaceUrl,
  });

  // ============================================================
  // Local File Sync Setup (if codespace exists)
  // ============================================================
  let localFilePath: string | undefined;
  let fileWatcher: FSWatcher | undefined;
  let localFileSyncOccurred = false;

  if (app.codespaceId) {
    try {
      // Download current code to local file
      localFilePath = await downloadCodeToLive(app.codespaceId);
      console.log(`  Local file ready: ${localFilePath}`);

      // Start watching for changes
      fileWatcher = startFileWatcher(app.codespaceId, appId, () => {
        localFileSyncOccurred = true;
      });
    } catch (syncError) {
      const errorMsg = syncError instanceof Error ? syncError.message : "Unknown error";
      console.warn(`  Local file sync setup failed: ${errorMsg}`);
      console.log(`  Continuing with MCP-only mode...`);
      // Continue without local file - MCP tools will still work
      localFilePath = undefined;
    }
  }

  // Build system prompt (with local file path if available)
  const systemPrompt = buildSystemPrompt({
    name: app.name,
    codespaceId: app.codespaceId,
    codespaceUrl: app.codespaceUrl,
    localFilePath, // Pass local file path for faster editing
  });

  // Create temporary MCP config
  let mcpConfigPath: string | null = null;
  try {
    mcpConfigPath = await createTempMcpConfig();
    console.log(`  Created MCP config: ${mcpConfigPath}`);

    // Spawn Claude Code CLI
    const result = await spawnClaudeCode(prompt, systemPrompt, mcpConfigPath);

    if (!result.success) {
      console.error(`  Claude error: ${result.error}`);
      return {
        success: false,
        agentMessage: `Agent error: ${result.response}`,
      };
    }

    // Update app's codespace if one was created/used
    if (result.codespaceId) {
      try {
        await updateAppCodespace(appId, result.codespaceId);
      } catch (updateError) {
        console.error(`  Failed to update codespace: ${updateError}`);
      }
    }

    // Determine if code was updated (either by tool or file sync)
    const finalCodeUpdated = result.codeUpdated || localFileSyncOccurred;

    // Post response via API (triggers SSE broadcast including code_updated)
    try {
      await postAgentResponse(appId, result.response, finalCodeUpdated, [messageId]);
      console.log(`  Posted response via API (codeUpdated: ${finalCodeUpdated})`);
    } catch (apiError) {
      console.error(`  API error: ${apiError}`);
      // Fall back to direct database insert
      return {
        success: true,
        agentMessage: result.response,
        appUpdate: finalCodeUpdated
          ? {
              status: "BUILDING" as AppBuildStatus,
              codespaceId: result.codespaceId || app.codespaceId || undefined,
            }
          : undefined,
        statusMessage: finalCodeUpdated ? "Code updated by agent" : undefined,
      };
    }

    // Response was posted via API, don't add another message in processApp
    return {
      success: true,
      // agentMessage is handled by API, so don't return it here
      appUpdate: finalCodeUpdated ? { status: "BUILDING" as AppBuildStatus } : undefined,
      statusMessage: finalCodeUpdated ? "Code updated by agent" : undefined,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error(`  Processing error: ${errorMsg}`);
    return {
      success: false,
      agentMessage: `Agent error: ${errorMsg}`,
    };
  } finally {
    // ============================================================
    // Cleanup: Stop watcher, final sync, remove temp files
    // ============================================================

    // Stop file watcher if running
    if (fileWatcher) {
      await stopFileWatcher(fileWatcher);
    }

    // Final sync to ensure server has latest code
    if (localFilePath && app.codespaceId) {
      try {
        const finalCode = await readFile(localFilePath, "utf-8");
        console.log(`  Final sync: ${finalCode.length} bytes`);
        await syncCodeToServer(app.codespaceId, finalCode, appId);
      } catch (syncError) {
        const errorMsg = syncError instanceof Error ? syncError.message : "Unknown error";
        console.warn(`  Final sync failed: ${errorMsg}`);
      }
    }

    // Clean up temp MCP config files
    if (mcpConfigPath) {
      await cleanupMcpConfig(mcpConfigPath);
    }
  }
}

/**
 * Process all pending messages for an app
 */
async function processApp(appId: string): Promise<void> {
  console.log(`\nProcessing app: ${appId}`);

  // Check if app exists first to handle orphan messages
  const app = await getPrisma().app.findUnique({
    where: { id: appId },
    select: { id: true },
  });

  if (!app) {
    console.warn(`  App ${appId} not found - cleaning up orphan queue`);
    await cleanupAppQueue(appId);
    return;
  }

  try {
    // Mark agent as working
    await setAgentWorking(appId, true);

    // Process messages one by one
    let messageId = await dequeueMessage(appId);
    let processedCount = 0;

    while (messageId) {
      console.log(`  Message: ${messageId}`);

      const result = await processMessage(appId, messageId);

      if (result.success) {
        // Add agent response
        if (result.agentMessage) {
          await addAgentMessage(appId, result.agentMessage);
        }

        // Update app properties if specified
        if (result.appUpdate) {
          if (result.appUpdate.status) {
            await updateAppStatus(appId, result.appUpdate.status, result.statusMessage);
            // Remove status from appUpdate to avoid duplicate update
            const { status: _, ...restUpdate } = result.appUpdate;
            if (Object.keys(restUpdate).length > 0) {
              await updateApp(appId, restUpdate);
            }
          } else {
            await updateApp(appId, result.appUpdate);
          }
        }

        processedCount++;
      } else {
        console.error(`  Failed to process message: ${result.agentMessage}`);
        // Add error message to chat
        await addSystemMessage(appId, `Error processing message: ${result.agentMessage}`);
      }

      // Get next message
      messageId = await dequeueMessage(appId);
    }

    console.log(`  Processed ${processedCount} messages`);
  } catch (error) {
    console.error(`  Error processing app ${appId}:`, error);
    // Try to add error message, but don't fail if app was deleted mid-processing
    try {
      await addSystemMessage(
        appId,
        `Agent error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } catch {
      // App may have been deleted, just log and continue
      console.warn(`  Could not add error message - app may have been deleted`);
    }
  } finally {
    // Mark agent as done (uses updateMany so won't fail if app doesn't exist)
    await setAgentWorking(appId, false);
  }
}

/**
 * Main polling loop
 */
async function poll(): Promise<number> {
  const appIds = await getAppsWithPending();

  if (appIds.length === 0) {
    return 0;
  }

  console.log(`Found ${appIds.length} apps with pending messages`);

  for (const appId of appIds) {
    await processApp(appId);
  }

  return appIds.length;
}

/**
 * Get queue statistics
 */
async function getQueueStats(): Promise<void> {
  const appIds = await getAppsWithPending();
  let totalPending = 0;
  const redisClient = getRedis();

  console.log("\nQueue Statistics:");
  console.log("=================");

  for (const appId of appIds) {
    const count = await redisClient.llen(KEYS.APP_PENDING_MESSAGES(appId));
    const app = await getPrisma().app.findUnique({
      where: { id: appId },
      select: { name: true, status: true },
    });
    console.log(`  ${app?.name || appId}: ${count} pending (${app?.status})`);
    totalPending += count;
  }

  console.log(`\nTotal: ${appIds.length} apps, ${totalPending} messages`);
}

/**
 * CLI entry point
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const runOnce = args.includes("--once");
  const showStats = args.includes("--stats");
  const intervalArg = args.find((a) => a.startsWith("--interval="));
  const interval = intervalArg ? parseInt(intervalArg.split("=")[1]!, 10) : 5000;

  console.log("Agent Poll Script");
  console.log("=================");
  console.log(`Environment: ${isProd ? "PRODUCTION" : "LOCAL"}`);
  console.log(`API URL: ${AGENT_API_URL}`);
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  console.log(`Redis URL: ${redisUrl?.substring(0, 30) || "(not configured)"}...`);
  console.log(`Debug mode: ${isDebug ? "ON" : "OFF"}`);

  // Show additional debug info
  if (isDebug) {
    console.log("\n[DEBUG] Configuration:");
    console.log(`  AGENT_API_KEY: ${maskApiKey(process.env.AGENT_API_KEY)}`);
    console.log(`  SPIKE_LAND_API_KEY: ${maskApiKey(process.env.SPIKE_LAND_API_KEY)}`);
    const dbUrl = isProd
      ? process.env.DATABASE_URL_PROD || process.env.DATABASE_URL
      : process.env.DATABASE_URL;
    const dbSource = isProd && process.env.DATABASE_URL_PROD ? "DATABASE_URL_PROD" : "DATABASE_URL";
    console.log(`  ${dbSource}: ${dbUrl ? `(set - ${isProd ? "PROD" : "LOCAL"})` : "(not set)"}`);
    console.log(`  Skip permissions: ${SKIP_PERMISSIONS}`);
    console.log("\n[DEBUG] E2E Test Keywords Available:");
    Object.keys(TEST_KEYWORD_HANDLERS).forEach((keyword) => {
      console.log(`  - ${keyword}`);
    });
    console.log("");
  }

  if (showStats) {
    await getQueueStats();
    await getPrisma().$disconnect();
    return;
  }

  if (runOnce) {
    console.log("Running once...\n");
    const processed = await poll();
    console.log(`\nDone. Processed ${processed} apps.`);
    await getPrisma().$disconnect();
    return;
  }

  console.log(`Polling every ${interval}ms (Ctrl+C to stop)\n`);

  // Continuous polling loop
  const pollLoop = async () => {
    try {
      await poll();
    } catch (error) {
      console.error("Poll error:", error);
    }
    setTimeout(pollLoop, interval);
  };

  // Handle graceful shutdown
  process.on("SIGINT", async () => {
    console.log("\nShutting down...");
    await getPrisma().$disconnect();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    console.log("\nShutting down...");
    await getPrisma().$disconnect();
    process.exit(0);
  });

  // Start polling
  await pollLoop();
}

// Export functions for testing and external use
export {
  addAgentMessage,
  addSystemMessage,
  dequeueMessage,
  findTestKeywordHandler,
  getAppsWithPending,
  getQueueStats,
  maskApiKey,
  poll,
  processApp,
  processMessage,
  setAgentWorking,
  TEST_KEYWORD_HANDLERS,
  updateApp,
  updateAppStatus,
  VALID_STATUSES,
};

// Run if executed directly
main().catch(console.error);
