"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface EngagementDataPoint {
  hour: number;
  engagementScore: number;
  label: string;
}

interface BestTimesChartProps {
  data: EngagementDataPoint[];
}

export function BestTimesChart({ data }: BestTimesChartProps) {
  const maxScore = Math.max(...data.map((d) => d.engagementScore), 1);
  const topScore = Math.max(...data.map((d) => d.engagementScore));

  return (
    <Card className="bg-zinc-900 border-zinc-800 w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base text-zinc-100">Best Engagement Times</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-1.5 h-40 w-full">
          {data.map((point) => {
            const heightPct = (point.engagementScore / maxScore) * 100;
            const isTop = point.engagementScore === topScore;

            return (
              <div
                key={point.hour}
                className="flex-1 flex flex-col items-center gap-1 group"
                title={`${point.label}: ${point.engagementScore}`}
              >
                <div className="w-full flex flex-col items-center justify-end h-32 relative">
                  <div
                    className={cn(
                      "w-full rounded-t-sm transition-all duration-300",
                      isTop ? "bg-primary" : "bg-zinc-600 group-hover:bg-zinc-500",
                    )}
                    style={{ height: `${heightPct}%` }}
                  />
                  {isTop && (
                    <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] font-bold text-primary whitespace-nowrap">
                      Best
                    </div>
                  )}
                </div>
                <span className="text-[9px] text-zinc-500 text-center leading-tight">
                  {point.label}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-primary inline-block" />
            <span className="text-xs text-zinc-400">Peak hours</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-zinc-600 inline-block" />
            <span className="text-xs text-zinc-400">Other hours</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
