"use client";

import { Badge } from "@/components/ui/badge";
import { TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type Plan = "free" | "pro" | "enterprise";

interface AdminUserRowProps {
  userId: string;
  email: string;
  name: string;
  plan: Plan;
  joinedDate: string;
  lastActive: string;
  avatarInitials: string;
}

const planStyles: Record<Plan, string> = {
  free: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  pro: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  enterprise: "bg-purple-500/10 text-purple-400 border-purple-500/20",
};

export function AdminUserRow({
  userId,
  email,
  name,
  plan,
  joinedDate,
  lastActive,
  avatarInitials,
}: AdminUserRowProps) {
  return (
    <TableRow className="border-zinc-800 hover:bg-zinc-800/50">
      <TableCell>
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "h-9 w-9 rounded-full flex items-center justify-center text-sm font-semibold shrink-0",
              "bg-zinc-700 text-zinc-200",
            )}
            aria-label={`Avatar for ${name}`}
          >
            {avatarInitials}
          </div>
          <div className="min-w-0">
            <p className="text-zinc-100 font-medium truncate">{name}</p>
            <p className="text-zinc-500 text-xs truncate">{email}</p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={cn("text-xs capitalize", planStyles[plan])}>
          {plan}
        </Badge>
      </TableCell>
      <TableCell className="text-zinc-400 text-sm font-mono">{joinedDate}</TableCell>
      <TableCell className="text-zinc-400 text-sm font-mono">{lastActive}</TableCell>
      <TableCell className="text-zinc-500 text-xs font-mono">{userId}</TableCell>
    </TableRow>
  );
}
