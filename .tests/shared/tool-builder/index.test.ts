/**
 * Tests for shared tool-builder (builder.ts + middleware.ts)
 */

import { z } from "zod";
import { describe, expect, it } from "vitest";
import { baseProcedure, createProcedure } from "../../../src/core/shared-utils/core-logic/builder";
import { middleware } from "../../../src/core/shared-utils/core-logic/middleware";

// ---------------------------------------------------------------------------
// createProcedure / baseProcedure
// ---------------------------------------------------------------------------

describe("createProcedure", () => {
  it("creates a procedure with no middleware", () => {
    const proc = createProcedure();
    expect(proc).toBeDefined();
    expect(typeof proc.use).toBe("function");
    expect(typeof proc.tool).toBe("function");
  });

  it("baseProcedure is a pre-built procedure instance", () => {
    expect(baseProcedure).toBeDefined();
    expect(typeof baseProcedure.use).toBe("function");
    expect(typeof baseProcedure.tool).toBe("function");
  });
});

// ---------------------------------------------------------------------------
// ToolBuilder - meta, output, handler
// ---------------------------------------------------------------------------

describe("ToolBuilder", () => {
  it("creates a built tool with correct name and description", async () => {
    const tool = baseProcedure
      .tool("my_tool", "Does something", { name: z.string() })
      .handler(async ({ input }) => ({
        content: [{ type: "text", text: `Hello ${input.name}` }],
      }));

    expect(tool.name).toBe("my_tool");
    expect(tool.description).toBe("Does something");
    expect(tool.inputSchema).toBeDefined();
  });

  it("handler is callable and returns content", async () => {
    const tool = baseProcedure
      .tool("echo_tool", "Echoes input", { message: z.string() })
      .handler(async ({ input }) => ({
        content: [{ type: "text", text: input.message }],
      }));

    const result = await tool.handler({ message: "hello" });
    expect(result.content[0]!.text).toBe("hello");
    expect(result.isError).toBeUndefined();
  });

  it("meta sets metadata on the built tool", () => {
    const tool = baseProcedure
      .tool("meta_tool", "With meta", { x: z.number() })
      .meta({ category: "utils", tier: "free" })
      .handler(async () => ({ content: [{ type: "text", text: "ok" }] }));

    expect(tool.meta).toEqual({ category: "utils", tier: "free" });
  });

  it("meta merges with existing meta", () => {
    const tool = baseProcedure
      .tool("meta_tool2", "With merged meta", { x: z.number() })
      .meta({ category: "utils" })
      .meta({ tier: "workspace" })
      .handler(async () => ({ content: [{ type: "text", text: "ok" }] }));

    expect(tool.meta).toEqual({ category: "utils", tier: "workspace" });
  });

  it("output schema is set on built tool", () => {
    const outputSchema = z.object({ value: z.string() });
    const tool = baseProcedure
      .tool("output_tool", "With output schema", { x: z.number() })
      .output(outputSchema)
      .handler(async () => ({
        content: [{ type: "text", text: JSON.stringify({ value: "test" }) }],
      }));

    expect(tool.outputSchema).toBe(outputSchema);
  });

  it("handler returns isError true when input validation fails", async () => {
    const tool = baseProcedure
      .tool("validate_tool", "Validates", { count: z.number() })
      .handler(async ({ input }) => ({
        content: [{ type: "text", text: String(input.count) }],
      }));

    // Pass a string instead of number
    const result = await tool.handler({ count: "not-a-number" } as never);
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("Validation Error");
  });

  it("handler catches generic errors and returns isError true", async () => {
    const tool = baseProcedure
      .tool("error_tool", "Throws error", { x: z.string() })
      .handler(async () => {
        throw new Error("Something went wrong");
      });

    const result = await tool.handler({ x: "test" });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("Something went wrong");
  });

  it("handler catches non-Error throws and returns isError true", async () => {
    const tool = baseProcedure
      .tool("string_throw_tool", "Throws string", { x: z.string() })
      .handler(async () => {
        throw "raw string error";
      });

    const result = await tool.handler({ x: "test" });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("raw string error");
  });

  it("handler catches DomainError and formats it", async () => {
    const tool = baseProcedure
      .tool("domain_error_tool", "Throws DomainError", { x: z.string() })
      .handler(async () => {
        const err = {
          name: "DomainError",
          code: "NOT_FOUND",
          message: "Resource not found",
          retryable: false,
        };
        throw err;
      });

    const result = await tool.handler({ x: "test" });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("NOT_FOUND");
    expect(result.content[0]!.text).toContain("Resource not found");
    expect(result.content[0]!.text).toContain("Retryable:");
  });

  it("handler catches McpError and formats it", async () => {
    const tool = baseProcedure
      .tool("mcp_error_tool", "Throws McpError", { x: z.string() })
      .handler(async () => {
        const err = {
          name: "McpError",
          code: "TOOL_NOT_FOUND",
          message: "Tool not found",
        };
        throw err;
      });

    const result = await tool.handler({ x: "test" });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("TOOL_NOT_FOUND");
    expect(result.content[0]!.text).toContain("Tool not found");
  });

  it("output validation passes for valid JSON response", async () => {
    const outputSchema = z.object({ value: z.string() });
    const tool = baseProcedure
      .tool("output_valid_tool", "Valid output", { x: z.string() })
      .output(outputSchema)
      .handler(async () => ({
        content: [{ type: "text", text: JSON.stringify({ value: "test" }) }],
      }));

    const result = await tool.handler({ x: "input" });
    expect(result.isError).toBeUndefined();
    expect(result.content[0]!.text).toContain("value");
  });

  it("output validation fails for invalid JSON response", async () => {
    const outputSchema = z.object({ value: z.number() });
    const tool = baseProcedure
      .tool("output_invalid_tool", "Invalid output", { x: z.string() })
      .output(outputSchema)
      .handler(async () => ({
        // Returns string but schema expects number
        content: [{ type: "text", text: JSON.stringify({ value: "not-a-number" }) }],
      }));

    const result = await tool.handler({ x: "input" });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("Output Validation Error");
  });

  it("output validation skips non-JSON text content", async () => {
    const outputSchema = z.object({ value: z.string() });
    const tool = baseProcedure
      .tool("non_json_output_tool", "Non-JSON output", { x: z.string() })
      .output(outputSchema)
      .handler(async () => ({
        content: [{ type: "text", text: "plain text, not JSON" }],
      }));

    // Should not fail for non-JSON output
    const result = await tool.handler({ x: "input" });
    expect(result.isError).toBeUndefined();
  });

  it("skips output validation when result has isError", async () => {
    const outputSchema = z.object({ value: z.string() });
    const tool = baseProcedure
      .tool("error_with_schema_tool", "Error with schema", { x: z.string() })
      .output(outputSchema)
      .handler(async () => ({
        content: [{ type: "text", text: "error content" }],
        isError: true,
      }));

    const result = await tool.handler({ x: "input" });
    expect(result.isError).toBe(true);
    // Should not try to validate error result
    expect(result.content[0]!.text).toBe("error content");
  });

  it("handler can return synchronously (non-Promise)", async () => {
    const tool = baseProcedure
      .tool("sync_tool", "Sync handler", { x: z.string() })
      .handler(({ input }) => ({
        content: [{ type: "text", text: `sync: ${input.x}` }],
      }));

    const result = await tool.handler({ x: "world" });
    expect(result.content[0]!.text).toBe("sync: world");
  });

  it("examples sets examples on the built tool", () => {
    const tool = baseProcedure
      .tool("examples_tool", "With examples", { x: z.string() })
      .examples([{ name: "basic", input: { x: "hello" }, description: "Basic usage" }])
      .handler(async () => ({ content: [{ type: "text", text: "ok" }] }));

    expect(tool.meta.examples).toHaveLength(1);
    expect(tool.meta.examples![0]!.name).toBe("basic");
  });

  it("examples appends to existing examples from meta", () => {
    const tool = baseProcedure
      .tool("examples_merge_tool", "With merged examples", { x: z.string() })
      .meta({ examples: [{ name: "first", input: { x: "a" }, description: "First" }] })
      .examples([{ name: "second", input: { x: "b" }, description: "Second" }])
      .handler(async () => ({ content: [{ type: "text", text: "ok" }] }));

    expect(tool.meta.examples).toHaveLength(2);
    expect(tool.meta.examples![0]!.name).toBe("first");
    expect(tool.meta.examples![1]!.name).toBe("second");
  });
});

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

