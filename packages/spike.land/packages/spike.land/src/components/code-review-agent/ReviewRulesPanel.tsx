"use client";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type RuleSeverity = "error" | "warning" | "info";

interface ReviewRule {
  id: string;
  name: string;
  category: string;
  enabled: boolean;
  description: string;
  severity: RuleSeverity;
}

interface ReviewRulesPanelProps {
  rules: ReviewRule[];
}

const severityBadgeClass: Record<RuleSeverity, string> = {
  error: "bg-red-500/10 text-red-400 border-red-500/20",
  warning: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  info: "bg-blue-500/10 text-blue-400 border-blue-500/20",
};

export function ReviewRulesPanel({ rules }: ReviewRulesPanelProps) {
  return (
    <Card className="bg-zinc-900 border-zinc-800 w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base text-zinc-100">Review Rules</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 p-4 pt-0">
        {rules.map(rule => (
          <div
            key={rule.id}
            className={cn(
              "flex items-start gap-3 py-3 px-4 rounded-lg border transition-colors",
              rule.enabled
                ? "bg-zinc-800/50 border-zinc-700"
                : "bg-zinc-900/50 border-zinc-800 opacity-50",
            )}
          >
            {/* Enabled indicator */}
            <div className="mt-0.5 shrink-0">
              <div
                className={cn(
                  "w-2 h-2 rounded-full",
                  rule.enabled ? "bg-green-400" : "bg-zinc-600",
                )}
              />
            </div>

            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-zinc-200">
                  {rule.name}
                </span>
                <Badge
                  variant="outline"
                  className="text-xs text-zinc-500 border-zinc-700 font-mono"
                >
                  {rule.category}
                </Badge>
                <Badge
                  variant="outline"
                  className={cn("text-xs", severityBadgeClass[rule.severity])}
                >
                  {rule.severity}
                </Badge>
              </div>
              <p className="text-xs text-zinc-500 leading-snug">
                {rule.description}
              </p>
            </div>

            {/* Enabled badge */}
            <Badge
              variant="outline"
              className={cn(
                "text-xs shrink-0",
                rule.enabled
                  ? "bg-green-500/10 text-green-400 border-green-500/20"
                  : "bg-zinc-800 text-zinc-600 border-zinc-700",
              )}
            >
              {rule.enabled ? "on" : "off"}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
