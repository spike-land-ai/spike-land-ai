import { afterEach, describe, expect, it, vi } from "vitest";
import type { ExtractedLink } from "../../../src/core/browser-automation/core-logic/link-checker/types.js";
import { createUrlValidator } from "../../../src/core/browser-automation/core-logic/link-checker/url-validator.js";

function makeLink(target: string): ExtractedLink {
  return {
    target,
    text: "test",
    line: 1,
    column: 1,
    category: "external_url",
    inCodeBlock: false,
    inComment: false,
  };
}

describe("createUrlValidator", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("returns ok for 200 responses", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      redirected: false,
      url: "https://example.org",
      headers: new Headers(),
    });

    const validator = createUrlValidator({ concurrency: 1, timeout: 5000 });
    const result = await validator.validate(makeLink("https://example.org"));
    expect(result.status).toBe("ok");
    expect(result.httpStatus).toBe(200);
  });

  it("returns broken for 404 responses", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      redirected: false,
      headers: new Headers(),
    });

    const validator = createUrlValidator({ concurrency: 1 });
    const result = await validator.validate(makeLink("https://example.org/missing"));
    expect(result.status).toBe("broken");
    expect(result.httpStatus).toBe(404);
  });

  it("reports redirects as warnings", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      redirected: true,
      url: "https://example.org/new-url",
      headers: new Headers(),
    });

    const validator = createUrlValidator({ concurrency: 1 });
    const result = await validator.validate(makeLink("https://example.org/old-url"));
    expect(result.status).toBe("warning");
    expect(result.suggestion).toBe("https://example.org/new-url");
  });

  it("falls back to GET on 405", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 405,
        redirected: false,
        headers: new Headers(),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        redirected: false,
        url: "https://example.org",
        headers: new Headers(),
      });
    globalThis.fetch = mockFetch;

    const validator = createUrlValidator({ concurrency: 1 });
    const result = await validator.validate(makeLink("https://example.org"));
    expect(result.status).toBe("ok");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("handles network errors", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));

    const validator = createUrlValidator({ concurrency: 1 });
    const result = await validator.validate(makeLink("https://unreachable.test"));
    expect(result.status).toBe("error");
    expect(result.reason).toContain("ECONNREFUSED");
  });

  it("handles timeout", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new DOMException("aborted", "AbortError"));

    const validator = createUrlValidator({ concurrency: 1, timeout: 100 });
    const result = await validator.validate(makeLink("https://slow.test"));
    expect(result.status).toBe("error");
    expect(result.reason).toContain("Timeout");
  });
});
