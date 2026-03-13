/**
 * PresenceBar — compact row of avatars showing who is currently connected.
 *
 * - Up to 5 avatars visible; overflow shown as "+N" badge
 * - Status indicator dot per user (online=green, away=yellow, dnd=red, offline=gray)
 * - Hover tooltip with username + status
 * - Click handler prop for opening user profile
 *
 * Usage:
 *   <PresenceBar onUserClick={(userId) => navigate(`/profile/${userId}`)} />
 */
import { memo, useCallback, useId, useState } from "react";
import { cn } from "../../../styling/cn";
import { useCollab } from "./CollabProvider";
import type { CollabUser, UserStatus } from "./CollabProvider";

const MAX_VISIBLE = 5;

const STATUS_DOT: Record<UserStatus, string> = {
  online: "bg-green-400",
  away: "bg-yellow-400",
  dnd: "bg-red-400",
  offline: "bg-zinc-400",
};

const STATUS_LABEL: Record<UserStatus, string> = {
  online: "Online",
  away: "Away",
  dnd: "Do not disturb",
  offline: "Offline",
};

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

interface AvatarProps {
  user: CollabUser;
  onUserClick?: (userId: string) => void;
}

const Avatar = memo(function Avatar({ user, onUserClick }: AvatarProps) {
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const tooltipId = useId();

  const handleClick = useCallback(() => {
    onUserClick?.(user.userId);
  }, [onUserClick, user.userId]);

  return (
    <div className="relative" onMouseEnter={() => setTooltipVisible(true)} onMouseLeave={() => setTooltipVisible(false)}>
      <button
        type="button"
        aria-describedby={tooltipId}
        onClick={handleClick}
        className={cn(
          "relative flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold text-white",
          "ring-2 ring-background transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-ring",
          !onUserClick && "cursor-default",
        )}
        style={{ backgroundColor: user.color }}
        aria-label={`${user.name} — ${STATUS_LABEL[user.status]}`}
      >
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt=""
            aria-hidden="true"
            className="h-full w-full rounded-full object-cover"
          />
        ) : (
          <span aria-hidden="true">{getInitials(user.name)}</span>
        )}

        {/* Status dot */}
        <span
          aria-hidden="true"
          className={cn(
            "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-1 ring-background",
            STATUS_DOT[user.status],
          )}
        />
      </button>

      {/* Tooltip */}
      {tooltipVisible && (
        <div
          id={tooltipId}
          role="tooltip"
          className={cn(
            "absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap",
            "rounded-md border border-border bg-popover px-2.5 py-1.5 text-[11px] font-medium text-popover-foreground shadow-md",
            "pointer-events-none",
          )}
        >
          <p className="font-semibold">{user.name}</p>
          <p className="text-muted-foreground">{STATUS_LABEL[user.status]}</p>
          {/* Tooltip arrow */}
          <span
            aria-hidden="true"
            className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-border"
          />
        </div>
      )}
    </div>
  );
});

interface PresenceBarProps {
  /** Called when a user avatar is clicked */
  onUserClick?: (userId: string) => void;
  className?: string;
}

export function PresenceBar({ onUserClick, className }: PresenceBarProps) {
  const { users, connectionStatus } = useCollab();

  const visible = users.slice(0, MAX_VISIBLE);
  const overflow = users.length - visible.length;

  if (connectionStatus === "disconnected" && users.length === 0) {
    return null;
  }

  return (
    <div
      className={cn("flex items-center gap-1.5", className)}
      aria-label={`${users.length} ${users.length === 1 ? "person" : "people"} viewing`}
      role="group"
    >
      {/* Viewing count label */}
      <span className="mr-1 text-[11px] font-medium text-muted-foreground">
        {users.length === 0
          ? "Just you"
          : `${users.length + 1} viewing`}
      </span>

      {/* Avatar stack */}
      <div className="flex items-center -space-x-2">
        {visible.map((user) => (
          <Avatar key={user.userId} user={user} onUserClick={onUserClick} />
        ))}

        {overflow > 0 && (
          <div
            aria-label={`${overflow} more user${overflow === 1 ? "" : "s"}`}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full",
              "border-2 border-background bg-muted text-[11px] font-bold text-muted-foreground",
              "ring-2 ring-background",
            )}
          >
            +{overflow}
          </div>
        )}
      </div>

      {/* Connection status icon */}
      <span
        aria-label={`Connection: ${connectionStatus}`}
        className={cn(
          "ml-1 h-2 w-2 rounded-full transition-colors",
          connectionStatus === "connected" && "bg-green-400",
          connectionStatus === "connecting" && "bg-yellow-400 animate-pulse",
          connectionStatus === "reconnecting" && "bg-yellow-400 animate-pulse",
          connectionStatus === "disconnected" && "bg-red-400",
        )}
      />
    </div>
  );
}
