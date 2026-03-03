import { describe, expect, it } from "vitest";

import {
  formatFileSize,
  getValidationSummary,
  hasImageExtension,
  isImageFile,
  isSecureFilename,
  validateFile,
  validateFiles,
} from "./validation";

// Helper to create mock File objects
function createFile(
  name: string,
  size: number,
  type: string,
): File {
  const content = new Uint8Array(size);
  return new File([content], name, { type });
}

describe("isImageFile", () => {
  it("accepts jpeg", () => {
    expect(isImageFile(createFile("a.jpg", 100, "image/jpeg"))).toBe(true);
  });

  it("accepts png", () => {
    expect(isImageFile(createFile("a.png", 100, "image/png"))).toBe(true);
  });

  it("accepts gif", () => {
    expect(isImageFile(createFile("a.gif", 100, "image/gif"))).toBe(true);
  });

  it("accepts webp", () => {
    expect(isImageFile(createFile("a.webp", 100, "image/webp"))).toBe(true);
  });

  it("accepts heic", () => {
    expect(isImageFile(createFile("a.heic", 100, "image/heic"))).toBe(true);
  });

  it("accepts heif", () => {
    expect(isImageFile(createFile("a.heif", 100, "image/heif"))).toBe(true);
  });

  it("rejects svg (XSS risk)", () => {
    expect(isImageFile(createFile("a.svg", 100, "image/svg+xml"))).toBe(false);
  });

  it("rejects text/plain", () => {
    expect(isImageFile(createFile("a.txt", 100, "text/plain"))).toBe(false);
  });
});

