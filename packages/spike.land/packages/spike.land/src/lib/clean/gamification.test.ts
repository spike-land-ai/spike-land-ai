import { describe, expect, it } from "vitest";
import {
  ACHIEVEMENTS,
  type AchievementStats,
  BONUSES,
  calculateLevel,
  calculateSessionPoints,
  checkNewAchievements,
  isConsecutiveDay,
  isSameDay,
  LEVEL_THRESHOLDS,
  POINTS,
  pointsToNextLevel,
  streakBonus,
} from "./gamification";

describe("Gamification Pure Functions", () => {
  describe("POINTS", () => {
    it("has correct values for each difficulty", () => {
      expect(POINTS.QUICK).toBe(5);
      expect(POINTS.EASY).toBe(10);
      expect(POINTS.MEDIUM).toBe(20);
      expect(POINTS.EFFORT).toBe(35);
    });
  });

  describe("BONUSES", () => {
    it("has correct bonus values", () => {
      expect(BONUSES.VERIFICATION_PHOTO).toBe(5);
      expect(BONUSES.ZERO_SKIP_SESSION).toBe(25);
      expect(BONUSES.ALL_TASKS_DONE).toBe(50);
    });
  });

  describe("streakBonus", () => {
    it("returns currentStreak * 2", () => {
      expect(streakBonus(0)).toBe(0);
      expect(streakBonus(1)).toBe(2);
      expect(streakBonus(5)).toBe(10);
      expect(streakBonus(30)).toBe(60);
    });
  });

  describe("calculateLevel", () => {
    it("returns level 1 for 0 points", () => {
      expect(calculateLevel(0)).toBe(1);
    });

    it("returns level 2 for 100 points", () => {
      expect(calculateLevel(100)).toBe(2);
    });

    it("returns level 3 for 250 points", () => {
      expect(calculateLevel(250)).toBe(3);
    });

    it("returns level 1 for 99 points (below threshold)", () => {
      expect(calculateLevel(99)).toBe(1);
    });

    it("returns correct level for high points", () => {
      expect(calculateLevel(1000000)).toBe(19);
      expect(calculateLevel(1500000)).toBe(20);
    });

    it("handles points beyond max threshold", () => {
      expect(calculateLevel(5000000)).toBe(20);
    });
  });

  describe("pointsToNextLevel", () => {
    it("returns correct progress for level 1", () => {
      const result = pointsToNextLevel(50);
      expect(result.current).toBe(0);
      expect(result.next).toBe(100);
      expect(result.progress).toBe(0.5);
    });

    it("returns 0 progress at start of level", () => {
      const result = pointsToNextLevel(0);
      expect(result.progress).toBe(0);
    });

    it("returns progress clamped to [0, 1]", () => {
      const result = pointsToNextLevel(100);
      expect(result.progress).toBeGreaterThanOrEqual(0);
      expect(result.progress).toBeLessThanOrEqual(1);
    });

    it("handles max level gracefully", () => {
      const result = pointsToNextLevel(1500000);
      expect(result.progress).toBeLessThanOrEqual(1);
      expect(result.progress).toBeGreaterThanOrEqual(0);
    });

    it("clamps progress to 1 when points exceed next threshold", () => {
      const result = pointsToNextLevel(5000000);
      expect(result.progress).toBe(1);
      expect(result.current).toBe(1500000);
      expect(result.next).toBe(3000000);
    });

    it("uses nullish coalescing for currentThreshold at level 1", () => {
      const result = pointsToNextLevel(0);
      expect(result.current).toBe(0);
      expect(result.next).toBe(100);
      expect(result.progress).toBe(0);
    });
  });

  describe("calculateSessionPoints", () => {
    it("calculates base points only when no bonuses", () => {
      const result = calculateSessionPoints({
        taskPoints: 100,
        currentStreak: 0,
        hasVerificationPhoto: false,
        zeroSkips: false,
        allTasksDone: false,
      });
      expect(result.base).toBe(100);
      expect(result.streakBonus).toBe(0);
      expect(result.verificationBonus).toBe(0);
      expect(result.zeroSkipBonus).toBe(0);
      expect(result.allTasksBonus).toBe(0);
      expect(result.total).toBe(100);
    });

    it("calculates all bonuses", () => {
      const result = calculateSessionPoints({
        taskPoints: 50,
        currentStreak: 5,
        hasVerificationPhoto: true,
        zeroSkips: true,
        allTasksDone: true,
      });
      expect(result.base).toBe(50);
      expect(result.streakBonus).toBe(10); // 5 * 2
      expect(result.verificationBonus).toBe(5);
      expect(result.zeroSkipBonus).toBe(25);
      expect(result.allTasksBonus).toBe(50);
      expect(result.total).toBe(50 + 10 + 5 + 25 + 50);
    });

    it("calculates streak bonus correctly", () => {
      const result = calculateSessionPoints({
        taskPoints: 0,
        currentStreak: 10,
        hasVerificationPhoto: false,
        zeroSkips: false,
        allTasksDone: false,
      });
      expect(result.streakBonus).toBe(20);
      expect(result.total).toBe(20);
    });
  });

  describe("isConsecutiveDay", () => {
    it("returns true for adjacent days", () => {
      const today = new Date(2026, 1, 15);
      const yesterday = new Date(2026, 1, 14);
      expect(isConsecutiveDay(today, yesterday)).toBe(true);
    });

    it("returns false for same day", () => {
      const today = new Date(2026, 1, 15);
      const sameDay = new Date(2026, 1, 15);
      expect(isConsecutiveDay(today, sameDay)).toBe(false);
    });

    it("returns false for two days apart", () => {
      const today = new Date(2026, 1, 15);
      const twoDaysAgo = new Date(2026, 1, 13);
      expect(isConsecutiveDay(today, twoDaysAgo)).toBe(false);
    });

    it("returns true across month boundary", () => {
      const feb1 = new Date(2026, 1, 1);
      const jan31 = new Date(2026, 0, 31);
      expect(isConsecutiveDay(feb1, jan31)).toBe(true);
    });

    it("returns false when current is before last", () => {
      const yesterday = new Date(2026, 1, 14);
      const today = new Date(2026, 1, 15);
      expect(isConsecutiveDay(yesterday, today)).toBe(false);
    });
  });

  describe("isSameDay", () => {
    it("returns true for same day", () => {
      const a = new Date(2026, 1, 15, 10, 0);
      const b = new Date(2026, 1, 15, 23, 59);
      expect(isSameDay(a, b)).toBe(true);
    });

    it("returns false for different days", () => {
      const a = new Date(2026, 1, 15);
      const b = new Date(2026, 1, 16);
      expect(isSameDay(a, b)).toBe(false);
    });

    it("returns false for same day different month", () => {
      const a = new Date(2026, 0, 15);
      const b = new Date(2026, 1, 15);
      expect(isSameDay(a, b)).toBe(false);
    });

    it("returns false for same day different year", () => {
      const a = new Date(2025, 1, 15);
      const b = new Date(2026, 1, 15);
      expect(isSameDay(a, b)).toBe(false);
    });
  });

  describe("ACHIEVEMENTS", () => {
    it("has exactly 15 achievements", () => {
      expect(ACHIEVEMENTS).toHaveLength(15);
    });

    it("all have valid type, name, description, and condition", () => {
      for (const a of ACHIEVEMENTS) {
        expect(typeof a.type).toBe("string");
        expect(a.type.length).toBeGreaterThan(0);
        expect(typeof a.name).toBe("string");
        expect(a.name.length).toBeGreaterThan(0);
        expect(typeof a.description).toBe("string");
        expect(a.description.length).toBeGreaterThan(0);
        expect(typeof a.condition).toBe("function");
      }
    });

    it("all conditions are callable and return boolean", () => {
      const stats: AchievementStats = {
        totalSessions: 0,
        currentStreak: 0,
        bestStreak: 0,
        totalTasks: 0,
        level: 1,
        sessionSkips: 0,
        sessionTotalTasks: 0,
        sessionDurationMinutes: 0,
        sessionHour: 12,
        daysSinceLastSession: 0,
      };
      for (const a of ACHIEVEMENTS) {
        const result = a.condition(stats);
        expect(typeof result).toBe("boolean");
      }
    });
  });

  describe("checkNewAchievements", () => {
    it("returns newly unlocked achievements only", () => {
      const stats: AchievementStats = {
        totalSessions: 1,
        currentStreak: 3,
        bestStreak: 3,
        totalTasks: 5,
        level: 1,
        sessionSkips: 0,
        sessionTotalTasks: 5,
        sessionDurationMinutes: 15,
        sessionHour: 12,
        daysSinceLastSession: 0,
      };
      const alreadyUnlocked = new Set<string>(["FIRST_SESSION"]);
      const newAchievements = checkNewAchievements(stats, alreadyUnlocked);

      // Should include THREE_DAY_STREAK, ROOM_CLEAR, SKIP_ZERO but not FIRST_SESSION
      expect(newAchievements.find(a => a.type === "FIRST_SESSION"))
        .toBeUndefined();
      expect(newAchievements.find(a => a.type === "THREE_DAY_STREAK"))
        .toBeDefined();
    });

    it("returns empty array when all are already unlocked", () => {
      const stats: AchievementStats = {
        totalSessions: 1,
        currentStreak: 3,
        bestStreak: 3,
        totalTasks: 5,
        level: 1,
        sessionSkips: 0,
        sessionTotalTasks: 5,
        sessionDurationMinutes: 15,
        sessionHour: 12,
        daysSinceLastSession: 0,
      };
      const allTypes = new Set(ACHIEVEMENTS.map(a => a.type));
      const newAchievements = checkNewAchievements(stats, allTypes);
      expect(newAchievements).toHaveLength(0);
    });

    it("returns empty array when no conditions are met", () => {
      const stats: AchievementStats = {
        totalSessions: 0,
        currentStreak: 0,
        bestStreak: 0,
        totalTasks: 0,
        level: 0,
        sessionSkips: 1,
        sessionTotalTasks: 0,
        sessionDurationMinutes: 0,
        sessionHour: 12,
        daysSinceLastSession: 0,
      };
      const newAchievements = checkNewAchievements(stats, new Set());
      expect(newAchievements).toHaveLength(0);
    });
  });

  describe("LEVEL_THRESHOLDS", () => {
    it("starts at 0", () => {
      expect(LEVEL_THRESHOLDS[0]).toBe(0);
    });

    it("is sorted in ascending order", () => {
      for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
        expect(LEVEL_THRESHOLDS[i]!).toBeGreaterThan(LEVEL_THRESHOLDS[i - 1]!);
      }
    });

    it("has 20 entries", () => {
      expect(LEVEL_THRESHOLDS).toHaveLength(20);
    });
  });
});
