import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const mockSafeToolCall = vi.hoisted(() =>
  vi.fn((_name: string, handler: () => Promise<unknown>) => handler())
);
const mockTextResult = vi.hoisted(() =>
  vi.fn((text: string) => ({ content: [{ type: "text", text }] }))
);

vi.mock("../tool-helpers", () => ({
  safeToolCall: mockSafeToolCall,
  textResult: mockTextResult,
}));

import { createMockRegistry, getText } from "../../__test-utils__";
import {
  formatEntity,
  formatEntityList,
  registerCrudTools,
} from "./crud-template";
import type { CrudToolConfig } from "./crud-template";

describe("crud-template", () => {
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
  });

  describe("registerCrudTools", () => {
    it("should register all 5 CRUD tools when all schemas provided", () => {
      const config: CrudToolConfig<
        { name: z.ZodString; },
        { id: z.ZodString; },
        { id: z.ZodString; name: z.ZodString; },
        { id: z.ZodString; },
        { filter: z.ZodOptional<z.ZodString>; }
      > = {
        domain: "test",
        category: "testing",
        tier: "free",
        entity: "widget",
        schemas: {
          create: {
            shape: { name: z.string() },
            handler: async () => ({
              content: [{ type: "text", text: "created" }],
            }),
          },
          get: {
            shape: { id: z.string() },
            handler: async () => ({ content: [{ type: "text", text: "got" }] }),
          },
          update: {
            shape: { id: z.string(), name: z.string() },
            handler: async () => ({
              content: [{ type: "text", text: "updated" }],
            }),
          },
          delete: {
            shape: { id: z.string() },
            handler: async () => ({
              content: [{ type: "text", text: "deleted" }],
            }),
          },
          list: {
            shape: { filter: z.string().optional() },
            handler: async () => ({
              content: [{ type: "text", text: "listed" }],
            }),
          },
        },
      };

      registerCrudTools(registry, config);

      expect(registry.register).toHaveBeenCalledTimes(5);
    });

    it("should generate correct tool names using domain and entity", () => {
      const config: CrudToolConfig<
        { name: z.ZodString; },
        { id: z.ZodString; },
        { id: z.ZodString; },
        { id: z.ZodString; },
        { filter: z.ZodOptional<z.ZodString>; }
      > = {
        domain: "myapp",
        category: "apps",
        tier: "workspace",
        entity: "item",
        schemas: {
          create: {
            shape: { name: z.string() },
            handler: async () => ({ content: [{ type: "text", text: "ok" }] }),
          },
          get: {
            shape: { id: z.string() },
            handler: async () => ({ content: [{ type: "text", text: "ok" }] }),
          },
          update: {
            shape: { id: z.string() },
            handler: async () => ({ content: [{ type: "text", text: "ok" }] }),
          },
          delete: {
            shape: { id: z.string() },
            handler: async () => ({ content: [{ type: "text", text: "ok" }] }),
          },
          list: {
            shape: { filter: z.string().optional() },
            handler: async () => ({ content: [{ type: "text", text: "ok" }] }),
          },
        },
      };

      registerCrudTools(registry, config);

      const registeredNames = (registry.register as ReturnType<typeof vi.fn>)
        .mock.calls.map(
          (call: Array<{ name: string; }>) => call[0]!.name,
        );
      expect(registeredNames).toContain("myapp_create_item");
      expect(registeredNames).toContain("myapp_get_item");
      expect(registeredNames).toContain("myapp_update_item");
      expect(registeredNames).toContain("myapp_delete_item");
      expect(registeredNames).toContain("myapp_list_item");
    });

    it("should set correct descriptions for each CRUD operation", () => {
      const config: CrudToolConfig<
        { name: z.ZodString; },
        { id: z.ZodString; },
        { id: z.ZodString; },
        { id: z.ZodString; },
        { filter: z.ZodOptional<z.ZodString>; }
      > = {
        domain: "test",
        category: "testing",
        tier: "free",
        entity: "widget",
        schemas: {
          create: {
            shape: { name: z.string() },
            handler: async () => ({ content: [{ type: "text", text: "ok" }] }),
          },
          get: {
            shape: { id: z.string() },
            handler: async () => ({ content: [{ type: "text", text: "ok" }] }),
          },
          update: {
            shape: { id: z.string() },
            handler: async () => ({ content: [{ type: "text", text: "ok" }] }),
          },
          delete: {
            shape: { id: z.string() },
            handler: async () => ({ content: [{ type: "text", text: "ok" }] }),
          },
          list: {
            shape: { filter: z.string().optional() },
            handler: async () => ({ content: [{ type: "text", text: "ok" }] }),
          },
        },
      };

      registerCrudTools(registry, config);

      const calls = (registry.register as ReturnType<typeof vi.fn>).mock
        .calls as Array<
          [{ name: string; description: string; }]
        >;

      const getDesc = (name: string) => calls.find(c => c[0].name === name)?.[0].description;

      expect(getDesc("test_create_widget")).toBe("Create a new widget.");
      expect(getDesc("test_get_widget")).toBe("Get a widget by ID.");
      expect(getDesc("test_update_widget")).toBe("Update an existing widget.");
      expect(getDesc("test_delete_widget")).toBe("Delete a widget.");
      expect(getDesc("test_list_widget")).toBe(
        "List widgets with optional filters.",
      );
    });

    it("should set readOnlyHint annotation on get and list tools", () => {
      const config: CrudToolConfig<
        { name: z.ZodString; },
        { id: z.ZodString; },
        { id: z.ZodString; },
        { id: z.ZodString; },
        { filter: z.ZodOptional<z.ZodString>; }
      > = {
        domain: "test",
        category: "testing",
        tier: "free",
        entity: "widget",
        schemas: {
          create: {
            shape: { name: z.string() },
            handler: async () => ({ content: [{ type: "text", text: "ok" }] }),
          },
          get: {
            shape: { id: z.string() },
            handler: async () => ({ content: [{ type: "text", text: "ok" }] }),
          },
          update: {
            shape: { id: z.string() },
            handler: async () => ({ content: [{ type: "text", text: "ok" }] }),
          },
          delete: {
            shape: { id: z.string() },
            handler: async () => ({ content: [{ type: "text", text: "ok" }] }),
          },
          list: {
            shape: { filter: z.string().optional() },
            handler: async () => ({ content: [{ type: "text", text: "ok" }] }),
          },
        },
      };

      registerCrudTools(registry, config);

      const calls = (registry.register as ReturnType<typeof vi.fn>).mock
        .calls as Array<
          [{ name: string; annotations?: { readOnlyHint: boolean; }; }]
        >;

      const getDef = (name: string) => calls.find(c => c[0].name === name)?.[0];

      // get and list should have readOnlyHint
      expect(getDef("test_get_widget")?.annotations).toEqual({
        readOnlyHint: true,
      });
      expect(getDef("test_list_widget")?.annotations).toEqual({
        readOnlyHint: true,
      });

      // create, update, delete should NOT have readOnlyHint
      expect(getDef("test_create_widget")?.annotations).toBeUndefined();
      expect(getDef("test_update_widget")?.annotations).toBeUndefined();
      expect(getDef("test_delete_widget")?.annotations).toBeUndefined();
    });

    it("should pass through category and tier to each registered tool", () => {
      const config: CrudToolConfig<
        { name: z.ZodString; },
        never,
        never,
        never,
        never
      > = {
        domain: "test",
        category: "my-category",
        tier: "workspace",
        entity: "thing",
        schemas: {
          create: {
            shape: { name: z.string() },
            handler: async () => ({ content: [{ type: "text", text: "ok" }] }),
          },
        },
      };

      registerCrudTools(registry, config);

      const call = (registry.register as ReturnType<typeof vi.fn>).mock
        .calls[0]![0] as {
          category: string;
          tier: string;
        };
      expect(call.category).toBe("my-category");
      expect(call.tier).toBe("workspace");
    });

    it("should set complexity to primitive for all tools", () => {
      const config: CrudToolConfig<
        { name: z.ZodString; },
        { id: z.ZodString; },
        never,
        never,
        never
      > = {
        domain: "test",
        category: "testing",
        tier: "free",
        entity: "widget",
        schemas: {
          create: {
            shape: { name: z.string() },
            handler: async () => ({ content: [{ type: "text", text: "ok" }] }),
          },
          get: {
            shape: { id: z.string() },
            handler: async () => ({ content: [{ type: "text", text: "ok" }] }),
          },
        },
      };

      registerCrudTools(registry, config);

      const calls = (registry.register as ReturnType<typeof vi.fn>).mock
        .calls as Array<
          [{ complexity: string; }]
        >;
      for (const call of calls) {
        expect(call[0].complexity).toBe("primitive");
      }
    });

    it("should register only create and list when only those schemas provided", () => {
      const config: CrudToolConfig<
        { name: z.ZodString; },
        never,
        never,
        never,
        { limit: z.ZodNumber; }
      > = {
        domain: "partial",
        category: "testing",
        tier: "free",
        entity: "foo",
        schemas: {
          create: {
            shape: { name: z.string() },
            handler: async () => ({ content: [{ type: "text", text: "ok" }] }),
          },
          list: {
            shape: { limit: z.number() },
            handler: async () => ({ content: [{ type: "text", text: "ok" }] }),
          },
        },
      };

      registerCrudTools(registry, config);

      expect(registry.register).toHaveBeenCalledTimes(2);
      const registeredNames = (registry.register as ReturnType<typeof vi.fn>)
        .mock.calls.map(
          (call: Array<{ name: string; }>) => call[0]!.name,
        );
      expect(registeredNames).toContain("partial_create_foo");
      expect(registeredNames).toContain("partial_list_foo");
    });

    it("should register no tools when schemas is empty", () => {
      const config: CrudToolConfig<never, never, never, never, never> = {
        domain: "empty",
        category: "testing",
        tier: "free",
        entity: "nothing",
        schemas: {},
      };

      registerCrudTools(registry, config);

      expect(registry.register).toHaveBeenCalledTimes(0);
    });

    it("should wrap handlers with safeToolCall", async () => {
      const createHandler = vi.fn(async () => ({
        content: [{ type: "text" as const, text: "created!" }],
      }));

      const config: CrudToolConfig<
        { name: z.ZodString; },
        never,
        never,
        never,
        never
      > = {
        domain: "test",
        category: "testing",
        tier: "free",
        entity: "widget",
        schemas: {
          create: {
            shape: { name: z.string() },
            handler: createHandler,
          },
        },
      };

      registerCrudTools(registry, config);

      const handler = registry.handlers.get("test_create_widget")!;
      const result = await handler({ name: "test" });

      // safeToolCall should have been called with the tool name
      expect(mockSafeToolCall).toHaveBeenCalledWith(
        "test_create_widget",
        expect.any(Function),
      );
      expect(result).toEqual({ content: [{ type: "text", text: "created!" }] });
    });

    it("should invoke the correct handler for each CRUD operation", async () => {
      const createHandler = vi.fn(async () => ({
        content: [{ type: "text" as const, text: "created" }],
      }));
      const getHandler = vi.fn(async () => ({
        content: [{ type: "text" as const, text: "fetched" }],
      }));
      const updateHandler = vi.fn(async () => ({
        content: [{ type: "text" as const, text: "updated" }],
      }));
      const deleteHandler = vi.fn(async () => ({
        content: [{ type: "text" as const, text: "deleted" }],
      }));
      const listHandler = vi.fn(async () => ({
        content: [{ type: "text" as const, text: "listed" }],
      }));

      const config: CrudToolConfig<
        { name: z.ZodString; },
        { id: z.ZodString; },
        { id: z.ZodString; name: z.ZodString; },
        { id: z.ZodString; },
        { filter: z.ZodOptional<z.ZodString>; }
      > = {
        domain: "test",
        category: "testing",
        tier: "free",
        entity: "widget",
        schemas: {
          create: { shape: { name: z.string() }, handler: createHandler },
          get: { shape: { id: z.string() }, handler: getHandler },
          update: {
            shape: { id: z.string(), name: z.string() },
            handler: updateHandler,
          },
          delete: { shape: { id: z.string() }, handler: deleteHandler },
          list: {
            shape: { filter: z.string().optional() },
            handler: listHandler,
          },
        },
      };

      registerCrudTools(registry, config);

      await registry.handlers.get("test_create_widget")!({ name: "foo" });
      expect(createHandler).toHaveBeenCalledWith({ name: "foo" });

      await registry.handlers.get("test_get_widget")!({ id: "123" });
      expect(getHandler).toHaveBeenCalledWith({ id: "123" });

      await registry.handlers.get("test_update_widget")!({
        id: "123",
        name: "bar",
      });
      expect(updateHandler).toHaveBeenCalledWith({ id: "123", name: "bar" });

      await registry.handlers.get("test_delete_widget")!({ id: "123" });
      expect(deleteHandler).toHaveBeenCalledWith({ id: "123" });

      await registry.handlers.get("test_list_widget")!({ filter: "active" });
      expect(listHandler).toHaveBeenCalledWith({ filter: "active" });
    });

    it("should pass inputSchema (shape) to each registered tool", () => {
      const nameShape = { name: z.string() };
      const idShape = { id: z.string() };

      const config: CrudToolConfig<
        { name: z.ZodString; },
        { id: z.ZodString; },
        never,
        never,
        never
      > = {
        domain: "test",
        category: "testing",
        tier: "free",
        entity: "widget",
        schemas: {
          create: {
            shape: nameShape,
            handler: async () => ({ content: [{ type: "text", text: "ok" }] }),
          },
          get: {
            shape: idShape,
            handler: async () => ({ content: [{ type: "text", text: "ok" }] }),
          },
        },
      };

      registerCrudTools(registry, config);

      const calls = (registry.register as ReturnType<typeof vi.fn>).mock
        .calls as Array<
          [{ name: string; inputSchema: z.ZodRawShape; }]
        >;
      const createDef = calls.find(c => c[0].name === "test_create_widget")
        ?.[0];
      const getDef = calls.find(c => c[0].name === "test_get_widget")?.[0];

      expect(createDef?.inputSchema).toBe(nameShape);
      expect(getDef?.inputSchema).toBe(idShape);
    });
  });

  describe("formatEntity", () => {
    it("should format entity with label and fields", () => {
      const result = formatEntity("Widget", {
        Name: "Test Widget",
        Status: "active",
        Count: 42,
      });

      expect(result).toContain("**Widget**");
      expect(result).toContain("**Name:** Test Widget");
      expect(result).toContain("**Status:** active");
      expect(result).toContain("**Count:** 42");
    });

    it("should display (none) for null values", () => {
      const result = formatEntity("Item", {
        Name: "Test",
        Description: null,
      });

      expect(result).toContain("**Description:** (none)");
    });

    it("should display (none) for undefined values", () => {
      const result = formatEntity("Item", {
        Name: "Test",
        Notes: undefined,
      });

      expect(result).toContain("**Notes:** (none)");
    });

    it("should handle boolean values", () => {
      const result = formatEntity("Item", {
        Active: true,
        Archived: false,
      });

      expect(result).toContain("**Active:** true");
      expect(result).toContain("**Archived:** false");
    });

    it("should handle empty fields object", () => {
      const result = formatEntity("Empty", {});
      expect(result).toBe("**Empty**\n\n");
    });

    it("should handle numeric zero", () => {
      const result = formatEntity("Item", { Count: 0 });
      expect(result).toContain("**Count:** 0");
    });
  });

  describe("formatEntityList", () => {
    it("should format a list of entities", () => {
      const result = formatEntityList("Widgets", [
        { id: "w1", summary: "First widget" },
        { id: "w2", summary: "Second widget" },
      ]);

      const text = getText(result);
      expect(text).toContain("**Widgets (2)**");
      expect(text).toContain("- **w1** — First widget");
      expect(text).toContain("- **w2** — Second widget");
    });

    it("should return no-items message when list is empty", () => {
      const result = formatEntityList("Widgets", []);
      const text = getText(result);
      expect(text).toContain("**No Widgets found.**");
    });

    it("should show correct count for single item", () => {
      const result = formatEntityList("Items", [
        { id: "i1", summary: "Only item" },
      ]);

      const text = getText(result);
      expect(text).toContain("**Items (1)**");
      expect(text).toContain("- **i1** — Only item");
    });

    it("should call textResult helper", () => {
      formatEntityList("Things", [{ id: "t1", summary: "a thing" }]);
      expect(mockTextResult).toHaveBeenCalled();
    });
  });
});
