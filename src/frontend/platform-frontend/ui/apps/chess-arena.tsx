import { Activity, Clock3, Crown, Sparkles, Swords, Users } from "lucide-react";
import { Fragment, useState } from "react";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
const RANKS = [8, 7, 6, 5, 4, 3, 2, 1] as const;
const BOARD = [
  ["♜", "♞", "♝", "♛", "", "♝", "♞", "♜"],
  ["♟", "♟", "♟", "♟", "", "♟", "♟", "♟"],
  ["", "", "", "", "", "", "", ""],
  ["", "", "", "", "♟", "", "", ""],
  ["", "", "", "", "♙", "", "", ""],
  ["", "", "", "", "", "", "", ""],
  ["♙", "♙", "♙", "♙", "", "♙", "♙", "♙"],
  ["♖", "♘", "♗", "♕", "♔", "♗", "♘", "♖"],
] as const;
const HIGHLIGHTED_SQUARES = new Set(["e4", "e5"]);
const LIVE_MATCHES = [
  { players: "zerdos vs atlas-31", mode: "Blitz", status: "move 23", accent: "text-primary" },
  { players: "rookie.dev vs ops-bot", mode: "Rapid", status: "analysis", accent: "text-foreground" },
  { players: "queen-side vs pair-coder", mode: "Arena", status: "finals", accent: "text-success-foreground" },
] as const;

type QueueMode = "Arena" | "Blitz" | "Rapid";
type SeatSide = "Black" | "White";

function squareId(rank: number, fileIndex: number) {
  return `${FILES[fileIndex]}${rank}`;
}

export function ChessArenaApp() {
  const [queueMode, setQueueMode] = useState<QueueMode>("Blitz");
  const [seatSide, setSeatSide] = useState<SeatSide>("White");

  return (
    <div className="rubik-panel-strong overflow-hidden p-4 sm:p-5">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.92fr)]">
        <section className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <span className="rubik-eyebrow">
                <Sparkles className="h-3.5 w-3.5" />
                Featured Arena
              </span>
              <div>
                <h2 className="text-2xl font-semibold tracking-[-0.05em] text-foreground sm:text-3xl">
                  Queue into live multiplayer without leaving spike.land.
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">
                  Matchmaking, analysis, and spectator traffic live in the same surface. The board
                  is the focal panel, but the queue, ladder, and live arena pulse stay visible.
                </p>
              </div>
            </div>

            <div className="grid min-w-[220px] gap-2 sm:grid-cols-3">
              <div className="rubik-panel border-primary/20 bg-primary/10 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                  Queue
                </div>
                <div className="mt-1 text-lg font-semibold text-foreground">124 players</div>
              </div>
              <div className="rubik-panel p-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Avg wait
                </div>
                <div className="mt-1 text-lg font-semibold text-foreground">18s</div>
              </div>
              <div className="rubik-panel p-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Peak ELO
                </div>
                <div className="mt-1 text-lg font-semibold text-foreground">2411</div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="rubik-panel overflow-hidden p-3 sm:p-4">
              <div className="flex items-center justify-between gap-3 border-b border-border/70 pb-3">
                <div>
                  <div className="text-sm font-semibold text-foreground">Board Preview</div>
                  <div className="text-xs text-muted-foreground">
                    Semi-Slav arena board, live analysis enabled
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  <Activity className="h-3.5 w-3.5" />
                  live
                </div>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-[auto_1fr] sm:items-start">
                <div className="mx-auto grid w-full max-w-[520px] grid-cols-[auto_repeat(8,minmax(0,1fr))] gap-1 text-center text-xs font-medium text-muted-foreground">
                  <div />
                  {FILES.map((file) => (
                    <div key={file} className="pb-1 uppercase tracking-[0.16em]">
                      {file}
                    </div>
                  ))}
                  {BOARD.map((row, rowIndex) => (
                    <Fragment key={`row-${RANKS[rowIndex]}`}>
                      <div className="flex items-center justify-center pr-2 text-[11px] font-semibold">
                        {RANKS[rowIndex]}
                      </div>
                      {row.map((piece, fileIndex) => {
                        const rank = RANKS[rowIndex];
                        const id = squareId(rank, fileIndex);
                        const isDark = (rowIndex + fileIndex) % 2 === 1;
                        const isHighlighted = HIGHLIGHTED_SQUARES.has(id);

                        return (
                          <div
                            key={id}
                            className={`aspect-square rounded-[18px] border p-2 transition-colors ${
                              isDark
                                ? "border-border/20 bg-foreground/10"
                                : "border-border/40 bg-background"
                            } ${isHighlighted ? "ring-2 ring-primary/45" : ""}`}
                          >
                            <div className="flex h-full items-center justify-center rounded-[14px] bg-background/45 text-[clamp(1rem,2vw,2rem)]">
                              {piece || ""}
                            </div>
                          </div>
                        );
                      })}
                    </Fragment>
                  ))}
                </div>

                <div className="grid gap-3">
                  <div className="rubik-panel p-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <Clock3 className="h-4 w-4 text-primary" />
                      Match Queue
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
                      {(["Blitz", "Rapid", "Arena"] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setQueueMode(mode)}
                          className={`rounded-2xl border px-3 py-2 text-left text-sm font-medium transition-colors ${
                            queueMode === mode
                              ? "border-primary/35 bg-primary/10 text-foreground"
                              : "border-border bg-background text-muted-foreground hover:border-primary/20 hover:text-foreground"
                          }`}
                        >
                          <div>{mode}</div>
                          <div className="text-xs text-muted-foreground">
                            {mode === "Blitz"
                              ? "3+2 live pool"
                              : mode === "Rapid"
                                ? "10+0 ladder"
                                : "continuous knockout"}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rubik-panel p-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <Swords className="h-4 w-4 text-primary" />
                      Seat Selection
                    </div>
                    <div className="mt-3 flex gap-2">
                      {(["White", "Black"] as const).map((side) => (
                        <button
                          key={side}
                          type="button"
                          onClick={() => setSeatSide(side)}
                          className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                            seatSide === side
                              ? "border-primary/35 bg-primary/10 text-foreground"
                              : "border-border bg-background text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {side}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="rubik-panel p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Crown className="h-4 w-4 text-primary" />
                  Arena Pulse
                </div>
                <div className="mt-3 space-y-3">
                  {LIVE_MATCHES.map((match) => (
                    <div
                      key={match.players}
                      className="rounded-2xl border border-border bg-background px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-2 text-sm font-medium text-foreground">
                        <span>{match.players}</span>
                        <span className={`text-xs font-semibold uppercase tracking-[0.16em] ${match.accent}`}>
                          {match.status}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">{match.mode}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rubik-panel p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Users className="h-4 w-4 text-primary" />
                  Queue Summary
                </div>
                <div className="mt-3 space-y-3 text-sm text-muted-foreground">
                  <div className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2">
                    <span>Selected queue</span>
                    <span className="font-semibold text-foreground">{queueMode}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2">
                    <span>Preferred side</span>
                    <span className="font-semibold text-foreground">{seatSide}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2">
                    <span>Commentary room</span>
                    <span className="font-semibold text-foreground">2,418 watching</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
