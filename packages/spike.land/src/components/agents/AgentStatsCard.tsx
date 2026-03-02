"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Activity, Clock, Power, PowerOff } from "lucide-react";

interface AgentStatsCardProps {
  stats: {
    online: number;
    sleeping: number;
    offline: number;
    total: number;
  };
}

export function AgentStatsCard({ stats }: AgentStatsCardProps) {
  const statItems = [
    {
      label: "Online",
      value: stats.online,
      icon: Power,
      color: "text-aurora-green",
      bgColor: "bg-aurora-green/10",
    },
    {
      label: "Sleeping",
      value: stats.sleeping,
      icon: Clock,
      color: "text-aurora-yellow",
      bgColor: "bg-aurora-yellow/10",
    },
    {
      label: "Offline",
      value: stats.offline,
      icon: PowerOff,
      color: "text-muted-foreground",
      bgColor: "bg-muted/50",
    },
    {
      label: "Total",
      value: stats.total,
      icon: Activity,
      color: "text-aurora-teal",
      bgColor: "bg-aurora-teal/10",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {statItems.map((item) => (
        <Card key={item.label} className="overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={cn("rounded-lg p-2", item.bgColor)}>
                <item.icon className={cn("h-5 w-5", item.color)} />
              </div>
              <div>
                <p className="text-2xl font-bold">{item.value}</p>
                <p className="text-xs text-muted-foreground">{item.label}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
