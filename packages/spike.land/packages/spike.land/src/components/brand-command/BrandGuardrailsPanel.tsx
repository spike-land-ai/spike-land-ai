"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AlertTriangle, Check, X } from "lucide-react";

type RuleStatus = "pass" | "fail" | "warning";

interface BrandRule {
  id: string;
  rule: string;
  status: RuleStatus;
  detail?: string;
}

interface BrandGuardrailsPanelProps {
  rules: BrandRule[];
}

const statusConfig: Record<RuleStatus, {
  icon: React.ComponentType<{ className?: string; }>;
  iconClass: string;
  badgeClass: string;
  label: string;
}> = {
  pass: {
    icon: Check,
    iconClass: "text-green-400",
    badgeClass: "bg-green-500/10 text-green-400 border-green-500/20",
    label: "Pass",
  },
  fail: {
    icon: X,
    iconClass: "text-red-400",
    badgeClass: "bg-red-500/10 text-red-400 border-red-500/20",
    label: "Fail",
  },
  warning: {
    icon: AlertTriangle,
    iconClass: "text-yellow-400",
    badgeClass: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    label: "Warning",
  },
};

export function BrandGuardrailsPanel({ rules }: BrandGuardrailsPanelProps) {
  return (
    <Card className="bg-zinc-900 border-zinc-800 w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base text-zinc-100">
          Brand Guardrails
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {rules.map(rule => {
          const config = statusConfig[rule.status];
          const Icon = config.icon;
          return (
            <div
              key={rule.id}
              className="flex items-start gap-3 p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50"
            >
              <Icon
                className={cn("h-4 w-4 shrink-0 mt-0.5", config.iconClass)}
              />
              <div className="flex-1 min-w-0">
                <span className="text-sm text-zinc-200 block">{rule.rule}</span>
                {rule.detail && (
                  <span className="text-xs text-zinc-500 block mt-0.5">
                    {rule.detail}
                  </span>
                )}
              </div>
              <Badge
                variant="outline"
                className={cn("text-xs shrink-0", config.badgeClass)}
              >
                {config.label}
              </Badge>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
