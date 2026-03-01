/**
 * Dev Workflow MCP Tools
 *
 * Local-only tools for development workflow: logs, status, file guard, notifications.
 * Only registered when NODE_ENV=development.
 */

import { z } from "zod";
import type { ToolRegistry } from "../tool-registry";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
    appendFileSync,
    existsSync,
    mkdirSync,
    readFileSync,
    writeFileSync,
} from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { freeTool } from "../tool-builder/procedures.js";

const CATEGORY = "dev";
const TIER = "free" as const;
const LOG_DIR = ".dev-logs";
const LOG_FILE = join(LOG_DIR, "dev-server.log");
const META_FILE = join(LOG_DIR, "dev-meta.json");
const NOTIFICATIONS_FILE = join(LOG_DIR, "notifications.json");

function textResult(text: string): CallToolResult {
    return { content: [{ type: "text", text }] };
}

function errorResult(msg: string): CallToolResult {
    return { content: [{ type: "text", text: `Error: ${msg}` }], isError: true };
}

/** Validate a string looks like a git ref (commit hash, branch name, HEAD~N). */
function isValidGitRef(ref: string): boolean {
    return /^[a-zA-Z0-9._~^/\-]+$/.test(ref) && ref.length <= 100;
}

function safeExec(cmd: string, timeoutMs = 10_000): string {
    try {
        return execSync(cmd, {
            encoding: "utf-8",
            timeout: timeoutMs,
            stdio: ["pipe", "pipe", "pipe"],
        }).trim();
    } catch {
        return "";
    }
}

