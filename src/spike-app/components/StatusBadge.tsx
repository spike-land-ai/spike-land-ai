import type { ReactNode } from "react";
import { 
  HelpCircle, 
  Pencil, 
  Settings, 
  Circle, 
  Square, 
  X 
} from "lucide-react";

type AppStatus = "prompting" | "drafting" | "building" | "live" | "archived" | "deleted";

const statusConfig: Record<AppStatus, { color: string; icon: ReactNode }> = {
  prompting: { color: "bg-warning text-warning-foreground", icon: <HelpCircle className="size-3" /> },
  drafting: { color: "bg-info text-info-foreground", icon: <Pencil className="size-3" /> },
  building: { color: "bg-warning text-warning-foreground", icon: <Settings className="size-3 animate-spin-slow" /> },
  live: { color: "bg-success text-success-foreground", icon: <Circle className="size-3 fill-current" /> },
  archived: { color: "bg-muted text-muted-foreground", icon: <Square className="size-3" /> },
  deleted: { color: "bg-destructive text-destructive-foreground", icon: <X className="size-3" /> },
};

interface StatusBadgeProps {
  status: AppStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status] ?? statusConfig.drafting;
  return (
    <span
      role="status"
      aria-label={`Status: ${status}`}
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${config.color}`}
    >
      {config.icon}
      <span className="capitalize">{status}</span>
    </span>
  );
}

export type { AppStatus };
