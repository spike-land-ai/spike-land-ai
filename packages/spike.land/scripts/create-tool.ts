#!/usr/bin/env tsx
/**
 * MCP Tool Scaffold Generator
 *
 * Usage:
 *   yarn create-tool <tool-name> <category> [--tier free|workspace] [--ops create,list,update,delete]
 *
 * Examples:
 *   yarn create-tool invoices billing
 *   yarn create-tool invoices billing --tier workspace --ops create,list,update,delete
 *   yarn create-tool feedback feedback --tier free --ops submit,list
 */

import * as fs from "node:fs";
import * as path from "node:path";

// ─── CLI parsing ───

const args = process.argv.slice(2);

function printUsage(): never {
  console.error(
    `Usage: yarn create-tool <tool-name> <category> [--tier free|workspace] [--ops op1,op2,...]`,
  );
  console.error(`\nExamples:`);
  console.error(`  yarn create-tool invoices billing`);
  console.error(
    `  yarn create-tool invoices billing --tier workspace --ops create,list,update,delete`,
  );
  process.exit(1);
}

if (args.length < 2) printUsage();

const toolName = args[0]!;
const category = args[1]!;

let tier: "free" | "workspace" = "free";
let operations: string[] = ["list", "create"];

for (let i = 2; i < args.length; i++) {
  if (args[i] === "--tier" && args[i + 1]) {
    const val = args[i + 1]!;
    if (val !== "free" && val !== "workspace") {
      console.error(`Invalid tier: ${val}. Must be "free" or "workspace".`);
      process.exit(1);
    }
    tier = val;
    i++;
  } else if (args[i] === "--ops" && args[i + 1]) {
    operations = args[i + 1]!.split(",").map((s) => s.trim());
    i++;
  }
}

// ─── Naming helpers ───

/** "my-tool" → "MyTool" */
function toPascalCase(s: string): string {
  return s.replace(/(^|[-_])(\w)/g, (_, _sep, ch: string) => ch.toUpperCase());
}

/** "my-tool" → "my_tool" */
function toSnakeCase(s: string): string {
  return s.replace(/-/g, "_");
}

const pascalName = toPascalCase(toolName);
const snakeName = toSnakeCase(toolName);
const builderFn = tier === "workspace" ? "workspaceTool" : "freeTool";

// ─── Paths ───

const TOOLS_DIR = path.resolve(__dirname, "../src/lib/mcp/server/tools");
const MANIFEST_PATH = path.resolve(__dirname, "../src/lib/mcp/server/tool-manifest.ts");

const toolFile = path.join(TOOLS_DIR, `${toolName}.ts`);
const testFile = path.join(TOOLS_DIR, `${toolName}.test.ts`);

if (fs.existsSync(toolFile)) {
  console.error(`Tool file already exists: ${toolFile}`);
  process.exit(1);
}

// ─── Generate tool file ───

function generateHandler(op: string): string {
  const toolId = `${snakeName}_${op}`;
  const description = `${op.charAt(0).toUpperCase() + op.slice(1)} ${toolName.replace(/-/g, " ")} items.`;

  return `    registry.registerBuilt(
        ${builderFn}(userId)
            .tool("${toolId}", "${description}", {
                id: z.string().min(1).optional().describe("Item ID."),
            })
            .meta({ category: "${category}", tier: "${tier}" })
            .handler(async ({ input, ctx }) => {
                const { id } = input;
                // TODO: implement ${op} logic using ctx.prisma
                void id;
                void ctx.prisma;
                return textResult("${toolId}: not yet implemented");
            })
    );`;
}

const toolSource = `import { z } from "zod";
import type { ToolRegistry } from "../tool-registry";
import { textResult } from "./tool-helpers";
import { ${builderFn} } from "../tool-builder/procedures.js";

export function register${pascalName}Tools(
    registry: ToolRegistry,
    userId: string,
): void {
${operations.map(generateHandler).join("\n\n")}
}
`;

// ─── Generate test file ───

function generateTestDescribe(op: string): string {
  const toolId = `${snakeName}_${op}`;
  return `    describe("${toolId}", () => {
        it("is registered", () => {
            expect(registry.handlers.has("${toolId}")).toBe(true);
        });

        it("returns a result", async () => {
            const result = await registry.call("${toolId}", {});
            expect(getText(result)).toContain("${toolId}");
        });
    });`;
}

const testSource = `import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        // TODO: add Prisma model mocks as needed
    },
}));

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

import { createMockRegistry, getText } from "../__test-utils__";
import { register${pascalName}Tools } from "./${toolName}";

describe("${pascalName} MCP Tools", () => {
    let registry: ReturnType<typeof createMockRegistry>;
    const userId = "user-123";

    beforeEach(() => {
        vi.clearAllMocks();
        registry = createMockRegistry();
        register${pascalName}Tools(registry as unknown as Parameters<typeof register${pascalName}Tools>[0], userId);
    });

    it("registers ${operations.length} tools", () => {
        expect(registry.register).toHaveBeenCalledTimes(${operations.length});
${operations.map((op) => `        expect(registry.handlers.has("${snakeName}_${op}")).toBe(true);`).join("\n")}
    });

${operations.map(generateTestDescribe).join("\n\n")}
});
`;

// ─── Write files ───

fs.writeFileSync(toolFile, toolSource, "utf-8");
console.log(`Created: ${path.relative(process.cwd(), toolFile)}`);

fs.writeFileSync(testFile, testSource, "utf-8");
console.log(`Created: ${path.relative(process.cwd(), testFile)}`);

// ─── Update tool-manifest.ts ───

const manifest = fs.readFileSync(MANIFEST_PATH, "utf-8");

// Add import after the last tool import
const importLine = `import { register${pascalName}Tools } from "./tools/${toolName}";`;

// Find the last import from "./tools/" that is NOT inside a block
const importRegex = /^import .+ from "\.\/tools\/[^"]+";$/gm;
let lastImportMatch: RegExpExecArray | null = null;
let match: RegExpExecArray | null;
while ((match = importRegex.exec(manifest)) !== null) {
  lastImportMatch = match;
}

if (!lastImportMatch) {
  console.error("Could not find tool imports in tool-manifest.ts");
  process.exit(1);
}

const importInsertPos = lastImportMatch.index + lastImportMatch[0].length;
const withImport =
  manifest.slice(0, importInsertPos) + "\n" + importLine + manifest.slice(importInsertPos);

// Add entry before the closing ]; of TOOL_MODULES
const closingBracket = withImport.lastIndexOf("];");
if (closingBracket === -1) {
  console.error("Could not find TOOL_MODULES closing bracket in tool-manifest.ts");
  process.exit(1);
}

const entry = `\n  // ${pascalName}\n  { register: register${pascalName}Tools, categories: ["${category}"] },\n`;
const finalManifest =
  withImport.slice(0, closingBracket) + entry + withImport.slice(closingBracket);

fs.writeFileSync(MANIFEST_PATH, finalManifest, "utf-8");
console.log(`Updated: tool-manifest.ts (added import + TOOL_MODULES entry)`);

console.log(`\nDone! Next steps:`);
console.log(`  1. Implement the tool handlers in ${path.relative(process.cwd(), toolFile)}`);
console.log(`  2. Expand tests in ${path.relative(process.cwd(), testFile)}`);
console.log(`  3. Run: yarn test:run --testPathPattern=${toolName}`);
