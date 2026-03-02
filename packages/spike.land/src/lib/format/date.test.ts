import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatDate, formatDateShort, formatDuration, formatRelativeTime } from "./date";

describe("formatDate", () => {
  it("should format a date string with full date and time", () => {
    const result = formatDate("2024-06-15T14:30:00Z");
    expect(result).toContain("Jun");
    expect(result).toContain("15");
    expect(result).toContain("2024");
  });

  it("should handle ISO date strings", () => {
    const result = formatDate("2025-01-01T00:00:00.000Z");
    expect(result).toContain("Jan");
    expect(result).toContain("1");
    expect(result).toContain("2025");
  });
});

describe("formatDateShort", () => {
  it("should format a date string with date only (no time)", () => {
    const result = formatDateShort("2024-06-15T14:30:00Z");
    expect(result).toContain("Jun");
    expect(result).toContain("15");
    expect(result).toContain("2024");
    // Should NOT contain time components
    expect(result).not.toMatch(/\d{1,2}:\d{2}/);
  });

  it("should handle different months", () => {
    const result = formatDateShort("2024-12-25T00:00:00Z");
    expect(result).toContain("Dec");
    expect(result).toContain("25");
    expect(result).toContain("2024");
  });
});

describe("formatDuration", () => {
  it("should return 'In progress' when no end date", () => {
    expect(formatDuration("2024-06-15T14:30:00Z")).toBe("In progress");
    expect(formatDuration("2024-06-15T14:30:00Z", undefined)).toBe("In progress");
  });

  it("should format seconds-only duration", () => {
    const result = formatDuration("2024-06-15T14:30:00Z", "2024-06-15T14:30:45Z");
    expect(result).toBe("45s");
  });

  it("should format minutes and seconds duration", () => {
    const result = formatDuration("2024-06-15T14:30:00Z", "2024-06-15T14:32:15Z");
    expect(result).toBe("2m 15s");
  });

  it("should handle zero-second duration", () => {
    const result = formatDuration("2024-06-15T14:30:00Z", "2024-06-15T14:30:00Z");
    expect(result).toBe("0s");
  });

  it("should handle exact minute boundary", () => {
    const result = formatDuration("2024-06-15T14:30:00Z", "2024-06-15T14:31:00Z");
    expect(result).toBe("1m 0s");
  });
});

describe("formatRelativeTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return 'Never used' for null", () => {
    expect(formatRelativeTime(null)).toBe("Never used");
  });

  it("should return 'Just now' for less than 1 minute ago", () => {
    const thirtySecsAgo = new Date("2025-06-15T11:59:30Z").toISOString();
    expect(formatRelativeTime(thirtySecsAgo)).toBe("Just now");
  });

  it("should return minutes ago", () => {
    const fiveMinsAgo = new Date("2025-06-15T11:55:00Z").toISOString();
    expect(formatRelativeTime(fiveMinsAgo)).toBe("5 min ago");
  });

  it("should return singular minute", () => {
    const oneMinAgo = new Date("2025-06-15T11:59:00Z").toISOString();
    expect(formatRelativeTime(oneMinAgo)).toBe("1 min ago");
  });

  it("should return hours ago (singular)", () => {
    const oneHourAgo = new Date("2025-06-15T11:00:00Z").toISOString();
    expect(formatRelativeTime(oneHourAgo)).toBe("1 hour ago");
  });

  it("should return hours ago (plural)", () => {
    const threeHoursAgo = new Date("2025-06-15T09:00:00Z").toISOString();
    expect(formatRelativeTime(threeHoursAgo)).toBe("3 hours ago");
  });

  it("should return days ago (singular)", () => {
    const oneDayAgo = new Date("2025-06-14T12:00:00Z").toISOString();
    expect(formatRelativeTime(oneDayAgo)).toBe("1 day ago");
  });

  it("should return days ago (plural)", () => {
    const threeDaysAgo = new Date("2025-06-12T12:00:00Z").toISOString();
    expect(formatRelativeTime(threeDaysAgo)).toBe("3 days ago");
  });

  it("should fall back to formatDateShort for dates older than 7 days", () => {
    const twoWeeksAgo = new Date("2025-06-01T12:00:00Z").toISOString();
    const result = formatRelativeTime(twoWeeksAgo);
    expect(result).toContain("Jun");
    expect(result).toContain("1");
    expect(result).toContain("2025");
  });
});
