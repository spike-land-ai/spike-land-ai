---
name: mcp-tool
description: Create a new MCP tool for the spike.land platform. Covers the full lifecycle - tool module, tests, registration, and coverage verification. Use when adding new server-side MCP tools to the platform.
---

# MCP Tool Development

Step-by-step guide for creating new MCP tools in `src/lib/mcp/server/tools/`.

## Prerequisites

- Tool name decided (e.g., `notifications`)
- Category name decided (used for progressive disclosure grouping)
- Tier decided: `"free"` (all users) or `"workspace"` (paid)
- Whether tools should be `alwaysEnabled` or discoverable via `search_tools`

## Step 1: Create the Tool Module

Create `src/lib/mcp/server/tools/<name>.ts`:

```ts
/**
 * <Name> MCP Tools
 *
 * <One-line description of what this tool category does.>
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "../tool-registry";
import { safeToolCall, textResult } from "./tool-helpers";

export function register<Name>Tools(
  registry: ToolRegistry,
  userId: string,
): void {
  registry.register({
    name: "<category>_<action>",
    description:
      "One-line description of what this tool does. Be specific about inputs and outputs.",
    category: "<category>",
    tier: "free",
    inputSchema: {
      field_name: z.string().describe("What this field represents"),
      optional_field: z.number().optional().describe("Optional parameter"),
    },
    handler: async (input: {
      field_name: string;
      optional_field?: number;
    }): Promise<CallToolResult> =>
      safeToolCall("<category>_<action>", async () => {
        // Implementation here
        // Use dynamic imports for heavy dependencies:
        //   const prisma = (await import("@/lib/prisma")).default;
        //   const { SomeService } = await import("@/lib/some-service");

        return textResult(`Result: ${input.field_name}`);
      }),
  });
}
```

### Key Patterns

**Tool naming:** `<category>_<action>` (e.g., `credits_get_balance`,
`apps_create`, `dev_logs`)

**Error handling:** Use `safeToolCall` wrapper from `tool-helpers.ts` - it
catches errors, classifies them (`McpErrorCode`), and returns structured error
responses with suggestions and retryability info.

**Local-only tools (no DB):** If the tool only uses local resources (filesystem,
exec), define helpers inline instead of using `safeToolCall`:

```ts
function textResult(text: string): CallToolResult {
  return { content: [{ type: "text", text }] };
}
function errorResult(msg: string): CallToolResult {
  return { content: [{ type: "text", text: `Error: ${msg}` }], isError: true };
}
```

**Input validation with Zod:** The `inputSchema` field accepts a `z.ZodRawShape`
(plain object of Zod types, not wrapped in `z.object()`). Common patterns:

```ts
inputSchema: {
  id: z.string().describe("Resource ID"),
  limit: z.number().optional().describe("Max results (default 10)"),
  status: z.enum(["active", "archived"]).optional().describe("Filter by status"),
}
```

**Empty input:** Use `inputSchema: {}` or `z.object({}).shape` for tools with no
parameters.

## Step 2: Create the Test File

Create `src/lib/mcp/server/tools/<name>.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import { createMockRegistry, getText, isError } from "../__test-utils__";
import { register<Name>Tools } from "./<name>";

// Mock external dependencies BEFORE imports
const mockSomeMethod = vi.fn();
vi.mock("@/lib/some-service", () => ({
  SomeService: { someMethod: mockSomeMethod },
}));

// Mock Prisma if needed
const mockPrismaMethod = vi.fn();
vi.mock("@/lib/prisma", () => ({
  default: {
    someModel: { findMany: mockPrismaMethod },
  },
}));

describe("<name> tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    register<Name>Tools(registry, userId);
  });

  it("should register N tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(N);
    expect(registry.handlers.has("<category>_<action>")).toBe(true);
  });

  describe("<category>_<action>", () => {
    it("should return expected result on success", async () => {
      mockSomeMethod.mockResolvedValue({ data: "value" });

      const handler = registry.handlers.get("<category>_<action>")!;
      const result = await handler({ field_name: "test" });

      expect(isError(result)).toBe(false);
      expect(getText(result)).toContain("expected content");
    });

    it("should handle error case", async () => {
      mockSomeMethod.mockRejectedValue(new Error("not found"));

      const handler = registry.handlers.get("<category>_<action>")!;
      const result = await handler({ field_name: "missing" });

      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("Error");
    });
  });
});
```

