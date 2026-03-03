import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: { socialAccountHealth: { findUnique: vi.fn(), findMany: vi.fn() } },
}));
vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn() },
  default: { debug: vi.fn() },
}));
vi.mock("./health-calculator", () => ({
  getOrCreateHealth: vi.fn(),
  updateHealth: vi.fn(),
}));
vi.mock("@/lib/types/common", () => ({
  isFacebookErrorResponse: (body: unknown) => {
    if (!body || typeof body !== "object") return false;
    return "error" in body;
  },
  isLinkedInErrorResponse: (body: unknown) => {
    if (!body || typeof body !== "object") return false;
    return "status" in body || "message" in body;
  },
}));

import {
  parseFacebookRateLimits,
  parseLinkedInRateLimits,
  parseRateLimitHeaders,
  parseTwitterRateLimits,
} from "./rate-limit-tracker";

function createHeaders(map: Record<string, string>): Headers {
  const h = new Headers();
  for (const [k, v] of Object.entries(map)) {
    h.set(k, v);
  }
  return h;
}

describe("parseTwitterRateLimits", () => {
  it("returns null when headers are missing", () => {
    expect(parseTwitterRateLimits(new Headers())).toBeNull();
  });

  it("parses valid Twitter rate limit headers", () => {
    const headers = createHeaders({
      "x-rate-limit-remaining": "50",
      "x-rate-limit-limit": "100",
      "x-rate-limit-reset": String(Math.floor(Date.now() / 1000) + 900),
    });
    const result = parseTwitterRateLimits(headers);
    expect(result).not.toBeNull();
    expect(result!.remaining).toBe(50);
    expect(result!.total).toBe(100);
    expect(result!.isLimited).toBe(false);
  });

  it("detects rate limited state when remaining is 0", () => {
    const headers = createHeaders({
      "x-rate-limit-remaining": "0",
      "x-rate-limit-limit": "100",
      "x-rate-limit-reset": String(Math.floor(Date.now() / 1000) + 900),
    });
    const result = parseTwitterRateLimits(headers);
    expect(result!.isLimited).toBe(true);
    expect(result!.remaining).toBe(0);
  });

  it("returns null when only some headers present", () => {
    const headers = createHeaders({
      "x-rate-limit-remaining": "50",
    });
    expect(parseTwitterRateLimits(headers)).toBeNull();
  });
});

describe("parseFacebookRateLimits", () => {
  it("returns null when no relevant headers or body", () => {
    expect(parseFacebookRateLimits(new Headers())).toBeNull();
  });

  it("parses x-business-use-case-usage header", () => {
    const usage = JSON.stringify({
      "12345": [{ call_count: 30, total_cputime: 10, total_time: 20 }],
    });
    const headers = createHeaders({ "x-business-use-case-usage": usage });
    const result = parseFacebookRateLimits(headers);
    expect(result).not.toBeNull();
    expect(result!.remaining).toBe(70);
    expect(result!.total).toBe(100);
    expect(result!.isLimited).toBe(false);
  });

  it("detects rate limited from business usage at 100%", () => {
    const usage = JSON.stringify({
      "12345": [{ call_count: 100 }],
    });
    const headers = createHeaders({ "x-business-use-case-usage": usage });
    const result = parseFacebookRateLimits(headers);
    expect(result!.isLimited).toBe(true);
    expect(result!.remaining).toBe(0);
  });

  it("parses x-app-usage header", () => {
    const usage = JSON.stringify({ call_count: 45 });
    const headers = createHeaders({ "x-app-usage": usage });
    const result = parseFacebookRateLimits(headers);
    expect(result!.remaining).toBe(55);
    expect(result!.total).toBe(100);
  });

  it("detects rate limit from error body code 4", () => {
    const body = { error: { code: 4, message: "Rate limited" } };
    const result = parseFacebookRateLimits(new Headers(), body);
    expect(result).not.toBeNull();
    expect(result!.isLimited).toBe(true);
    expect(result!.remaining).toBe(0);
  });

  it("returns null for non-rate-limit error body", () => {
    const body = { error: { code: 100, message: "Invalid token" } };
    const result = parseFacebookRateLimits(new Headers(), body);
    expect(result).toBeNull();
  });

  it("handles malformed JSON in business usage header gracefully", () => {
    const headers = createHeaders({ "x-business-use-case-usage": "not json" });
    const result = parseFacebookRateLimits(headers);
    expect(result).toBeNull();
  });
});

