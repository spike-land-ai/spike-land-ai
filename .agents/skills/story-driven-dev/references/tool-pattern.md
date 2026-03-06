# MCP Tool Definition Pattern

Based on patterns from `src/lib/mcp/server/tools/` in this codebase.

## File Structure

Each category gets its own file:

```
src/lib/mcp/server/tools/
├── my-category.ts          # Tool definitions
└── my-category.test.ts     # Tests (see test-pattern.md)
```

## Full Tool Template

```typescript
/**
 * My Category Tools (Server-Side)
 *
 * Brief description of what this category does.
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "../tool-registry";

// --- Zod Schemas ---

const CreateThingSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(100)
    .describe("Human-readable name for the thing"),
  description: z
    .string()
    .min(10)
    .max(1000)
    .describe("What this thing does"),
  config: z
    .record(z.string())
    .optional()
    .describe("Optional key-value configuration"),
});

const ThingIdSchema = z.object({
  thing_id: z.string().min(1).describe("The thing's unique identifier"),
});

// --- Registration Function ---

export function registerMyCategoryTools(
  registry: ToolRegistry,
  userId: string,
): void {
  // Tool 1: Create
  registry.register({
    name: "create_thing",
    description: "Create a new thing. Returns the created thing's ID and status.",
    category: "my-category",
    tier: "free",
    inputSchema: CreateThingSchema.shape, // IMPORTANT: .shape, not the schema
    handler: async ({
      name,
      description,
      config,
    }: z.infer<typeof CreateThingSchema>): Promise<CallToolResult> => {
      try {
        const prisma = (await import("@/lib/prisma")).default;

        const thing = await prisma.thing.create({
          data: { userId, name, description, config },
        });

        return {
          content: [{
            type: "text",
            text: `**Thing Created!**\n\n`
              + `**ID:** ${thing.id}\n`
              + `**Name:** ${thing.name}\n`,
          }],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        return {
          content: [{ type: "text", text: `Error creating thing: ${msg}` }],
          isError: true,
        };
      }
    },
  });

  // Tool 2: List
  registry.register({
    name: "list_things",
    description: "List all things for the current user.",
    category: "my-category",
    tier: "free",
    inputSchema: {},
    handler: async (): Promise<CallToolResult> => {
      try {
        const prisma = (await import("@/lib/prisma")).default;
        const things = await prisma.thing.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
        });

        if (things.length === 0) {
          return {
            content: [{
              type: "text",
              text: "No things found. Use `create_thing` to add one.",
            }],
          };
        }

        let text = `**Things (${things.length})**\n\n`;
        for (const t of things) {
          text += `- **${t.name}** — ID: ${t.id}\n`;
        }
        return { content: [{ type: "text", text }] };
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        return {
          content: [{ type: "text", text: `Error listing things: ${msg}` }],
          isError: true,
        };
      }
    },
  });

  // Tool 3: Delete (with annotations)
  registry.register({
    name: "delete_thing",
    description: "Permanently delete a thing by ID.",
    category: "my-category",
    tier: "free",
    inputSchema: ThingIdSchema.shape,
    annotations: {
      destructiveHint: true, // Tells agents this is destructive
    },
    handler: async ({
      thing_id,
    }: z.infer<typeof ThingIdSchema>): Promise<CallToolResult> => {
      try {
        const prisma = (await import("@/lib/prisma")).default;
        const thing = await prisma.thing.findFirst({
          where: { id: thing_id, userId },
        });

        if (!thing) {
          return {
            content: [{
              type: "text",
              text: "Thing not found or you don't have access.",
            }],
            isError: true,
          };
        }

        await prisma.thing.delete({ where: { id: thing_id } });

        return {
          content: [{
            type: "text",
            text: `**Thing Deleted!**\n\n**Name:** ${thing.name}`,
          }],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        return {
          content: [{ type: "text", text: `Error deleting thing: ${msg}` }],
          isError: true,
        };
      }
    },
  });
}
```

## Key Conventions

### Schema: always `.shape`

```typescript
// CORRECT:
inputSchema: MySchema.shape,

// WRONG:
inputSchema: MySchema,
```

### Schema: `.describe()` on every field

```typescript
// CORRECT:
name: z.string().min(1).describe("Human-readable name");

// WRONG:
name: z.string().min(1);
```

### Dynamic imports for Prisma

```typescript
// Inside handler — lazy-load prisma to avoid import-time side effects
const prisma = (await import("@/lib/prisma")).default;
```

### Response format

```typescript
// Success:
{ content: [{ type: "text", text: "**Bold Title**\n\nDetails..." }] }

// Error:
{ content: [{ type: "text", text: "Error: message" }], isError: true }
```

### Tool naming

| Pattern          | Example              | When                |
| ---------------- | -------------------- | ------------------- |
| `verb_noun`      | `create_thing`       | Creating            |
| `verb_noun`      | `list_things`        | Listing (plural)    |
| `verb_noun`      | `delete_thing`       | Deleting (singular) |
| `noun_verb_noun` | `vault_store_secret` | Category-prefixed   |

### Annotations

```typescript
annotations: {
  destructiveHint: true,   // Destructive operations (delete, revoke)
  readOnlyHint: true,      // Read-only operations (list, get)
}
```

## Registering with the Server

Two steps after creating the tool file:

### 1. Add category description in `tool-registry.ts`

```typescript
const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  // ... existing categories
  "my-category": "Description of what this category does",
};
```

### 2. Register in `mcp-server.ts`

```typescript
import { registerMyCategoryTools } from "./tools/my-category";

// Inside createMcpServer():
registerMyCategoryTools(registry, userId);
```
