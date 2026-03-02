"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Flame } from "lucide-react";

interface CleanStreakDisplayProps {
  streak: number;
  bestStreak: number;
}

export function CleanStreakDisplay({ streak, bestStreak }: CleanStreakDisplayProps) {
  return (
    <Card variant="orange">
      <CardContent className="flex items-center justify-between p-6">
        <div className="flex items-center gap-3">
          <Flame className="h-10 w-10 text-orange-300" />
          <div>
            <p className="text-3xl font-bold">{streak}</p>
            <p className="text-sm text-white/70">day streak</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm text-white/70">Best</p>
          <p className="text-lg font-semibold">{bestStreak}</p>
        </div>
      </CardContent>
    </Card>
  );
}