describe("middleware", () => {
  it("creates a middleware with fn property", () => {
    const mw = middleware<Record<string, unknown>, { userId: string }>(async ({ ctx, next }) =>
      next({ ...ctx, userId: "user-123" }),
    );
    expect(typeof mw.fn).toBe("function");
  });

  it("middleware can be used in a procedure chain", async () => {
    const withUserId = middleware<Record<string, unknown>, { userId: string }>(async ({ ctx, next }) =>
      next({ ...ctx, userId: "user-123" }),
    );

    const t = createProcedure().use(withUserId);

    const tool = t
      .tool("user_tool", "Uses user id", { name: z.string() })
      .handler(async ({ input, ctx }) => ({
        content: [{ type: "text", text: `${input.name} by ${ctx.userId}` }],
      }));

    const result = await tool.handler({ name: "Alice" }, {});
    expect(result.content[0]!.text).toBe("Alice by user-123");
  });

  it("middleware receives input and context", async () => {
    const capturedParams: { input: unknown; ctx: unknown }[] = [];

    const captureMw = middleware<Record<string, unknown>, Record<string, unknown>>(async ({ input, ctx, next }) => {
      capturedParams.push({ input, ctx });
      return next(ctx);
    });

    const tool = createProcedure()
      .use(captureMw)
      .tool("capture_tool", "Captures params", { value: z.number() })
      .handler(async ({ input }) => ({
        content: [{ type: "text", text: String(input.value) }],
      }));

    await tool.handler({ value: 42 }, { existingKey: "hello" });
    expect(capturedParams).toHaveLength(1);
    expect(capturedParams[0]!.input).toEqual({ value: 42 });
    expect(capturedParams[0]!.ctx).toEqual({ existingKey: "hello" });
  });

  it("multiple middleware compose correctly", async () => {
    const steps: string[] = [];

    const mw1 = middleware<Record<string, unknown>, { step1: boolean }>(async ({ ctx, next }) => {
      steps.push("mw1-before");
      const result = await next({ ...ctx, step1: true });
      steps.push("mw1-after");
      return result;
    });

    const mw2 = middleware<{ step1: boolean }, { step1: boolean; step2: boolean }>(
      async ({ ctx, next }) => {
        steps.push("mw2-before");
        const result = await next({ ...ctx, step2: true });
        steps.push("mw2-after");
        return result;
      },
    );

    const tool = createProcedure()
      .use(mw1)
      .use(mw2)
      .tool("multi_mw_tool", "Multi middleware", { x: z.string() })
      .handler(async ({ ctx }) => {
        steps.push("handler");
        expect((ctx as { step1: boolean; step2: boolean }).step1).toBe(true);
        expect((ctx as { step1: boolean; step2: boolean }).step2).toBe(true);
        return { content: [{ type: "text", text: "done" }] };
      });

    await tool.handler({ x: "test" }, {});
    expect(steps).toEqual(["mw1-before", "mw2-before", "handler", "mw2-after", "mw1-after"]);
  });

  it("middleware can be short-circuit the chain", async () => {
    const authMw = middleware<Record<string, unknown>, { authorized: boolean }>(async () => {
      // Don't call next — return error immediately
      return {
        content: [{ type: "text", text: "Unauthorized" }],
        isError: true,
      };
    });

    const handlerCalled = { value: false };
    const tool = createProcedure()
      .use(authMw)
      .tool("auth_tool", "Auth required", { x: z.string() })
      .handler(async () => {
        handlerCalled.value = true;
        return { content: [{ type: "text", text: "secret" }] };
      });

    const result = await tool.handler({ x: "test" }, {});
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toBe("Unauthorized");
    expect(handlerCalled.value).toBe(false);
  });

  it("handler receives initial ctx when no middleware", async () => {
    const tool = baseProcedure
      .tool("ctx_tool", "Gets ctx", { x: z.string() })
      .handler(async ({ ctx }) => ({
        content: [{ type: "text", text: JSON.stringify(ctx) }],
      }));

    const result = await tool.handler({ x: "test" }, { myKey: "myValue" });
    expect(result.content[0]!.text).toContain("myValue");
  });

  it("handler receives empty object ctx when ctx arg omitted", async () => {
    const tool = baseProcedure
      .tool("no_ctx_tool", "No ctx arg", { x: z.string() })
      .handler(async ({ ctx }) => ({
        content: [{ type: "text", text: JSON.stringify(ctx) }],
      }));

    const result = await tool.handler({ x: "test" });
    expect(result.content[0]!.text).toBe("{}");
  });
});