export function registerDevTools(
    registry: ToolRegistry,
    _userId: string,
): void {
    // ── dev_logs ──────────────────────────────────────────────────
    registry.registerBuilt(
        freeTool(_userId)
            .tool("dev_logs", "Read dev server logs. Returns the last N lines, optionally filtered by search term. Use to inspect server output, errors, and request logs.", {
                lines: z.number().optional().describe(
                    "Number of lines to return (default 100)",
                ),
                search: z.string().optional().describe(
                    "Filter lines containing this text",
                ),
            })
            .meta({ category: CATEGORY, tier: TIER })
            .handler(async ({ input, ctx: _ctx }) => {
                

                if (!existsSync(LOG_FILE)) {
                    return errorResult(
                        "No dev logs found. Is the dev server running via `yarn start:dev`?",
                    );
                }
                const raw = readFileSync(LOG_FILE, "utf-8");
                let lines = raw.split("\n");
                if (input.search) {
                    const term = input.search.toLowerCase();
                    lines = lines.filter(l => l.toLowerCase().includes(term));
                }
                const limit = input.lines ?? 100;
                const result = lines.slice(-limit).join("\n");
                return textResult(result || "(no matching log lines)");
            })
    );

    // ── dev_status ────────────────────────────────────────────────
    registry.registerBuilt(
        freeTool(_userId)
            .tool("dev_status", "Get dev server status: PID, uptime, port, current git commit. Use to check if the dev server is running and healthy.", {})
            .meta({ category: CATEGORY, tier: TIER })
            .handler(async ({ input: _input, ctx: _ctx }) => {
                if (!existsSync(META_FILE)) {
                    return errorResult(
                        "No dev server metadata found. Start with `yarn start:dev`.",
                    );
                }
                const meta = JSON.parse(readFileSync(META_FILE, "utf-8")) as {
                    pid: number;
                    startTime: string;
                    port: number;
                    commitHash: string;
                };

                let running = false;
                try {
                    process.kill(meta.pid, 0);
                    running = true;
                } catch {
                    running = false;
                }

                const uptime = running
                    ? `${Math.round((Date.now() - new Date(meta.startTime).getTime()) / 1000)}s`
                    : "stopped";

                return textResult(
                    [
                        `## Dev Server Status`,
                        `- **Running:** ${running ? "yes" : "no"}`,
                        `- **PID:** ${meta.pid}`,
                        `- **Port:** ${meta.port}`,
                        `- **Uptime:** ${uptime}`,
                        `- **Started:** ${meta.startTime}`,
                        `- **Commit:** ${meta.commitHash}`,
                    ].join("\n"),
                );
            })
    );

    // ── github_status ─────────────────────────────────────────────
    registry.registerBuilt(
        freeTool(_userId)
            .tool("github_status", "Get current git branch, commit, recent history, and CI status. Use to understand the current state of the repository before making changes.", {})
            .meta({ category: CATEGORY, tier: TIER })
            .handler(async ({ input: _input, ctx: _ctx }) => {
                const branch = safeExec("git branch --show-current");
                const commit = safeExec("git rev-parse --short HEAD");
                const commitFull = safeExec("git rev-parse HEAD");
                const recentLog = safeExec("git log --oneline -5");
                const dirty = safeExec("git status --porcelain").length > 0
                    ? "yes"
                    : "no";

                // Try to get CI status via gh (validate commitFull to prevent injection)
                const ciStatus = isValidGitRef(commitFull)
                    ? safeExec(
                        `gh run list --commit ${commitFull} --workflow ci-cd.yml --json conclusion,status --limit 1 -q '.[0] | .status + ":" + .conclusion'`,
                    )
                    : "";

                const openPRs = safeExec(
                    `gh pr list --json number,title,headRefName --limit 5 -q '.[] | "#" + (.number|tostring) + " " + .title + " (" + .headRefName + ")"'`,
                );

                return textResult(
                    [
                        `## Git & CI Status`,
                        `- **Branch:** ${branch}`,
                        `- **Commit:** ${commit}`,
                        `- **Dirty:** ${dirty}`,
                        ciStatus
                            ? `- **CI:** ${ciStatus}`
                            : "- **CI:** unknown (gh not available or no runs)",
                        ``,
                        `### Recent Commits`,
                        recentLog || "(none)",
                        ``,
                        openPRs ? `### Open PRs\n${openPRs}` : "",
                    ]
                        .filter(Boolean)
                        .join("\n"),
                );
            })
    );

    // ── file_guard ────────────────────────────────────────────────
    registry.registerBuilt(
        freeTool(_userId)
            .tool("file_guard", "Pre-check if file changes will break tests. Runs `vitest --changed` against the specified commit. Use BEFORE committing to verify safety.", {
                commit_hash: z
                    .string()
                    .optional()
                    .describe("Base commit hash to diff against (default: HEAD~1)"),
            })
            .meta({ category: CATEGORY, tier: TIER })
            .handler(async ({ input, ctx: _ctx }) => {
                

                const base = input.commit_hash ?? "HEAD~1";
                if (!isValidGitRef(base)) {
                    return errorResult(
                        "Invalid commit hash format. Use a hex SHA, branch name, or HEAD~N.",
                    );
                }

                // Detect if all changes are within src/lib/mcp/ to scope test run
                const changedFiles = safeExec(`git diff --name-only ${base}`);
                const fileList = changedFiles.split("\n").filter(Boolean);
                const mcpOnly = fileList.length > 0
                    && fileList.every(f => f.startsWith("src/lib/mcp/"));
                const scope = mcpOnly ? " src/lib/mcp" : "";
                const scopeNote = mcpOnly ? " (scoped to MCP layer)" : " (full suite)";

                try {
                    const result = execSync(
                        `yarn vitest run --changed ${base}${scope} --reporter=verbose 2>&1`,
                        {
                            encoding: "utf-8",
                            timeout: 120_000,
                            stdio: ["pipe", "pipe", "pipe"],
                        },
                    );
                    return textResult(
                        `## File Guard: PASS${scopeNote}\n\n\`\`\`\n${result.slice(-2000)}\n\`\`\``,
                    );
                } catch (err: unknown) {
                    const output = (err as { stdout?: string; }).stdout ?? String(err);
                    return errorResult(
                        `## File Guard: FAIL${scopeNote}\n\n\`\`\`\n${output.slice(-2000)}\n\`\`\``,
                    );
                }
            })
    );

    // ── notify_agent ──────────────────────────────────────────────
    registry.registerBuilt(
        freeTool(_userId)
            .tool("notify_agent", "Send a dev workflow notification. Notifications are stored locally and can be read by other agents. Use to signal events like test failures, build completions, or file guard results.", {
                event: z.string().describe(
                    "Event type (e.g., 'test_failure', 'build_complete', 'file_guard_fail')",
                ),
                message: z.string().describe("Notification message"),
                severity: z.enum(["info", "warning", "error"]).optional().describe(
                    "Severity level (default: info)",
                ),
            })
            .meta({ category: CATEGORY, tier: TIER })
            .handler(async ({ input, ctx: _ctx }) => {
                

                mkdirSync(LOG_DIR, { recursive: true });

                const notification = {
                    timestamp: new Date().toISOString(),
                    event: input.event,
                    message: input.message,
                    severity: input.severity ?? "info",
                };

                // Append to notifications file (JSON lines format)
                let existing: unknown[] = [];
                if (existsSync(NOTIFICATIONS_FILE)) {
                    try {
                        existing = JSON.parse(
                            readFileSync(NOTIFICATIONS_FILE, "utf-8"),
                        ) as unknown[];
                    } catch {
                        existing = [];
                    }
                }
                existing.push(notification);
                // Keep last 50 notifications
                if (existing.length > 50) {
                    existing = existing.slice(-50);
                }
                writeFileSync(NOTIFICATIONS_FILE, JSON.stringify(existing, null, 2));

                // Also append to log
                appendFileSync(
                    join(LOG_DIR, "dev-server.log"),
                    `[${notification.severity.toUpperCase()}] [${notification.event}] ${notification.message}\n`,
                );

                return textResult(
                    `Notification sent: [${input.severity ?? "info"}] ${input.event} - ${input.message}`,
                );
            })
    );
}
