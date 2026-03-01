/**
 * AI Gateway MCP Tools
 *
 * Provider-agnostic AI interface: model discovery, multi-provider chat,
 * provider management, and usage reporting.
 */

import { z } from "zod";
import type { ToolRegistry } from "../tool-registry";
import { requireAdminRole, safeToolCall, textResult } from "./tool-helpers";
import { McpError, McpErrorCode } from "../../errors";
import {
    getModelsByCapability,
    getModelsForProvider,
    MODEL_REGISTRY,
    resolveModel,
    resolveProvider,
} from "@/lib/ai/model-registry";
import type { Prisma } from "@/generated/prisma";
import { freeTool, workspaceTool } from "../tool-builder/procedures.js";

// --- Schemas ---
// --- Admin helper (imported from tool-helpers) ---

// --- Tool registration ---

export function registerAiGatewayTools(
    registry: ToolRegistry,
    userId: string,
): void {
    // Tool 1: ai_list_providers
    registry.registerBuilt(
        freeTool(userId)
            .tool("ai_list_providers", "List configured AI providers with availability status, default provider, and capabilities.", {})
            .meta({ category: "ai-gateway", tier: "free" })
            .handler(async ({ input: _input, ctx: _ctx }) => {
                
                return safeToolCall("ai_list_providers", async () => {
                    const { isClaudeConfigured } = await import(
                        "@/lib/ai/claude-client"
                    );
                    const { isGeminiConfigured } = await import(
                        "@/lib/ai/gemini-client"
                    );
                    const { getDefaultAIProvider } = await import(
                        "@/lib/ai/ai-config-resolver"
                    );

                    const prisma = (await import("@/lib/prisma")).default;

                    const [claudeReady, geminiReady, defaultProvider, dbProviders] = await Promise.all([
                        isClaudeConfigured(),
                        isGeminiConfigured(),
                        getDefaultAIProvider(),
                        prisma.aIProvider.findMany({
                            select: { name: true, isDefault: true },
                        }),
                    ]);

                    const dbNames = new Set(
                        dbProviders.map((p: { name: string; }) => p.name),
                    );

                    const providers = [
                        {
                            name: "anthropic",
                            status: claudeReady ? "configured" : "not_configured",
                            isDefault: defaultProvider?.name === "anthropic",
                            capabilities: ["chat", "vision"],
                            source: dbNames.has("anthropic") ? "database" : "env",
                        },
                        {
                            name: "google",
                            status: geminiReady ? "configured" : "not_configured",
                            isDefault: defaultProvider?.name === "google",
                            capabilities: [
                                "chat",
                                "vision",
                                "image-gen",
                                "structured",
                            ],
                            source: dbNames.has("google") ? "database" : "env",
                        },
                    ];

                    return textResult(JSON.stringify({ providers }, null, 2));
                }, { userId });
            })
    );

    // Tool 2: ai_list_models
    registry.registerBuilt(
        freeTool(userId)
            .tool("ai_list_models", "List available AI models, optionally filtered by provider and/or capability.", {
                provider: z
                    .enum(["anthropic", "google", "all"])
                    .optional()
                    .default("all")
                    .describe("Filter by provider, or 'all' for every provider."),
                capability: z
                    .enum(["chat", "vision", "image-gen", "structured", "all"])
                    .optional()
                    .default("all")
                    .describe("Filter by capability, or 'all'."),
            })
            .meta({ category: "ai-gateway", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const {
                    provider = "all",
                    capability = "all",
                } = input;
                return safeToolCall("ai_list_models", async () => {
                    let models = provider === "all"
                        ? [...MODEL_REGISTRY]
                        : getModelsForProvider(provider);

                    if (capability !== "all") {
                        const capModels = getModelsByCapability(capability);
                        const capIds = new Set(capModels.map(m => m.id));
                        models = models.filter(m => capIds.has(m.id));
                    }

                    const result = models.map(m => ({
                        id: m.id,
                        displayName: m.displayName,
                        provider: m.provider,
                        aliases: m.aliases,
                        capabilities: m.capabilities,
                        maxOutputTokens: m.maxOutputTokens,
                    }));

                    return textResult(
                        JSON.stringify({ models: result, count: result.length }, null, 2),
                    );
                }, { userId });
            })
    );

    // Tool 3: ai_chat
    registry.registerBuilt(
        workspaceTool(userId)
            .tool("ai_chat", "Send a message to any configured AI provider (Anthropic or Google) with automatic provider/model detection.", {
                message: z.string().min(1).describe("The message to send to the AI model."),
                provider: z
                    .enum(["anthropic", "google"])
                    .optional()
                    .describe(
                        "Explicit provider override. Auto-detected from model if omitted.",
                    ),
                model: z
                    .string()
                    .optional()
                    .describe(
                        "Model ID or alias (e.g. 'opus', 'gemini-flash'). Defaults to provider's default.",
                    ),
                system_prompt: z.string().optional().describe("Optional system prompt."),
                max_tokens: z
                    .number()
                    .int()
                    .min(1)
                    .max(65536)
                    .optional()
                    .describe("Maximum output tokens."),
                temperature: z
                    .number()
                    .min(0)
                    .max(2)
                    .optional()
                    .describe("Sampling temperature."),
            })
            .meta({ category: "ai-gateway", tier: "workspace" })
            .handler(async ({ input, ctx: _ctx }) => {
                const {
                    message,
                    provider,
                    model,
                    system_prompt,
                    max_tokens,
                    temperature,
                } = input;
                return safeToolCall("ai_chat", async () => {
                    const resolvedProvider = resolveProvider(model, provider);
                    const resolvedModelInfo = model ? resolveModel(model) : undefined;

                    if (resolvedProvider === "anthropic") {
                        const { getClaudeClient } = await import(
                            "@/lib/ai/claude-client"
                        );
                        const anthropic = await getClaudeClient();

                        const modelId = resolvedModelInfo?.id ?? "claude-sonnet-4-6";
                        const maxTokens = max_tokens ?? resolvedModelInfo?.maxOutputTokens
                            ?? 16384;

                        const response = await anthropic.messages.create({
                            model: modelId,
                            max_tokens: maxTokens,
                            ...(system_prompt ? { system: system_prompt } : {}),
                            ...(temperature != null ? { temperature } : {}),
                            messages: [{ role: "user", content: message }],
                        });

                        const textParts: string[] = [];
                        for (const block of response.content) {
                            if (block.type === "text") {
                                textParts.push(block.text);
                            }
                        }

                        return textResult(
                            JSON.stringify(
                                {
                                    provider: "anthropic",
                                    model: modelId,
                                    response: textParts.join("\n"),
                                    usage: {
                                        input_tokens: response.usage.input_tokens,
                                        output_tokens: response.usage.output_tokens,
                                    },
                                },
                                null,
                                2,
                            ),
                        );
                    }

                    // Google / Gemini path
                    const { getGeminiClient } = await import(
                        "@/lib/ai/gemini-client"
                    );
                    const ai = await getGeminiClient();

                    const modelId = resolvedModelInfo?.id ?? "gemini-3-flash-preview";
                    const maxTokens = max_tokens ?? resolvedModelInfo?.maxOutputTokens
                        ?? 8192;

                    const response = await ai.models.generateContent({
                        model: modelId,
                        contents: [
                            { role: "user", parts: [{ text: message }] },
                        ],
                        config: {
                            ...(system_prompt ? { systemInstruction: system_prompt } : {}),
                            maxOutputTokens: maxTokens,
                            ...(temperature != null ? { temperature } : {}),
                        },
                    });

                    const responseText = response?.text ?? "";
                    const usageMetadata = response?.usageMetadata;

                    return textResult(
                        JSON.stringify(
                            {
                                provider: "google",
                                model: modelId,
                                response: responseText,
                                usage: {
                                    input_tokens: usageMetadata?.promptTokenCount ?? 0,
                                    output_tokens: usageMetadata?.candidatesTokenCount ?? 0,
                                },
                            },
                            null,
                            2,
                        ),
                    );
                }, { userId });
            })
    );

    // Tool 4: ai_manage_provider
    registry.registerBuilt(
        workspaceTool(userId)
            .tool("ai_manage_provider", "Manage AI provider credentials (upsert, delete, set default). Admin-only.", {
                action: z
                    .enum(["upsert", "delete", "set_default"])
                    .describe("Action to perform on the provider."),
                provider_id: z
                    .string()
                    .optional()
                    .describe(
                        "Provider name (e.g. 'anthropic', 'google'). Required for upsert/delete.",
                    ),
                token: z.string().optional().describe("API token for upsert."),
                config: z
                    .record(z.string(), z.unknown())
                    .optional()
                    .describe("Additional config JSON for upsert."),
            })
            .meta({ category: "ai-gateway", tier: "workspace" })
            .handler(async ({ input, ctx: _ctx }) => {
                const {
                    action,
                    provider_id,
                    token,
                    config,
                } = input;
                return safeToolCall("ai_manage_provider", async () => {
                    await requireAdminRole(userId);

                    const prisma = (await import("@/lib/prisma")).default;

                    if (action === "upsert") {
                        if (!provider_id) {
                            throw new McpError(
                                "provider_id is required for upsert.",
                                McpErrorCode.VALIDATION_ERROR,
                                false,
                            );
                        }

                        const { safeEncryptToken } = await import(
                            "@/lib/crypto/token-encryption"
                        );

                        const updateData: Prisma.AIProviderUpdateInput = {};
                        if (token !== undefined) {
                            updateData.tokenEncrypted = safeEncryptToken(token);
                            updateData.token = null; // Clear legacy field
                        }
                        if (config !== undefined) {
                            updateData.config = config as Prisma.InputJsonValue;
                        }

                        await prisma.aIProvider.upsert({
                            where: { name: provider_id },
                            create: {
                                name: provider_id,
                                tokenEncrypted: token ? safeEncryptToken(token) : null,
                                token: null,
                                isDefault: false,
                                ...(config ? { config: config as Prisma.InputJsonValue } : {}),
                            },
                            update: updateData,
                        });

                        // Reset cached clients so they pick up new config
                        const { resetClaudeClient } = await import(
                            "@/lib/ai/claude-client"
                        );
                        const { resetGeminiClient } = await import(
                            "@/lib/ai/gemini-client"
                        );
                        resetClaudeClient();
                        resetGeminiClient();

                        return textResult(
                            `Provider '${provider_id}' upserted successfully.`,
                        );
                    }

                    if (action === "delete") {
                        if (!provider_id) {
                            throw new McpError(
                                "provider_id is required for delete.",
                                McpErrorCode.VALIDATION_ERROR,
                                false,
                            );
                        }
                        await prisma.aIProvider.delete({
                            where: { name: provider_id },
                        });

                        const { resetClaudeClient } = await import(
                            "@/lib/ai/claude-client"
                        );
                        const { resetGeminiClient } = await import(
                            "@/lib/ai/gemini-client"
                        );
                        resetClaudeClient();
                        resetGeminiClient();

                        return textResult(
                            `Provider '${provider_id}' deleted.`,
                        );
                    }

                    // set_default
                    if (!provider_id) {
                        throw new McpError(
                            "provider_id is required for set_default.",
                            McpErrorCode.VALIDATION_ERROR,
                            false,
                        );
                    }
                    // Unset all defaults, then set the target
                    await prisma.aIProvider.updateMany({
                        where: { isDefault: true },
                        data: { isDefault: false },
                    });
                    await prisma.aIProvider.update({
                        where: { name: provider_id },
                        data: { isDefault: true },
                    });

                    return textResult(
                        `Provider '${provider_id}' set as default.`,
                    );
                }, { userId });
            })
    );

    // Tool 5: ai_get_usage
    registry.registerBuilt(
        freeTool(userId)
            .tool("ai_get_usage", "Get AI usage statistics: total invocations, token counts, breakdown by provider.", {
                days: z
                    .number()
                    .int()
                    .min(1)
                    .max(90)
                    .optional()
                    .default(7)
                    .describe("Number of days to look back (default 7)."),
                provider: z
                    .string()
                    .optional()
                    .describe("Filter by provider name."),
            })
            .meta({ category: "ai-gateway", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const {
                    days = 7,
                    provider,
                } = input;
                return safeToolCall("ai_get_usage", async () => {
                    const prisma = (await import("@/lib/prisma")).default;

                    const since = new Date();
                    since.setDate(since.getDate() - days);

                    const invocations = await prisma.toolInvocation.findMany({
                        where: {
                            tool: { in: ["ai_chat", "chat_send_message"] },
                            createdAt: { gte: since },
                            ...(provider
                                ? {
                                    input: {
                                        path: ["provider"],
                                        equals: provider,
                                    },
                                }
                                : {}),
                        },
                        select: {
                            tool: true,
                            input: true,
                            durationMs: true,
                            isError: true,
                            createdAt: true,
                        },
                    });

                    const totalInvocations = invocations.length;
                    const errorCount = invocations.filter((i: { isError: boolean; }) => i.isError).length;
                    const avgDuration = totalInvocations > 0
                        ? Math.round(
                            invocations.reduce(
                                (sum: number, i: { durationMs: number | null; }) => sum + (i.durationMs ?? 0),
                                0,
                            ) / totalInvocations,
                        )
                        : 0;

                    // Breakdown by tool name
                    const byTool: Record<string, number> = {};
                    for (const inv of invocations) {
                        byTool[inv.tool] = (byTool[inv.tool] ?? 0) + 1;
                    }

                    return textResult(
                        JSON.stringify(
                            {
                                period: `last ${days} days`,
                                totalInvocations,
                                errorCount,
                                avgDurationMs: avgDuration,
                                byTool,
                            },
                            null,
                            2,
                        ),
                    );
                }, { userId });
            })
    );
}
