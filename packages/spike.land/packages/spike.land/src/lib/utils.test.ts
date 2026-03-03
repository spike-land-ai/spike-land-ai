import { describe, expect, it } from "vitest";
import { cn, formatBytes, formatFileSize, sleep, truncate } from "./utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("handles conditional classes", () => {
    expect(cn("base", false && "hidden", "visible")).toBe("base visible");
  });

  it("deduplicates conflicting tailwind classes", () => {
    // twMerge keeps the last one
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });

  it("handles empty input", () => {
    expect(cn()).toBe("");
  });

  it("handles undefined and null", () => {
    expect(cn(undefined, null, "foo")).toBe("foo");
  });

  it("handles array inputs", () => {
    expect(cn(["a", "b"], "c")).toBe("a b c");
  });
});

describe("formatFileSize", () => {
  it("returns N/A for null", () => {
    expect(formatFileSize(null)).toBe("N/A");
  });

  it("returns N/A for undefined", () => {
    expect(formatFileSize(undefined)).toBe("N/A");
  });

  it("formats bytes under 1KB", () => {
    expect(formatFileSize(500)).toBe("500 B");
    expect(formatFileSize(0)).toBe("0 B");
    expect(formatFileSize(1023)).toBe("1023 B");
  });

  it("formats KB range", () => {
    expect(formatFileSize(1024)).toBe("1.0 KB");
    expect(formatFileSize(2048)).toBe("2.0 KB");
    expect(formatFileSize(1536)).toBe("1.5 KB");
  });

  it("formats MB range", () => {
    expect(formatFileSize(1024 * 1024)).toBe("1.0 MB");
    expect(formatFileSize(2.5 * 1024 * 1024)).toBe("2.5 MB");
  });
});

describe("formatBytes", () => {
  it("returns N/A for null", () => {
    expect(formatBytes(null)).toBe("N/A");
  });

  it("returns N/A for undefined", () => {
    expect(formatBytes(undefined)).toBe("N/A");
  });

  it("returns 0 B for zero", () => {
    expect(formatBytes(0)).toBe("0 B");
  });

  it("formats bytes", () => {
    expect(formatBytes(1)).toBe("1 B");
    expect(formatBytes(500)).toBe("500 B");
  });

  it("formats KB", () => {
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
  });

  it("formats MB", () => {
    expect(formatBytes(1024 * 1024)).toBe("1 MB");
    expect(formatBytes(1.5 * 1024 * 1024)).toBe("1.5 MB");
  });

  it("formats GB", () => {
    expect(formatBytes(1024 * 1024 * 1024)).toBe("1 GB");
  });

  it("formats TB", () => {
    expect(formatBytes(1024 ** 4)).toBe("1 TB");
  });
});

describe("truncate", () => {
  it("returns text unchanged when at or below max", () => {
    expect(truncate("hello", 10)).toBe("hello");
    expect(truncate("hello", 5)).toBe("hello");
  });

  it("truncates and appends ellipsis when over max", () => {
    const result = truncate("hello world", 5);
    expect(result.endsWith("...")).toBe(true);
    expect(result.length).toBeLessThanOrEqual(8); // 5 chars + "..."
  });

  it("trims trailing whitespace before ellipsis", () => {
    const result = truncate("hello world", 6);
    expect(result).not.toMatch(/ \.\.\.$/);
  });

  it("handles empty string", () => {
    expect(truncate("", 5)).toBe("");
  });

  it("handles exactly max length", () => {
    expect(truncate("exact", 5)).toBe("exact");
  });
});

describe("sleep", () => {
  it("resolves after the given duration", async () => {
    const start = Date.now();
    await sleep(20);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(15);
  });

  it("returns a Promise", () => {
    const result = sleep(0);
    expect(result).toBeInstanceOf(Promise);
    return result;
  });
});
