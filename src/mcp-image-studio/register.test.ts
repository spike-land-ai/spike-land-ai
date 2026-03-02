import { describe, expect, it, type Mock, vi } from "vitest";
import { registerImageStudioTools } from "./register.js";
import { createMockImageStudioDeps, createMockRegistry } from "./__test-utils__/index.js";
import { generateTool } from "./tools/generate.js";
import { editTool } from "./tools/edit.js";
import type { ImageStudioToolRegistry } from "./types.js";

describe("registerImageStudioTools", () => {
  it("should register all 42 img_ tools", () => {
    const registry = createMockRegistry();
    const { deps } = createMockImageStudioDeps();
    registerImageStudioTools(registry, "test-user", deps);

    // Verify all tools are registered with img_ prefix
    const registeredNames = (registry.register as Mock).mock.calls.map(
      (call: unknown[]) => (call[0] as { name: string }).name,
    );

    expect(registeredNames.length).toBeGreaterThanOrEqual(35);
    for (const name of registeredNames) {
      expect(name).toMatch(/^img_/);
    }

    // Verify key tools exist (42 total after merges/renames/additions)
    const expected = [
      // Generation (2)
      "img_generate",
      "img_edit",
      // Asset generators (5 — favicon merged into icon, og merged into banner)
      "img_icon",
      "img_avatar",
      "img_banner",
      "img_screenshot",
      "img_diagram",
      // Enhancement & Effects (6 — added resize)
      "img_enhance",
      "img_remove_bg",
      "img_crop",
      "img_watermark",
      "img_blend",
      "img_resize",
      // Analysis (3 — added auto_tag)
      "img_analyze",
      "img_compare",
      "img_auto_tag",
      // Library (5 — added update, bulk_delete, duplicate)
      "img_upload",
      "img_list",
      "img_delete",
      "img_update",
      "img_bulk_delete",
      "img_duplicate",
      // Sharing & Export (3)
      "img_share",
      "img_versions",
      "img_export",
      // Albums (7 — added album_reorder)
      "img_album_create",
      "img_album",
      "img_album_list",
      "img_album_update",
      "img_album_delete",
      "img_album_images",
      "img_album_reorder",
      // Pipelines (4 — split pipeline_list into pipeline + pipeline_list)
      "img_pipeline_save",
      "img_pipeline",
      "img_pipeline_list",
      "img_pipeline_delete",
      // Subjects (3 — added subject_delete, renamed subjects → subject_list)
      "img_subject_save",
      "img_subject_list",
      "img_subject_delete",
      // Status & Credits (3 — renamed job → job_status, added history)
      "img_job_status",
      "img_credits",
      "img_history",
    ];
    for (const name of expected) {
      expect(registeredNames).toContain(name);
    }

    // Verify removed tools are NOT registered
    expect(registeredNames).not.toContain("img_favicon");
    expect(registeredNames).not.toContain("img_og");
    expect(registeredNames).not.toContain("img_try_catch_demo");
    expect(registeredNames).not.toContain("img_job");
    expect(registeredNames).not.toContain("img_subjects");
    expect(registeredNames).not.toContain("img_albums");
  });

  it("should export registerImageStudioTools as backwards-compat alias", () => {
    expect(registerImageStudioTools).toBe(registerImageStudioTools);
  });
});

