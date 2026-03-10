/**
 * Sandbox MCP Tools (CF Workers)
 *
 * Tools for ephemeral sandbox environments — create sandboxes,
 * execute code (simulated), read/write files, and tear down.
 *
 * Runs on Cloudflare Workers. Uses in-memory storage.
 * Code execution is simulated — CF Workers cannot spawn processes.
 * For real execution, use the spike.land platform.
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "../../lazy-imports/registry";
import { freeTool, textResult } from "../../lazy-imports/procedures-index.ts";
import type { DrizzleDB } from "../../db/db/db-index.ts";

interface ExecEntry {
  code: string;
  language: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  timestamp: number;
}

interface SandboxState {
  id: string;
  name: string;
  userId: string;
  language: string;
  files: Map<string, string>;
  execLog: ExecEntry[];
  createdAt: number;
  status: "active" | "destroyed";
}

// In-memory sandbox storage
const sandboxes = new Map<string, SandboxState>();

/** Exported for testing — clears all sandboxes. */
export function _resetSandboxes(): void {
  sandboxes.clear();
}

/** Exported for testing — get sandbox count. */
export function _getSandboxCount(): number {
  return sandboxes.size;
}

function getSandboxOrError(sandboxId: string): SandboxState | CallToolResult {
  const sandbox = sandboxes.get(sandboxId);
  if (!sandbox) {
    return {
      content: [{ type: "text", text: `Sandbox "${sandboxId}" not found.` }],
      isError: true,
    };
  }
  if (sandbox.status === "destroyed") {
    return {
      content: [
        {
          type: "text",
          text: `Sandbox "${sandboxId}" has been destroyed.`,
        },
      ],
      isError: true,
    };
  }
  return sandbox;
}

function isSandboxState(value: SandboxState | CallToolResult): value is SandboxState {
  return "id" in value && "files" in value;
}

