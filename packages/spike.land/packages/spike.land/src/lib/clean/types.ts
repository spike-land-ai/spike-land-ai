/**
 * CleanSweep — Shared Types
 * Used by frontend components, hooks, and API routes.
 */

import type { AchievementType } from "./gamification";

export enum SessionState {
  IDLE = "IDLE",
  SCANNING = "SCANNING",
  ANALYZING = "ANALYZING",
  TASK_ACTIVE = "TASK_ACTIVE",
  VERIFY = "VERIFY",
  COMPLETE = "COMPLETE",
}

export type TaskDifficulty = "QUICK" | "EASY" | "MEDIUM" | "EFFORT";
export type TaskStatus = "PENDING" | "COMPLETED" | "SKIPPED" | "REQUEUED";
export type TaskCategory =
  | "SURFACE"
  | "FLOOR"
  | "ORGANIZE"
  | "DISHES"
  | "LAUNDRY"
  | "TRASH"
  | "BATHROOM"
  | "OTHER";

export interface CleaningTask {
  id: string;
  description: string;
  category: TaskCategory;
  difficulty: TaskDifficulty;
  status: TaskStatus;
  pointsValue: number;
  order: number;
  skipReason?: string;
  completedAt?: string;
}

export interface CleaningSession {
  id: string;
  userId: string;
  status: "ACTIVE" | "COMPLETED" | "ABANDONED";
  roomPhotoUrl?: string;
  tasks: CleaningTask[];
  totalPoints: number;
  startedAt: string;
  completedAt?: string;
}

export interface CleaningStreak {
  currentStreak: number;
  bestStreak: number;
  totalPoints: number;
  level: number;
  totalSessions: number;
  lastSessionDate?: string;
}

export interface CleaningAchievement {
  type: AchievementType;
  name: string;
  description: string;
  unlockedAt?: string;
}

export interface CleaningReminder {
  id: string;
  time: string; // HH:MM format
  days: number[]; // 0=Sunday, 1=Monday, ..., 6=Saturday
  message: string;
  enabled: boolean;
}

export interface RoomAnalysisResult {
  tasks: Array<{
    description: string;
    category: TaskCategory;
    difficulty: TaskDifficulty;
    pointsValue: number;
  }>;
  roomDescription: string;
}

export interface VerificationResult {
  verified: boolean;
  confidence: number;
  feedback: string;
}
