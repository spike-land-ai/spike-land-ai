"use client";

import { Card, CardContent } from "@/components/ui/card";
import type { CleaningAchievement } from "@/lib/clean/types";
import { cn } from "@/lib/utils";
import { Lock, Trophy } from "lucide-react";

interface CleanAchievementCardProps {
  achievement: CleaningAchievement;
}

export function CleanAchievementCard(
  { achievement }: CleanAchievementCardProps,
) {
  const unlocked = !!achievement.unlockedAt;

  return (
    <Card
      variant={unlocked ? "green" : "solid"}
      className={cn(!unlocked && "opacity-50")}
    >
      <CardContent className="flex flex-col items-center gap-2 p-4 text-center">
        {unlocked
          ? <Trophy className="h-8 w-8 text-yellow-300" />
          : <Lock className="h-8 w-8 text-muted-foreground" />}
        <p className="font-semibold text-sm">{achievement.name}</p>
        <p className="text-xs text-white/70">{achievement.description}</p>
        {unlocked && achievement.unlockedAt && (
          <p className="text-xs text-white/50">
            {new Date(achievement.unlockedAt).toLocaleDateString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
