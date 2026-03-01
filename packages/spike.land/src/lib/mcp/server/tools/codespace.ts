/**
 * CodeSpace Tools (Server-Side)
 *
 * Uses SessionService for direct database access instead of HTTP calls
 * to the Cloudflare Worker. Falls back to HTTP for screenshot capture.
 */

import { z } from "zod";
import type { ToolRegistry } from "../tool-registry";
import { getFilesystem } from "./filesystem";
import {
    getOrCreateSession,
    getSession,
    upsertSession,
} from "@/lib/codespace/session-service";
import { transpileCode } from "@/lib/codespace/transpile";
import { SPIKE_LAND_BASE_URL } from "./tool-helpers";
import { freeTool } from "../tool-builder/procedures.js";

const COMPONENT_URL = process.env.SPIKE_LAND_COMPONENT_URL
    || "https://testing.spike.land";

const CODESPACE_ID_PATTERN = /^[a-zA-Z0-9_.-]+$/;

function validateCodeSpaceId(id: string): void {
    if (!CODESPACE_ID_PATTERN.test(id)) {
        throw new Error(`Invalid codespace ID format: ${id}`);
    }
}

async function spikeLandRequest<T>(
    endpoint: string,
    apiKey: string,
    options: RequestInit = {},
): Promise<{ data: T | null; error: string | null; }> {
    try {
        const url = `${SPIKE_LAND_BASE_URL}${endpoint}`;
        const response = await fetch(url, {
            ...options,
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                ...options.headers,
            },
        });
        const json = await response.json();
        if (!response.ok) {
            return {
                data: null,
                error: (json as { error?: string; })?.error
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

export function registerCodeSpaceTools(
    registry: ToolRegistry,
    _userId: string,
): void {
    const serviceToken = process.env.SPIKE_LAND_SERVICE_TOKEN
        || process.env.SPIKE_LAND_API_KEY || "";

    registry.registerBuilt(
        freeTool(_userId)
            .tool("codespace_update", `Create or update a live React application.\nThe app is available at: ${SPIKE_LAND_BASE_URL}/api/codespace/{codespace_id}/embed`, {
                codespace_id: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_.-]+$/),
                code: z.string().min(1),
                run: z.boolean().optional().default(true),
            })
            .meta({ category: "codespace", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const { codespace_id, code, run } = input;

                validateCodeSpaceId(codespace_id);
                try {
                    const session = await getOrCreateSession(codespace_id);
                    let transpiled = session.transpiled;
                    if (run !== false) {
                        transpiled = await transpileCode(code, SPIKE_LAND_BASE_URL);
                    }
                    const updated = await upsertSession({
                        ...session,
                        codeSpace: codespace_id,
                        code,
                        transpiled,
                        messages: session.messages ?? [],
                    });
                    return {
                        content: [{
                            type: "text",
                            text:
                                `**CodeSpace Updated!**\n\n**ID:** ${updated.codeSpace}\n**Hash:** ${updated.hash}\n**Live URL:** ${SPIKE_LAND_BASE_URL}/api/codespace/${codespace_id}/embed`,
                        }],
                    };
                } catch (error) {
                    const msg = error instanceof Error ? error.message : "Unknown error";
                    return {
                        content: [{ type: "text", text: `Error: ${msg}` }],
                        isError: true,
                    };
                }
            })
    );

    registry.registerBuilt(
        freeTool(_userId)
            .tool("codespace_run", "Transpile and render a codespace without updating code.", {
                codespace_id: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_.-]+$/),
            })
            .meta({ category: "codespace", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const { codespace_id } = input;

                validateCodeSpaceId(codespace_id);
                try {
                    const session = await getSession(codespace_id);
                    if (!session) {
                        return {
                            content: [{
                                type: "text",
                                text: `Error: Codespace "${codespace_id}" not found`,
                            }],
                            isError: true,
                        };
                    }
                    const transpiled = await transpileCode(
                        session.code,
                        SPIKE_LAND_BASE_URL,
                    );
                    const updated = await upsertSession({ ...session, transpiled });
                    return {
                        content: [{
                            type: "text",
                            text:
                                `**Transpiled!**\n\n**ID:** ${updated.codeSpace}\n**Hash:** ${updated.hash}\n**Live URL:** ${SPIKE_LAND_BASE_URL}/api/codespace/${codespace_id}/embed`,
                        }],
                    };
                } catch (error) {
                    const msg = error instanceof Error ? error.message : "Unknown error";
                    return {
                        content: [{ type: "text", text: `Error: ${msg}` }],
                        isError: true,
                    };
                }
            })
    );

    registry.registerBuilt(
        freeTool(_userId)
            .tool("codespace_screenshot", "Get a JPEG screenshot of a running codespace.", {
                codespace_id: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_.-]+$/),
            })
            .meta({ category: "codespace", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const { codespace_id } = input;

                validateCodeSpaceId(codespace_id);
                // Screenshots require a running browser — fetch from the component worker or local API
                const screenshotUrl = `${COMPONENT_URL}/live/${codespace_id}/api/screenshot`;
                try {
                    const response = await fetch(screenshotUrl);
                    if (!response.ok) {
                        return {
                            content: [{
                                type: "text",
                                text: `Error: Screenshot unavailable (${response.status})`,
                            }],
                            isError: true,
                        };
                    }
                    const buf = await response.arrayBuffer();
                    return {
                        content: [
                            {
                                type: "text",
                                text:
                                    `**Screenshot of ${codespace_id}**\nLive URL: ${SPIKE_LAND_BASE_URL}/api/codespace/${codespace_id}/embed`,
                            },
                            {
                                type: "image",
                                data: Buffer.from(buf).toString("base64"),
                                mimeType: "image/jpeg",
                            },
                        ],
                    };
                } catch (error) {
                    const msg = error instanceof Error ? error.message : "Unknown error";
                    return {
                        content: [{ type: "text", text: `Error: ${msg}` }],
                        isError: true,
                    };
                }
            })
    );

    registry.registerBuilt(
        freeTool(_userId)
            .tool("codespace_get", "Get the current code and session data for a codespace.", {
                codespace_id: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_.-]+$/),
            })
            .meta({ category: "codespace", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const { codespace_id } = input;

                validateCodeSpaceId(codespace_id);
                try {
                    const session = await getSession(codespace_id);
                    if (!session) {
                        return {
                            content: [{
                                type: "text",
                                text: `Error: Codespace "${codespace_id}" not found`,
                            }],
                            isError: true,
                        };
                    }
                    let text =
                        `**CodeSpace Details**\n\n**ID:** ${session.codeSpace}\n**Hash:** ${session.hash}\n**Live URL:** ${SPIKE_LAND_BASE_URL}/api/codespace/${codespace_id}/embed\n`;
                    text += `\n**Source Code:**\n\`\`\`tsx\n${session.code}\n\`\`\``;
                    return { content: [{ type: "text", text }] };
                } catch (error) {
                    const msg = error instanceof Error ? error.message : "Unknown error";
                    return {
                        content: [{ type: "text", text: `Error: ${msg}` }],
                        isError: true,
                    };
                }
            })
    );

    registry.registerBuilt(
        freeTool(_userId)
            .tool("codespace_link_app", "Link a codespace to the user's apps on spike.land.", {
                codespace_id: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_.-]+$/),
                app_id: z.string().optional(),
                app_name: z.string().min(3).max(50).optional(),
                app_description: z.string().min(10).max(500).optional(),
            })
            .meta({ category: "codespace", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const { codespace_id, app_id, app_name, app_description } = input;

                if (app_id) {
                    const result = await spikeLandRequest<{ id: string; name: string; }>(
                        `/api/apps/${app_id}`,
                        serviceToken,
                        {
                            method: "PATCH",
                            body: JSON.stringify({ codespaceId: codespace_id }),
                        },
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
                            text: `**Linked!** App ${result.data?.name} → codespace ${codespace_id}`,
                        }],
                    };
                }
                if (!app_name) {
                    return {
                        content: [{
                            type: "text",
                            text: "Either app_id or app_name required",
                        }],
                        isError: true,
                    };
                }
                const result = await spikeLandRequest<{ id: string; name: string; }>(
                    "/api/apps",
                    serviceToken,
                    {
                        method: "POST",
                        body: JSON.stringify({
                            name: app_name,
                            description: app_description
                                || `App from codespace ${codespace_id}`,
                            requirements: "Codespace-based app",
                            monetizationModel: "free",
                            codespaceId: codespace_id,
                        }),
                    },
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
                        text:
                            `**App Created!** ${result.data?.name} → codespace ${codespace_id}\nView: https://spike.land/create`,
                    }],
                };
            })
    );

    registry.registerBuilt(
        freeTool(_userId)
            .tool("codespace_list_my_apps", "List the user's apps from spike.land.", {})
            .meta({ category: "codespace", tier: "free" })
            .handler(async ({ input: _input, ctx: _ctx }) => {
                const result = await spikeLandRequest<
                    Array<
                        {
                            id: string;
                            name: string;
                            status: string;
                            codespaceId?: string;
                            codespaceUrl?: string;
                        }
                    >
                >("/api/apps", serviceToken);
                if (result.error) {
                    return {
                        content: [{ type: "text", text: `Error: ${result.error}` }],
                        isError: true,
                    };
                }
                const apps = result.data || [];
                let text = `**My Apps (${apps.length}):**\n\n`;
                if (apps.length === 0) text += "No apps found.";
                else {
                    for (const app of apps) {
                        text += `- **${app.name}** (${app.status}) ID: ${app.id}\n`;
                        if (app.codespaceId) text += `  Codespace: ${app.codespaceId}\n`;
                    }
                }
                return { content: [{ type: "text", text }] };
            })
    );

    registry.registerBuilt(
        freeTool(_userId)
            .tool("codespace_run_tests", "Discover and validate test files in a codespace filesystem.\nReturns inventory of test files found.", {
                codespace_id: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_.-]+$/),
                test_path: z.string().optional().describe(
                    "Specific test file path, or omit to find all",
                ),
            })
            .meta({ category: "codespace", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const { codespace_id, test_path } = input;

                validateCodeSpaceId(codespace_id);
                const fs = getFilesystem(codespace_id);

                if (fs.size === 0) {
                    return {
                        content: [{
                            type: "text",
                            text: `No files in codespace "${codespace_id}". Use fs_write to add files first.`,
                        }],
                        isError: true,
                    };
                }

                const testFiles: string[] = [];
                for (const path of fs.keys()) {
                    if (test_path) {
                        const normalized = path.startsWith("/") ? path : `/${path}`;
                        const normalizedTarget = test_path.startsWith("/")
                            ? test_path
                            : `/${test_path}`;
                        if (normalized === normalizedTarget) {
                            testFiles.push(path);
                        }
                    } else if (/\.(test|spec)\.(ts|tsx|js|jsx)$/.test(path)) {
                        testFiles.push(path);
                    }
                }

                if (testFiles.length === 0) {
                    return {
                        content: [{
                            type: "text",
                            text: `No test files found in codespace "${codespace_id}".${test_path ? ` Looked for: ${test_path}` : ""
                                }`,
                        }],
                        isError: true,
                    };
                }

                const details = testFiles.map(p => {
                    const content = fs.get(p) || "";
                    const lines = content.split("\n").length;
                    return `- **${p}** (${lines} lines)`;
                });

                return {
                    content: [{
                        type: "text",
                        text: `**Test files (${testFiles.length}):**\n\n${details.join("\n")
                            }\n\n_MVP: Test execution coming soon. Files are syntactically present._`,
                    }],
                };
            })
    );

    registry.registerBuilt(
        freeTool(_userId)
            .tool("codespace_generate_variant", "Generate code variants from tests and spec.\nMVP: Returns stub variant IDs. Full AI generation coming soon.", {
                codespace_id: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_.-]+$/),
                spec: z.string().optional().describe(
                    "Natural language spec for generation",
                ),
                count: z.number().int().min(1).max(10).optional().default(3).describe(
                    "Number of variants",
                ),
                model: z.string().optional().default("claude-sonnet-4-6").describe(
                    "AI model to use",
                ),
            })
            .meta({ category: "codespace", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const { codespace_id, spec, count } = input;

                validateCodeSpaceId(codespace_id);
                const fs = getFilesystem(codespace_id);
                const variantCount = count ?? 3;

                // Find test files
                const testFiles: string[] = [];
                for (const path of fs.keys()) {
                    if (/\.(test|spec)\.(ts|tsx|js|jsx)$/.test(path)) {
                        testFiles.push(path);
                    }
                }

                // Find entry point
                const entryPoint = fs.get("/src/App.tsx");

                const variants = Array.from(
                    { length: variantCount },
                    (_, i) => `${codespace_id}-v${i + 1}`,
                );

                let text = `**Generation request accepted**\n\n`;
                text += `- **Base codespace:** ${codespace_id}\n`;
                text += `- **Test files:** ${testFiles.length > 0 ? testFiles.join(", ") : "none"}\n`;
                text += `- **Entry point:** ${entryPoint ? "found" : "missing"}\n`;
                text += `- **Spec:** ${spec || "(none)"}\n`;
                text += `- **Variants:** ${variants.join(", ")}\n\n`;
                text += `_MVP: Variant IDs reserved. Full AI generation coming soon._`;

                return { content: [{ type: "text", text }] };
            })
    );

    registry.registerBuilt(
        freeTool(_userId)
            .tool("codespace_regenerate", "Regenerate codespace code from tests or restore from version.\nDefault: regenerates from tests if they exist.", {
                codespace_id: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_.-]+$/),
                from_tests: z.boolean().optional().describe("Regenerate from test files"),
                from_version: z.number().int().optional().describe(
                    "Restore from version number",
                ),
            })
            .meta({ category: "codespace", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const { codespace_id, from_tests, from_version } = input;

                validateCodeSpaceId(codespace_id);
                const fs = getFilesystem(codespace_id);

                if (from_version !== undefined) {
                    return {
                        content: [{
                            type: "text",
                            text:
                                `**Version restore requested**\n\n- **Codespace:** ${codespace_id}\n- **Version:** ${from_version}\n\n_MVP: Version restore coming soon._`,
                        }],
                    };
                }

                // Default or explicit from_tests
                const testFiles: string[] = [];
                for (const path of fs.keys()) {
                    if (/\.(test|spec)\.(ts|tsx|js|jsx)$/.test(path)) {
                        testFiles.push(path);
                    }
                }

                if (
                    testFiles.length === 0
                    && (from_tests === true || from_tests === undefined)
                ) {
                    return {
                        content: [{
                            type: "text",
                            text:
                                `No test files found in codespace "${codespace_id}". Write tests first with fs_write.`,
                        }],
                        isError: true,
                    };
                }

                let text = `**Regeneration request accepted**\n\n`;
                text += `- **Codespace:** ${codespace_id}\n`;
                text += `- **Strategy:** ${from_tests ? "from tests" : "auto (tests found)"}\n`;
                text += `- **Test files:** ${testFiles.join(", ")}\n\n`;
                text += `_MVP: Regeneration coming soon. Test files identified._`;

                return { content: [{ type: "text", text }] };
            })
    );
}
