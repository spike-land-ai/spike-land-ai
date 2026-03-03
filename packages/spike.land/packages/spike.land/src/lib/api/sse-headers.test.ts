import { describe, expect, it } from "vitest";

import { SSE_HEADERS } from "./sse-headers";

describe("SSE_HEADERS", () => {
  it("has Content-Type text/event-stream", () => {
    expect(SSE_HEADERS["Content-Type"]).toBe("text/event-stream");
  });

  it("has Cache-Control no-cache", () => {
    expect(SSE_HEADERS["Cache-Control"]).toBe("no-cache");
  });

  it("has Connection keep-alive", () => {
    expect(SSE_HEADERS.Connection).toBe("keep-alive");
  });

  it("has exactly 3 headers", () => {
    expect(Object.keys(SSE_HEADERS)).toHaveLength(3);
  });
});
