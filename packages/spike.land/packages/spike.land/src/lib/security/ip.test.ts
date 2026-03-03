import { describe, expect, it } from "vitest";
import { getClientIp } from "./ip";
import { NextRequest } from "next/server";

describe("getClientIp", () => {
  it("should return x-client-ip if present (highest priority)", () => {
    const headers = new Headers();
    headers.set("x-client-ip", "1.2.3.4");
    headers.set("cf-connecting-ip", "5.6.7.8");
    headers.set("x-forwarded-for", "9.10.11.12");
    const req = new NextRequest("http://localhost", { headers });
    expect(getClientIp(req)).toBe("1.2.3.4");
  });

  it("should return cf-connecting-ip if x-client-ip is missing", () => {
    const headers = new Headers();
    headers.set("cf-connecting-ip", "5.6.7.8");
    headers.set("x-forwarded-for", "9.10.11.12");
    const req = new NextRequest("http://localhost", { headers });
    expect(getClientIp(req)).toBe("5.6.7.8");
  });

  it("should return first x-forwarded-for if other trusted headers are missing", () => {
    const headers = new Headers();
    headers.set("x-forwarded-for", "9.10.11.12, 13.14.15.16");
    headers.set("x-real-ip", "17.18.19.20");
    const req = new NextRequest("http://localhost", { headers });
    expect(getClientIp(req)).toBe("9.10.11.12");
  });

  it("should return x-real-ip if forwarded headers are missing", () => {
    const headers = new Headers();
    headers.set("x-real-ip", "17.18.19.20");
    const req = new NextRequest("http://localhost", { headers });
    expect(getClientIp(req)).toBe("17.18.19.20");
  });

  it("should return 'unknown' if no headers are present", () => {
    const req = new NextRequest("http://localhost");
    expect(getClientIp(req)).toBe("unknown");
  });

  it("should work with Headers object directly", () => {
    const headers = new Headers();
    headers.set("x-client-ip", "1.2.3.4");
    expect(getClientIp(headers)).toBe("1.2.3.4");
  });

  it("should trim whitespace from IPs", () => {
    const headers = new Headers();
    headers.set("x-client-ip", "  1.2.3.4  ");
    expect(getClientIp(headers)).toBe("1.2.3.4");
  });
});
