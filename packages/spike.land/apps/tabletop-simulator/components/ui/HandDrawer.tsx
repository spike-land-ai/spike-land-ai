"use client";
import type { Card } from "../../types/card";

interface HandDrawerProps {
  hand: Card[];
  onPlayCard?: (cardId: string) => void;
}

const SUIT_SYMBOLS: Record<string, string> = {
  hearts: "\u2665",
  diamonds: "\u2666",
  clubs: "\u2663",
  spades: "\u2660",
};

const SUIT_COLORS: Record<string, string> = {
  hearts: "text-red-500",
  diamonds: "text-red-500",
  clubs: "text-gray-800",
  spades: "text-gray-800",
};

export function HandDrawer({ hand, onPlayCard }: HandDrawerProps) {
  // Always show strip if there are cards, but minimize if closed
  // NOTE: We are moving to a persistent drawer model, so isOpen might be less relevant for hiding,
  // but we can keep it for "minimizing" if the user wants more screen space.
  // For now, let's make it look like a permanent HUD element.

  const hasCards = hand.length > 0;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 h-40 z-30 pointer-events-none flex flex-col justify-end"
      data-testid="hand-drawer"
    >
      {/* Cards container - persistent and glassmorphic */}
      <div className="w-full h-32 relative pointer-events-auto">
        {/* Glass background gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent backdrop-blur-md border-t border-white/5" />

        <div className="absolute top-2 left-4 text-xs font-medium text-white/50 uppercase tracking-widest">
          Your Hand ({hand.length})
        </div>

        <div className="relative h-full flex items-center px-4 overflow-x-auto pb-6 pt-8 scroll-smooth snap-x snap-mandatory w-full">
          {!hasCards ? (
            <div className="text-white/30 text-sm mx-auto flex flex-col items-center gap-2">
              <span className="text-2xl opacity-50">🎴</span>
              <span>Draw cards from the deck to play</span>
            </div>
          ) : (
            <div className="flex items-end gap-2 pr-10">
              {hand.map((card, index) => (
                <button
                  key={card.id}
                  onClick={() => onPlayCard?.(card.id)}
                  className="flex-shrink-0 snap-center group relative transition-all duration-300 hover:-translate-y-6 focus:outline-none"
                  title="Click to play this card"
                  data-testid={`hand-card-${card.id}`}
                  style={{
                    // Fan effect
                    marginLeft: index > 0 ? "-30px" : "0",
                    zIndex: index,
                    transform: `rotate(${(index - (hand.length - 1) / 2) * 3}deg)`,
                    transformOrigin: "bottom center",
                  }}
                >
                  {/* 3D Card with better visuals */}
                  <div className="relative w-24 h-36 bg-white rounded-lg shadow-2xl border border-gray-200 flex flex-col items-center justify-center overflow-hidden transition-transform duration-200 group-hover:scale-110 group-hover:shadow-[0_0_20px_rgba(255,255,255,0.3)]">
                    {/* Card content */}
                    <span className={`text-3xl font-bold ${SUIT_COLORS[card.suit]}`}>
                      {card.rank}
                    </span>
                    <span className={`text-5xl ${SUIT_COLORS[card.suit]}`}>
                      {SUIT_SYMBOLS[card.suit]}
                    </span>

                    {/* Corner indicators */}
                    <span
                      className={`absolute top-1 left-2 text-sm font-bold ${
                        SUIT_COLORS[card.suit]
                      }`}
                    >
                      {card.rank}
                    </span>
                    <span
                      className={`absolute bottom-1 right-2 text-sm font-bold rotate-180 ${
                        SUIT_COLORS[card.suit]
                      }`}
                    >
                      {card.rank}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