describe("parseLinkedInRateLimits", () => {
  it("returns null when no rate limit info available", () => {
    expect(parseLinkedInRateLimits(new Headers())).toBeNull();
  });

  it("detects rate limit from 429 status in body", () => {
    const body = { status: 429, message: "Too many requests" };
    const result = parseLinkedInRateLimits(new Headers(), body);
    expect(result).not.toBeNull();
    expect(result!.isLimited).toBe(true);
    expect(result!.remaining).toBe(0);
  });

  it("detects rate limit from message containing rate limit", () => {
    const body = { status: 400, message: "Rate limit exceeded" };
    const result = parseLinkedInRateLimits(new Headers(), body);
    expect(result!.isLimited).toBe(true);
  });

  it("returns null for non-rate-limit error", () => {
    const body = { status: 401, message: "Unauthorized" };
    const result = parseLinkedInRateLimits(new Headers(), body);
    expect(result).toBeNull();
  });
});

describe("parseRateLimitHeaders", () => {
  it("routes TWITTER to parseTwitterRateLimits", () => {
    const headers = createHeaders({
      "x-rate-limit-remaining": "10",
      "x-rate-limit-limit": "100",
      "x-rate-limit-reset": String(Math.floor(Date.now() / 1000) + 60),
    });
    const result = parseRateLimitHeaders("TWITTER" as const, headers);
    expect(result).not.toBeNull();
    expect(result!.remaining).toBe(10);
  });

  it("routes FACEBOOK to parseFacebookRateLimits", () => {
    const usage = JSON.stringify({ call_count: 20 });
    const headers = createHeaders({ "x-app-usage": usage });
    const result = parseRateLimitHeaders("FACEBOOK" as const, headers);
    expect(result).not.toBeNull();
    expect(result!.remaining).toBe(80);
  });

  it("routes INSTAGRAM to parseFacebookRateLimits", () => {
    const usage = JSON.stringify({ call_count: 50 });
    const headers = createHeaders({ "x-app-usage": usage });
    const result = parseRateLimitHeaders("INSTAGRAM" as const, headers);
    expect(result).not.toBeNull();
  });

  it("routes LINKEDIN to parseLinkedInRateLimits", () => {
    const body = { status: 429, message: "Too many requests" };
    const result = parseRateLimitHeaders("LINKEDIN" as const, new Headers(), body);
    expect(result!.isLimited).toBe(true);
  });

  it("returns null for YOUTUBE (quota-based)", () => {
    const result = parseRateLimitHeaders("YOUTUBE" as const, new Headers());
    expect(result).toBeNull();
  });

  it("returns null for TIKTOK", () => {
    const result = parseRateLimitHeaders("TIKTOK" as const, new Headers());
    expect(result).toBeNull();
  });

  it("parses DISCORD rate limit headers", () => {
    const headers = createHeaders({
      "x-ratelimit-remaining": "5",
      "x-ratelimit-limit": "30",
      "x-ratelimit-reset": String(Date.now() / 1000 + 60),
    });
    const result = parseRateLimitHeaders("DISCORD" as const, headers);
    expect(result).not.toBeNull();
    expect(result!.remaining).toBe(5);
    expect(result!.total).toBe(30);
  });

  it("returns null for unknown platform", () => {
    const result = parseRateLimitHeaders("SNAPCHAT" as const, new Headers());
    expect(result).toBeNull();
  });
});
