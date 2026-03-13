/**
 * Matchmaking
 *
 * - Quick Play button (random opponent)
 * - Challenge Friend (enter username)
 * - Time control selector
 * - Waiting spinner with cancel
 */
import { useState, useCallback } from "react";
import type { TimeControl } from "./chess-types";
import { TIME_CONTROL_LABELS, TIME_CONTROL_MS } from "./chess-types";

// ─── Time Control Options ────────────────────────────────────────────────────

const TIME_CONTROL_OPTIONS: TimeControl[] = [
  "BULLET_1",
  "BULLET_2",
  "BLITZ_3",
  "BLITZ_5",
  "RAPID_10",
  "RAPID_15",
  "UNLIMITED",
];

interface TimeControlCategory {
  label: string;
  options: TimeControl[];
}

const TIME_CONTROL_CATEGORIES: TimeControlCategory[] = [
  { label: "Bullet", options: ["BULLET_1", "BULLET_2"] },
  { label: "Blitz", options: ["BLITZ_3", "BLITZ_5"] },
  { label: "Rapid", options: ["RAPID_10", "RAPID_15"] },
  { label: "Other", options: ["UNLIMITED"] },
];

function TimeControlPicker({
  selected,
  onChange,
}: {
  selected: TimeControl;
  onChange: (tc: TimeControl) => void;
}) {
  return (
    <div className="space-y-2" role="radiogroup" aria-label="Time control">
      {TIME_CONTROL_CATEGORIES.map((cat) => (
        <div key={cat.label}>
          <p className="mb-1 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
            {cat.label}
          </p>
          <div className="flex flex-wrap gap-2">
            {cat.options.map((tc) => (
              <button
                key={tc}
                type="button"
                role="radio"
                aria-checked={selected === tc}
                onClick={() => onChange(tc)}
                className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors ${
                  selected === tc
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-foreground hover:bg-muted"
                }`}
              >
                {TIME_CONTROL_LABELS[tc]}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Waiting State ───────────────────────────────────────────────────────────

function WaitingState({
  timeControl,
  onCancel,
}: {
  timeControl: TimeControl;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-6">
      <div className="relative flex h-16 w-16 items-center justify-center">
        <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-border border-t-primary" />
      </div>
      <div className="text-center">
        <p className="font-semibold text-foreground">Looking for opponent...</p>
        <p className="text-sm text-muted-foreground">{TIME_CONTROL_LABELS[timeControl]}</p>
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
      >
        Cancel
      </button>
    </div>
  );
}

// ─── Main Matchmaking Component ──────────────────────────────────────────────

export interface MatchmakingProps {
  onQuickPlay: (timeControl: TimeControl) => Promise<void>;
  onChallengeFriend: (username: string, timeControl: TimeControl) => Promise<void>;
  isSearching?: boolean;
  onCancelSearch?: () => void;
  searchingTimeControl?: TimeControl;
}

export function Matchmaking({
  onQuickPlay,
  onChallengeFriend,
  isSearching = false,
  onCancelSearch,
  searchingTimeControl,
}: MatchmakingProps) {
  const [timeControl, setTimeControl] = useState<TimeControl>("BLITZ_5");
  const [tab, setTab] = useState<"quick" | "friend">("quick");
  const [username, setUsername] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleQuickPlay = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    try {
      await onQuickPlay(timeControl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to find game");
    } finally {
      setIsLoading(false);
    }
  }, [onQuickPlay, timeControl]);

  const handleChallenge = useCallback(async () => {
    if (!username.trim()) {
      setError("Please enter a username");
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      await onChallengeFriend(username.trim(), timeControl);
      setUsername("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send challenge");
    } finally {
      setIsLoading(false);
    }
  }, [onChallengeFriend, username, timeControl]);

  if (isSearching && searchingTimeControl) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <WaitingState
          timeControl={searchingTimeControl}
          onCancel={onCancelSearch ?? (() => undefined)}
        />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="mb-4 text-base font-semibold text-foreground">Play</h2>

      {/* Tab switcher */}
      <div className="mb-4 flex rounded-xl border border-border bg-muted/40 p-1" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "quick"}
          onClick={() => setTab("quick")}
          className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors ${
            tab === "quick"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Quick Play
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "friend"}
          onClick={() => setTab("friend")}
          className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors ${
            tab === "friend"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Challenge Friend
        </button>
      </div>

      {/* Time control selector */}
      <div className="mb-4">
        <TimeControlPicker selected={timeControl} onChange={setTimeControl} />
      </div>

      {/* Error */}
      {error && (
        <div className="mb-3 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {/* Tab content */}
      {tab === "quick" ? (
        <button
          type="button"
          onClick={() => void handleQuickPlay()}
          disabled={isLoading}
          className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              Finding opponent...
            </span>
          ) : (
            "Quick Play"
          )}
        </button>
      ) : (
        <div className="space-y-2">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleChallenge();
            }}
            placeholder="Enter username..."
            className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            aria-label="Opponent username"
          />
          <button
            type="button"
            onClick={() => void handleChallenge()}
            disabled={isLoading || !username.trim()}
            className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                Sending challenge...
              </span>
            ) : (
              "Send Challenge"
            )}
          </button>
        </div>
      )}
    </div>
  );
}
