import { describe, expect, it } from "vitest";
import { getManifestEntry, TOOL_MANIFEST } from "./tool-manifest.js";

describe("tool-manifest", () => {
  it("should have a populated manifest", () => {
    expect(TOOL_MANIFEST.length).toBeGreaterThan(0);
  });

  it("should return undefined for unknown tool", () => {
    expect(getManifestEntry("img_unknown")).toBeUndefined();
  });

  it("should return entry for known tool", () => {
    const entry = getManifestEntry("img_generate");
    expect(entry).toBeDefined();
    expect(entry?.toolName).toBe("img_generate");
    expect(entry?.fileName).toBe("generate");
    expect(entry?.interfaceName).toBe("GenerateInput");
    expect(entry?.functionName).toBe("generate");
  });

  it("should properly format multi-word tool names", () => {
    const entry = getManifestEntry("img_album_create");
    expect(entry).toBeDefined();
    expect(entry?.toolName).toBe("img_album_create");
    expect(entry?.fileName).toBe("album-create");
    expect(entry?.interfaceName).toBe("AlbumCreateInput");
    expect(entry?.functionName).toBe("albumCreate");
  });
});