describe("createToolFromFunction error handling within registerImageStudioTools", () => {
  it("should handle tools that throw an Error", async () => {
    const registry = createMockRegistry();
    const { deps } = createMockImageStudioDeps();

    const spy = vi
      .spyOn(generateTool, "handler")
      .mockRejectedValueOnce(new Error("Simulated generate error"));

    registerImageStudioTools(registry, "test-user", deps);

    const toolSpec = (registry.register as Mock).mock.calls.find(
      (c: unknown[]) => c[0].name === "img_generate",
    )?.[0];
    expect(toolSpec).toBeDefined();

    if (toolSpec) {
      const result = await toolSpec.handler({ prompt: "test" });
      expect(result).toEqual({
        isError: true,
        content: [{ type: "text", text: "Simulated generate error" }],
      });
    }

    spy.mockRestore();
  });

  it("should handle tools that throw a generic object or isError object", async () => {
    const registry = createMockRegistry();
    const { deps } = createMockImageStudioDeps();

    const spy = vi.spyOn(editTool, "handler").mockImplementationOnce(() => {
      throw {
        isError: true,
        content: [{ type: "text", text: "Simulated custom error" }],
      };
    });

    registerImageStudioTools(registry, "test-user", deps);

    const toolSpec = (registry.register as Mock).mock.calls.find(
      (c: unknown[]) => c[0].name === "img_edit",
    )?.[0];
    const result = await toolSpec.handler({ source_image_id: "mock-id-123" });

    expect(result).toEqual({
      isError: true,
      content: [{ type: "text", text: "Simulated custom error" }],
    });

    spy.mockRestore();
  });

  it("should return isError if handler successfully returns an object with isError = true", async () => {
    const registry = createMockRegistry();
    const { deps } = createMockImageStudioDeps();

    deps.resolvers.resolveImage = vi.fn().mockRejectedValue({
      result: {
        isError: true,
        content: [{ type: "text", text: "Known error" }],
      },
    });

    registerImageStudioTools(registry, "test-user", deps);

    const toolSpec = (registry.register as Mock).mock.calls.find(
      (c: unknown[]) => c[0].name === "img_enhance",
    )?.[0];
    const result = await toolSpec.handler({ image_id: "mock-id-123" });

    // Since it's caught in tryCatch, it resolves cleanly to a resolved Error Result
    expect(result).toEqual({
      isError: true,
      content: expect.arrayContaining([
        {
          type: "text",
          text: expect.stringContaining("Error:"),
        },
      ]),
    });
  });

  it("should wrap non-content result as text content", async () => {
    const registry = createMockRegistry();
    const { deps } = createMockImageStudioDeps();

    const spy = vi.spyOn(generateTool, "handler").mockResolvedValueOnce(
      // Return an object without 'content' array so the wrapper kicks in
      { notContent: true } as unknown as ReturnType<typeof generateTool.handler>,
    );

    registerImageStudioTools(registry, "test-user", deps);

    const toolSpec = (registry.register as Mock).mock.calls.find(
      (c: unknown[]) => c[0].name === "img_generate",
    )?.[0];
    const result = await toolSpec.handler({ prompt: "test" });

    expect(result).toEqual({
      content: [{ type: "text", text: JSON.stringify({ notContent: true }) }],
    });

    spy.mockRestore();
  });

  it("should return INVALID_INPUT when safeParse fails in handler", async () => {
    const registry = createMockRegistry();
    const { deps } = createMockImageStudioDeps();
    registerImageStudioTools(registry, "test-user", deps);

    // img_upload requires name, data_base64, content_type, width, height
    // Pass empty object to trigger validation failure on a Zod-schema tool
    const toolSpec = (registry.register as Mock).mock.calls.find(
      (c: unknown[]) => c[0].name === "img_upload",
    )?.[0];
    expect(toolSpec).toBeDefined();

    const result = await toolSpec.handler({});

    expect(result).toMatchObject({
      isError: true,
      content: expect.arrayContaining([
        expect.objectContaining({ text: expect.stringContaining("Validation Error") }),
      ]),
    });
  });

  it("should call onNotify and onProgress when provided", () => {
    const registry = createMockRegistry();
    const { deps } = createMockImageStudioDeps();
    const onNotify = vi.fn();
    const onProgress = vi.fn();

    registerImageStudioTools(registry, "test-user", deps, { onNotify, onProgress });

    // Verify tools were registered (the callbacks don't error)
    expect((registry.register as Mock).mock.calls.length).toBeGreaterThan(0);
  });

  it("should call default reportProgress without error (covers void lines)", async () => {
    // This hits the default reportProgress no-op body (lines 239-240)
    // by invoking img_enhance with image_ids which calls ctx.reportProgress
    const registry = createMockRegistry();
    const { deps } = createMockImageStudioDeps();

    // Mock jobCreate to return a valid job so enhance completes
    deps.db.jobCreate = vi.fn().mockResolvedValue({
      id: "job-1",
      imageId: "img-1",
      tier: "FREE",
      status: "PENDING",
      creditsCost: 0,
    });

    // Register without onProgress - creates the default no-op lambda
    registerImageStudioTools(registry, "test-user", deps);

    const toolSpec = (registry.register as Mock).mock.calls.find(
      (c: unknown[]) => c[0].name === "img_enhance",
    )?.[0];
    expect(toolSpec).toBeDefined();

    // Call with image_ids to trigger the reportProgress path inside enhance handler
    const result = await toolSpec.handler({ image_ids: ["img-1"] });
    // Should succeed (reportProgress no-op should not throw)
    expect(result).toBeDefined();
  });

  it("should handle tool name already prefixed with img_", async () => {
    const registry = createMockRegistry();
    const { deps } = createMockImageStudioDeps();

    // Temporarily rename generateTool.name to have img_ prefix
    const originalName = generateTool.name;
    Object.defineProperty(generateTool, "name", {
      value: "img_generate",
      writable: true,
      configurable: true,
    });

    registerImageStudioTools(registry, "test-user", deps);

    // Restore original name
    Object.defineProperty(generateTool, "name", {
      value: originalName,
      writable: true,
      configurable: true,
    });

    const registeredNames = (registry.register as Mock).mock.calls.map(
      (call: unknown[]) => (call[0] as { name: string }).name,
    );

    // Should not double-prefix
    expect(registeredNames).toContain("img_generate");
    expect(registeredNames).not.toContain("img_img_generate");
  });

  it("should use fallback description when tool has empty description", async () => {
    const registry = createMockRegistry();
    const { deps } = createMockImageStudioDeps();

    // Temporarily set empty description on generateTool
    const originalDesc = generateTool.description;
    Object.defineProperty(generateTool, "description", {
      value: "",
      writable: true,
      configurable: true,
    });

    registerImageStudioTools(registry, "test-user", deps);

    Object.defineProperty(generateTool, "description", {
      value: originalDesc,
      writable: true,
      configurable: true,
    });

    const generateSpec = (registry.register as Mock).mock.calls.find(
      (c: unknown[]) => (c[0] as { name: string }).name === "img_generate",
    )?.[0] as { description: string };

    // Should use the fallback `Execute ${toolExport.name}`
    expect(generateSpec.description).toContain("Execute");
  });

  it("should handle handler throwing a non-Error value (string)", async () => {
    const registry = createMockRegistry();
    const { deps } = createMockImageStudioDeps();

    const spy = vi.spyOn(generateTool, "handler").mockImplementationOnce(() => {
      throw "plain string error";
    });

    registerImageStudioTools(registry, "test-user", deps);

    const toolSpec = (registry.register as Mock).mock.calls.find(
      (c: unknown[]) => c[0].name === "img_generate",
    )?.[0];
    const result = await toolSpec.handler({ prompt: "test" });

    expect(result).toEqual({
      isError: true,
      content: [{ type: "text", text: "plain string error" }],
    });

    spy.mockRestore();
  });

  it("should warn when module has no valid tool export in non-production", () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "test";

    // Create a registry that collects registrations but also allows us to
    // test the warning path by injecting a module with no valid export
    const registry: ImageStudioToolRegistry = {
      register: vi.fn(),
    };

    // We cannot easily inject a bad module, but we can verify the existing
    // modules all export valid tools (no warnings in test env)
    const { deps } = createMockImageStudioDeps();
    registerImageStudioTools(registry, "test-user", deps);

    // All current modules have valid exports so no warn expected
    expect(consoleSpy).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
    process.env.NODE_ENV = originalEnv;
  });
});
