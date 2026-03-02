"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ImpactLevel = "critical" | "serious" | "moderate" | "minor";

interface Violation {
  id: string;
  impact: ImpactLevel;
  description: string;
  nodes: number;
  wcagCriteria: string;
}

interface AccessibilityReportProps {
  violations: Violation[];
}

const impactStyles: Record<ImpactLevel, string> = {
  critical: "bg-red-500/10 text-red-400 border-red-500/20",
  serious: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  moderate: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  minor: "bg-blue-500/10 text-blue-400 border-blue-500/20",
};

export function AccessibilityReport({ violations }: AccessibilityReportProps) {
  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base text-zinc-100">Accessibility Report</CardTitle>
          <Badge variant="outline" className="text-xs text-zinc-400 border-zinc-700">
            {violations.length} violation{violations.length !== 1 ? "s" : ""}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {violations.length === 0 ? (
          <p className="text-sm text-zinc-500 text-center py-4">No violations found</p>
        ) : (
          violations.map((violation) => (
            <div
              key={violation.id}
              className="flex items-start gap-3 p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50"
            >
              <Badge
                variant="outline"
                className={cn("text-xs shrink-0 capitalize mt-0.5", impactStyles[violation.impact])}
              >
                {violation.impact}
              </Badge>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm text-zinc-200 leading-snug">{violation.description}</p>
                <div className="flex items-center gap-3 text-xs text-zinc-500">
                  <span className="font-mono">{violation.wcagCriteria}</span>
                  <span>
                    {violation.nodes} node{violation.nodes !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
