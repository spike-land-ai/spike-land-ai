"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Player {
  name: string;
  avatarInitials: string;
  color: string;
}

interface GameRoomCardProps {
  roomId: string;
  gameName: string;
  players: Player[];
  maxPlayers: number;
  status: "waiting" | "in-progress" | "finished";
  gameType: string;
}

const statusConfig: Record<
  GameRoomCardProps["status"],
  { label: string; className: string; }
> = {
  waiting: {
    label: "Waiting",
    className: "bg-green-500/10 text-green-400 border-green-500/20",
  },
  "in-progress": {
    label: "In Progress",
    className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  },
  finished: {
    label: "Finished",
    className: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  },
};

export function GameRoomCard({
  roomId,
  gameName,
  players,
  maxPlayers,
  status,
  gameType,
}: GameRoomCardProps) {
  const isFull = players.length >= maxPlayers;
  const isJoinDisabled = status === "in-progress" || status === "finished" || isFull;
  const config = statusConfig[status];

  return (
    <Card className="bg-zinc-900 border-zinc-800 hover:border-zinc-700 transition-colors h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <Badge variant="outline" className="text-xs text-zinc-400 border-zinc-700">
            {gameType}
          </Badge>
          <Badge variant="outline" className={cn("text-xs", config.className)}>
            {config.label}
          </Badge>
        </div>
        <CardTitle className="text-lg text-zinc-100">{gameName}</CardTitle>
        <p className="text-xs text-zinc-500 font-mono">Room #{roomId}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          {players.map(player => (
            <div
              key={player.name}
              className="flex items-center gap-1.5"
              title={player.name}
            >
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                style={{ backgroundColor: player.color }}
              >
                {player.avatarInitials}
              </div>
            </div>
          ))}
          {Array.from({ length: maxPlayers - players.length }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="w-7 h-7 rounded-full border border-dashed border-zinc-700 bg-zinc-800/50"
            />
          ))}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-zinc-500">
            {players.length}/{maxPlayers} players
          </span>
          <Button
            size="sm"
            variant={isJoinDisabled ? "outline" : "default"}
            disabled={isJoinDisabled}
            className={cn(
              isJoinDisabled && "opacity-50 cursor-not-allowed",
            )}
          >
            {status === "finished" ? "View" : status === "in-progress" ? "Spectate" : "Join"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