export function registerSandboxTools(registry: ToolRegistry, userId: string, db: DrizzleDB): void {
  const t = freeTool(userId, db);

  // sandbox_create
  registry.registerBuilt(
    t
      .tool(
        "sandbox_create",
        "Create an ephemeral sandbox environment for code execution. Returns a sandbox ID for subsequent operations.",
        {
          name: z.string().max(100).optional().describe("Sandbox name (auto-generated if omitted)"),
          language: z
            .enum(["typescript", "javascript", "python"])
            .optional()
            .default("typescript")
            .describe("Default language for code execution"),
        },
      )
      .meta({ category: "orchestration", tier: "free", stability: "beta" })
      .handler(async ({ input }) => {
        const { name, language } = input;

        const id = crypto.randomUUID();
        const sandboxName = name || `sandbox-${id.slice(0, 8)}`;
        const now = Date.now();

        const sandbox: SandboxState = {
          id,
          name: sandboxName,
          userId,
          language,
          files: new Map(),
          execLog: [],
          createdAt: now,
          status: "active",
        };

        sandboxes.set(id, sandbox);

        return textResult(
          `**Sandbox created**\n\n` +
            `- **ID:** \`${id}\`\n` +
            `- **Name:** ${sandboxName}\n` +
            `- **Language:** ${language}\n` +
            `- **Status:** active\n` +
            `- **Created:** ${new Date(now).toISOString()}\n\n` +
            `_Note: Code execution is simulated in edge mode. ` +
            `Use spike.land platform for Docker-based sandboxes with real execution._`,
        );
      }),
  );

  // sandbox_simulate
  registry.registerBuilt(
    t
      .tool(
        "sandbox_simulate",
        "SIMULATED EXECUTION PREVIEW — no code actually runs. Returns synthetic stdout/stderr for prototyping tool invocation patterns. For real execution, use spike.land platform directly.",
        {
          sandbox_id: z.string().min(1).describe("The sandbox ID"),
          code: z.string().min(1).describe("Code to execute"),
          language: z
            .enum(["typescript", "javascript", "python"])
            .optional()
            .describe("Language override (defaults to sandbox language)"),
        },
      )
      .meta({ category: "orchestration", tier: "free", stability: "beta" })
      .handler(async ({ input }) => {
        const { sandbox_id, code, language } = input;

        const result = getSandboxOrError(sandbox_id);
        if (!isSandboxState(result)) return result;

        const sandbox = result;
        const execLanguage = language || sandbox.language;
        const startTime = Date.now();

        // Simulated execution — CF Workers cannot spawn processes
        const stdout = `[${execLanguage}] Executed ${
          code.split("\n").length
        } line(s) successfully. (simulated — use spike.land for real execution)`;
        const stderr = "";
        const exitCode = 0;
        const durationMs = Date.now() - startTime;

        const entry: ExecEntry = {
          code,
          language: execLanguage,
          stdout,
          stderr,
          exitCode,
          durationMs,
          timestamp: Date.now(),
        };
        sandbox.execLog.push(entry);

        return textResult(
          `**[SIMULATION ONLY - NO CODE WAS EXECUTED]**\n` +
            `**Execution result**\n\n` +
            `- **Language:** ${execLanguage}\n` +
            `- **Exit code:** ${exitCode}\n` +
            `- **Duration:** ${durationMs}ms\n\n` +
            `**stdout:**\n\`\`\`\n${stdout}\n\`\`\`\n\n` +
            `**stderr:**\n\`\`\`\n${stderr}\n\`\`\``,
        );
      }),
  );

  // sandbox_read_file
  registry.registerBuilt(
    t
      .tool("sandbox_read_file", "Read a file from the sandbox virtual filesystem.", {
        sandbox_id: z.string().min(1).describe("The sandbox ID"),
        file_path: z.string().min(1).describe("Path of the file to read"),
      })
      .meta({ category: "orchestration", tier: "free", stability: "beta" })
      .handler(async ({ input }) => {
        const { sandbox_id, file_path } = input;

        const result = getSandboxOrError(sandbox_id);
        if (!isSandboxState(result)) return result;

        const sandbox = result;
        const content = sandbox.files.get(file_path);

        if (content === undefined) {
          return {
            content: [
              {
                type: "text" as const,
                text: `File "${file_path}" not found in sandbox "${sandbox_id}".`,
              },
            ],
            isError: true,
          };
        }

        return textResult(`**File: ${file_path}**\n\n\`\`\`\n${content}\n\`\`\``);
      }),
  );

  // sandbox_write_file
  registry.registerBuilt(
    t
      .tool("sandbox_write_file", "Write a file to the sandbox virtual filesystem.", {
        sandbox_id: z.string().min(1).describe("The sandbox ID"),
        file_path: z.string().min(1).describe("Path of the file to write"),
        content: z.string().describe("File content to write"),
      })
      .meta({ category: "orchestration", tier: "free", stability: "beta" })
      .handler(async ({ input }) => {
        const { sandbox_id, file_path, content } = input;

        const result = getSandboxOrError(sandbox_id);
        if (!isSandboxState(result)) return result;

        const sandbox = result;

        const MAX_FILE_COUNT = 100;
        const MAX_FILE_SIZE_BYTES = 1_048_576; // 1MB
        const MAX_TOTAL_SIZE_BYTES = 52_428_800; // 50MB

        const sizeBytes = new TextEncoder().encode(content).byteLength;
        if (sizeBytes > MAX_FILE_SIZE_BYTES) {
          return {
            content: [
              {
                type: "text" as const,
                text: `File exceeds 1MB limit (${sizeBytes} bytes).`,
              },
            ],
            isError: true,
          };
        }
        if (sandbox.files.size >= MAX_FILE_COUNT && !sandbox.files.has(file_path)) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Sandbox file limit (${MAX_FILE_COUNT}) reached.`,
              },
            ],
            isError: true,
          };
        }
        // Check total size
        let totalSize = 0;
        for (const [, fileContent] of sandbox.files) {
          totalSize += new TextEncoder().encode(fileContent).byteLength;
        }
        totalSize += sizeBytes;
        if (totalSize > MAX_TOTAL_SIZE_BYTES) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Sandbox total size limit (50MB) exceeded.`,
              },
            ],
            isError: true,
          };
        }

        sandbox.files.set(file_path, content);

        return textResult(
          `**File written**\n\n` +
            `- **Path:** ${file_path}\n` +
            `- **Size:** ${sizeBytes} bytes\n` +
            `- **Total files:** ${sandbox.files.size}`,
        );
      }),
  );

  // sandbox_destroy
  registry.registerBuilt(
    t
      .tool(
        "sandbox_destroy",
        "Destroy a sandbox and free its resources. Returns summary statistics.",
        {
          sandbox_id: z.string().min(1).describe("The sandbox ID to destroy"),
        },
      )
      .meta({ category: "orchestration", tier: "free", stability: "beta" })
      .handler(async ({ input }) => {
        const { sandbox_id } = input;

        const result = getSandboxOrError(sandbox_id);
        if (!isSandboxState(result)) return result;

        const sandbox = result;
        const filesCreated = sandbox.files.size;
        const commandsRun = sandbox.execLog.length;
        const durationMs = Date.now() - sandbox.createdAt;

        sandbox.status = "destroyed";
        sandbox.files.clear();
        sandbox.execLog.length = 0;

        return textResult(
          `**Sandbox destroyed**\n\n` +
            `- **ID:** \`${sandbox_id}\`\n` +
            `- **Name:** ${sandbox.name}\n` +
            `- **Files created:** ${filesCreated}\n` +
            `- **Commands run:** ${commandsRun}\n` +
            `- **Lifetime:** ${durationMs}ms`,
        );
      }),
  );
}
