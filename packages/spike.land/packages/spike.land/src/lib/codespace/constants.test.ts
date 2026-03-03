import { describe, expect, it } from "vitest";
import { ESM_CDN, ESM_DEPS_PARAM, REACT_VERSION } from "./constants";

describe("codespace constants", () => {
  it("should export a valid React version string", () => {
    expect(REACT_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("should export esm.sh CDN base URL", () => {
    expect(ESM_CDN).toBe("https://esm.sh");
  });

  it("should include react in deps param", () => {
    expect(ESM_DEPS_PARAM).toContain(`react@${REACT_VERSION}`);
    expect(ESM_DEPS_PARAM).toContain(`react-dom@${REACT_VERSION}`);
    expect(ESM_DEPS_PARAM).toContain(`react-is@${REACT_VERSION}`);
  });

  it("should start with deps= prefix", () => {
    expect(ESM_DEPS_PARAM).toMatch(/^deps=/);
  });
});
