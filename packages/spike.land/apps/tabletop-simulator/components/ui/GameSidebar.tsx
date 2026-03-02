"use client";
import { useCallback, useRef, useState } from "react";
import type { GameMessage } from "../../types/message";

// Player colors for visual identification
const PLAYER_COLORS = [
  "#3B82F6", // blue
  "#10B981", // green
  "#F59E0B", // amber
  "#EF4444", // red
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#06B6D4", // cyan
  "#F97316", // orange
];

interface Player {
  id: string;
  peerId: string;
  name: string;
  cardCount: number;
}

interface GameSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: "players" | "chat" | "library";
  onTabChange: (tab: "players" | "chat" | "library") => void;
  players: Player[];
  messages: GameMessage[];
  localPlayerId: string | null;
  onSendMessage: (content: string) => void;
  onSpawnObject: (type: "deck" | "d6" | "d20" | "token") => void;
  isMobile?: boolean;
}

export function GameSidebar({
  isOpen,
  onClose,
  activeTab,
  onTabChange,
  players,
  messages,
  localPlayerId,
  onSendMessage,
  onSpawnObject,
  isMobile = false,
}: GameSidebarProps) {
  const [messageInput, setMessageInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleSendMessage = useCallback(() => {
    if (messageInput.trim()) {
      onSendMessage(messageInput.trim());
      setMessageInput("");
    }
  }, [messageInput, onSendMessage]);

  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    },
    [handleSendMessage],
  );

  if (!isOpen) return null;

  const content = (
    <div className="flex flex-col h-full">
      {/* Header with tabs */}
      <div className="flex items-center border-b border-white/10 mb-4">
        <button
          onClick={() => onTabChange("players")}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            activeTab === "players"
              ? "text-white border-b-2 border-cyan-500"
              : "text-white/60 hover:text-white/80"
          }`}
        >
          👥 Players
        </button>
        <button
          onClick={() => onTabChange("chat")}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            activeTab === "chat"
              ? "text-white border-b-2 border-cyan-500"
              : "text-white/60 hover:text-white/80"
          }`}
        >
          💬 Chat
        </button>
        <button
          onClick={() => onTabChange("library")}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            activeTab === "library"
              ? "text-white border-b-2 border-cyan-500"
              : "text-white/60 hover:text-white/80"
          }`}
        >
          📦 Library
        </button>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "players" && <PlayersTab players={players} localPlayerId={localPlayerId} />}
        {activeTab === "chat" && (
          <ChatTab
            messages={messages}
            messageInput={messageInput}
            onMessageChange={setMessageInput}
            onSendMessage={handleSendMessage}
            onKeyPress={handleKeyPress}
            messagesEndRef={messagesEndRef}
            localPlayerId={localPlayerId}
          />
        )}
        {activeTab === "library" && <LibraryTab onSpawnObject={onSpawnObject} />}
      </div>
    </div>
  );

  // Mobile: Full screen overlay
  if (isMobile) {
    return (
      <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-lg">
        <div className="flex flex-col h-full p-4">
          {/* Mobile header with close button */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Game Menu</h2>
            <button
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              <span className="text-xl">✕</span>
            </button>
          </div>
          {content}
        </div>
      </div>
    );
  }

  // Desktop: Side panel
  return (
    <div
      className={`fixed top-0 right-0 h-full w-80 z-50 bg-black/80 backdrop-blur-xl border-l border-white/10 transform transition-transform duration-300 ${
        isOpen ? "translate-x-0" : "translate-x-full"
      }`}
    >
      <div className="flex flex-col h-full p-4 pt-16">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
        >
          <span className="text-lg">✕</span>
        </button>
        {content}
      </div>
    </div>
  );
}

// Players Tab
function PlayersTab({
  players,
  localPlayerId,
}: {
  players: Player[];
  localPlayerId: string | null;
}) {
  return (
    <div className="space-y-2">
      {players.length === 0 ? (
        <p className="text-white/50 text-sm text-center py-4">No players connected</p>
      ) : (
        players.map((player, index) => {
          const isLocal = player.id === localPlayerId || player.peerId === localPlayerId;
          const color = PLAYER_COLORS[index % PLAYER_COLORS.length];

          return (
            <div
              key={player.id || player.peerId}
              className={`flex items-center gap-3 p-3 rounded-lg ${
                isLocal ? "bg-cyan-500/20 border border-cyan-500/30" : "bg-white/5"
              }`}
            >
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
              <div className="flex-1">
                <p className="text-white font-medium text-sm">
                  {player.name || `Player ${index + 1}`}
                  {isLocal && <span className="text-cyan-400 ml-2">(You)</span>}
                </p>
                <p className="text-white/50 text-xs">{player.cardCount} cards in hand</p>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

// Chat Tab
function ChatTab({
  messages,
  messageInput,
  onMessageChange,
  onSendMessage,
  onKeyPress,
  messagesEndRef,
  localPlayerId,
}: {
  messages: GameMessage[];
  messageInput: string;
  onMessageChange: (value: string) => void;
  onSendMessage: () => void;
  onKeyPress: (e: React.KeyboardEvent) => void;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  localPlayerId: string | null;
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Messages list */}
      <div className="flex-1 overflow-y-auto space-y-2 mb-4">
        {messages.length === 0 ? (
          <p className="text-white/50 text-sm text-center py-4">No messages yet</p>
        ) : (
          messages.map((msg) => {
            const isLocal = msg.playerId === localPlayerId;
            const isEvent = msg.type === "event";

            return (
              <div
                key={msg.id}
                className={`p-2 rounded-lg ${
                  isEvent
                    ? "bg-yellow-500/10 border border-yellow-500/20"
                    : isLocal
                      ? "bg-cyan-500/20"
                      : "bg-white/5"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: msg.playerColor }}
                  />
                  <span className="text-white/70 text-xs font-medium">{msg.playerName}</span>
                  <span className="text-white/30 text-xs">
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className={`text-sm ${isEvent ? "text-yellow-200" : "text-white/90"}`}>
                  {isEvent ? `🎲 ${msg.content}` : msg.content}
                </p>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={messageInput}
          onChange={(e) => onMessageChange(e.target.value)}
          onKeyPress={onKeyPress}
          placeholder="Type a message..."
          className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
        />
        <button
          onClick={onSendMessage}
          disabled={!messageInput.trim()}
          className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg text-white text-sm font-medium transition-colors"
        >
          Send
        </button>
      </div>
    </div>
  );
}

// Library Tab
function LibraryTab({
  onSpawnObject,
}: {
  onSpawnObject: (type: "deck" | "d6" | "d20" | "token") => void;
}) {
  const items = [
    {
      type: "deck" as const,
      icon: "🃏",
      label: "Card Deck",
      description: "Standard 52-card deck",
    },
    {
      type: "d6" as const,
      icon: "🎲",
      label: "D6",
      description: "Six-sided die",
    },
    {
      type: "d20" as const,
      icon: "🎯",
      label: "D20",
      description: "Twenty-sided die",
    },
    {
      type: "token" as const,
      icon: "🔵",
      label: "Token",
      description: "Game token/marker",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map((item) => (
        <button
          key={item.type}
          onClick={() => onSpawnObject(item.type)}
          className="flex flex-col items-center gap-2 p-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-lg transition-all group"
        >
          <span className="text-3xl group-hover:scale-110 transition-transform">{item.icon}</span>
          <span className="text-white font-medium text-sm">{item.label}</span>
          <span className="text-white/50 text-xs text-center">{item.description}</span>
        </button>
      ))}
    </div>
  );
}
