"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ServiceStatus = "healthy" | "degraded" | "down";

interface ServiceItem {
  name: string;
  status: ServiceStatus;
  latencyMs?: number;
  uptime?: string;
}

interface SystemHealthCardProps {
  services: ServiceItem[];
}

const statusDot: Record<ServiceStatus, string> = {
  healthy: "bg-green-400",
  degraded: "bg-yellow-400",
  down: "bg-red-500",
};

const statusLabel: Record<ServiceStatus, string> = {
  healthy: "Healthy",
  degraded: "Degraded",
  down: "Down",
};

export function SystemHealthCard({ services }: SystemHealthCardProps) {
  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-zinc-100 text-base">System Health</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {services.map((service) => (
          <div
            key={service.name}
            className="flex items-center gap-3 py-2 border-b border-zinc-800 last:border-0"
          >
            <span
              className={cn(
                "h-2.5 w-2.5 rounded-full shrink-0",
                statusDot[service.status],
                service.status === "degraded" && "animate-pulse",
              )}
              aria-label={statusLabel[service.status]}
            />
            <span className="flex-1 text-zinc-200 text-sm font-medium">{service.name}</span>
            {service.latencyMs !== undefined && (
              <span className="text-zinc-500 text-xs font-mono">{service.latencyMs}ms</span>
            )}
            {service.uptime && (
              <span className="text-zinc-500 text-xs font-mono">{service.uptime}</span>
            )}
            <span
              className={cn(
                "text-xs font-semibold",
                service.status === "healthy" && "text-green-400",
                service.status === "degraded" && "text-yellow-400",
                service.status === "down" && "text-red-400",
              )}
            >
              {statusLabel[service.status]}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
