import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { jsonSchema as aiJsonSchema, streamText, tool } from "ai";
import type { ModelMessage, Tool } from "ai";
import type { Code } from "../chatRoom";
import type Env from "../env";
import { hashClientId, sendGA4Events } from "../lib/ga4";
import { convertMessages } from "../lib/message-converter";
import type { MessageWithParts } from "../lib/message-converter";
import { validateMessages } from "../lib/message-validation";
import { createSystemPrompt } from "../lib/prompts";
import { validateToolsArray } from "../lib/tool-adapter";
import type { McpTool } from "../mcp";
import { StorageService } from "../services/storageService";
import type { ErrorResponse, PostRequestBody } from "../types/aiRoutes";
import { DEFAULT_CORS_HEADERS } from "../utils";

/**
 * Type for the processed tools record
 */
type ProcessedToolsRecord = Record<string, Tool<Record<string, unknown>, unknown>>;

export class PostHandler {
  private storageService: StorageService;

  constructor(
    private code: Code,
    private env: Env,
  ) {
    this.storageService = new StorageService(env);
  }

  async handle(request: Request, _url: URL): Promise<Response> {
    const requestId = crypto.randomUUID();

    try {
      // Validate request size
      const contentLength = request.headers.get("content-length");
      if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) {
        return this.createErrorResponse("Request too large", 413);
      }

      const body = await this.parseRequestBody(request);

      // Validate and clean tools in the request body
      if (body.tools && Array.isArray(body.tools)) {
        const invalidTools = validateToolsArray(body.tools);
        if (invalidTools.length > 0) {
          console.warn(
            `[AI Routes][${requestId}] Found ${invalidTools.length} tools with invalid schemas:`,
            invalidTools,
          );
        }
      }

      // Validate messages
      const validationError = validateMessages(body.messages);
      if (validationError) {
        return this.createErrorResponse(validationError, 400);
      }

      const codeSpace = this.code.getSession().codeSpace;
      const messages = convertMessages(body.messages as MessageWithParts[]);

      // Track ai_message_request event (fire-and-forget)
      if (this.env.GA_MEASUREMENT_ID && this.env.GA_API_SECRET) {
        hashClientId(codeSpace).then((clientId) =>
          sendGA4Events(this.env.GA_MEASUREMENT_ID, this.env.GA_API_SECRET, clientId, [
            {
              name: "ai_message_request",
              params: {
                code_space: codeSpace,
                request_id: requestId,
              },
            },
          ]),
        ).catch((err) => console.error("Failed to send GA4 event:", err));
      }

      await this.storageService.saveRequestBody(codeSpace, body);

      if (!this.env.CLAUDE_CODE_OAUTH_TOKEN) {
        return this.createErrorResponse(
          "CLAUDE_CODE_OAUTH_TOKEN not configured. Please add your OAuth token to .dev.vars file.",
          503,
        );
      }

      const tools = this.code.getMcpServer().tools;

      // Remove tools from body to ensure we only use MCP-generated tools
      const bodyWithoutTools = { ...body };
      delete bodyWithoutTools.tools;

      return await this.createStreamResponse(
        messages,
        tools,
        bodyWithoutTools,
        codeSpace,
        requestId,
      );
    } catch (error) {
      console.error(`[AI Routes][${requestId}] Error handling message:`, error);
      return this.createErrorResponse(
        "Failed to process message",
        500,
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  }

  private async parseRequestBody(request: Request): Promise<PostRequestBody> {
    try {
      return await request.json();
    } catch (parseError) {
      console.error("[AI Routes] Failed to parse request body:", parseError);
      throw new Error(
        `Invalid JSON in request body: ${
          parseError instanceof Error ? parseError.message : "Unknown parse error"
        }`,
      );
    }
  }

  private async createStreamResponse(
    messages: ModelMessage[],
    tools: McpTool[],
    body: PostRequestBody,
    codeSpace: string,
    requestId: string,
  ): Promise<Response> {
    const systemPrompt = createSystemPrompt(codeSpace);
    const google = createGoogleGenerativeAI({
      apiKey: this.env.GEMINI_API_KEY,
    });

    // Create a copy of messages to avoid mutation
    const messagesCopy = JSON.parse(JSON.stringify(body.messages));

    try {
      const processedTools = this.processTools(tools, codeSpace, requestId);

      // Check if we should disable tools due to AI SDK compatibility issues
      const disableTools = this.env.DISABLE_AI_TOOLS === "true";

      const result = await streamText({
        model: google("gemini-3-flash-preview"),
        system: systemPrompt,
        messages,
        ...(disableTools
          ? {}
          : {
              tools: processedTools,
              toolChoice: "auto" as const,
              onStepFinish: async (stepResult: { toolResults?: unknown[] }) => {
                if (stepResult.toolResults && stepResult.toolResults.length > 0) {
                  try {
                    const toolMessages = stepResult.toolResults.map((result: unknown) => ({
                      ["role"]: "assistant" as const,
                      ["content"]: JSON.stringify(result),
                    }));

                    messagesCopy.push(...toolMessages);

                    await this.storageService.saveRequestBody(codeSpace, {
                      ...body,
                      messages: messagesCopy,
                    });
                  } catch (error) {
                    console.error(
                      `[AI Routes][${requestId}] Error saving messages after tool call:`,
                      error,
                    );
                  }
                }
              },
            }),
      });

      // Use the appropriate streaming response method
      if (typeof result?.toUIMessageStreamResponse === "function") {
        return result.toUIMessageStreamResponse({
          headers: this.getCorsHeaders(),
        });
      }

      // Fallback to text stream for simpler responses
      if (typeof result?.toTextStreamResponse === "function") {
        return result.toTextStreamResponse({
          headers: this.getCorsHeaders(),
        });
      }

      console.error(`[AI Routes][${requestId}] No streaming methods available on result`);
      throw new Error("Streaming methods not available on streamText result");
    } catch (streamErrorCaught) {
      console.error(`[AI Routes][${requestId}] Stream error details:`, {
        message: streamErrorCaught instanceof Error ? streamErrorCaught.message : "Unknown error",
        stack: streamErrorCaught instanceof Error ? streamErrorCaught.stack : undefined,
      });
      throw streamErrorCaught;
    }
  }

  private processTools(
    tools: McpTool[],
    codeSpace: string,
    requestId: string,
  ): ProcessedToolsRecord {
    return tools.reduce<ProcessedToolsRecord>((acc, mcpTool) => {
      if (!mcpTool.inputSchema) {
        console.warn(
          `[AI Routes][${requestId}] Tool '${mcpTool.name}' has no inputSchema, skipping`,
        );
        return acc;
      }

      if (mcpTool.inputSchema.type !== "object") {
        console.error(
          `[AI Routes][${requestId}] Tool '${mcpTool.name}' has invalid inputSchema.type: '${mcpTool.inputSchema.type}', expected 'object'`,
        );
        return acc;
      }

      const schemaDefinition = aiJsonSchema<Record<string, unknown>>({
        type: "object" as const,
        properties: mcpTool.inputSchema.properties,
        required: mcpTool.inputSchema.required,
      });

      const mcpServerRef = this.code.getMcpServer();
      const toolName = mcpTool.name;

      const aiTool = tool<Record<string, unknown>, unknown>({
        ...(mcpTool.description !== undefined && { description: mcpTool.description }),
        inputSchema: schemaDefinition,
        execute: async (args: Record<string, unknown>) => {
          try {
            const response = await mcpServerRef.executeTool(toolName, {
              ...args,
              codeSpace,
            });
            return response;
          } catch (error) {
            console.error(`[AI Routes][${requestId}] Error executing tool ${toolName}:`, error);
            throw new Error(
              `Failed to execute tool ${toolName}: ${
                error instanceof Error ? error.message : "Unknown error"
              }`,
            );
          }
        },
      });

      acc[mcpTool.name] = aiTool;
      return acc;
    }, {});
  }

  private getCorsHeaders(): Record<string, string> {
    return DEFAULT_CORS_HEADERS;
  }

  private createErrorResponse(error: string, status: number, details?: string): Response {
    const errorResponse: ErrorResponse = { error };
    if (details) {
      errorResponse.details = details;
    }

    return new Response(JSON.stringify(errorResponse), {
      status,
      headers: this.getCorsHeaders(),
    });
  }
}
