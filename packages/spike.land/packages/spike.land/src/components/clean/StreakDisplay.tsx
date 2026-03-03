"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { pointsToNextLevel } from "@/lib/clean/gamification";
import { getStreakMessage } from "@/lib/clean/encouragement";
import type { CleaningStreak } from "@/lib/clean/types";
import { Flame, Star, Trophy, Zap } from "lucide-react";

interface StreakDisplayProps {
  streak: CleaningStreak;
  compact?: boolean;
}

function StreakFlame({ value }: { value: number; }) {
  const size = value === 0
    ? "text-muted-foreground opacity-30"
    : value < 3
    ? "text-orange-400"
    : value < 7
    ? "text-orange-300"
    : value < 30
    ? "text-amber-300"
    : "text-yellow-200";

  return (
    <div className="relative">
      <Flame className={`h-12 w-12 ${size}`} />
      {value >= 7 && (
        <Zap className="h-4 w-4 text-yellow-300 absolute -top-1 -right-1 animate-pulse" />
      )}
    </div>
  );
}

export function StreakDisplay({ streak, compact = false }: StreakDisplayProps) {
  const { progress } = pointsToNextLevel(streak.totalPoints);
  const streakMessage = streak.currentStreak > 0
    ? getStreakMessage(streak.currentStreak)
    : null;

  if (compact) {
    return (
      <Card variant="orange">
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <StreakFlame value={streak.currentStreak} />
            <div>
              <p className="text-2xl font-bold">{streak.currentStreak}</p>
              <p className="text-xs text-white/70">day streak</p>
            </div>
          </div>
          <div className="text-right space-y-1">
            <div className="flex items-center gap-1 justify-end">
              <Trophy className="h-3 w-3 text-yellow-300" />
              <p className="text-xs text-white/70">Best {streak.bestStreak}</p>
            </div>
            <div className="flex items-center gap-1 justify-end">
              <Star className="h-3 w-3 text-emerald-300" />
              <p className="text-xs text-white/70">Lvl {streak.level}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <Card variant="orange">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <StreakFlame value={streak.currentStreak} />
              <div>
                <p className="text-4xl font-black">{streak.currentStreak}</p>
                <p className="text-sm text-white/70">day streak</p>
              </div>
            </div>
            <div className="text-right space-y-2">
              <div>
                <p className="text-xs text-white/60 uppercase tracking-wider">
                  Best
                </p>
                <p className="text-xl font-bold">{streak.bestStreak}</p>
              </div>
              <div>
                <p className="text-xs text-white/60 uppercase tracking-wider">
                  Sessions
                </p>
                <p className="text-sm font-semibold">{streak.totalSessions}</p>
              </div>
            </div>
          </div>

          {streakMessage && (
            <p className="mt-3 text-xs text-white/60 italic border-t border-white/10 pt-3">
              {streakMessage}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-yellow-400" />
              <span className="text-sm font-semibold">
                Level {streak.level}
              </span>
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">
              {streak.totalPoints.toLocaleString()} XP
            </span>
          </div>
          <Progress value={progress * 100} variant="default" glow />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{streak.totalSessions} sessions total</span>
            <span>{Math.round(progress * 100)}% to next level</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
