import { afterEach, describe, expect, it, vi } from "vitest";
import type { ExtractedLink } from "../../../src/core/browser-automation/core-logic/link-checker/types.js";

// Mock fs/promises
const mockAccess = vi.fn();
const mockReaddir = vi.fn();
const mockReadFile = vi.fn();

vi.mock("node:fs/promises", () => ({
  access: (...args: unknown[]) => mockAccess(...args),
  readdir: (...args: unknown[]) => mockReaddir(...args),
  readFile: (...args: unknown[]) => mockReadFile(...args),
}));

import {
  validateRelativeLink,
  validateAnchor,
  validateFileWithAnchor,
  suggestCorrectPath,
} from "../../../src/core/browser-automation/core-logic/link-checker/file-validator.js";

function makeLink(target: string, line = 1): ExtractedLink {
  return {
    target,
    text: "test",
    line,
    column: 1,
    category: "relative_file",
    inCodeBlock: false,
    inComment: false,
  };
}

describe("validateRelativeLink", () => {
  afterEach(() => vi.clearAllMocks());

  it("returns ok when file exists", async () => {
    mockAccess.mockResolvedValue(undefined);
    mockReaddir.mockResolvedValue(["README.md"]);
    const result = await validateRelativeLink(
      makeLink("./README.md"),
      "/project/docs/guide.md",
      "/project",
    );
    expect(result.status).toBe("ok");
  });

  it("returns broken when file does not exist", async () => {
    mockAccess.mockRejectedValue(new Error("ENOENT"));
    mockReaddir.mockResolvedValue([]);
    const result = await validateRelativeLink(
      makeLink("./missing.md"),
      "/project/docs/guide.md",
      "/project",
    );
    expect(result.status).toBe("broken");
    expect(result.reason).toContain("not found");
  });

  it("detects case mismatch", async () => {
    mockAccess.mockResolvedValue(undefined);
    mockReaddir.mockResolvedValue(["readme.md"]); // lowercase on disk
    const result = await validateRelativeLink(
      makeLink("./README.md"),
      "/project/docs/guide.md",
      "/project",
    );
    expect(result.status).toBe("warning");
    expect(result.reason).toContain("Case mismatch");
  });

  it("rejects paths that escape root directory", async () => {
    const result = await validateRelativeLink(
      makeLink("../../../../etc/passwd"),
      "/project/docs/guide.md",
      "/project",
    );
    expect(result.status).toBe("broken");
    expect(result.reason).toContain("escapes root");
  });
});

describe("validateAnchor", () => {
  afterEach(() => vi.clearAllMocks());

  it("returns ok when anchor exists", async () => {
    const content = "# Getting Started\n\nSome text\n\n## Installation";
    const result = await validateAnchor(
      { ...makeLink("#getting-started"), category: "anchor" },
      content,
    );
    expect(result.status).toBe("ok");
  });

  it("returns broken when anchor not found", async () => {
    const content = "# Getting Started\n\n## Installation";
    const result = await validateAnchor(
      { ...makeLink("#nonexistent"), category: "anchor" },
      content,
    );
    expect(result.status).toBe("broken");
    expect(result.reason).toContain("not found");
  });
});

describe("validateFileWithAnchor", () => {
  afterEach(() => vi.clearAllMocks());

  it("returns ok when file and anchor exist", async () => {
    mockAccess.mockResolvedValue(undefined);
    mockReadFile.mockResolvedValue("# API Reference\n\nContent here");
    const result = await validateFileWithAnchor(
      { ...makeLink("./api.md#api-reference"), category: "file_with_anchor" },
      "/project/docs/guide.md",
      "/project",
    );
    expect(result.status).toBe("ok");
  });

  it("returns broken when file not found", async () => {
    mockAccess.mockRejectedValue(new Error("ENOENT"));
    mockReaddir.mockResolvedValue([]);
    const result = await validateFileWithAnchor(
      { ...makeLink("./missing.md#section"), category: "file_with_anchor" },
      "/project/docs/guide.md",
      "/project",
    );
    expect(result.status).toBe("broken");
  });

  it("returns broken when file exists but anchor not found", async () => {
    mockAccess.mockResolvedValue(undefined);
    mockReadFile.mockResolvedValue("# Other Heading\n\nNo matching anchor");
    const result = await validateFileWithAnchor(
      { ...makeLink("./api.md#nonexistent"), category: "file_with_anchor" },
      "/project/docs/guide.md",
      "/project",
    );
    expect(result.status).toBe("broken");
    expect(result.reason).toContain("anchor");
  });
});

describe("suggestCorrectPath", () => {
  afterEach(() => vi.clearAllMocks());

  it("suggests correct path when file found in sibling directory", async () => {
    mockReaddir.mockImplementation(async (_dir: string, _opts?: unknown) => {
      return ["sub/TARGET.md"];
    });
    const suggestion = await suggestCorrectPath(
      "../TARGET.md",
      "/project/docs",
      "/project",
    );
    // Should find the file somewhere and suggest a path
    expect(suggestion).toBeDefined();
  });

  it("returns undefined when no match found", async () => {
    mockReaddir.mockResolvedValue([]);
    const suggestion = await suggestCorrectPath(
      "nonexistent-file.md",
      "/project/docs",
      "/project",
    );
    expect(suggestion).toBeUndefined();
  });
});
