import { Link } from "@tanstack/react-router";
import { type AppStatus, StatusBadge } from "./StatusBadge";
import {
  Clock,
  User,
  Package,
  Zap,
  Boxes,
  Gamepad2,
  Info,
  MessageSquare,
  ArrowRight,
} from "lucide-react";
import { cn } from "../../styling/cn";

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
  mcp: {
    color: "border-primary/20 bg-primary/10 text-primary",
    icon: Boxes,
  },
  utility: {
    color: "border-border bg-muted/80 text-muted-foreground",
    icon: Info,
  },
  game: {
    color: "border-success/20 bg-success/70 text-success-foreground",
    icon: Gamepad2,
  },
  tool: {
    color: "border-info/20 bg-info/70 text-info-foreground",
    icon: Zap,
  },
  social: {
    color: "border-border bg-muted/80 text-muted-foreground",
    icon: MessageSquare,
  },
  other: {
    color: "border-border bg-muted/80 text-muted-foreground",
    icon: Package,
  },
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
  const config = CATEGORY_CONFIG[category];
  const Icon = config.icon;

  return (
    <Link
      to="/packages/$appId"
      params={{ appId: id }}
      search={{ tab: "Overview" }}
      aria-label={`View app: ${name}`}
      className="group block h-full rounded-[var(--radius-panel)] border border-border/90 bg-card/90 p-5 shadow-[var(--panel-shadow)] transition-[border-color,box-shadow,transform] duration-200 hover:border-primary/24 hover:shadow-[var(--panel-shadow-strong)]"
    >
      <div className="flex h-full flex-col gap-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-3">
            <div className="flex items-center gap-3">
              <div className="rubik-icon-badge h-11 w-11 rounded-2xl">
                <Icon className="size-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-lg font-semibold tracking-[-0.03em] text-foreground transition-colors group-hover:text-primary">
                    {name}
                  </h3>
                  <span className="rubik-chip rubik-chip-accent px-2.5 py-1 text-[10px]">MCP</span>
                </div>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Package surface
                </p>
              </div>
            </div>

            <div
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors",
                config.color,
              )}
            >
              <Icon className="size-3" />
              {category}
            </div>
          </div>
          <StatusBadge status={status} />
        </div>

        {description && (
          <p className="line-clamp-2 text-sm leading-7 text-muted-foreground">{description}</p>
        )}

        <div className="mt-auto space-y-4">
          <div className="rubik-divider" />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium text-muted-foreground">
              {toolCount !== undefined && toolCount > 0 && (
                <div className="flex items-center gap-1.5" title={`${toolCount} tools available`}>
                  <Package className="size-3" />
                  <span>
                    {toolCount} {toolCount === 1 ? "tool" : "tools"}
                  </span>
                </div>
              )}
              {ownerName && (
                <div className="flex items-center gap-1.5">
                  <User className="size-3" />
                  <span className="truncate max-w-[92px]">{ownerName}</span>
                </div>
              )}
              {createdAt && (
                <div className="flex items-center gap-1.5">
                  <Clock className="size-3" />
                  <span>
                    {new Date(createdAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                  </span>
                </div>
              )}
            </div>

            <div
              aria-hidden="true"
              className="flex h-9 w-9 items-center justify-center rounded-2xl border border-border bg-background text-muted-foreground transition-colors group-hover:border-primary/30 group-hover:text-primary"
            >
              <ArrowRight className="size-4" />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

export type { AppCardProps };
