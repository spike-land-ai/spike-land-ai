import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { jsonResult, safeToolCall } from "./tool-helpers";
import { buildZeroShotPrompt, parseCodeOutput } from "../../../codegen/engine";
import type { CodeGenResult, ContextBundle } from "../../../codegen/types";

export interface MCPTool {
  name: string;
  description: string;
  schema: z.ZodObject<z.ZodRawShape>;
  handler: (args: unknown) => Promise<CallToolResult>;
}

const bundles = new Map<string, ContextBundle>();
const results = new Map<string, CodeGenResult>();

export const codegenTools: MCPTool[] = [
  {
    name: "codegen_create_bundle",
    description: "Create a context bundle for a zero-shot code generation call",
    schema: z.object({
      spec: z.string(),
      file_contents: z.array(
        z.object({ path: z.string(), content: z.string() }),
      ),
      conventions: z.array(z.string()).optional(),
      constraints: z.array(z.string()).optional(),
      examples: z.array(z.object({ description: z.string(), code: z.string() }))
        .optional(),
    }),
    handler: async (args: unknown) => {
      const a = args as {
        spec: string;
        file_contents: Array<{ path: string; content: string; }>;
        conventions?: string[];
        constraints?: string[];
        examples?: Array<{ description: string; code: string; }>;
      };
      return safeToolCall("codegen_create_bundle", async () => {
        const id = Math.random().toString(36).substring(2, 11);
        const bundle: ContextBundle = {
          id,
          userId: "system",
          spec: a.spec,
          fileContents: a.file_contents,
          conventions: a.conventions ?? [],
          constraints: a.constraints ?? [],
          examples: a.examples ?? [],
          dependencyOutputs: [],
        };
        bundles.set(id, bundle);
        return jsonResult(
          `Bundle ${id} created with ${a.file_contents.length} file(s)`,
          bundle,
        );
      });
    },
  },
  {
    name: "codegen_build_prompt",
    description: "Build a code generation prompt from a context bundle",
    schema: z.object({
      bundle_id: z.string(),
      role: z.string().optional().default("Senior React/Next.js Engineer"),
      output_format: z.string().optional().default(
        "Multi-file fenced blocks with 'filepath: path' header",
      ),
    }),
    handler: async (args: unknown) => {
      const a = args as {
        bundle_id: string;
        role: string;
        output_format: string;
      };
      return safeToolCall("codegen_build_prompt", async () => {
        const bundle = bundles.get(a.bundle_id);
        if (!bundle) throw new Error(`Bundle ${a.bundle_id} not found`);
        const prompt = buildZeroShotPrompt(bundle, a.role, a.output_format);
        return jsonResult(`Prompt built for bundle ${a.bundle_id}`, { prompt });
      });
    },
  },
  {
    name: "codegen_dispatch",
    description: "Dispatch a code generation prompt to AI provider (Mock)",
    schema: z.object({
      bundle_id: z.string(),
      model: z.string().optional().default("gemini-2.0-flash"),
    }),
    handler: async (args: unknown) => {
      const a = args as { bundle_id: string; model: string; };
      return safeToolCall("codegen_dispatch", async () => {
        const resultId = Math.random().toString(36).substring(2, 11);
        const result: CodeGenResult = {
          id: resultId,
          userId: "system",
          bundleId: a.bundle_id,
          provider: "google",
          model: a.model,
          prompt: "Mock prompt",
          generatedCode: "```typescript\nfilepath: test.ts\nexport const x = 1;\n```",
          files: [{ path: "test.ts", content: "export const x = 1;" }],
          tokensIn: 100,
          tokensOut: 50,
          durationMs: 500,
          status: "success",
          iteration: 1,
        };
        results.set(resultId, result);
        return jsonResult(
          `Code generation dispatched. Result ID: ${resultId}`,
          result,
        );
      });
    },
  },
  {
    name: "codegen_get_result",
    description: "Retrieve result of a code generation dispatch",
    schema: z.object({
      result_id: z.string(),
    }),
    handler: async (args: unknown) => {
      const a = args as { result_id: string; };
      return safeToolCall("codegen_get_result", async () => {
        const result = results.get(a.result_id);
        if (!result) throw new Error(`Result ${a.result_id} not found`);
        return jsonResult(`Result details for ${a.result_id}`, result);
      });
    },
  },
  {
    name: "codegen_parse_output",
    description: "Parse AI-generated text into structured FileDiffs",
    schema: z.object({
      result_id: z.string(),
      format: z.string().optional().default("fenced"),
    }),
    handler: async (args: unknown) => {
      const a = args as { result_id: string; format: string; };
      return safeToolCall("codegen_parse_output", async () => {
        const result = results.get(a.result_id);
        if (!result) throw new Error(`Result ${a.result_id} not found`);
        const files = parseCodeOutput(result.generatedCode, a.format);
        return jsonResult(
          `Parsed ${files.length} file(s) from AI output`,
          files,
        );
      });
    },
  },
  {
    name: "codegen_retry",
    description: "Retry code generation with corrective feedback",
    schema: z.object({
      result_id: z.string(),
      feedback: z.string(),
    }),
    handler: async (args: unknown) => {
      const a = args as { result_id: string; feedback: string; };
      return safeToolCall("codegen_retry", async () => {
        const result = results.get(a.result_id);
        if (!result) throw new Error(`Result ${a.result_id} not found`);
        const bundle = bundles.get(result.bundleId);
        if (!bundle) throw new Error(`Bundle ${result.bundleId} not found`);

        const id = Math.random().toString(36).substring(2, 11);
        return jsonResult(
          `Retry requested with feedback. New result ID: ${id}`,
          { id, feedback: a.feedback },
        );
      });
    },
  },
  {
    name: "codegen_summarize",
    description: "Summarize code generation results and usage",
    schema: z.object({
      result_ids: z.array(z.string()),
    }),
    handler: async (args: unknown) => {
      const a = args as { result_ids: string[]; };
      return safeToolCall("codegen_summarize", async () => {
        const list = a.result_ids.map(id => results.get(id)).filter((
          r,
        ): r is CodeGenResult => !!r);
        return jsonResult(
          `Summary of ${list.length} results`,
          list.map(r => ({
            id: r.id,
            tokensIn: r.tokensIn,
            tokensOut: r.tokensOut,
          })),
        );
      });
    },
  },
];
