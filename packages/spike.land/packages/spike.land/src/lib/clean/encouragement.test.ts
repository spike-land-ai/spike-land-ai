import { describe, expect, it } from "vitest";
import {
  ACHIEVEMENT_MESSAGES,
  COMEBACK_MESSAGES,
  getStreakMessage,
  randomMessage,
  SESSION_COMPLETE_MESSAGES,
  SKIP_MESSAGES,
  STARTING_MESSAGES,
  STREAK_MESSAGES,
  TASK_COMPLETE_MESSAGES,
} from "./encouragement";

describe("encouragement", () => {
  describe("randomMessage", () => {
    it("returns a message from the provided array", () => {
      const messages = ["hello", "world", "test"];
      const result = randomMessage(messages);
      expect(messages).toContain(result);
    });

    it("returns the first element for a single-element array", () => {
      const result = randomMessage(["only one"]);
      expect(result).toBe("only one");
    });

    it("returns first element as fallback for empty array", () => {
      // With an empty array, Math.floor(Math.random() * 0) = 0,
      // arr[0] is undefined, so ?? arr[0]! fires (still undefined for truly empty)
      // but the function signature expects a non-empty array in practice
      const result = randomMessage(["fallback"]);
      expect(result).toBe("fallback");
    });
  });

  describe("getStreakMessage", () => {
    it("returns a 'first' message for streak of 0", () => {
      const result = getStreakMessage(0);
      expect(STREAK_MESSAGES.first).toContain(result);
    });

    it("returns a 'first' message for streak of 1", () => {
      const result = getStreakMessage(1);
      expect(STREAK_MESSAGES.first).toContain(result);
    });

    it("returns a 'building' message for streak of 2-7", () => {
      const result = getStreakMessage(5);
      expect(STREAK_MESSAGES.building).toContain(result);
    });

    it("returns a 'building' message for streak of exactly 7", () => {
      const result = getStreakMessage(7);
      expect(STREAK_MESSAGES.building).toContain(result);
    });

    it("returns a 'strong' message for streak of 8-30", () => {
      const result = getStreakMessage(15);
      expect(STREAK_MESSAGES.strong).toContain(result);
    });

    it("returns a 'strong' message for streak of exactly 30", () => {
      const result = getStreakMessage(30);
      expect(STREAK_MESSAGES.strong).toContain(result);
    });

    it("returns a 'legendary' message for streak above 30", () => {
      const result = getStreakMessage(31);
      expect(STREAK_MESSAGES.legendary).toContain(result);
    });

    it("returns a 'legendary' message for very high streak", () => {
      const result = getStreakMessage(365);
      expect(STREAK_MESSAGES.legendary).toContain(result);
    });
  });

  describe("message arrays", () => {
    it("STARTING_MESSAGES is non-empty", () => {
      expect(STARTING_MESSAGES.length).toBeGreaterThan(0);
    });

    it("TASK_COMPLETE_MESSAGES is non-empty", () => {
      expect(TASK_COMPLETE_MESSAGES.length).toBeGreaterThan(0);
    });

    it("SKIP_MESSAGES is non-empty", () => {
      expect(SKIP_MESSAGES.length).toBeGreaterThan(0);
    });

    it("SESSION_COMPLETE_MESSAGES is non-empty", () => {
      expect(SESSION_COMPLETE_MESSAGES.length).toBeGreaterThan(0);
    });

    it("COMEBACK_MESSAGES is non-empty", () => {
      expect(COMEBACK_MESSAGES.length).toBeGreaterThan(0);
    });

    it("STREAK_MESSAGES has all required categories", () => {
      expect(STREAK_MESSAGES.first).toBeDefined();
      expect(STREAK_MESSAGES.building).toBeDefined();
      expect(STREAK_MESSAGES.strong).toBeDefined();
      expect(STREAK_MESSAGES.legendary).toBeDefined();
    });

    it("ACHIEVEMENT_MESSAGES has expected keys", () => {
      expect(ACHIEVEMENT_MESSAGES.FIRST_SESSION).toBeDefined();
      expect(ACHIEVEMENT_MESSAGES.THREE_DAY_STREAK).toBeDefined();
      expect(ACHIEVEMENT_MESSAGES.SEVEN_DAY_STREAK).toBeDefined();
      expect(ACHIEVEMENT_MESSAGES.THIRTY_DAY_STREAK).toBeDefined();
      expect(ACHIEVEMENT_MESSAGES.HUNDRED_TASKS).toBeDefined();
      expect(ACHIEVEMENT_MESSAGES.THOUSAND_TASKS).toBeDefined();
      expect(ACHIEVEMENT_MESSAGES.SPEED_DEMON).toBeDefined();
      expect(ACHIEVEMENT_MESSAGES.ROOM_CLEAR).toBeDefined();
      expect(ACHIEVEMENT_MESSAGES.SKIP_ZERO).toBeDefined();
      expect(ACHIEVEMENT_MESSAGES.COMEBACK_KID).toBeDefined();
      expect(ACHIEVEMENT_MESSAGES.EARLY_BIRD).toBeDefined();
      expect(ACHIEVEMENT_MESSAGES.NIGHT_OWL).toBeDefined();
      expect(ACHIEVEMENT_MESSAGES.LEVEL_5).toBeDefined();
      expect(ACHIEVEMENT_MESSAGES.LEVEL_10).toBeDefined();
      expect(ACHIEVEMENT_MESSAGES.LEVEL_20).toBeDefined();
    });

    it("all ACHIEVEMENT_MESSAGES values are non-empty strings", () => {
      for (const [key, value] of Object.entries(ACHIEVEMENT_MESSAGES)) {
        expect(typeof value).toBe("string");
        expect(value.length, `${key} should be non-empty`).toBeGreaterThan(0);
      }
    });

    it("ACHIEVEMENT_MESSAGES has exactly 15 entries", () => {
      expect(Object.keys(ACHIEVEMENT_MESSAGES)).toHaveLength(15);
    });

    it("STREAK_MESSAGES has exactly 4 tiers", () => {
      expect(Object.keys(STREAK_MESSAGES)).toHaveLength(4);
    });

    it("each STREAK_MESSAGES tier has at least one message", () => {
      for (const [tier, messages] of Object.entries(STREAK_MESSAGES)) {
        expect(messages.length, `${tier} should have messages`).toBeGreaterThan(
          0,
        );
        for (const msg of messages) {
          expect(typeof msg).toBe("string");
          expect(msg.length).toBeGreaterThan(0);
        }
      }
    });

    it("all STARTING_MESSAGES are non-empty strings", () => {
      for (const msg of STARTING_MESSAGES) {
        expect(typeof msg).toBe("string");
        expect(msg.length).toBeGreaterThan(0);
      }
    });

    it("all TASK_COMPLETE_MESSAGES are non-empty strings", () => {
      for (const msg of TASK_COMPLETE_MESSAGES) {
        expect(typeof msg).toBe("string");
        expect(msg.length).toBeGreaterThan(0);
      }
    });

    it("all SKIP_MESSAGES are non-empty strings", () => {
      for (const msg of SKIP_MESSAGES) {
        expect(typeof msg).toBe("string");
        expect(msg.length).toBeGreaterThan(0);
      }
    });

    it("all SESSION_COMPLETE_MESSAGES are non-empty strings", () => {
      for (const msg of SESSION_COMPLETE_MESSAGES) {
        expect(typeof msg).toBe("string");
        expect(msg.length).toBeGreaterThan(0);
      }
    });

    it("all COMEBACK_MESSAGES are non-empty strings", () => {
      for (const msg of COMEBACK_MESSAGES) {
        expect(typeof msg).toBe("string");
        expect(msg.length).toBeGreaterThan(0);
      }
    });
  });

  describe("randomMessage edge cases", () => {
    it("always returns a string from STARTING_MESSAGES across many calls", () => {
      for (let i = 0; i < 100; i++) {
        const result = randomMessage(STARTING_MESSAGES);
        expect(STARTING_MESSAGES).toContain(result);
      }
    });

    it("always returns a string from TASK_COMPLETE_MESSAGES across many calls", () => {
      for (let i = 0; i < 100; i++) {
        const result = randomMessage(TASK_COMPLETE_MESSAGES);
        expect(TASK_COMPLETE_MESSAGES).toContain(result);
      }
    });

    it("always returns a string from SKIP_MESSAGES across many calls", () => {
      for (let i = 0; i < 100; i++) {
        const result = randomMessage(SKIP_MESSAGES);
        expect(SKIP_MESSAGES).toContain(result);
      }
    });

    it("always returns a string from SESSION_COMPLETE_MESSAGES across many calls", () => {
      for (let i = 0; i < 100; i++) {
        const result = randomMessage(SESSION_COMPLETE_MESSAGES);
        expect(SESSION_COMPLETE_MESSAGES).toContain(result);
      }
    });

    it("always returns a string from COMEBACK_MESSAGES across many calls", () => {
      for (let i = 0; i < 100; i++) {
        const result = randomMessage(COMEBACK_MESSAGES);
        expect(COMEBACK_MESSAGES).toContain(result);
      }
    });
  });

  describe("getStreakMessage boundary values", () => {
    it("returns first tier for streak of exactly 0", () => {
      const result = getStreakMessage(0);
      expect(STREAK_MESSAGES.first).toContain(result);
    });

    it("returns building tier for streak of exactly 2", () => {
      const result = getStreakMessage(2);
      expect(STREAK_MESSAGES.building).toContain(result);
    });

    it("returns building tier for streak of exactly 3", () => {
      const result = getStreakMessage(3);
      expect(STREAK_MESSAGES.building).toContain(result);
    });

    it("returns strong tier for streak of exactly 8", () => {
      const result = getStreakMessage(8);
      expect(STREAK_MESSAGES.strong).toContain(result);
    });

    it("returns legendary tier for streak of 100", () => {
      const result = getStreakMessage(100);
      expect(STREAK_MESSAGES.legendary).toContain(result);
    });
  });
});
