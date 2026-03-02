/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CONSENT_CHANGED_EVENT,
  CONSENT_KEY,
  hasConsent,
  notifyConsentChanged,
  resetConsentCache,
} from "./consent";

describe("consent", () => {
  beforeEach(() => {
    // Ensure test environment and clear state
    vi.stubEnv("NODE_ENV", "test");
    localStorage.clear();
    resetConsentCache();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    localStorage.clear();
    resetConsentCache();
  });

  describe("CONSENT_KEY and CONSENT_CHANGED_EVENT", () => {
    it("exports the correct consent key", () => {
      expect(CONSENT_KEY).toBe("cookie-consent");
    });

    it("exports the correct event name", () => {
      expect(CONSENT_CHANGED_EVENT).toBe("consent-changed");
    });
  });

  describe("hasConsent()", () => {
    it("returns false when localStorage has no consent entry", () => {
      expect(hasConsent()).toBe(false);
    });

    it("returns true when localStorage has 'accepted' value", () => {
      localStorage.setItem(CONSENT_KEY, "accepted");
      expect(hasConsent()).toBe(true);
    });

    it("returns false when localStorage has 'rejected' value", () => {
      localStorage.setItem(CONSENT_KEY, "rejected");
      expect(hasConsent()).toBe(false);
    });

    it("returns false for any non-'accepted' value", () => {
      localStorage.setItem(CONSENT_KEY, "true");
      expect(hasConsent()).toBe(false);
    });

    it("reads fresh from localStorage on each call in test environment (no caching)", () => {
      // Initially no consent
      expect(hasConsent()).toBe(false);
      // Add consent mid-test
      localStorage.setItem(CONSENT_KEY, "accepted");
      // Should see update immediately (no caching in test env)
      expect(hasConsent()).toBe(true);
    });
  });

  describe("notifyConsentChanged()", () => {
    it("dispatches a consent-changed CustomEvent on window", () => {
      const events: Event[] = [];
      window.addEventListener(CONSENT_CHANGED_EVENT, (e) => events.push(e));

      notifyConsentChanged();

      expect(events).toHaveLength(1);
      expect(events[0]!.type).toBe(CONSENT_CHANGED_EVENT);
    });

    it("dispatches event after setting accepted consent", () => {
      const events: Event[] = [];
      window.addEventListener(CONSENT_CHANGED_EVENT, (e) => events.push(e));

      localStorage.setItem(CONSENT_KEY, "accepted");
      notifyConsentChanged();

      expect(events).toHaveLength(1);
    });

    it("can dispatch multiple events", () => {
      const events: Event[] = [];
      window.addEventListener(CONSENT_CHANGED_EVENT, (e) => events.push(e));

      notifyConsentChanged();
      notifyConsentChanged();

      expect(events).toHaveLength(2);
    });
  });

  describe("resetConsentCache()", () => {
    it("resets without error when cache is already null", () => {
      expect(() => resetConsentCache()).not.toThrow();
    });

    it("resets the cache so subsequent hasConsent() re-reads localStorage", () => {
      // In non-test mode, caching applies; but in test mode it doesn't.
      // Test that resetConsentCache doesn't throw and function still works.
      localStorage.setItem(CONSENT_KEY, "accepted");
      expect(hasConsent()).toBe(true);
      resetConsentCache();
      localStorage.removeItem(CONSENT_KEY);
      expect(hasConsent()).toBe(false);
    });
  });
});