### Testing Tools That Use Node.js Built-ins

For tools using `node:fs` or `node:child_process`, use the shared mock
factories:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createChildProcessMocks,
  createMockRegistry,
  createNodeFsMocks,
  getText,
  isError,
} from "../__test-utils__";

// Create mocks BEFORE vi.mock calls
const fsMocks = createNodeFsMocks();
vi.mock("node:fs", fsMocks.factory);

const cpMocks = createChildProcessMocks();
vi.mock("node:child_process", cpMocks.factory);

import { registerMyTools } from "./my-tool";

// Then use fsMocks.existsSync, fsMocks.readFileSync, cpMocks.execSync, etc.
```

### Test Coverage Checklist

- Registration count matches actual tool count
- Success path for each tool
- Error/edge cases (null results, empty inputs, missing resources)
- Input validation (if applicable)
- That `userId` is passed through correctly to downstream services

## Step 3: Run Tests and Verify Coverage

```bash
yarn vitest run src/lib/mcp/server/tools/<name>.test.ts
yarn test:coverage src/lib/mcp/server/tools/<name>
```

**Required thresholds:** 80%+ lines, functions, statements; 75%+ branches.

## Step 4: Register in the MCP Server

Edit `src/lib/mcp/server/mcp-server.ts`:

1. Add the import at the top with the other tool imports:

```ts
import { register<Name>Tools } from "./tools/<name>";
```

2. Add the registration call in `createMcpServer()`:

```ts
// <Name> tools (discoverable)
register < Name > Tools(registry, userId);
```

3. If the tool has a conditional availability check (like Jules or Gateway), add
   the guard:

```ts
import { register<Name>Tools, is<Name>Available } from "./tools/<name>";
// ...
if (is<Name>Available()) {
  register<Name>Tools(registry, userId);
}
```

4. If the tool is dev-only (like dev tools):

```ts
if (process.env.NODE_ENV === "development") {
  register < Name > Tools(registry, userId);
}
```

## Step 5: Add Category Description

If this is a new category, add it to `CATEGORY_DESCRIPTIONS` in
`src/lib/mcp/server/tool-registry.ts`:

```ts
const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  // ... existing entries
  "<category>": "<One-line description of this category>",
};
```

## Step 6: Final Verification

```bash
# Run the new tests
yarn vitest run src/lib/mcp/server/tools/<name>.test.ts

# Run full MCP test suite to check nothing is broken
yarn vitest run src/lib/mcp/

# Lint
yarn lint
```

## ToolDefinition Interface Reference

From `src/lib/mcp/server/tool-registry.ts`:

```ts
interface ToolDefinition {
  name: string; // Tool name (snake_case: category_action)
  description: string; // Description shown to agents
  category: string; // Category for progressive disclosure
  tier: "free" | "workspace"; // Access tier
  inputSchema?: z.ZodRawShape; // Zod shape (not z.object())
  annotations?: ToolAnnotations; // MCP protocol annotations
  handler: (input: never) => Promise<CallToolResult> | CallToolResult;
  alwaysEnabled?: boolean; // true = always on; false/omitted = discoverable
}
```

## File Locations

| File                                       | Purpose                                                                                 |
| ------------------------------------------ | --------------------------------------------------------------------------------------- |
| `src/lib/mcp/server/tools/<name>.ts`       | Tool implementation                                                                     |
| `src/lib/mcp/server/tools/<name>.test.ts`  | Tests                                                                                   |
| `src/lib/mcp/server/tool-registry.ts`      | `ToolDefinition` interface, `CATEGORY_DESCRIPTIONS`                                     |
| `src/lib/mcp/server/tools/tool-helpers.ts` | `safeToolCall`, `textResult`, `apiRequest`, `resolveWorkspace`                          |
| `src/lib/mcp/server/__test-utils__/`       | Shared test utilities (`createMockRegistry`, `getText`, `isError`, node mock factories) |
| `src/lib/mcp/server/mcp-server.ts`         | Server factory where tools are registered                                               |
