/**
 * CollabIndicator — header bar widget showing:
 *   - "N people viewing" count
 *   - "Alex is typing..." indicator
 *   - WebSocket connection status icon
 *
 * Designed to be dropped into the page header alongside other header actions.
 *
 * Usage:
 *   <CollabIndicator />            // in any component inside <CollabProvider>
 *   <CollabIndicator className="ml-3" />
 */
import { memo } from "react";
import { Users, Wifi, WifiOff, Loader2 } from "lucide-react";
import { cn } from "../../../styling/cn";
import { useCollab } from "./CollabProvider";
import type { ConnectionStatus } from "./CollabProvider";

function ConnectionIcon({ status, className }: { status: ConnectionStatus; className?: string }) {
  switch (status) {
    case "connected":
      return (
        <Wifi
          className={cn("h-3.5 w-3.5 text-green-500", className)}
          aria-label="Connected"
        />
      );
    case "connecting":
    case "reconnecting":
      return (
        <Loader2
          className={cn("h-3.5 w-3.5 animate-spin text-yellow-500", className)}
          aria-label={status === "connecting" ? "Connecting…" : "Reconnecting…"}
        />
      );
    case "disconnected":
      return (
        <WifiOff
          className={cn("h-3.5 w-3.5 text-red-500", className)}
          aria-label="Disconnected"
        />
      );
  }
}

function buildTypingText(typingNames: string[]): string | null {
  if (typingNames.length === 0) return null;
  if (typingNames.length === 1) return `${typingNames[0]} is typing…`;
  if (typingNames.length === 2) return `${typingNames[0]} and ${typingNames[1]} are typing…`;
  return `${typingNames[0]} and ${typingNames.length - 1} others are typing…`;
}

interface CollabIndicatorProps {
  className?: string;
  /** Show the detailed "N people viewing" label (default true) */
  showLabel?: boolean;
}

export const CollabIndicator = memo(function CollabIndicator({
  className,
  showLabel = true,
}: CollabIndicatorProps) {
  const { users, connectionStatus, typingUsers } = useCollab();

  const viewerCount = users.length + 1; // include self
  const typingText = buildTypingText(typingUsers);

  return (
    <div
      className={cn("flex items-center gap-2 text-[11px] font-medium text-muted-foreground", className)}
      aria-live="polite"
      aria-label="Collaboration status"
    >
      {/* Connection icon */}
      <ConnectionIcon status={connectionStatus} />

      {showLabel && connectionStatus === "connected" && (
        <>
          {/* Viewer count */}
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            <span>
              {viewerCount === 1 ? "Just you" : `${viewerCount} viewing`}
            </span>
          </span>

          {/* Typing indicator — replaces viewer count when someone is typing */}
          {typingText && (
            <span
              className="flex items-center gap-1 text-foreground/70 italic"
              aria-live="polite"
              aria-atomic="true"
            >
              <TypingDots />
              {typingText}
            </span>
          )}
        </>
      )}

      {connectionStatus === "reconnecting" && (
        <span className="text-yellow-500">Reconnecting…</span>
      )}

      {connectionStatus === "disconnected" && (
        <span className="text-red-500">Offline</span>
      )}
    </div>
  );
});

/** Three-dot animated typing indicator */
function TypingDots() {
  return (
    <span
      aria-hidden="true"
      className="flex items-center gap-[2px]"
      style={{ height: 14 }}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1 w-1 rounded-full bg-current"
          style={{
            animation: `typing-bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes typing-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </span>
  );
}
