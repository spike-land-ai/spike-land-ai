/**
 * Code Generation MCP Tools
 *
 * Zero-shot code generation with context bundles.
 * Ported from spike.land — pure in-memory computation.
 */

import { z } from "zod";
import type { ToolRegistry } from "../mcp/registry";
import { freeTool, jsonResult } from "../procedures/index";
import type { DrizzleDB } from "../db/index";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ContextBundle {
  id: string;
  userId: string;
  spec: string;
  fileContents: Array<{ path: string; content: string }>;
  conventions: string[];
  constraints: string[];
  examples: Array<{ description: string; code: string }>;
  dependencyOutputs: Array<{ subtaskId: string; output: string }>;
}

interface CodeGenResult {
  id: string;
  userId: string;
  bundleId: string;
  provider: string;
  model: string;
  prompt: string;
  generatedCode: string;
  files: Array<{ path: string; content: string }>;
  tokensIn: number;
  tokensOut: number;
  durationMs: number;
  status: "success" | "error" | "needs_revision";
  iteration: number;
}

// ─── In-memory storage ───────────────────────────────────────────────────────

const bundles = new Map<string, ContextBundle>();
const results = new Map<string, CodeGenResult>();

export function clearCodegen(): void {
  bundles.clear();
  results.clear();
}

// ─── Engine functions ────────────────────────────────────────────────────────

function buildZeroShotPrompt(bundle: ContextBundle, role: string, format: string): string {
  let prompt = `Role: ${role}\nFormat: ${format}\n\n`;
  prompt += `Specification: ${bundle.spec}\n\n`;
  if (bundle.fileContents.length > 0) {
    prompt += `Existing Context Files:\n`;
    for (const file of bundle.fileContents) {
      prompt += `--- ${file.path} ---\n${file.content}\n\n`;
    }
  }
  if (bundle.constraints.length > 0) {
    prompt += `Constraints:\n- ${bundle.constraints.join("\n- ")}\n\n`;
  }
  return prompt;
}

