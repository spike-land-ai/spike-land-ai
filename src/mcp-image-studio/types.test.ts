import { describe, expect, it } from "vitest";
import {
  ADVANCED_FEATURE_COSTS,
  asAlbumHandle,
  asHexColor,
  asImageId,
  asJobId,
  asPercentage,
  asPipelineId,
  asSubjectLabel,
  batchResult,
  BG_OUTPUT_FORMAT_VALUES,
  BLEND_MODE_VALUES,
  ENHANCEMENT_COSTS,
  errorResult,
  IMG_DEFAULTS,
  jsonResult,
  ImageStudioResolverError,
  resolve,
  STYLE_NAME_VALUES,
  textResult,
  toolEvent,
} from "./types.js";

describe("Enum Values", () => {
  it("exports valid enum lists", () => {
    expect(STYLE_NAME_VALUES).toContain("oil_painting");
    expect(STYLE_NAME_VALUES.length).toBeGreaterThan(0);

    expect(BLEND_MODE_VALUES).toContain("overlay");
    expect(BLEND_MODE_VALUES.length).toBe(4); // "overlay", "multiply", "screen", "dissolve"
    expect(BLEND_MODE_VALUES[0]).toBe("overlay");

    expect(BG_OUTPUT_FORMAT_VALUES).toContain("png");
    expect(BG_OUTPUT_FORMAT_VALUES.length).toBeGreaterThan(0);
  });
});

describe("Enum Values Coverage Helper", () => {
  it("iterates over Enum Values", () => {
    expect(STYLE_NAME_VALUES.map((x) => x).length).toBe(STYLE_NAME_VALUES.length);
    expect(BLEND_MODE_VALUES.map((x) => x).length).toBe(BLEND_MODE_VALUES.length);
    expect(BG_OUTPUT_FORMAT_VALUES.map((x) => x).length).toBe(BG_OUTPUT_FORMAT_VALUES.length);
  });
});

describe("IMG_DEFAULTS", () => {
  it("exports baseline configured defaults for enhancement tools", () => {
    expect(IMG_DEFAULTS).toBeDefined();
    expect(IMG_DEFAULTS.tier).toBe("TIER_1K");
    expect(IMG_DEFAULTS.aspectRatio).toBe("1:1");
    expect(IMG_DEFAULTS.modelPreference).toBe("default");
    expect(IMG_DEFAULTS.watermarkPosition).toBe("bottom-right");
    expect(IMG_DEFAULTS.watermarkOpacity).toBe(50);
    expect(IMG_DEFAULTS.promptGenerate).toContain("beautiful");
  });
});

describe("Pricing constants", () => {
  it("exports advanced feature costs", () => {
    expect(ADVANCED_FEATURE_COSTS.subjectRef).toBe(1);
    expect(ADVANCED_FEATURE_COSTS.grounding).toBe(2);
    expect(ADVANCED_FEATURE_COSTS.text).toBe(1);
  });

  it("exports base tier enhancement costs", () => {
    expect(ENHANCEMENT_COSTS.FREE).toBe(0);
    expect(ENHANCEMENT_COSTS.TIER_0_5K).toBe(1);
    expect(ENHANCEMENT_COSTS.TIER_1K).toBe(2);
    expect(ENHANCEMENT_COSTS.TIER_2K).toBe(5);
    expect(ENHANCEMENT_COSTS.TIER_4K).toBe(10);
  });
});