describe("formatFileSize", () => {
  it("formats bytes", () => {
    expect(formatFileSize(500)).toBe("500 B");
  });

  it("formats kilobytes", () => {
    expect(formatFileSize(1024)).toBe("1.0 KB");
    expect(formatFileSize(1536)).toBe("1.5 KB");
  });

  it("formats megabytes", () => {
    expect(formatFileSize(1024 * 1024)).toBe("1.0 MB");
    expect(formatFileSize(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});

describe("isSecureFilename", () => {
  it("accepts normal filenames", () => {
    expect(isSecureFilename("photo.jpg")).toBe(true);
    expect(isSecureFilename("my-image_v2.png")).toBe(true);
  });

  it("rejects path traversal with ..", () => {
    expect(isSecureFilename("../../etc/passwd")).toBe(false);
  });

  it("rejects forward slashes", () => {
    expect(isSecureFilename("path/to/file")).toBe(false);
  });

  it("rejects backslashes", () => {
    expect(isSecureFilename("path\\to\\file")).toBe(false);
  });

  it("rejects hidden files", () => {
    expect(isSecureFilename(".hidden")).toBe(false);
  });

  it("rejects names > 255 chars", () => {
    expect(isSecureFilename("x".repeat(256))).toBe(false);
  });

  it("accepts names exactly 255 chars", () => {
    expect(isSecureFilename("x".repeat(255))).toBe(true);
  });
});

describe("hasImageExtension", () => {
  it("matches .jpg", () => {
    expect(hasImageExtension("photo.jpg")).toBe(true);
  });

  it("matches .jpeg", () => {
    expect(hasImageExtension("photo.jpeg")).toBe(true);
  });

  it("matches .png", () => {
    expect(hasImageExtension("photo.PNG")).toBe(true);
  });

  it("matches .gif", () => {
    expect(hasImageExtension("photo.gif")).toBe(true);
  });

  it("matches .webp", () => {
    expect(hasImageExtension("photo.webp")).toBe(true);
  });

  it("rejects .svg", () => {
    expect(hasImageExtension("icon.svg")).toBe(false);
  });

  it("rejects .pdf", () => {
    expect(hasImageExtension("doc.pdf")).toBe(false);
  });
});

describe("validateFile", () => {
  it("accepts valid image file", () => {
    const file = createFile("photo.jpg", 100, "image/jpeg");
    const result = validateFile(file);
    expect(result.valid).toBe(true);
  });

  it("rejects invalid file type", () => {
    const file = createFile("doc.pdf", 100, "application/pdf");
    const result = validateFile(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Invalid file type");
  });

  it("rejects file exceeding max size", () => {
    const file = createFile("big.jpg", 100 * 1024 * 1024, "image/jpeg");
    const result = validateFile(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("File too large");
  });

  it("respects custom max file size", () => {
    const file = createFile("photo.jpg", 2000, "image/jpeg");
    const result = validateFile(file, { maxFileSize: 1000 });
    expect(result.valid).toBe(false);
  });

  it("respects custom allowed types", () => {
    const file = createFile("doc.pdf", 100, "application/pdf");
    const result = validateFile(file, {
      allowedTypes: ["application/pdf"],
    });
    expect(result.valid).toBe(true);
  });

  it("supports wildcard types", () => {
    const file = createFile("photo.jpg", 100, "image/jpeg");
    const result = validateFile(file, { allowedTypes: ["image/*"] });
    expect(result.valid).toBe(true);
  });

  it("rejects file with empty name", () => {
    const file = createFile("", 100, "image/jpeg");
    const result = validateFile(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("valid name");
  });

  it("rejects insecure filename with path traversal", () => {
    const file = createFile("../../etc/passwd", 100, "image/jpeg");
    const result = validateFile(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("path traversal");
  });

  it("rejects hidden filename", () => {
    const file = createFile(".hidden", 100, "image/jpeg");
    const result = validateFile(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("hidden files");
  });

  it("rejects filename exceeding max length", () => {
    const file = createFile("x".repeat(256) + ".jpg", 100, "image/jpeg");
    const result = validateFile(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("maximum length");
  });
});

describe("validateFiles", () => {
  it("accepts valid file list", () => {
    const files = [
      createFile("a.jpg", 100, "image/jpeg"),
      createFile("b.png", 200, "image/png"),
    ];
    const result = validateFiles(files);
    expect(result.valid).toBe(true);
    expect(result.validFiles).toHaveLength(2);
  });

  it("rejects empty file list", () => {
    const result = validateFiles([]);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("No files selected");
  });

  it("rejects too many files", () => {
    const files = Array.from({ length: 25 }, (_, i) => createFile(`${i}.jpg`, 100, "image/jpeg"));
    const result = validateFiles(files);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("Too many files");
  });

  it("respects custom max files", () => {
    const files = [
      createFile("a.jpg", 100, "image/jpeg"),
      createFile("b.jpg", 100, "image/jpeg"),
      createFile("c.jpg", 100, "image/jpeg"),
    ];
    const result = validateFiles(files, { maxFiles: 2 });
    expect(result.valid).toBe(false);
  });

  it("separates valid and invalid files", () => {
    const files = [
      createFile("good.jpg", 100, "image/jpeg"),
      createFile("bad.txt", 100, "text/plain"),
    ];
    const result = validateFiles(files);
    expect(result.valid).toBe(false);
    expect(result.validFiles).toHaveLength(1);
    expect(result.invalidFiles).toHaveLength(1);
  });
});

describe("getValidationSummary", () => {
  it("returns success message for valid result", () => {
    const result = {
      valid: true,
      errors: [],
      validFiles: [createFile("a.jpg", 100, "image/jpeg")],
      invalidFiles: [],
    };
    expect(getValidationSummary(result)).toBe("1 file(s) ready to upload.");
  });

  it("returns summary for mixed results", () => {
    const result = {
      valid: false,
      errors: ["bad.txt: Invalid file type"],
      validFiles: [createFile("a.jpg", 100, "image/jpeg")],
      invalidFiles: [
        { file: createFile("bad.txt", 100, "text/plain"), error: "Invalid" },
      ],
    };
    const summary = getValidationSummary(result);
    expect(summary).toContain("1 valid file(s)");
    expect(summary).toContain("1 invalid file(s)");
  });

  it("returns only invalid count when all invalid", () => {
    const result = {
      valid: false,
      errors: ["bad"],
      validFiles: [],
      invalidFiles: [
        { file: createFile("bad.txt", 100, "text/plain"), error: "Invalid" },
      ],
    };
    const summary = getValidationSummary(result);
    expect(summary).toContain("1 invalid file(s)");
    expect(summary).not.toMatch(/\d+ valid file/);
    expect(summary).toMatch(/^\d+ invalid file/);
  });
});
