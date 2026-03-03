"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { CleaningAchievement } from "@/lib/clean/types";
import { Trophy } from "lucide-react";
import { useEffect, useState } from "react";

interface CleanCelebrationProps {
  achievement: CleaningAchievement;
  onDismiss?: () => void;
}

export function CleanCelebration(
  { achievement, onDismiss }: CleanCelebrationProps,
) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger entrance animation
    const timer = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0 }}
      />

      {/* Confetti particles */}
      <div
        className="absolute inset-0 pointer-events-none overflow-hidden"
        aria-hidden="true"
      >
        {Array.from({ length: 20 }).map((_, i) => (
          <span
            key={i}
            className="absolute block w-2 h-2 rounded-full animate-confetti"
            style={{
              left: `${Math.random() * 100}%`,
              backgroundColor: [
                "#f59e0b",
                "#10b981",
                "#3b82f6",
                "#ec4899",
                "#8b5cf6",
              ][i % 5],
              animationDelay: `${Math.random() * 0.5}s`,
              animationDuration: `${1.5 + Math.random()}s`,
            }}
          />
        ))}
      </div>

      {/* Card */}
      <Card
        variant="green"
        className="relative z-10 max-w-sm w-full text-center transition-all duration-500"
        style={{
          transform: visible ? "scale(1)" : "scale(0.8)",
          opacity: visible ? 1 : 0,
        }}
      >
        <CardContent className="flex flex-col items-center gap-4 p-8">
          <Trophy className="h-16 w-16 text-yellow-300 animate-bounce" />
          <div className="space-y-2">
            <p className="text-xl font-bold">Achievement Unlocked!</p>
            <p className="text-lg font-semibold text-yellow-200">
              {achievement.name}
            </p>
            <p className="text-sm text-white/70">{achievement.description}</p>
          </div>
          {onDismiss && (
            <Button
              variant="secondary"
              onClick={onDismiss}
              className="mt-2"
            >
              Awesome!
            </Button>
          )}
        </CardContent>
      </Card>

      {/* CSS for confetti */}
      <style jsx>
        {`
        @keyframes confetti {
          0% {
            transform: translateY(-10vh) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
        .animate-confetti {
          animation: confetti linear forwards;
        }
      `}
      </style>
    </div>
  );
}
