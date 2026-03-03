import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchVariantAssignment,
  getVariantFromCookie,
  setVariantCookie,
} from "./assignment";

describe("getVariantFromCookie", () => {
  const originalDocument = globalThis.document;

  afterEach(() => {
    if (originalDocument) {
      Object.defineProperty(globalThis, "document", {
        value: originalDocument,
        writable: true,
        configurable: true,
      });
    }
  });

  it("should return variant value from cookie", () => {
    Object.defineProperty(globalThis, "document", {
      value: { cookie: "other=foo; ab_variant=variant-b; session=abc" },
      writable: true,
      configurable: true,
    });
    expect(getVariantFromCookie()).toBe("variant-b");
  });

  it("should return null when cookie is not present", () => {
    Object.defineProperty(globalThis, "document", {
      value: { cookie: "other=foo; session=abc" },
      writable: true,
      configurable: true,
    });
    expect(getVariantFromCookie()).toBeNull();
  });

  it("should return null when document is undefined", () => {
    Object.defineProperty(globalThis, "document", {
      value: undefined,
      writable: true,
      configurable: true,
    });
    expect(getVariantFromCookie()).toBeNull();
  });
});

describe("setVariantCookie", () => {
  const originalDocument = globalThis.document;

  afterEach(() => {
    if (originalDocument) {
      Object.defineProperty(globalThis, "document", {
        value: originalDocument,
        writable: true,
        configurable: true,
      });
    }
  });

  it("should set cookie with correct format", () => {
    const mockDoc = { cookie: "" };
    Object.defineProperty(globalThis, "document", {
      value: mockDoc,
      writable: true,
      configurable: true,
    });
    setVariantCookie("variant-a");
    expect(mockDoc.cookie).toContain("ab_variant=variant-a");
    expect(mockDoc.cookie).toContain("path=/");
    expect(mockDoc.cookie).toContain("samesite=lax");
    expect(mockDoc.cookie).toContain(`max-age=${30 * 24 * 60 * 60}`);
  });

  it("should do nothing when document is undefined", () => {
    Object.defineProperty(globalThis, "document", {
      value: undefined,
      writable: true,
      configurable: true,
    });
    expect(() => setVariantCookie("variant-a")).not.toThrow();
  });
});

describe("fetchVariantAssignment", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should return variant from API on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ variantName: "variant-b" }),
      }),
    );

    const result = await fetchVariantAssignment("test-1", "visitor-1");
    expect(result).toBe("variant-b");
    expect(fetch).toHaveBeenCalledWith(
      "/api/ab-test/assign?testId=test-1&visitorId=visitor-1",
    );

    vi.unstubAllGlobals();
  });

  it("should return 'control' when variantName is empty", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ variantName: "" }),
      }),
    );

    const result = await fetchVariantAssignment("test-1", "visitor-1");
    expect(result).toBe("control");

    vi.unstubAllGlobals();
  });

  it("should return 'control' on HTTP error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      }),
    );

    const result = await fetchVariantAssignment("test-1", "visitor-1");
    expect(result).toBe("control");

    vi.unstubAllGlobals();
  });

  it("should return 'control' on network failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network error")),
    );

    const result = await fetchVariantAssignment("test-1", "visitor-1");
    expect(result).toBe("control");

    vi.unstubAllGlobals();
  });
});
