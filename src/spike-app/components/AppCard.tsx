import { Link } from "@tanstack/react-router";
import { type AppStatus, StatusBadge } from "./StatusBadge";
import { Clock, User, Package, Zap, Boxes, Gamepad2, Info, MessageSquare } from "lucide-react";
import { cn } from "@/shared/utils/cn";

interface AppCardProps {
  id: string;
  name: string;
  description?: string;
  category?: "mcp" | "utility" | "game" | "tool" | "social" | "other";
  status: AppStatus;
  ownerName?: string;
  createdAt?: string;
  toolCount?: number;
}

const CATEGORY_CONFIG = {
  mcp: { color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200/50", icon: Boxes },
  utility: { color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200/50", icon: Info },
  game: { color: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200/50", icon: Gamepad2 },
  tool: { color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200/50", icon: Zap },
  social: { color: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-200/50", icon: MessageSquare },
  other: { color: "bg-muted text-muted-foreground border-border", icon: Package },
};

export function AppCard({
  id,
  name,
  description,
  category = "other",
  status,
  ownerName,
  createdAt,
  toolCount,
}: AppCardProps) {
  const config = CATEGORY_CONFIG[category] ?? CATEGORY_CONFIG.other;
  const Icon = config.icon;

  return (
    <Link
      to="/apps/$appId"
      params={{ appId: id }}
      search={{ tab: "Overview" }}
      className="group block relative rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-primary/20"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-bold tracking-tight text-foreground truncate group-hover:text-primary transition-colors">
              {name}
            </h3>
            <span className="inline-flex items-center rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-primary border border-primary/10">
              MCP
            </span>
          </div>
          <div className={cn(
            "inline-flex items-center gap-1 w-fit rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border transition-colors",
            config.color
          )}>
            <Icon className="size-3" />
            {category}
          </div>
        </div>
        <StatusBadge status={status} />
      </div>

      {description && (
        <p className="mt-3 line-clamp-2 text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>
      )}

      <div className="mt-5 pt-4 border-t border-border/50 flex items-center justify-between">
        <div className="flex items-center gap-3 text-[11px] font-medium text-muted-foreground/70">
          {toolCount !== undefined && toolCount > 0 && (
            <div className="flex items-center gap-1" title={`${toolCount} tools available`}>
              <Package className="size-3" />
              <span>{toolCount}</span>
            </div>
          )}
          {ownerName && (
            <div className="flex items-center gap-1">
              <User className="size-3" />
              <span className="truncate max-w-[80px]">{ownerName}</span>
            </div>
          )}
          {createdAt && (
            <div className="flex items-center gap-1">
              <Clock className="size-3" />
              <span>{new Date(createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
            </div>
          )}
        </div>
        
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
          <Zap className="size-3" />
        </div>
      </div>
    </Link>
  );
}

export type { AppCardProps };
