"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendingDown, TrendingUp } from "lucide-react";

interface StatItem {
  label: string;
  value: string | number;
  delta?: string;
  deltaType?: "up" | "down" | "neutral";
  icon?: string;
}

interface AdminStatsBarProps {
  stats: StatItem[];
}

export function AdminStatsBar({ stats }: AdminStatsBarProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
      {stats.map((stat, index) => (
        <Card key={index} className="bg-zinc-900 border-zinc-800">
          <CardContent className="pt-5 pb-4 space-y-2">
            <div className="flex items-center gap-2 text-zinc-400 text-sm">
              {stat.icon && (
                <span className="text-base" aria-hidden="true">
                  {stat.icon}
                </span>
              )}
              <span>{stat.label}</span>
            </div>
            <div className="flex items-end justify-between gap-2">
              <span className="text-2xl font-bold font-mono text-zinc-100">
                {stat.value}
              </span>
              {stat.delta && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 text-xs font-semibold font-mono mb-0.5",
                    stat.deltaType === "up" && "text-green-400",
                    stat.deltaType === "down" && "text-red-400",
                    stat.deltaType === "neutral" && "text-zinc-400",
                    !stat.deltaType && "text-zinc-400",
                  )}
                >
                  {stat.deltaType === "up" && <TrendingUp className="h-3.5 w-3.5" />}
                  {stat.deltaType === "down" && <TrendingDown className="h-3.5 w-3.5" />}
                  {stat.delta}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
