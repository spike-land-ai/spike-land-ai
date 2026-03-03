/**
 * Tool Factory Tools (Server-Side)
 *
 * Agent Tool Factory — lets agents register custom tools scoped
 * to a user's workspace. Tool handlers are declarative HTTP proxy
 * specs (not arbitrary code), eliminating RCE vectors.
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "../tool-registry";

type PrismaClient = Awaited<typeof import("@/lib/prisma")>["default"];

const FREE_TOOL_LIMIT = 5;
const PREMIUM_TOOL_LIMIT = 500;

// Private IP ranges for SSRF prevention
const PRIVATE_IP_PATTERNS = [
  /^https?:\/\/localhost/i,
  /^https?:\/\/127\./,
  /^https?:\/\/0\./,
  /^https?:\/\/10\./,
  /^https?:\/\/172\.(1[6-9]|2\d|3[01])\./,
  /^https?:\/\/192\.168\./,
  /^https?:\/\/\[::1\]/,
  /^https?:\/\/\[fe80:/i,
  /^https?:\/\/169\.254\./,
];

// Template variable pattern — only allow {{secrets.KEY}} and {{input.FIELD}}
const VALID_TEMPLATE_VAR = /\{\{(secrets|input)\.[a-zA-Z][a-zA-Z0-9_]*\}\}/g;
const ANY_TEMPLATE_VAR = /\{\{[^}]+\}\}/g;

/**
 * Validate that a URL is HTTPS and not targeting private/internal addresses.
 */
export function validateUrl(url: string): string | null {
  if (!url.startsWith("https://")) {
    return "URL must use HTTPS";
  }
  for (const pattern of PRIVATE_IP_PATTERNS) {
    if (pattern.test(url)) {
      return "URL must not target private/internal addresses";
    }
  }
  return null;
}

/**
 * Validate that template strings only contain allowed variable references.
 */
export function validateTemplate(template: string): string | null {
  const allVars: string[] = template.match(ANY_TEMPLATE_VAR) ?? [];
  const validVars: string[] = template.match(VALID_TEMPLATE_VAR) ?? [];
  if (allVars.length !== validVars.length) {
    const invalid = allVars.filter(v => !validVars.includes(v));
    return `Invalid template variables: ${
      invalid.join(", ")
    }. Only {{secrets.KEY}} and {{input.FIELD}} are allowed.`;
  }
  return null;
}

const HandlerSpecSchema = z.object({
  url: z.string().min(1),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  headers: z.record(z.string(), z.string()).optional().default({}),
  body: z.string().optional(),
  responseTransform: z
    .object({
      type: z.literal("json_path"),
      path: z.string(),
    })
    .optional(),
});

const RegisterToolSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(100)
    .regex(
      /^[a-z][a-z0-9_]*$/,
      "Name must be lowercase, start with a letter, and contain only letters, numbers, and underscores",
    ),
  description: z.string().min(1).max(500),
  input_schema: z.record(z.string(), z.unknown()).default({}),
  handler_spec: HandlerSpecSchema,
});

const ToolIdSchema = z.object({
  tool_id: z.string().min(1),
});

const TestToolSchema = z.object({
  tool_id: z.string().min(1),
  test_input: z.record(z.string(), z.unknown()).default({}),
});

async function getToolCount(
  prisma: PrismaClient,
  userId: string,
): Promise<number> {
  return prisma.registeredTool.count({
    where: { userId, status: { not: "DISABLED" } },
  });
}

async function getToolLimit(
  prisma: PrismaClient,
  userId: string,
): Promise<number> {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
    select: { tier: true },
  });
  if (subscription?.tier && subscription.tier !== "FREE") {
    return PREMIUM_TOOL_LIMIT;
  }
  return FREE_TOOL_LIMIT;
}

/**
 * Resolve template variables in a string.
 * {{input.field}} → input[field]
 * {{secrets.KEY}} → resolved secret value
 */
