"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  CreditCard,
  Settings,
  User,
} from "lucide-react";

type ActivityType = "user" | "system" | "payment" | "error";

interface ActivityItem {
  id: string;
  timestamp: string;
  action: string;
  actor: string;
  target?: string;
  type: ActivityType;
}

interface AdminActivityFeedProps {
  activities: ActivityItem[];
}

const typeIcon: Record<ActivityType, React.ReactNode> = {
  user: <User className="h-4 w-4" />,
  system: <Settings className="h-4 w-4" />,
  payment: <CreditCard className="h-4 w-4" />,
  error: <AlertCircle className="h-4 w-4" />,
};

const typeStyles: Record<ActivityType, string> = {
  user: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  system: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  payment: "bg-green-500/10 text-green-400 border-green-500/20",
  error: "bg-red-500/10 text-red-400 border-red-500/20",
};

function getRelativeTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${diffDay}d ago`;
}

export function AdminActivityFeed({ activities }: AdminActivityFeedProps) {
  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-zinc-100 text-base">
          Activity Feed
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {activities.map(activity => (
          <div key={activity.id} className="flex items-start gap-3">
            <div
              className={cn(
                "h-8 w-8 rounded-full border flex items-center justify-center shrink-0",
                typeStyles[activity.type],
              )}
              aria-label={activity.type}
            >
              {typeIcon[activity.type]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-zinc-200 text-sm leading-snug">
                <span className="font-semibold text-zinc-100">
                  {activity.actor}
                </span>{" "}
                {activity.action}
                {activity.target && (
                  <>
                    {" "}
                    <span className="text-zinc-400">{activity.target}</span>
                  </>
                )}
              </p>
            </div>
            <span
              className="text-zinc-500 text-xs font-mono shrink-0 pt-0.5"
              suppressHydrationWarning
            >
              {getRelativeTime(activity.timestamp)}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
