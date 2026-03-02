"use client";
import { useCallback, useState } from "react";

type ConnectionStatus = "connected" | "connecting" | "disconnected";

interface TopAppBarProps {
  roomCode: string;
  connectionStatus: ConnectionStatus;
  playerCount: number;
  onSettingsClick?: () => void;
  onSidebarToggle?: () => void;
  isMobile?: boolean;
}

export function TopAppBar({
  roomCode,
  connectionStatus,
  playerCount,
  onSettingsClick,
  onSidebarToggle,
  isMobile = false,
}: TopAppBarProps) {
  const [copied, setCopied] = useState(false);

  const copyRoomCode = useCallback(() => {
    const url = new URL(window.location.href);
    navigator.clipboard.writeText(url.toString());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const statusColor = {
    connected: "bg-green-500",
    connecting: "bg-yellow-500 animate-pulse",
    disconnected: "bg-red-500",
  }[connectionStatus];

  const statusLabel = {
    connected: "Connected",
    connecting: "Connecting...",
    disconnected: "Disconnected",
  }[connectionStatus];

  return (
    <div className="fixed top-0 left-0 right-0 z-50 pointer-events-none">
      <div className="flex items-center justify-between p-3 pointer-events-auto">
        {/* Left section: Room info */}
        <div className="flex items-center gap-3">
          <button
            onClick={copyRoomCode}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 hover:bg-black/70 transition-colors"
            title="Click to copy invite link"
          >
            <span className="text-lg">🎲</span>
            <span className="text-white/90 font-medium text-sm">Room: {roomCode.slice(0, 8)}</span>
            <span className="text-white/50 text-xs">{copied ? "Copied!" : "📋"}</span>
          </button>
        </div>

        {/* Center section: Status */}
        <div className="flex items-center gap-4">
          {/* Connection status */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-black/60 backdrop-blur-md border border-white/10">
            <span className={`w-2 h-2 rounded-full ${statusColor}`} />
            <span className="text-white/70 text-xs hidden sm:inline">{statusLabel}</span>
          </div>

          {/* Player count */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-black/60 backdrop-blur-md border border-white/10">
            <span className="text-white/90 text-sm">👥 {playerCount}</span>
          </div>
        </div>

        {/* Right section: Actions */}
        <div className="flex items-center gap-2">
          {/* Settings button */}
          {onSettingsClick && (
            <button
              onClick={onSettingsClick}
              className="w-10 h-10 flex items-center justify-center rounded-lg bg-black/60 backdrop-blur-md border border-white/10 hover:bg-black/70 transition-colors"
              title="Settings"
            >
              <span className="text-lg">⚙️</span>
            </button>
          )}

          {/* Sidebar toggle (hamburger on mobile, players icon on desktop) */}
          {onSidebarToggle && (
            <button
              onClick={onSidebarToggle}
              className="w-10 h-10 flex items-center justify-center rounded-lg bg-black/60 backdrop-blur-md border border-white/10 hover:bg-black/70 transition-colors"
              title={isMobile ? "Menu" : "Players & Chat"}
            >
              <span className="text-lg">{isMobile ? "☰" : "💬"}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