export function resolveTemplate(
  template: string,
  input: Record<string, unknown>,
  secrets: Record<string, string>,
): string {
  return template.replace(VALID_TEMPLATE_VAR, match => {
    const inner = match.slice(2, -2); // Remove {{ and }}
    const [namespace, key] = inner.split(".");
    if (namespace === "input" && key) {
      const value = input[key];
      return value !== undefined ? String(value) : match;
    }
    if (namespace === "secrets" && key) {
      return secrets[key] ?? match;
    }
    return match;
  });
}

export function registerToolFactoryTools(
  registry: ToolRegistry,
  userId: string,
): void {
  registry.register({
    name: "register_tool",
    description: "Register a custom tool with a declarative HTTP proxy handler. "
      + "The tool handler is a JSON spec defining URL, method, headers, and body templates. "
      + "Use {{secrets.KEY}} to reference vault secrets and {{input.FIELD}} for user inputs.",
    category: "tools",
    tier: "free",
    inputSchema: RegisterToolSchema.shape,
    handler: async ({
      name,
      description,
      input_schema,
      handler_spec,
    }: z.infer<typeof RegisterToolSchema>): Promise<CallToolResult> => {
      try {
        const prisma = (await import("@/lib/prisma")).default;

        // Check quota
        const [count, limit] = await Promise.all([
          getToolCount(prisma, userId),
          getToolLimit(prisma, userId),
        ]);

        if (count >= limit) {
          return {
            content: [
              {
                type: "text",
                text:
                  `Tool limit reached (${count}/${limit}). Upgrade to Premium for up to ${PREMIUM_TOOL_LIMIT} tools.`,
              },
            ],
            isError: true,
          };
        }

        // Validate URL
        const urlError = validateUrl(handler_spec.url);
        if (urlError) {
          return {
            content: [{
              type: "text",
              text: `Invalid handler URL: ${urlError}`,
            }],
            isError: true,
          };
        }

        // Validate all templates
        const templatedStrings = [
          handler_spec.url,
          ...Object.values(handler_spec.headers),
          handler_spec.body,
        ].filter(Boolean) as string[];

        for (const tmpl of templatedStrings) {
          const tmplError = validateTemplate(tmpl);
          if (tmplError) {
            return {
              content: [{ type: "text", text: `Template error: ${tmplError}` }],
              isError: true,
            };
          }
        }

        const tool = await prisma.registeredTool.upsert({
          where: { userId_name: { userId, name } },
          update: {
            description,
            inputSchema: input_schema as object,
            handlerSpec: handler_spec as object,
            status: "DRAFT",
          },
          create: {
            userId,
            name,
            description,
            inputSchema: input_schema as object,
            handlerSpec: handler_spec as object,
            status: "DRAFT",
          },
        });

        return {
          content: [
            {
              type: "text",
              text: `**Tool Registered!**\n\n`
                + `**ID:** ${tool.id}\n`
                + `**Name:** ${tool.name}\n`
                + `**Status:** DRAFT\n\n`
                + `Use \`test_tool\` to test it, then \`publish_tool\` to make it available.`,
            },
          ],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        return {
          content: [{ type: "text", text: `Error registering tool: ${msg}` }],
          isError: true,
        };
      }
    },
  });

  registry.register({
    name: "test_tool",
    description:
      "Execute a registered tool with test inputs. Only works with DRAFT or PUBLISHED tools.",
    category: "tools",
    tier: "free",
    inputSchema: TestToolSchema.shape,
    handler: async ({
      tool_id,
      test_input,
    }: z.infer<typeof TestToolSchema>): Promise<CallToolResult> => {
      try {
        const prisma = (await import("@/lib/prisma")).default;
        const { decryptSecret } = await import("../crypto/vault");

        const tool = await prisma.registeredTool.findFirst({
          where: { id: tool_id, userId, status: { not: "DISABLED" } },
        });

        if (!tool) {
          return {
            content: [
              { type: "text", text: "Tool not found or disabled." },
            ],
            isError: true,
          };
        }

        const spec = tool.handlerSpec as unknown as z.infer<
          typeof HandlerSpecSchema
        >;

        // Resolve secrets
        const secretRefs = new Set<string>();
        const allTemplates = [
          spec.url,
          ...Object.values(spec.headers || {}),
          spec.body,
        ].filter(Boolean) as string[];

        for (const tmpl of allTemplates) {
          const matches = tmpl.match(/\{\{secrets\.([a-zA-Z][a-zA-Z0-9_]*)\}\}/g) || [];
          for (const m of matches) {
            secretRefs.add(m.slice(10, -2)); // Extract KEY from {{secrets.KEY}}
          }
        }

        const secrets: Record<string, string> = {};
        if (secretRefs.size > 0) {
          const vaultSecrets = await prisma.vaultSecret.findMany({
            where: {
              userId,
              name: { in: Array.from(secretRefs) },
              status: "APPROVED",
            },
          });

          for (const vs of vaultSecrets) {
            secrets[vs.name] = decryptSecret(
              userId,
              vs.encryptedValue,
              vs.iv,
              vs.tag,
            );
          }

          // Check for missing secrets
          for (const ref of secretRefs) {
            if (!secrets[ref]) {
              return {
                content: [
                  {
                    type: "text",
                    text:
                      `Missing or unapproved secret: ${ref}. Store and approve it with vault tools first.`,
                  },
                ],
                isError: true,
              };
            }
          }
        }

        // Resolve templates
        const resolvedUrl = resolveTemplate(
          spec.url,
          test_input as Record<string, unknown>,
          secrets,
        );

        // Re-validate the resolved URL to prevent SSRF via template injection
        const resolvedUrlError = validateUrl(resolvedUrl);
        if (resolvedUrlError) {
          return {
            content: [
              {
                type: "text",
                text:
                  `Resolved URL is invalid: ${resolvedUrlError}. Template variables may have injected a disallowed URL.`,
              },
            ],
            isError: true,
          };
        }

        const resolvedHeaders: Record<string, string> = {};
        for (const [k, v] of Object.entries(spec.headers || {})) {
          resolvedHeaders[k] = resolveTemplate(
            v,
            test_input as Record<string, unknown>,
            secrets,
          );
        }
        const resolvedBody = spec.body
          ? resolveTemplate(
            spec.body,
            test_input as Record<string, unknown>,
            secrets,
          )
          : undefined;

        // Execute HTTP request
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);

        try {
          const response = await fetch(resolvedUrl, {
            method: spec.method,
            headers: resolvedHeaders,
            body: resolvedBody,
            signal: controller.signal,
          });

          const responseText = await response.text();
          const truncated = responseText.length > 1_000_000
            ? responseText.slice(0, 1_000_000) + "\n...(truncated)"
            : responseText;

          let resultText = `**Tool Test: ${tool.name}**\n\n`;
          resultText += `**Status:** ${response.status} ${response.statusText}\n`;
          resultText += `**URL:** ${resolvedUrl}\n\n`;

          if (spec.responseTransform?.type === "json_path") {
            try {
              const json = JSON.parse(truncated);
              const path = spec.responseTransform.path.split(".");
              let value: unknown = json;
              for (const segment of path) {
                if (value && typeof value === "object") {
                  value = (value as Record<string, unknown>)[segment];
                }
              }
              resultText += `**Transformed Result:**\n\`\`\`json\n${
                JSON.stringify(value, null, 2)
              }\n\`\`\``;
            } catch {
              resultText += `**Response:**\n\`\`\`\n${truncated}\n\`\`\``;
            }
          } else {
            resultText += `**Response:**\n\`\`\`\n${truncated}\n\`\`\``;
          }

          return { content: [{ type: "text", text: resultText }] };
        } finally {
          clearTimeout(timeout);
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        return {
          content: [{ type: "text", text: `Error testing tool: ${msg}` }],
          isError: true,
        };
      }
    },
  });

  registry.register({
    name: "publish_tool",
    description: "Publish a draft tool to make it available for use.",
    category: "tools",
    tier: "free",
    inputSchema: ToolIdSchema.shape,
    handler: async ({
      tool_id,
    }: z.infer<typeof ToolIdSchema>): Promise<CallToolResult> => {
      try {
        const prisma = (await import("@/lib/prisma")).default;

        const tool = await prisma.registeredTool.findFirst({
          where: { id: tool_id, userId },
        });

        if (!tool) {
          return {
            content: [
              {
                type: "text",
                text: "Tool not found or you don't have access.",
              },
            ],
            isError: true,
          };
        }

        if (tool.status !== "DRAFT") {
          return {
            content: [
              {
                type: "text",
                text:
                  `Tool "${tool.name}" is ${tool.status}, not DRAFT. Only draft tools can be published.`,
              },
            ],
            isError: true,
          };
        }

        await prisma.registeredTool.update({
          where: { id: tool_id },
          data: { status: "PUBLISHED" },
        });

        return {
          content: [
            {
              type: "text",
              text: `**Tool Published!**\n\n`
                + `**Name:** ${tool.name}\n`
                + `**Status:** PUBLISHED\n\n`
                + `The tool is now available for use via \`search_tools("${tool.name}")\`.`,
            },
          ],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        return {
          content: [{ type: "text", text: `Error publishing tool: ${msg}` }],
          isError: true,
        };
      }
    },
  });

  registry.register({
    name: "list_registered_tools",
    description: "List all tools registered by the current user.",
    category: "tools",
    tier: "free",
    inputSchema: {},
    handler: async (): Promise<CallToolResult> => {
      try {
        const prisma = (await import("@/lib/prisma")).default;

        const tools = await prisma.registeredTool.findMany({
          where: { userId },
          select: {
            id: true,
            name: true,
            description: true,
            status: true,
            installCount: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        });

        const [count, limit] = await Promise.all([
          getToolCount(prisma, userId),
          getToolLimit(prisma, userId),
        ]);

        if (tools.length === 0) {
          return {
            content: [
              {
                type: "text",
                text:
                  `**Registered Tools (${count}/${limit})**\n\nNo tools registered. Use \`register_tool\` to create one.`,
              },
            ],
          };
        }

        let text = `**Registered Tools (${count}/${limit})**\n\n`;
        for (const t of tools) {
          text +=
            `- **${t.name}** (${t.status}) — ID: ${t.id}\n  ${t.description}\n  Installs: ${t.installCount} | Created: ${t.createdAt.toISOString()}\n`;
        }

        return { content: [{ type: "text", text }] };
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        return {
          content: [{ type: "text", text: `Error listing tools: ${msg}` }],
          isError: true,
        };
      }
    },
  });

  registry.register({
    name: "disable_tool",
    description: "Disable a registered tool.",
    category: "tools",
    tier: "free",
    inputSchema: ToolIdSchema.shape,
    handler: async ({
      tool_id,
    }: z.infer<typeof ToolIdSchema>): Promise<CallToolResult> => {
      try {
        const prisma = (await import("@/lib/prisma")).default;

        const tool = await prisma.registeredTool.findFirst({
          where: { id: tool_id, userId },
        });

        if (!tool) {
          return {
            content: [
              {
                type: "text",
                text: "Tool not found or you don't have access.",
              },
            ],
            isError: true,
          };
        }

        if (tool.status === "DISABLED") {
          return {
            content: [
              {
                type: "text",
                text: `Tool "${tool.name}" is already disabled.`,
              },
            ],
          };
        }

        await prisma.registeredTool.update({
          where: { id: tool_id },
          data: { status: "DISABLED" },
        });

        return {
          content: [
            {
              type: "text",
              text: `**Tool Disabled!**\n\n**Name:** ${tool.name}\n**Status:** DISABLED`,
            },
          ],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        return {
          content: [{ type: "text", text: `Error disabling tool: ${msg}` }],
          isError: true,
        };
      }
    },
  });
}
