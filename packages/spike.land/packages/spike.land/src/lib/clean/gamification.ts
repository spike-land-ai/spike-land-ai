/**
 * CleanSweep Gamification — Pure Functions
 * No DB dependencies. Used by MCP tools and frontend.
 */

// Points per difficulty
export const POINTS = {
  QUICK: 5,
  EASY: 10,
  MEDIUM: 20,
  EFFORT: 35,
} as const;

// Bonus points
export const BONUSES = {
  VERIFICATION_PHOTO: 5,
  ZERO_SKIP_SESSION: 25,
  ALL_TASKS_DONE: 50,
} as const;

/** Streak bonus = currentStreak * 2 */
export function streakBonus(currentStreak: number): number {
  return currentStreak * 2;
}

/** Fibonacci-ish level thresholds */
export const LEVEL_THRESHOLDS = [
  0,
  100,
  250,
  500,
  1000,
  2000,
  4000,
  8000,
  15000,
  25000,
  40000,
  65000,
  100000,
  150000,
  225000,
  330000,
  500000,
  750000,
  1000000,
  1500000,
] as const;

/** Calculate level from total points */
export function calculateLevel(totalPoints: number): number {
  let level = 1;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (totalPoints >= LEVEL_THRESHOLDS[i]!) {
      level = i + 1;
    } else {
      break;
    }
  }
  return level;
}

/** Points needed for next level */
export function pointsToNextLevel(
  totalPoints: number,
): { current: number; next: number; progress: number; } {
  const level = calculateLevel(totalPoints);
  const currentThreshold = LEVEL_THRESHOLDS[level - 1] ?? 0;
  const nextThreshold = LEVEL_THRESHOLDS[level]
    ?? LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1]! * 2;
  const progress = nextThreshold === currentThreshold
    ? 1
    : (totalPoints - currentThreshold) / (nextThreshold - currentThreshold);
  return {
    current: currentThreshold,
    next: nextThreshold,
    progress: Math.min(1, Math.max(0, progress)),
  };
}

/** Calculate session points */
export function calculateSessionPoints(opts: {
  taskPoints: number;
  currentStreak: number;
  hasVerificationPhoto: boolean;
  zeroSkips: boolean;
  allTasksDone: boolean;
}): {
  base: number;
  streakBonus: number;
  verificationBonus: number;
  zeroSkipBonus: number;
  allTasksBonus: number;
  total: number;
} {
  const sb = streakBonus(opts.currentStreak);
  const vb = opts.hasVerificationPhoto ? BONUSES.VERIFICATION_PHOTO : 0;
  const zb = opts.zeroSkips ? BONUSES.ZERO_SKIP_SESSION : 0;
  const ab = opts.allTasksDone ? BONUSES.ALL_TASKS_DONE : 0;
  return {
    base: opts.taskPoints,
    streakBonus: sb,
    verificationBonus: vb,
    zeroSkipBonus: zb,
    allTasksBonus: ab,
    total: opts.taskPoints + sb + vb + zb + ab,
  };
}

/** Check if date is consecutive day after reference date */
export function isConsecutiveDay(current: Date, last: Date): boolean {
  const currentDay = new Date(
    current.getFullYear(),
    current.getMonth(),
    current.getDate(),
  );
  const lastDay = new Date(last.getFullYear(), last.getMonth(), last.getDate());
  const diffMs = currentDay.getTime() - lastDay.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays === 1;
}

/** Check if same calendar day */
export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

// Achievement type - matches Prisma enum
export type AchievementType =
  | "FIRST_SESSION"
  | "THREE_DAY_STREAK"
  | "SEVEN_DAY_STREAK"
  | "THIRTY_DAY_STREAK"
  | "HUNDRED_TASKS"
  | "THOUSAND_TASKS"
  | "SPEED_DEMON"
  | "ROOM_CLEAR"
  | "SKIP_ZERO"
  | "COMEBACK_KID"
  | "EARLY_BIRD"
  | "NIGHT_OWL"
  | "LEVEL_5"
  | "LEVEL_10"
  | "LEVEL_20";

export interface AchievementCheck {
  type: AchievementType;
  name: string;
  description: string;
  condition: (stats: AchievementStats) => boolean;
}

export interface AchievementStats {
  totalSessions: number;
  currentStreak: number;
  bestStreak: number;
  totalTasks: number;
  level: number;
  sessionSkips: number;
  sessionTotalTasks: number;
  sessionDurationMinutes: number;
  sessionHour: number;
  daysSinceLastSession: number;
}

export const ACHIEVEMENTS: AchievementCheck[] = [
  {
    type: "FIRST_SESSION",
    name: "First Steps",
    description: "Complete your first cleaning session",
    condition: s => s.totalSessions >= 1,
  },
  {
    type: "THREE_DAY_STREAK",
    name: "Getting Started",
    description: "3-day cleaning streak",
    condition: s => s.currentStreak >= 3,
  },
  {
    type: "SEVEN_DAY_STREAK",
    name: "Week Warrior",
    description: "7-day cleaning streak",
    condition: s => s.currentStreak >= 7,
  },
  {
    type: "THIRTY_DAY_STREAK",
    name: "Monthly Master",
    description: "30-day cleaning streak",
    condition: s => s.currentStreak >= 30,
  },
  {
    type: "HUNDRED_TASKS",
    name: "Century Club",
    description: "Complete 100 cleaning tasks",
    condition: s => s.totalTasks >= 100,
  },
  {
    type: "THOUSAND_TASKS",
    name: "Task Titan",
    description: "Complete 1000 cleaning tasks",
    condition: s => s.totalTasks >= 1000,
  },
  {
    type: "SPEED_DEMON",
    name: "Speed Demon",
    description: "Complete a session in under 10 minutes",
    condition: s => s.sessionDurationMinutes < 10 && s.sessionDurationMinutes > 0,
  },
  {
    type: "ROOM_CLEAR",
    name: "Room Clear!",
    description: "Complete all tasks in a session",
    condition: s => s.sessionTotalTasks > 0 && s.sessionSkips === 0,
  },
  {
    type: "SKIP_ZERO",
    name: "No Skip Zone",
    description: "Complete a session without skipping any task",
    condition: s => s.sessionTotalTasks > 0 && s.sessionSkips === 0,
  },
  {
    type: "COMEBACK_KID",
    name: "Comeback Kid",
    description: "Start cleaning again after 7+ days away",
    condition: s => s.daysSinceLastSession >= 7,
  },
  {
    type: "EARLY_BIRD",
    name: "Early Bird",
    description: "Start a session before 8 AM",
    condition: s => s.sessionHour < 8,
  },
  {
    type: "NIGHT_OWL",
    name: "Night Owl",
    description: "Start a session after 10 PM",
    condition: s => s.sessionHour >= 22,
  },
  {
    type: "LEVEL_5",
    name: "Rising Star",
    description: "Reach level 5",
    condition: s => s.level >= 5,
  },
  {
    type: "LEVEL_10",
    name: "Cleaning Pro",
    description: "Reach level 10",
    condition: s => s.level >= 10,
  },
  {
    type: "LEVEL_20",
    name: "Legendary Cleaner",
    description: "Reach level 20",
    condition: s => s.level >= 20,
  },
];

/** Check which achievements are newly unlocked */
export function checkNewAchievements(
  stats: AchievementStats,
  alreadyUnlocked: Set<string>,
): AchievementCheck[] {
  return ACHIEVEMENTS.filter(a => !alreadyUnlocked.has(a.type) && a.condition(stats));
}
