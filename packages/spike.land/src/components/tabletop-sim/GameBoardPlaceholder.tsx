"use client";

import { cn } from "@/lib/utils";

interface Piece {
  row: number;
  col: number;
  symbol: string;
  color: string;
  label: string;
}

interface GameBoardPlaceholderProps {
  gridSize?: number;
  pieces?: Piece[];
}

export function GameBoardPlaceholder({ gridSize = 8, pieces = [] }: GameBoardPlaceholderProps) {
  const pieceMap = new Map<string, Piece>();
  for (const piece of pieces) {
    pieceMap.set(`${piece.row}-${piece.col}`, piece);
  }

  return (
    <div className="inline-block border border-zinc-700 rounded-lg overflow-hidden">
      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
        }}
        role="grid"
        aria-label="Game board"
      >
        {Array.from({ length: gridSize }).map((_, row) =>
          Array.from({ length: gridSize }).map((_, col) => {
            const isLight = (row + col) % 2 === 0;
            const piece = pieceMap.get(`${row}-${col}`);
            return (
              <div
                key={`${row}-${col}`}
                className={cn(
                  "w-9 h-9 flex items-center justify-center relative",
                  isLight ? "bg-zinc-700" : "bg-zinc-900",
                )}
                role="gridcell"
                aria-label={
                  piece ? `${piece.label} at row ${row + 1}, column ${col + 1}` : undefined
                }
              >
                {piece && (
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-md select-none"
                    style={{ backgroundColor: piece.color }}
                    title={piece.label}
                  >
                    {piece.symbol}
                  </div>
                )}
              </div>
            );
          }),
        )}
      </div>
    </div>
  );
}