function parseCodeOutput(rawOutput: string): Array<{ path: string; content: string }> {
  const files: Array<{ path: string; content: string }> = [];
  const regex = /```(?:[\w.]+)?\s*(?:filepath:\s*([\w/.-]+))?\n([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(rawOutput)) !== null) {
    files.push({ path: match[1] || "unknown_file", content: match[2] ?? "" });
  }
  if (files.length === 0 && rawOutput.includes("---")) {
    const segments = rawOutput.split(/--- ([\w/.-]+) ---/);
    for (let i = 1; i < segments.length; i += 2) {
      files.push({
        path: segments[i] ?? "unknown_file",
        content: (segments[i + 1] ?? "").trim(),
      });
    }
  }
  return files;
}

// ─── Registration ────────────────────────────────────────────────────────────

export function registerCodegenTools(registry: ToolRegistry, userId: string, db: DrizzleDB): void {
  registry.registerBuilt(
    freeTool(userId, db)
      .tool(
        "codegen_create_bundle",
        "Create a context bundle for a zero-shot code generation call.",
        {
          spec: z.string().describe("Specification for code generation."),
          file_contents: z
            .array(z.object({ path: z.string(), content: z.string() }))
            .describe("Context files."),
          conventions: z.array(z.string()).optional().describe("Coding conventions."),
          constraints: z.array(z.string()).optional().describe("Constraints."),
          examples: z
            .array(z.object({ description: z.string(), code: z.string() }))
            .optional()
            .describe("Examples."),
        },
      )
      .meta({ category: "codegen", tier: "free" })
      .examples([
        {
          name: "create_react_component",
          input: { spec: "Create a button component", file_contents: [] },
          description: "Create a simple code generation bundle"
        }
      ])
      .handler(async ({ input }) => {
        const id = crypto.randomUUID();
        const bundle: ContextBundle = {
          id,
          userId,
          spec: input.spec,
          fileContents: input.file_contents,
          conventions: input.conventions ?? [],
          constraints: input.constraints ?? [],
          examples: input.examples ?? [],
          dependencyOutputs: [],
        };
        bundles.set(id, bundle);
        return jsonResult(
          `Bundle ${id} created with ${input.file_contents.length} file(s)`,
          bundle,
        );
      }),
  );

  registry.registerBuilt(
    freeTool(userId, db)
      .tool("codegen_build_prompt", "Build a code generation prompt from a context bundle.", {
        bundle_id: z.string().describe("Bundle ID."),
        role: z.string().optional().describe("Role for the prompt."),
        output_format: z.string().optional().describe("Output format."),
      })
      .meta({ category: "codegen", tier: "free" })
      .handler(async ({ input }) => {
        const bundle = bundles.get(input.bundle_id);
        if (!bundle) throw new Error(`Bundle ${input.bundle_id} not found`);
        const prompt = buildZeroShotPrompt(
          bundle,
          input.role ?? "Senior React/TypeScript Engineer",
          input.output_format ?? "Multi-file fenced blocks",
        );
        return jsonResult(`Prompt built for bundle ${input.bundle_id}`, {
          prompt,
        });
      }),
  );

  registry.registerBuilt(
    freeTool(userId, db)
      .tool("codegen_dispatch", "Dispatch a code generation prompt to AI provider (Mock).", {
        bundle_id: z.string().describe("Bundle ID."),
        model: z.string().optional().describe("Model to use."),
      })
      .meta({ category: "codegen", tier: "free", stability: "not-implemented" })
      .handler(async ({ input }) => {
        const resultId = crypto.randomUUID();
        const result: CodeGenResult = {
          id: resultId,
          userId,
          bundleId: input.bundle_id,
          provider: "google",
          model: input.model ?? "gemini-3-flash-preview",
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
        return jsonResult(`Code generation dispatched. Result ID: ${resultId}`, result);
      }),
  );

  registry.registerBuilt(
    freeTool(userId, db)
      .tool("codegen_get_result", "Retrieve result of a code generation dispatch.", {
        result_id: z.string().describe("Result ID."),
      })
      .meta({ category: "codegen", tier: "free" })
      .handler(async ({ input }) => {
        const result = results.get(input.result_id);
        if (!result) throw new Error(`Result ${input.result_id} not found`);
        return jsonResult(`Result details for ${input.result_id}`, result);
      }),
  );

  registry.registerBuilt(
    freeTool(userId, db)
      .tool("codegen_parse_output", "Parse AI-generated text into structured FileDiffs.", {
        result_id: z.string().describe("Result ID."),
      })
      .meta({ category: "codegen", tier: "free" })
      .handler(async ({ input }) => {
        const result = results.get(input.result_id);
        if (!result) throw new Error(`Result ${input.result_id} not found`);
        const files = parseCodeOutput(result.generatedCode);
        return jsonResult(`Parsed ${files.length} file(s) from AI output`, files);
      }),
  );

  registry.registerBuilt(
    freeTool(userId, db)
      .tool("codegen_retry", "Retry code generation with corrective feedback.", {
        result_id: z.string().describe("Result ID."),
        feedback: z.string().describe("Corrective feedback."),
      })
      .meta({ category: "codegen", tier: "free" })
      .handler(async ({ input }) => {
        const result = results.get(input.result_id);
        if (!result) throw new Error(`Result ${input.result_id} not found`);
        const bundle = bundles.get(result.bundleId);
        if (!bundle) throw new Error(`Bundle ${result.bundleId} not found`);
        const id = crypto.randomUUID();
        return jsonResult(`Retry requested with feedback. New result ID: ${id}`, {
          id,
          feedback: input.feedback,
        });
      }),
  );

  registry.registerBuilt(
    freeTool(userId, db)
      .tool("codegen_summarize", "Summarize code generation results and usage.", {
        result_ids: z.array(z.string()).describe("Result IDs to summarize."),
      })
      .meta({ category: "codegen", tier: "free" })
      .handler(async ({ input }) => {
        const list = input.result_ids
          .map((id) => results.get(id))
          .filter((r): r is CodeGenResult => !!r);
        return jsonResult(
          `Summary of ${list.length} results`,
          list.map((r) => ({
            id: r.id,
            tokensIn: r.tokensIn,
            tokensOut: r.tokensOut,
          })),
        );
      }),
  );
}
