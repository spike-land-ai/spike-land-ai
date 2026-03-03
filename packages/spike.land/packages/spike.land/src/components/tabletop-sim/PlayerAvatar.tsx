"use client";

import { cn } from "@/lib/utils";

interface PlayerAvatarProps {
  username: string;
  initials: string;
  color: string;
  isActive?: boolean;
  role?: string;
}

export function PlayerAvatar({
  username,
  initials,
  color,
  isActive = false,
  role,
}: PlayerAvatarProps) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold text-white select-none"
          style={{ backgroundColor: color }}
          aria-label={`${username} avatar`}
        >
          {initials}
        </div>
        {isActive && (
          <span
            className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-400 border-2 border-zinc-900"
            aria-label="Active"
          />
        )}
      </div>
      <div className="text-center">
        <p
          className={cn(
            "text-xs font-medium leading-tight",
            isActive ? "text-zinc-100" : "text-zinc-400",
          )}
        >
          {username}
        </p>
        {role && <p className="text-[10px] text-zinc-500 leading-tight">{role}</p>}
      </div>
    </div>
  );
}
