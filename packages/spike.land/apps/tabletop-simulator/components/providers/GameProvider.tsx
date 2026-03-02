"use client";
import type { ReactNode } from "react";
import { createContext, useContext } from "react";
import { useGameMedia } from "../../hooks/useGameMedia";
import { useGameRoom } from "../../hooks/useGameRoom";
import type { UIState } from "../../stores/useUIStore";
import { useUIStore } from "../../stores/useUIStore";

interface GameContextValue {
  doc: ReturnType<typeof useGameRoom>["doc"];
  peer: ReturnType<typeof useGameRoom>["peer"];
  peerId: string | null;
  connections: ReturnType<typeof useGameRoom>["connections"];
  connectToPeer: ReturnType<typeof useGameRoom>["connectToPeer"];
  isSynced: boolean;
  ui: UIState;
  media: ReturnType<typeof useGameMedia>;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ roomId, children }: { roomId: string; children: ReactNode }) {
  const room = useGameRoom(roomId);
  const ui = useUIStore();
  const media = useGameMedia(room.peer, room.connections);

  return <GameContext.Provider value={{ ...room, ui, media }}>{children}</GameContext.Provider>;
}

export function useGame() {
  return useContext(GameContext);
}
