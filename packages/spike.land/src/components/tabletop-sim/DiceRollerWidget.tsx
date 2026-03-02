"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState } from "react";

const DIE_TYPES = [4, 6, 8, 10, 12, 20] as const;
type DieType = (typeof DIE_TYPES)[number];

interface DiceRollerWidgetProps {
  selectedDie?: number;
  lastResult?: number;
}

export function DiceRollerWidget({
  selectedDie: initialDie,
  lastResult: initialResult,
}: DiceRollerWidgetProps) {
  const [selectedDie, setSelectedDie] = useState<DieType>((initialDie as DieType) ?? 6);
  const [lastResult, setLastResult] = useState<number | undefined>(initialResult);
  const [isRolling, setIsRolling] = useState(false);

  const handleRoll = () => {
    setIsRolling(true);
    const result = Math.floor(Math.random() * selectedDie) + 1;
    setTimeout(() => {
      setLastResult(result);
      setIsRolling(false);
    }, 400);
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-4 w-full max-w-sm">
      <div className="flex items-center gap-2 flex-wrap">
        {DIE_TYPES.map((die) => (
          <button
            key={die}
            type="button"
            onClick={() => setSelectedDie(die)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-mono font-semibold border transition-colors",
              selectedDie === die
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-500 hover:text-zinc-200",
            )}
          >
            d{die}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-1 flex items-center justify-center min-h-[64px] bg-zinc-800 rounded-lg border border-zinc-700">
          {lastResult !== undefined ? (
            <span
              className={cn(
                "text-4xl font-bold font-mono text-foreground transition-opacity duration-300",
                isRolling ? "opacity-20" : "opacity-100",
              )}
            >
              {lastResult}
            </span>
          ) : (
            <span className="text-sm text-zinc-500">Roll to start</span>
          )}
        </div>
        <Button onClick={handleRoll} disabled={isRolling} className="shrink-0" size="lg">
          {isRolling ? "Rolling..." : `Roll d${selectedDie}`}
        </Button>
      </div>

      {lastResult !== undefined && (
        <p className="text-xs text-zinc-500 text-center">
          Rolled a <span className="font-mono font-semibold text-zinc-300">{lastResult}</span> on d
          {selectedDie}
        </p>
      )}
    </div>
  );
}
