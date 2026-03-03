import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/clean/photo-validation", () => ({
  validatePhoto: vi.fn(),
  extractPhotoMetadata: vi.fn(),
}));

import { registerCleanPhotoTools } from "./clean-photo";

interface ToolResult {
  content: Array<{ text: string; }>;
  isError?: boolean;
}

function createMockRegistry() {
  const tools = new Map<
    string,
    {
      handler: (...args: unknown[]) => Promise<ToolResult>;
      inputSchema: Record<string, unknown>;
    }
  >();
  return {
    tools,
    register: vi.fn(
      (
        { name, handler, inputSchema }: {
          name: string;
          handler: (...args: unknown[]) => Promise<ToolResult>;
          inputSchema: Record<string, unknown>;
        },
      ) => {
        tools.set(name, { handler, inputSchema });
      },
    ),
  };
}

describe("Clean Photo MCP Tools", () => {
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerCleanPhotoTools(
      registry as unknown as Parameters<typeof registerCleanPhotoTools>[0],
      "user123",
    );
  });

  it("registers 1 photo tool", () => {
    expect(registry.register).toHaveBeenCalledTimes(1);
    expect(registry.tools.has("clean_photo_analyze")).toBe(true);
  });

  describe("clean_photo_analyze", () => {
    it("returns combined validation and metadata for valid photo", async () => {
      const { validatePhoto, extractPhotoMetadata } = await import(
        "@/lib/clean/photo-validation"
      );
      (validatePhoto as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        valid: true,
        ageSeconds: 15,
        cameraModel: "iPhone 15",
        rejectionReason: null,
        isScreenshot: false,
      });
      (extractPhotoMetadata as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        hasExif: true,
        cameraModel: "iPhone 15",
        timestamp: new Date("2026-02-15T10:30:00Z"),
        software: null,
      });

      const handler = registry.tools.get("clean_photo_analyze")!.handler;
      const result = await handler({ photo_base64: "validbase64" });

      const text = result.content[0]!.text;
      // Validation section
      expect(text).toContain("Valid:** Yes");
      expect(text).toContain("Screenshot detected:** No");
      expect(text).toContain("Age:** 15");
      // Metadata section
      expect(text).toContain("Has EXIF:** Yes");
      expect(text).toContain("Camera:** iPhone 15");
      expect(text).toContain("Timestamp:**");
    });

    it("returns rejection for screenshot", async () => {
      const { validatePhoto, extractPhotoMetadata } = await import(
        "@/lib/clean/photo-validation"
      );
      (validatePhoto as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        valid: false,
        ageSeconds: null,
        cameraModel: null,
        rejectionReason: "Photo appears to be a screenshot.",
        isScreenshot: true,
      });
      (extractPhotoMetadata as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        hasExif: false,
        cameraModel: null,
        timestamp: null,
        software: null,
      });

      const handler = registry.tools.get("clean_photo_analyze")!.handler;
      const result = await handler({ photo_base64: "screenshotdata" });

      const text = result.content[0]!.text;
      expect(text).toContain("Valid:** No");
      expect(text).toContain("Screenshot detected:** Yes");
      expect(text).toContain(
        "Rejection reason:** Photo appears to be a screenshot.",
      );
      expect(text).toContain("Has EXIF:** No");
    });

    it("returns full metadata when available", async () => {
      const { validatePhoto, extractPhotoMetadata } = await import(
        "@/lib/clean/photo-validation"
      );
      (validatePhoto as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        valid: true,
        ageSeconds: 30,
        cameraModel: "Canon EOS R5",
        rejectionReason: null,
        isScreenshot: false,
      });
      (extractPhotoMetadata as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        hasExif: true,
        cameraModel: "Canon EOS R5",
        timestamp: new Date("2026-02-15T10:30:00Z"),
        software: "Adobe Lightroom",
      });

      const handler = registry.tools.get("clean_photo_analyze")!.handler;
      const result = await handler({ photo_base64: "validphoto" });

      const text = result.content[0]!.text;
      expect(text).toContain("Has EXIF:** Yes");
      expect(text).toContain("Camera:** Canon EOS R5");
      expect(text).toContain("Timestamp:**");
      expect(text).toContain("Software:** Adobe Lightroom");
    });

    it("handles no EXIF data", async () => {
      const { validatePhoto, extractPhotoMetadata } = await import(
        "@/lib/clean/photo-validation"
      );
      (validatePhoto as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        valid: true,
        ageSeconds: null,
        cameraModel: null,
        rejectionReason: null,
        isScreenshot: false,
      });
      (extractPhotoMetadata as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        hasExif: false,
        cameraModel: null,
        timestamp: null,
        software: null,
      });

      const handler = registry.tools.get("clean_photo_analyze")!.handler;
      const result = await handler({ photo_base64: "noexif" });

      const text = result.content[0]!.text;
      expect(text).toContain("Has EXIF:** No");
      expect(text).not.toContain("Software:");
    });

    it("handles errors gracefully", async () => {
      const { validatePhoto } = await import("@/lib/clean/photo-validation");
      (validatePhoto as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
        throw new Error("Buffer parse error");
      });

      const handler = registry.tools.get("clean_photo_analyze")!.handler;
      const result = await handler({ photo_base64: "baddata" });

      expect(result.isError).toBe(true);
      expect(result.content[0]!.text).toContain("Buffer parse error");
    });
  });
});
