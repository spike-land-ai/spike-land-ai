"use client";
import type { InteractionMode } from "../../stores/useUIStore";

interface ControlsPanelProps {
  mode: InteractionMode;
  onToggleMode: () => void;
  onDiceRoll: (type: string) => void;
  onToggleVideo?: () => void;
  videoEnabled?: boolean;
}

export function ControlsPanel({
  mode,
  onToggleMode,
  onDiceRoll,
  onToggleVideo,
  videoEnabled,
}: ControlsPanelProps) {
  const isInteractionMode = mode === "interaction";

  return (
    <>
      {/* Interaction mode screen border indicator */}
      {isInteractionMode && (
        <div
          className="fixed inset-0 pointer-events-none z-30 border-4 border-cyan-500/30 rounded-lg"
          style={{ animation: "pulse 2s ease-in-out infinite" }}
        />
      )}

      <div
        className="fixed top-20 left-4 flex flex-col gap-3 z-40 pointer-events-auto"
        data-testid="controls-panel"
      >
        {/* Mode Toggle - Primary action, larger and more prominent */}
        <button
          onClick={onToggleMode}
          data-testid="mode-toggle"
          className={`w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all duration-200 active:scale-95 border ${
            isInteractionMode
              ? "bg-cyan-500/80 backdrop-blur-md border-cyan-400/50 text-white shadow-cyan-500/30"
              : "bg-black/60 backdrop-blur-md border-white/10 text-white/80 hover:bg-black/80"
          }`}
          title={
            isInteractionMode
              ? "Switch to Camera Mode (Move View)"
              : "Switch to Interact Mode (Grab Objects)"
          }
        >
          <span className="text-2xl">{isInteractionMode ? "✋" : "📷"}</span>
        </button>

        {/* Dice roll */}
        <button
          onClick={() => onDiceRoll("d6")}
          className="w-12 h-12 bg-black/60 backdrop-blur-md border border-white/10 rounded-full text-white font-bold shadow-lg hover:bg-red-900/50 hover:border-red-500/50 active:scale-95 transition-all duration-200 flex items-center justify-center group"
          title="Roll a D6"
        >
          <span className="text-xl group-hover:scale-110 transition-transform">🎲</span>
        </button>

        {/* Video toggle */}
        {onToggleVideo && (
          <button
            onClick={onToggleVideo}
            className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 active:scale-95 border ${
              videoEnabled
                ? "bg-green-600/80 backdrop-blur-md border-green-500/50 text-white shadow-green-500/30"
                : "bg-black/60 backdrop-blur-md border-white/10 text-white/80 hover:bg-black/80"
            }`}
            title={videoEnabled ? "Turn off camera" : "Turn on camera"}
          >
            <span className="text-xl">{videoEnabled ? "📹" : "🎥"}</span>
          </button>
        )}
      </div>
    </>
  );
}
