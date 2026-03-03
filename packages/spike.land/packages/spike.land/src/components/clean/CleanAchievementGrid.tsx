"use client";

import type { CleaningAchievement } from "@/lib/clean/types";
import { CleanAchievementCard } from "./CleanAchievementCard";

interface CleanAchievementGridProps {
  achievements: CleaningAchievement[];
}

export function CleanAchievementGrid(
  { achievements }: CleanAchievementGridProps,
) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {achievements.map(achievement => (
        <CleanAchievementCard
          key={achievement.type}
          achievement={achievement}
        />
      ))}
    </div>
  );
}
