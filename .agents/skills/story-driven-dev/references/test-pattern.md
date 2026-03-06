# MCP Tool Test Pattern

Based on patterns from `vault.test.ts` and `tool-factory.test.ts` in this
codebase.

## Full Test Template

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Step 1: Mock dependencies BEFORE imports ---
// Vitest hoists vi.mock() but declaring mocks before keeps it readable

const mockPrisma = {
  thing: {
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({
  default: mockPrisma,
}));

// --- Step 2: Import the module under test AFTER mocks ---

import type { ToolRegistry } from "../tool-registry";
import { registerMyCategoryTools } from "./my-category";

// --- Step 3: Create mock registry ---

function createMockRegistry(): ToolRegistry & {
  handlers: Map<string, (...args: unknown[]) => unknown>;
} {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const registry = {
    register: vi.fn(
      (def: { name: string; handler: (...args: unknown[]) => unknown; }) => {
        handlers.set(def.name, def.handler);
      },
    ),
    handlers,
  };
  return registry as unknown as ToolRegistry & {
    handlers: Map<string, (...args: unknown[]) => unknown>;
  };
}

// --- Step 4: Write tests ---

describe("my-category tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerMyCategoryTools(registry, userId);
  });

  // 4a: Registration test
  it("should register 3 tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(3);
    expect(registry.handlers.has("create_thing")).toBe(true);
    expect(registry.handlers.has("list_things")).toBe(true);
    expect(registry.handlers.has("delete_thing")).toBe(true);
  });

  // 4b: Per-tool tests
  describe("create_thing", () => {
    it("should create a thing", async () => {
      // Setup mocks
      mockPrisma.thing.create.mockResolvedValue({
        id: "thing-1",
        name: "My Thing",
      });

      // Call handler
      const handler = registry.handlers.get("create_thing")!;
      const result = await handler({
        name: "My Thing",
        description: "A test thing",
      });

      // Assert side effects
      expect(mockPrisma.thing.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId,
          name: "My Thing",
        }),
      });

      // Assert response shape
      expect(result).toEqual(
        expect.objectContaining({
          content: expect.arrayContaining([
            expect.objectContaining({
              type: "text",
              text: expect.stringContaining("Thing Created"),
            }),
          ]),
        }),
      );
    });

    it("should handle database errors", async () => {
      mockPrisma.thing.create.mockRejectedValue(
        new Error("DB connection failed"),
      );

      const handler = registry.handlers.get("create_thing")!;
      const result = await handler({
        name: "My Thing",
        description: "A test thing",
      });

      expect(result).toEqual(
        expect.objectContaining({
          isError: true,
          content: expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining("DB connection failed"),
            }),
          ]),
        }),
      );
    });
  });

  describe("list_things", () => {
    it("should list things", async () => {
      mockPrisma.thing.findMany.mockResolvedValue([
        { id: "t1", name: "Thing A" },
        { id: "t2", name: "Thing B" },
      ]);

      const handler = registry.handlers.get("list_things")!;
      const result = await handler({});

      const text = (result as { content: Array<{ text: string; }>; }).content[0]!.text;
      expect(text).toContain("Thing A");
      expect(text).toContain("Thing B");
    });

    it("should show empty message", async () => {
      mockPrisma.thing.findMany.mockResolvedValue([]);

      const handler = registry.handlers.get("list_things")!;
      const result = await handler({});

      expect(result).toEqual(
        expect.objectContaining({
          content: expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining("No things found"),
            }),
          ]),
        }),
      );
    });
  });

  describe("delete_thing", () => {
    it("should delete an existing thing", async () => {
      mockPrisma.thing.findFirst.mockResolvedValue({
        id: "t1",
        name: "My Thing",
        userId,
      });
      mockPrisma.thing.delete.mockResolvedValue({ id: "t1" });

      const handler = registry.handlers.get("delete_thing")!;
      const result = await handler({ thing_id: "t1" });

      expect(mockPrisma.thing.delete).toHaveBeenCalledWith({
        where: { id: "t1" },
      });
      expect(result).toEqual(
        expect.objectContaining({
          content: expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining("Thing Deleted"),
            }),
          ]),
        }),
      );
    });

    it("should return error for non-existent thing", async () => {
      mockPrisma.thing.findFirst.mockResolvedValue(null);

      const handler = registry.handlers.get("delete_thing")!;
      const result = await handler({ thing_id: "nonexistent" });

      expect(result).toEqual(
        expect.objectContaining({
          isError: true,
          content: expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining("not found"),
            }),
          ]),
        }),
      );
    });
  });
});
```

## Key Patterns

### Mock ordering matters

```
1. Declare mock objects (const mockPrisma = ...)
2. vi.mock() calls (hoisted, but references the mocks above)
3. Import the module under test
4. Tests
```

### Handler capture pattern

```typescript
const handler = registry.handlers.get("tool_name")!;
const result = await handler({ ...args });
```

### Two assertion styles

**Nested objectContaining** (for response shape):

```typescript
expect(result).toEqual(
  expect.objectContaining({
    content: expect.arrayContaining([
      expect.objectContaining({
        type: "text",
        text: expect.stringContaining("Expected text"),
      }),
    ]),
  }),
);
```

**Text extraction** (for detailed text checks):

```typescript
const text = (result as { content: Array<{ text: string; }>; }).content[0]!.text;
expect(text).toContain("something");
expect(text).not.toContain("secret-value"); // Negative assertion
```

### Error response assertion

```typescript
expect(result).toEqual(
  expect.objectContaining({
    isError: true,
    content: expect.arrayContaining([
      expect.objectContaining({
        text: expect.stringContaining("error message"),
      }),
    ]),
  }),
);
```

### What to test per tool

| Test Type      | What to Check                                            |
| -------------- | -------------------------------------------------------- |
| Registration   | Correct count, correct names in `handlers` map           |
| Happy path     | Mocks return valid data, response contains expected text |
| Auth/ownership | Handler scopes queries to `userId`                       |
| Error handling | Mock rejects, `{ isError: true }` with message           |
| Edge cases     | Empty lists, already-deleted items, quota limits         |
| Side effects   | `expect(mock).toHaveBeenCalledWith(...)`                 |