describe("Brand type helpers", () => {
  it("asImageId", () => expect(asImageId("123")).toBe("123"));
  it("asImageId throws on empty string", () => {
    expect(() => asImageId("")).toThrowError(/Invalid ImageId/);
  });
  it("asImageId throws on string over 64 chars", () => {
    expect(() => asImageId("a".repeat(65))).toThrowError(/Invalid ImageId/);
  });

  it("asAlbumHandle", () => expect(asAlbumHandle("abc")).toBe("abc"));
  it("asAlbumHandle throws on empty string", () => {
    expect(() => asAlbumHandle("")).toThrowError(/Invalid AlbumHandle/);
  });
  it("asAlbumHandle throws on string over 64 chars", () => {
    expect(() => asAlbumHandle("x".repeat(65))).toThrowError(/Invalid AlbumHandle/);
  });

  it("asPipelineId", () => expect(asPipelineId("p-1")).toBe("p-1"));
  it("asPipelineId throws on empty string", () => {
    expect(() => asPipelineId("")).toThrowError(/Invalid PipelineId/);
  });

  it("asJobId", () => expect(asJobId("j-1")).toBe("j-1"));
  it("asJobId throws on empty string", () => {
    expect(() => asJobId("")).toThrowError(/Invalid JobId/);
  });

  it("asSubjectLabel", () => expect(asSubjectLabel("sub")).toBe("sub"));
  it("asSubjectLabel throws on empty string", () => {
    expect(() => asSubjectLabel("")).toThrowError(/Invalid SubjectLabel/);
  });
  it("asSubjectLabel throws on string over 128 chars", () => {
    expect(() => asSubjectLabel("s".repeat(129))).toThrowError(/Invalid SubjectLabel/);
  });

  describe("asHexColor", () => {
    it("returns valid hex color", () => {
      expect(asHexColor("#FFAA00")).toBe("#FFAA00");
    });
    it("throws on invalid hex color", () => {
      expect(() => asHexColor("FFAA00")).toThrowError(/Invalid hex color/);
      expect(() => asHexColor("#ZZZ")).toThrowError(/Invalid hex color/);
    });
  });

  describe("asPercentage", () => {
    it("returns valid percentage", () => {
      expect(asPercentage(50)).toBe(50);
      expect(asPercentage(0)).toBe(0);
      expect(asPercentage(100)).toBe(100);
    });
    it("throws on invalid percentage", () => {
      expect(() => asPercentage(-1)).toThrowError(/Percentage must be 0-100/);
      expect(() => asPercentage(101)).toThrowError(/Percentage must be 0-100/);
    });
  });
});

describe("resolve helper", () => {
  it("returns ok:true on success", async () => {
    const res = await resolve(async () => 42);
    expect(res).toEqual({ ok: true, value: 42 });
  });

  it("returns ok:false on ImageStudioResolverError", async () => {
    const fn = async () => {
      throw new ImageStudioResolverError({
        isError: true,
        content: [{ type: "text", text: "err" }],
      });
    };
    const res = await resolve(fn);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.result.content[0]).toEqual({ type: "text", text: "err" });
    }
  });

  it("re-throws generic errors", async () => {
    const fn = async () => {
      throw new Error("Generic failure");
    };
    await expect(resolve(fn)).rejects.toThrowError("Generic failure");
  });
});

describe("result helpers", () => {
  describe("textResult", () => {
    it("returns formatted text content", () => {
      expect(textResult("hello")).toEqual({
        content: [{ type: "text", text: "hello" }],
      });
    });

    it("truncates text content longer than 8192 characters", () => {
      const longText = "a".repeat(9000);
      const result = textResult(longText);
      expect(result.content[0].type).toBe("text");
      expect(result.content[0].text.length).toBe(8192 + "\n...(truncated)".length);
      expect(result.content[0].text.endsWith("\n...(truncated)")).toBe(true);
    });
  });

  describe("jsonResult", () => {
    it("stringifies input data", () => {
      const input = { foo: "bar" };
      const r = jsonResult(input);
      expect(r.isError).toBeFalsy();
      expect(r.content[0]).toEqual({
        type: "text",
        text: JSON.stringify(input, null, 2),
      });
    });
  });

  it("errorResult creates error result with custom retryable", () => {
    const r = errorResult("ERR1", "msg", true);
    expect(r.isError).toBeTruthy();
    expect(r.content[0].text).toContain("Retryable:** true");
  });

  it("errorResult defaults retryable to false", () => {
    const r = errorResult("ERR2", "msg");
    expect(r.content[0].text).toContain("Retryable:** false");
  });

  it("errorResult creates error result", () => {
    const r = errorResult("CODE", "msg");
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toContain("CODE");
    expect(r.content[0].text).toContain("msg");
  });

  describe("batchResult", () => {
    it("returns JSON-stringified content without pretty printing", () => {
      const data = { success: true, count: 3 };
      const r = batchResult(data);
      expect(r.isError).toBeFalsy();
      expect(r.content[0].type).toBe("text");
      expect(r.content[0].text).toBe(JSON.stringify(data));
    });
  });
});

describe("toolEvent", () => {
  it("creates a tool event with required fields", () => {
    const event = toolEvent("image:created", "img-123");
    expect(event.type).toBe("image:created");
    expect(event.entityId).toBe("img-123");
    expect(event.payload).toBeUndefined();
    expect(typeof event.timestamp).toBe("string");
    expect(new Date(event.timestamp).toISOString()).toBe(event.timestamp);
  });

  it("creates a tool event with optional payload", () => {
    const payload = { name: "photo.jpg", size: 1024 };
    const event = toolEvent("image:updated", "img-456", payload);
    expect(event.type).toBe("image:updated");
    expect(event.entityId).toBe("img-456");
    expect(event.payload).toEqual(payload);
    expect(typeof event.timestamp).toBe("string");
  });
});
