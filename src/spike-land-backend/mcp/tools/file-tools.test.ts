import { describe, expect, it, vi } from "vitest";
import {
  executeDeleteFile,
  executeListFiles,
  executeReadFile,
  executeWriteFile,
} from "./file-tools";

describe("executeListFiles", () => {
  it("returns entry point from session code when files map is empty", () => {
    const files = new Map<string, string>();
    const result = executeListFiles(files, "const x = 1;", "test-cs");

    expect(result.totalFiles).toBe(1);
    expect(result.files[0]).toEqual({
      path: "/src/App.tsx",
      size: "const x = 1;".length,
    });
    expect(result.codeSpace).toBe("test-cs");
  });

  it("merges files map with entry point", () => {
    const files = new Map<string, string>([
      ["/src/utils.tsx", "export const x = 1;"],
      ["/src/types.ts", "export type Foo = string;"],
    ]);
    const result = executeListFiles(files, "const App = () => <div/>;", "cs1");

    expect(result.totalFiles).toBe(3);
    const paths = result.files.map((f) => f.path);
    expect(paths).toContain("/src/App.tsx");
    expect(paths).toContain("/src/utils.tsx");
    expect(paths).toContain("/src/types.ts");
    // Should be sorted
    expect(paths).toEqual(["/src/App.tsx", "/src/types.ts", "/src/utils.tsx"]);
  });

  it("deduplicates entry point if also in files map", () => {
    const files = new Map<string, string>([["/src/App.tsx", "old code"]]);
    // Session code takes precedence
    const result = executeListFiles(files, "new code", "cs1");

    expect(result.totalFiles).toBe(1);
    expect(result.files[0]!.size).toBe("new code".length);
  });

  it("handles empty session code", () => {
    const files = new Map<string, string>([["/src/utils.tsx", "export const x = 1;"]]);
    const result = executeListFiles(files, "", "cs1");

    expect(result.totalFiles).toBe(1);
    expect(result.files[0]!.path).toBe("/src/utils.tsx");
  });
});

describe("executeReadFile", () => {
  it("reads the entry point from session code", () => {
    const files = new Map<string, string>();
    const result = executeReadFile(files, "line1\nline2\nline3", "cs1", "/src/App.tsx");

    expect(result.path).toBe("/src/App.tsx");
    expect(result.content).toContain("   1 | line1");
    expect(result.content).toContain("   2 | line2");
    expect(result.content).toContain("   3 | line3");
    expect(result.size).toBe("line1\nline2\nline3".length);
  });

  it("reads a file from the files map", () => {
    const files = new Map<string, string>([["/src/utils.tsx", "export const x = 1;"]]);
    const result = executeReadFile(files, "", "cs1", "/src/utils.tsx");

    expect(result.path).toBe("/src/utils.tsx");
    expect(result.content).toContain("   1 | export const x = 1;");
    expect(result.size).toBe("export const x = 1;".length);
  });

  it("throws for non-existent file", () => {
    const files = new Map<string, string>();
    expect(() => executeReadFile(files, "code", "cs1", "/src/missing.tsx")).toThrow(
      "File not found: /src/missing.tsx",
    );
  });
});

describe("executeWriteFile", () => {
  it("writes a new file", async () => {
    const files = new Map<string, string>();
    const setFile = vi.fn().mockResolvedValue(undefined);

    const result = await executeWriteFile(
      files,
      "",
      "cs1",
      "/src/utils.tsx",
      "export const x = 1;",
      setFile,
      0,
    );

    expect(result.success).toBe(true);
    expect(result.path).toBe("/src/utils.tsx");
    expect(result.size).toBe("export const x = 1;".length);
    expect(setFile).toHaveBeenCalledWith("/src/utils.tsx", "export const x = 1;");
  });

  it("writes to entry point with special message", async () => {
    const files = new Map<string, string>();
    const setFile = vi.fn().mockResolvedValue(undefined);

    const result = await executeWriteFile(
      files,
      "old code",
      "cs1",
      "/src/App.tsx",
      "new code",
      setFile,
      0,
    );

    expect(result.success).toBe(true);
    expect(result.message).toContain("Entry point updated");
    expect(setFile).toHaveBeenCalledWith("/src/App.tsx", "new code");
  });

  it("rejects files exceeding size limit", async () => {
    const files = new Map<string, string>();
    const setFile = vi.fn();
    const largeContent = "x".repeat(1024 * 1024 + 1);

    await expect(
      executeWriteFile(files, "", "cs1", "/src/big.tsx", largeContent, setFile, 0),
    ).rejects.toThrow("File too large");

    expect(setFile).not.toHaveBeenCalled();
  });

  it("rejects when file count limit reached", async () => {
    const files = new Map<string, string>();
    const setFile = vi.fn();

    await expect(
      executeWriteFile(files, "", "cs1", "/src/new.tsx", "content", setFile, 100),
    ).rejects.toThrow("File limit reached");

    expect(setFile).not.toHaveBeenCalled();
  });

  it("allows overwriting existing file at limit", async () => {
    const files = new Map<string, string>([["/src/existing.tsx", "old"]]);
    const setFile = vi.fn().mockResolvedValue(undefined);

    const result = await executeWriteFile(
      files,
      "",
      "cs1",
      "/src/existing.tsx",
      "new content",
      setFile,
      100,
    );

    expect(result.success).toBe(true);
    expect(setFile).toHaveBeenCalled();
  });
});

describe("executeDeleteFile", () => {
  it("deletes an existing file", async () => {
    const files = new Map<string, string>([["/src/utils.tsx", "export const x = 1;"]]);
    const deleteFile = vi.fn().mockResolvedValue(undefined);

    const result = await executeDeleteFile(files, "cs1", "/src/utils.tsx", deleteFile);

    expect(result.success).toBe(true);
    expect(result.path).toBe("/src/utils.tsx");
    expect(deleteFile).toHaveBeenCalledWith("/src/utils.tsx");
  });

  it("refuses to delete the entry point", async () => {
    const files = new Map<string, string>([["/src/App.tsx", "code"]]);
    const deleteFile = vi.fn();

    await expect(executeDeleteFile(files, "cs1", "/src/App.tsx", deleteFile)).rejects.toThrow(
      "Cannot delete /src/App.tsx",
    );

    expect(deleteFile).not.toHaveBeenCalled();
  });

  it("throws for non-existent file", async () => {
    const files = new Map<string, string>();
    const deleteFile = vi.fn();

    await expect(executeDeleteFile(files, "cs1", "/src/missing.tsx", deleteFile)).rejects.toThrow(
      "File not found: /src/missing.tsx",
    );

    expect(deleteFile).not.toHaveBeenCalled();
  });
});
