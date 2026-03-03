import { describe, expect, it } from "vitest";
import {
  formatBytes,
  formatPrice,
  getStatusBadgeVariant,
  getStatusColor,
} from "./formatters";

describe("formatBytes", () => {
  it("returns '0 B' for zero bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
  });

  it("formats bytes correctly", () => {
    expect(formatBytes(500)).toBe("500 B");
  });

  it("formats kilobytes correctly", () => {
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
  });

  it("formats megabytes correctly", () => {
    expect(formatBytes(1048576)).toBe("1 MB");
  });

  it("formats gigabytes correctly", () => {
    expect(formatBytes(1073741824)).toBe("1 GB");
  });

  it("formats terabytes correctly", () => {
    expect(formatBytes(1099511627776)).toBe("1 TB");
  });
});

describe("formatPrice", () => {
  it("formats zero", () => {
    expect(formatPrice(0)).toBe("£0.00");
  });

  it("formats a positive price", () => {
    expect(formatPrice(12.5)).toBe("£12.50");
  });

  it("formats a large price with comma separators", () => {
    const result = formatPrice(1234.56);
    expect(result).toContain("1");
    expect(result).toContain("234.56");
  });
});

describe("getStatusColor", () => {
  it("returns yellow classes for PENDING", () => {
    expect(getStatusColor("PENDING")).toContain("yellow");
  });

  it("returns green classes for COMPLETED", () => {
    expect(getStatusColor("COMPLETED")).toContain("green");
  });

  it("returns red classes for FAILED", () => {
    expect(getStatusColor("FAILED")).toContain("red");
  });

  it("returns default gray classes for unknown status", () => {
    expect(getStatusColor("UNKNOWN")).toContain("gray");
  });
});

describe("getStatusBadgeVariant", () => {
  it("returns 'default' for COMPLETED", () => {
    expect(getStatusBadgeVariant("COMPLETED")).toBe("default");
  });

  it("returns 'secondary' for PROCESSING", () => {
    expect(getStatusBadgeVariant("PROCESSING")).toBe("secondary");
  });

  it("returns 'secondary' for PENDING", () => {
    expect(getStatusBadgeVariant("PENDING")).toBe("secondary");
  });

  it("returns 'destructive' for FAILED", () => {
    expect(getStatusBadgeVariant("FAILED")).toBe("destructive");
  });

  it("returns 'secondary' for undefined", () => {
    expect(getStatusBadgeVariant()).toBe("secondary");
  });
});
