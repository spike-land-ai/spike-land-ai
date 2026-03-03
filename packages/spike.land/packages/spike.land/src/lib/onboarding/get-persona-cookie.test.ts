import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getPersonaCookieClient,
  PERSONA_COOKIE_MAX_AGE,
  PERSONA_COOKIE_NAME,
  setPersonaCookieClient,
} from "./get-persona-cookie";

describe("get-persona-cookie", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("constants", () => {
    it("exports the correct cookie name", () => {
      expect(PERSONA_COOKIE_NAME).toBe("spike-persona");
    });

    it("exports a max age of 1 year in seconds", () => {
      expect(PERSONA_COOKIE_MAX_AGE).toBe(31536000);
    });
  });

  describe("getPersonaCookieClient", () => {
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

    it("returns null when document is undefined (SSR)", () => {
      const doc = globalThis.document;
      // @ts-expect-error - simulating SSR by removing document
      delete globalThis.document;
      expect(getPersonaCookieClient()).toBeNull();
      Object.defineProperty(globalThis, "document", {
        value: doc,
        writable: true,
        configurable: true,
      });
    });

    it("returns the persona slug from document.cookie", () => {
      Object.defineProperty(globalThis, "document", {
        value: { cookie: "other=val; spike-persona=ml-engineer; foo=bar" },
        writable: true,
        configurable: true,
      });
      expect(getPersonaCookieClient()).toBe("ml-engineer");
    });

    it("returns null when cookie is absent", () => {
      Object.defineProperty(globalThis, "document", {
        value: { cookie: "other=val; foo=bar" },
        writable: true,
        configurable: true,
      });
      expect(getPersonaCookieClient()).toBeNull();
    });
  });

  describe("setPersonaCookieClient", () => {
    it("sets the cookie with correct attributes", () => {
      const cookieSetter = vi.fn();
      Object.defineProperty(globalThis, "document", {
        value: {
          get cookie() {
            return "";
          },
          set cookie(v: string) {
            cookieSetter(v);
          },
        },
        writable: true,
        configurable: true,
      });

      setPersonaCookieClient("solo-explorer");

      expect(cookieSetter).toHaveBeenCalledWith(
        "spike-persona=solo-explorer; path=/; max-age=31536000; samesite=lax",
      );
    });

    it("does nothing when document is undefined (SSR)", () => {
      const doc = globalThis.document;
      // @ts-expect-error - simulating SSR
      delete globalThis.document;
      // Should not throw
      setPersonaCookieClient("ai-indie");
      Object.defineProperty(globalThis, "document", {
        value: doc,
        writable: true,
        configurable: true,
      });
    });
  });
});
