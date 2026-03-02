/**
 * Immutable Tool Builder
 *
 * tRPC-style immutable builder where each .use(), .tool(), .meta(), .output()
 * returns a genuinely new object with augmented generics. Zero `as unknown as` casts.
 */

import { z } from "zod";
import type {
  BuiltTool,
  CallToolResult,
  EmptyContext,
  HandlerParams,
  Middleware,
  MiddlewareParams,
  ToolMeta,
} from "./types.js";

// ─── Internal middleware representation ───

/** Erased middleware — loses generic info but can be stored in arrays */
interface ErasedMiddleware {
  fn: (params: MiddlewareParams<unknown, Record<string, unknown>>) => Promise<CallToolResult>;
}

// ─── Procedure (pre-tool: middleware chain, no schema yet) ───

export interface Procedure<TCtx> {
  /**
   * Add middleware to the procedure chain.
   *
   * Middleware can require a SUBSET of the current context.
   * The fn field is contravariant in TCtxIn, so a middleware requiring
   * { userId } can be used where the context has { userId, deps, ... }.
   *
   * The result is TCtx intersected with the middleware's output context.
   */
  use<TCtxIn extends Record<string, unknown>, TCtxOut extends TCtxIn>(
    mw: Middleware<TCtxIn, TCtxOut>,
  ): TCtx extends TCtxIn ? Procedure<TCtx & TCtxOut> : never;

  /**
   * Define a tool with name, description, and input schema.
   * Returns a ToolBuilder that can add meta, output schema, and handler.
   */
  tool<TFields extends z.ZodRawShape>(
    name: string,
    description: string,
    fields: TFields,
  ): ToolBuilder<z.infer<z.ZodObject<TFields>>, TCtx, CallToolResult>;
}

// ─── ToolBuilder (post-tool: has schema, needs handler) ───

export interface ToolBuilder<TInput, TCtx, TOutput> {
  /** Add metadata (category, tier, etc.) */
  meta(meta: ToolMeta): ToolBuilder<TInput, TCtx, TOutput>;

  /** Add output schema for runtime validation of handler return values */
  output<TNewOutput>(schema: z.ZodType<TNewOutput>): ToolBuilder<TInput, TCtx, TNewOutput>;

  /** Define the handler. Returns a BuiltTool ready for registration. */
  handler(
    fn: (params: HandlerParams<TInput, TCtx>) => Promise<CallToolResult> | CallToolResult,
  ): BuiltTool<TInput, TOutput>;
}

// ─── Internal middleware runner ───

async function runMiddlewareChain(
  middlewares: ErasedMiddleware[],
  input: unknown,
  initialCtx: Record<string, unknown>,
  finalHandler: (input: unknown, ctx: Record<string, unknown>) => Promise<CallToolResult>,
): Promise<CallToolResult> {
  let index = 0;

  const executeNext = async (ctx: Record<string, unknown>): Promise<CallToolResult> => {
    if (index >= middlewares.length) {
      return finalHandler(input, ctx);
    }
    const current = middlewares[index]!;
    index++;
    return current.fn({
      input,
      ctx,
      next: async <TNewCtx extends Record<string, unknown>>(newCtx: TNewCtx) => {
        return executeNext(newCtx);
      },
    });
  };

  return executeNext(initialCtx);
}

// ─── Procedure implementation ───

function createProcedureImpl<TCtx>(middlewares: ErasedMiddleware[]): Procedure<TCtx> {
  return {
    use(mw: Middleware<Record<string, unknown>, Record<string, unknown>>) {
      const erased: ErasedMiddleware = {
        fn: mw.fn as ErasedMiddleware["fn"],
      };
      return createProcedureImpl([...middlewares, erased]);
    },

    tool<TFields extends z.ZodRawShape>(
      name: string,
      description: string,
      fields: TFields,
    ): ToolBuilder<z.infer<z.ZodObject<TFields>>, TCtx, CallToolResult> {
      const schema = z.object(fields);
      return createToolBuilderImpl<z.infer<typeof schema>, TCtx, CallToolResult>(
        middlewares,
        name,
        description,
        fields,
        schema,
        {},
        undefined,
      );
    },
    // The implementation types are erased at runtime; the public
    // Procedure<TCtx> interface provides the correct generic types.
  } as Procedure<TCtx>;
}

// ─── ToolBuilder implementation ───

