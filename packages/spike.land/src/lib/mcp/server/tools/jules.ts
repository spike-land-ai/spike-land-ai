/**
 * Jules Tools (Server-Side)
 *
 * Uses server-side JULES_API_KEY instead of requiring user to provide it.
 */

import { z } from "zod";
import type { ToolRegistry } from "../tool-registry";
import { freeTool } from "../tool-builder/procedures.js";

const JULES_BASE_URL = "https://jules.googleapis.com/v1alpha";
const SESSION_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

function validateSessionId(sessionId: string): void {
    const id = sessionId.replace(/^sessions\//, "");
    if (!SESSION_ID_PATTERN.test(id)) {
        throw new Error(`Invalid session ID format: ${sessionId}`);
    }
}

async function julesRequest<T>(
    endpoint: string,
    options: RequestInit = {},
): Promise<{ data: T | null; error: string | null; }> {
    const apiKey = process.env.JULES_API_KEY;
    if (!apiKey) {
        return { data: null, error: "Jules API not configured on server" };
    }

    try {
        const response = await fetch(`${JULES_BASE_URL}${endpoint}`, {
            ...options,
            headers: {
                "X-Goog-Api-Key": apiKey,
                "Content-Type": "application/json",
                ...options.headers,
            },
        });
        const json = await response.json();
        if (!response.ok) {
            return {
                data: null,
                error: (json as { error?: { message?: string; }; })?.error?.message
                    || `API error: ${response.status}`,
            };
        }
        return { data: json as T, error: null };
    } catch (error) {
        return {
            data: null,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

export function isJulesAvailable(): boolean {
    return !!process.env.JULES_API_KEY;
}

export function registerJulesTools(
    registry: ToolRegistry,
    _userId: string,
): void {
    if (!isJulesAvailable()) return;

    registry.registerBuilt(
        freeTool(_userId)
            .tool("jules_list_sessions", "List all Jules coding sessions with their current status.", {
                status: z.enum([
                    "QUEUED",
                    "PLANNING",
                    "AWAITING_PLAN_APPROVAL",
                    "IN_PROGRESS",
                    "COMPLETED",
                    "FAILED",
                ]).optional(),
                page_size: z.number().min(1).max(50).optional().default(20),
            })
            .meta({ category: "jules", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const { status, page_size } = input;

                const params = new URLSearchParams();
                if (page_size) params.set("pageSize", String(page_size));
                const result = await julesRequest<
                    {
                        sessions: Array<
                            { name: string; state: string; title?: string; url?: string; }
                        >;
                    }
                >(`/sessions${params.toString() ? `?${params}` : ""}`);
                if (result.error) {
                    return {
                        content: [{ type: "text", text: `Error: ${result.error}` }],
                        isError: true,
                    };
                }
                let sessions = result.data?.sessions || [];
                if (status) sessions = sessions.filter(s => s.state === status);
                let text = `**Jules Sessions (${sessions.length}):**\n\n`;
                if (sessions.length === 0) text += "No sessions found.";
                else {
                    for (const s of sessions) {
                        text += `- **${s.title || s.name}** [${s.state}]\n  ID: ${s.name}\n`;
                        if (s.url) text += `  URL: ${s.url}\n`;
                        text += "\n";
                    }
                }
                return { content: [{ type: "text", text }] };
            })
    );

    registry.registerBuilt(
        freeTool(_userId)
            .tool("jules_create_session", "Create a new Jules coding task for async implementation.", {
                title: z.string().min(1).max(200),
                task: z.string().min(1).max(4000),
                source_repo: z.string().optional(),
                starting_branch: z.string().optional().default("main"),
            })
            .meta({ category: "jules", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const { title, task, source_repo, starting_branch } = input;

                const source = source_repo
                    ? `sources/github/${source_repo}`
                    : `sources/github/${process.env.GITHUB_OWNER || "spike-land-ai"}/${process.env.GITHUB_REPO || "spike.land"
                    }`;
                const result = await julesRequest<
                    { name: string; state: string; url?: string; }
                >("/sessions", {
                    method: "POST",
                    body: JSON.stringify({
                        prompt: task,
                        sourceContext: {
                            source,
                            githubRepoContext: { startingBranch: starting_branch },
                        },
                        title,
                        requirePlanApproval: true,
                        automationMode: "AUTO_CREATE_PR",
                    }),
                });
                if (result.error) {
                    return {
                        content: [{ type: "text", text: `Error: ${result.error}` }],
                        isError: true,
                    };
                }
                let text =
                    `**Jules Session Created!**\n\n**Title:** ${title}\n**ID:** ${result.data?.name}\n**Status:** ${result.data?.state}\n`;
                if (result.data?.url) text += `**URL:** ${result.data.url}\n`;
                return { content: [{ type: "text", text }] };
            })
    );

    registry.registerBuilt(
        freeTool(_userId)
            .tool("jules_get_session", "Get details and activities for a Jules session.", {
                session_id: z.string(),
                include_activities: z.boolean().optional().default(true),
            })
            .meta({ category: "jules", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const { session_id, include_activities } = input;

                validateSessionId(session_id);
                const name = session_id.startsWith("sessions/")
                    ? session_id
                    : `sessions/${session_id}`;
                const result = await julesRequest<
                    {
                        name: string;
                        state: string;
                        title?: string;
                        url?: string;
                        planSummary?: string;
                    }
                >(`/${name}`);
                if (result.error) {
                    return {
                        content: [{ type: "text", text: `Error: ${result.error}` }],
                        isError: true,
                    };
                }
                let text =
                    `**Jules Session**\n\n**ID:** ${result.data?.name}\n**Status:** ${result.data?.state}\n**Title:** ${result.data?.title || "Untitled"
                    }\n`;
                if (result.data?.url) text += `**URL:** ${result.data.url}\n`;
                if (result.data?.planSummary) {
                    text += `\n**Plan:**\n${result.data.planSummary}\n`;
                }
                if (include_activities) {
                    const activities = await julesRequest<
                        { activities: Array<{ type?: string; content?: string; }>; }
                    >(`/${name}/activities?pageSize=10`);
                    if (activities.data?.activities?.length) {
                        text += `\n**Activities:**\n`;
                        for (const a of activities.data.activities) {
                            text += `- ${a.type || "Activity"}: ${a.content || "(no content)"}\n`;
                        }
                    }
                }
                return { content: [{ type: "text", text }] };
            })
    );

    registry.registerBuilt(
        freeTool(_userId)
            .tool("jules_approve_plan", "Approve the implementation plan for a Jules session.", { session_id: z.string() })
            .meta({ category: "jules", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const { session_id } = input;

                validateSessionId(session_id);
                const name = session_id.startsWith("sessions/")
                    ? session_id
                    : `sessions/${session_id}`;
                const result = await julesRequest<{ state: string; }>(
                    `/${name}:approvePlan`,
                    { method: "POST" },
                );
                if (result.error) {
                    return {
                        content: [{ type: "text", text: `Error: ${result.error}` }],
                        isError: true,
                    };
                }
                return {
                    content: [{
                        type: "text",
                        text: `**Plan Approved!** Status: ${result.data?.state || "IN_PROGRESS"}`,
                    }],
                };
            })
    );

    registry.registerBuilt(
        freeTool(_userId)
            .tool("jules_send_message", "Send a message to an active Jules session.", {
                session_id: z.string(),
                message: z.string().min(1).max(4000),
            })
            .meta({ category: "jules", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const { session_id, message } = input;

                validateSessionId(session_id);
                const name = session_id.startsWith("sessions/")
                    ? session_id
                    : `sessions/${session_id}`;
                const result = await julesRequest<{ state: string; }>(
                    `/${name}:sendMessage`,
                    { method: "POST", body: JSON.stringify({ prompt: message }) },
                );
                if (result.error) {
                    return {
                        content: [{ type: "text", text: `Error: ${result.error}` }],
                        isError: true,
                    };
                }
                return {
                    content: [{
                        type: "text",
                        text: `**Message Sent!** To: ${session_id}`,
                    }],
                };
            })
    );
}
