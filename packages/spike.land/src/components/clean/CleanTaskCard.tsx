"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { CleaningTask } from "@/lib/clean/types";
import { cn } from "@/lib/utils";
import { Check, SkipForward } from "lucide-react";

const CATEGORY_COLORS: Record<string, string> = {
  SURFACE: "border-l-blue-400",
  FLOOR: "border-l-green-400",
  ORGANIZE: "border-l-purple-400",
  DISHES: "border-l-yellow-400",
  LAUNDRY: "border-l-pink-400",
  TRASH: "border-l-red-400",
  BATHROOM: "border-l-cyan-400",
  OTHER: "border-l-gray-400",
};

const DIFFICULTY_VARIANT: Record<string, "default" | "secondary" | "warning" | "destructive"> = {
  QUICK: "secondary",
  EASY: "default",
  MEDIUM: "warning",
  EFFORT: "destructive",
};

interface CleanTaskCardProps {
  task: CleaningTask;
  onComplete: () => void;
  onSkip: () => void;
  isActive: boolean;
}

export function CleanTaskCard({ task, onComplete, onSkip, isActive }: CleanTaskCardProps) {
  const isDone = task.status === "COMPLETED";
  const isSkipped = task.status === "SKIPPED";

  return (
    <Card
      variant={isActive ? "highlighted" : "default"}
      className={cn(
        "border-l-4 transition-all",
        CATEGORY_COLORS[task.category] ?? "border-l-gray-400",
        isDone && "opacity-60",
        isSkipped && "opacity-40",
      )}
    >
      <CardContent className="flex items-center gap-4 p-4">
        <div className="flex-1 space-y-1">
          <p className={cn("font-medium", isDone && "line-through text-muted-foreground")}>
            {task.description}
          </p>
          <div className="flex items-center gap-2">
            <Badge variant={DIFFICULTY_VARIANT[task.difficulty] ?? "default"}>
              {task.difficulty}
            </Badge>
            <span className="text-xs text-muted-foreground">{task.pointsValue} pts</span>
          </div>
        </div>
        {isActive && task.status === "PENDING" && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={onSkip}>
              <SkipForward className="h-4 w-4" />
            </Button>
            <Button size="sm" onClick={onComplete}>
              <Check className="h-4 w-4 mr-1" />
              Done
            </Button>
          </div>
        )}
        {isDone && <Check className="h-5 w-5 text-green-400" />}
      </CardContent>
    </Card>
  );
}
