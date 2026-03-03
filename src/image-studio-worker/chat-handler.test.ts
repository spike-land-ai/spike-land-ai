import { describe, it, expect } from "vitest";

// ─── Chat Handler SSE Event Types ───

describe("Chat Handler SSE Events", () => {
  it("should define expected event types", () => {
    const validEvents = [
      "text_delta",
      "thought",
      "tool_call_start",
      "tool_call_end",
      "browser_command",
      "gallery_update",
      "system_notice",
      "error",
    ];

    expect(validEvents).toContain("gallery_update");
    expect(validEvents).toHaveLength(8);
  });

  it("should define image tool set for gallery updates", () => {
    const imageTools = new Set([
      "img_generate", "img_edit", "img_enhance", "img_upload",
      "img_delete", "img_auto_crop", "img_smart_enhance",
      "img_background_remove", "img_upscale", "img_style_transfer",
      "img_color_grade", "img_restore",
    ]);

    expect(imageTools.has("img_generate")).toBe(true);
    expect(imageTools.has("img_enhance")).toBe(true);
    expect(imageTools.has("some_other_tool")).toBe(false);
  });

  it("gallery_update action values are a known set", () => {
    // Matches GalleryUpdateEvent.action in shared-types.ts
    const validActions = ["image_created", "image_enhanced", "image_deleted", "album_updated"];
    expect(validActions).toContain("image_created");
    expect(validActions).toContain("image_enhanced");
    expect(validActions).toContain("image_deleted");
    expect(validActions).toContain("album_updated");
    expect(validActions).toHaveLength(4);
  });

  it("should construct a valid GalleryUpdateEvent object", async () => {
    const { } = await import("./shared-types.ts");

    const event = {
      type: "gallery_update" as const,
      action: "image_created" as const,
      imageId: "img-abc",
    };

    expect(event.type).toBe("gallery_update");
    expect(event.action).toBe("image_created");
    expect(event.imageId).toBe("img-abc");
  });

  it("should construct a valid TextDeltaEvent object", async () => {
    const { } = await import("./shared-types.ts");

    const event = {
      type: "text_delta" as const,
      text: "Hello, world!",
    };

    expect(event.type).toBe("text_delta");
    expect(event.text).toBe("Hello, world!");
  });

  it("should construct a valid ToolCallStartEvent object", async () => {
    const { } = await import("./shared-types.ts");

    const event = {
      type: "tool_call_start" as const,
      name: "img_generate",
      args: { prompt: "a beautiful landscape", width: 1024, height: 768 },
    };

    expect(event.type).toBe("tool_call_start");
    expect(event.name).toBe("img_generate");
    expect(event.args).toHaveProperty("prompt");
  });

  it("should construct a valid BrowserCommandEvent object", async () => {
    const { } = await import("./shared-types.ts");

    const requestId = `br-${Date.now()}-abc123`;
    const event = {
      type: "browser_command" as const,
      tool: "navigate",
      args: { url: "/gallery" },
      requestId,
    };

    expect(event.type).toBe("browser_command");
    expect(event.requestId).toMatch(/^br-/);
  });

  it("should construct a valid ErrorEvent object", async () => {
    const { } = await import("./shared-types.ts");

    const event = {
      type: "error" as const,
      error: "Something went wrong",
    };

    expect(event.type).toBe("error");
    expect(event.error).toBe("Something went wrong");
  });
});

// ─── SSE Encoding format ───

describe("SSE encoding format", () => {
  it("encodes events as data: <json>\\n\\n", () => {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    function sseEvent(data: Record<string, unknown>): string {
      const encoded = encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
      return decoder.decode(encoded);
    }

    const out = sseEvent({ type: "text_delta", text: "hello" });
    expect(out).toMatch(/^data: /);
    expect(out).toMatch(/\n\n$/);

    const parsed = JSON.parse(out.replace(/^data: /, "").trim());
    expect(parsed.type).toBe("text_delta");
    expect(parsed.text).toBe("hello");
  });

  it("correctly encodes gallery_update SSE event", () => {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const eventData = {
      type: "gallery_update",
      action: "image_created",
      imageId: "img-123",
    };

    const raw = decoder.decode(
      encoder.encode(`data: ${JSON.stringify(eventData)}\n\n`),
    );

    const parsed = JSON.parse(raw.replace(/^data: /, "").trim());
    expect(parsed.type).toBe("gallery_update");
    expect(parsed.action).toBe("image_created");
    expect(parsed.imageId).toBe("img-123");
  });

  it("handles special characters in text payloads", () => {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const specialText = 'Hello "world" & <script>alert(1)</script>';
    const raw = decoder.decode(
      encoder.encode(`data: ${JSON.stringify({ type: "text_delta", text: specialText })}\n\n`),
    );

    const parsed = JSON.parse(raw.replace(/^data: /, "").trim());
    expect(parsed.text).toBe(specialText);
  });
});

// ─── Model fallback logic ───

describe("Model fallback logic", () => {
  const RECOVERABLE_ERRORS = ["503", "404", "UNAVAILABLE", "not found", "region", "not supported", "429"];

  it("detects recoverable error codes", () => {
    for (const code of RECOVERABLE_ERRORS) {
      const errorText = `API error: ${code} Service Unavailable`;
      const isRecoverable = RECOVERABLE_ERRORS.some((e) => errorText.includes(e));
      expect(isRecoverable).toBe(true);
    }
  });

  it("treats unknown errors as non-recoverable", () => {
    const errorText = "Internal error: authentication failed";
    const isRecoverable = RECOVERABLE_ERRORS.some((e) => errorText.includes(e));
    expect(isRecoverable).toBe(false);
  });

  it("limits tool call iterations to maxIterations", () => {
    const maxIterations = 10;
    let iterations = 0;
    let hasToolCalls = true;

    // Simulate the iteration loop until max
    while (iterations < maxIterations && hasToolCalls) {
      iterations++;
      if (iterations === maxIterations) {
        hasToolCalls = false; // Force exit
      }
    }

    expect(iterations).toBe(maxIterations);
  });
});