function createToolBuilderImpl<TInput, TCtx, TOutput>(
  middlewares: ErasedMiddleware[],
  name: string,
  description: string,
  fields: z.ZodRawShape,
  inputSchema: z.ZodType<TInput>,
  toolMeta: ToolMeta,
  outputSchema: z.ZodType<TOutput> | undefined,
): ToolBuilder<TInput, TCtx, TOutput> {
  return {
    meta(newMeta: ToolMeta): ToolBuilder<TInput, TCtx, TOutput> {
      return createToolBuilderImpl(
        middlewares,
        name,
        description,
        fields,
        inputSchema,
        { ...toolMeta, ...newMeta },
        outputSchema,
      );
    },

    output<TNewOutput>(schema: z.ZodType<TNewOutput>): ToolBuilder<TInput, TCtx, TNewOutput> {
      return createToolBuilderImpl(
        middlewares,
        name,
        description,
        fields,
        inputSchema,
        toolMeta,
        schema,
      );
    },

    handler(
      fn: (params: HandlerParams<TInput, TCtx>) => Promise<CallToolResult> | CallToolResult,
    ): BuiltTool<TInput, TOutput> {
      const wrappedHandler = async (
        rawInput: TInput,
        initialCtx: Record<string, unknown> = {},
      ): Promise<CallToolResult> => {
        // 1. Validate input
        const parsed = inputSchema.safeParse(rawInput);
        if (!parsed.success) {
          return {
            content: [{ type: "text", text: `**Validation Error**\n${parsed.error.message}` }],
            isError: true,
          };
        }

        const validInput = parsed.data;
        let result: CallToolResult;

        try {
          // 2. Run middleware chain -> handler
          result = await runMiddlewareChain(
            middlewares,
            validInput,
            initialCtx,
            async (input, ctx) =>
              fn({
                input: input as TInput,
                ctx: ctx as TCtx,
              }),
          );
        } catch (error: unknown) {
          if (error && typeof error === "object") {
            const errorObj = error as Record<string, unknown>;
            if (errorObj.name === "DomainError") {
              const domainError = errorObj as { code: string; message: string; retryable: boolean };
              return {
                content: [
                  {
                    type: "text",
                    text: `**Error: ${domainError.code}**\n${domainError.message}\n**Retryable:** ${domainError.retryable}`,
                  },
                ],
                isError: true,
              };
            }
            // Handle McpError (has name === "McpError" and a code property)
            if (errorObj.name === "McpError" && "code" in errorObj) {
              const mcpError = errorObj as { code: string; message: string; retryable?: boolean };
              return {
                content: [
                  {
                    type: "text",
                    text: `**Error: ${mcpError.code}**\n${mcpError.message}`,
                  },
                ],
                isError: true,
              };
            }
          }
          // Generic error fallback — convert to text instead of propagating
          const message = error instanceof Error ? error.message : String(error);
          return {
            content: [{ type: "text", text: `**Error**\n${message}` }],
            isError: true,
          };
        }

        if (outputSchema && !result.isError) {
          const textContent = result.content
            .filter((c) => c.type === "text" && c.text)
            .map((c) => c.text)
            .join("");
          try {
            const data = JSON.parse(textContent) as unknown;
            const outputParsed = outputSchema.safeParse(data);
            if (!outputParsed.success) {
              return {
                content: [
                  {
                    type: "text",
                    text: `**Output Validation Error**\n${outputParsed.error.message}`,
                  },
                ],
                isError: true,
              };
            }
          } catch {
            // Non-JSON output -- skip validation
          }
        }

        return result;
      };

      return {
        name,
        description,
        inputSchema: fields,
        outputSchema,
        meta: toolMeta,
        handler: wrappedHandler,
      };
    },
  };
}

// ─── Public API ───

/**
 * Create a base procedure with no middleware.
 *
 * @example
 * ```ts
 * const baseProcedure = createProcedure();
 * const t = baseProcedure.use(withUserId("user-123"));
 *
 * const myTool = t.tool("my_tool", "Does something", {
 *   name: z.string(),
 * })
 * .meta({ category: "utils", tier: "free" })
 * .handler(async ({ input, ctx }) => {
 *   return { content: [{ type: "text", text: `Hello ${input.name}` }] };
 * });
 * ```
 */
export function createProcedure<TCtx = EmptyContext>(): Procedure<TCtx> {
  return createProcedureImpl<TCtx>([]);
}

/** Pre-built base procedure with no middleware */
export const baseProcedure = createProcedure();
