/**
 * useSharedState — hook for sharing a typed state value across all connected
 * clients in the same room. Uses last-writer-wins (LWW) conflict resolution
 * based on a Lamport-style logical timestamp.
 *
 * Backed by the presence DO WebSocket channel — the DO broadcasts edit
 * operations to all sockets, and each client applies them locally.
 *
 * For Monaco editor integration, use the MonacoSelectionRange variant below.
 *
 * Usage:
 *   const [content, setContent] = useSharedState("editor-content", "");
 *
 *   // Monaco cursor/selection:
 *   const [selection, setSelection] = useSharedSelection();
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useCollab } from "./CollabProvider";
import type { SelectionRange } from "./CollabProvider";

// ── LWW merge helper ───────────────────────────────────────────────────────

interface LwwEntry<T> {
  value: T;
  /** Logical clock incremented on every local write */
  clock: number;
  /** Wall-clock ms of last write (tie-breaker) */
  wallTime: number;
  userId: string;
}

function lwwMerge<T>(local: LwwEntry<T>, remote: LwwEntry<T>): LwwEntry<T> {
  if (remote.clock > local.clock) return remote;
  if (remote.clock === local.clock && remote.wallTime > local.wallTime) return remote;
  return local;
}

// ── Shared string / document state ─────────────────────────────────────────

/**
 * Share a mutable value (string, number, plain object) across clients.
 * Uses last-writer-wins: the client with the highest logical clock wins.
 *
 * @param key    Unique key within the room (e.g. "editor-content")
 * @param initial Initial value used if no remote state exists yet
 */
export function useSharedState<T>(
  key: string,
  initial: T,
): [T, (next: T | ((prev: T) => T)) => void] {
  const { sendEdit } = useCollab();
  const clockRef = useRef(0);
  const [entry, setEntry] = useState<LwwEntry<T>>({
    value: initial,
    clock: 0,
    wallTime: 0,
    userId: "",
  });

  // Listen for incoming edit operations via the context's WebSocket
  // We piggyback on window custom events that CollabProvider can dispatch.
  useEffect(() => {
    function onSharedStateEvent(evt: Event) {
      const customEvt = evt as CustomEvent<{
        key: string;
        value: unknown;
        clock: number;
        wallTime: number;
        userId: string;
      }>;
      if (customEvt.detail.key !== key) return;
      const remote: LwwEntry<T> = {
        value: customEvt.detail.value as T,
        clock: customEvt.detail.clock,
        wallTime: customEvt.detail.wallTime,
        userId: customEvt.detail.userId,
      };
      setEntry((prev) => lwwMerge(prev, remote));
    }

    window.addEventListener("collab:shared_state", onSharedStateEvent);
    return () => window.removeEventListener("collab:shared_state", onSharedStateEvent);
  }, [key]);

  const setState = useCallback(
    (next: T | ((prev: T) => T)) => {
      setEntry((prev) => {
        const nextValue = typeof next === "function" ? (next as (p: T) => T)(prev.value) : next;
        clockRef.current += 1;
        const updated: LwwEntry<T> = {
          value: nextValue,
          clock: clockRef.current,
          wallTime: Date.now(),
          userId: "", // filled by CollabProvider on the wire
        };

        // Broadcast via the edit channel — encode value as JSON string
        sendEdit({
          type: "replace",
          offset: 0,
          text: JSON.stringify({ __shared_state_key: key, ...updated }),
          length: 0,
        });

        return updated;
      });
    },
    [key, sendEdit],
  );

  return [entry.value, setState];
}

// ── Monaco selection / cursor sharing ─────────────────────────────────────

/**
 * Sync Monaco editor selection ranges across clients.
 * Returns [ownSelection, setOwnSelection, remoteSelections].
 *
 * Usage in a Monaco onDidChangeCursorSelection handler:
 *   const [, setSelection, remoteSelections] = useSharedSelection();
 *   editor.onDidChangeCursorSelection((e) => {
 *     setSelection({
 *       startLine: e.selection.startLineNumber,
 *       startColumn: e.selection.startColumn,
 *       endLine: e.selection.endLineNumber,
 *       endColumn: e.selection.endColumn,
 *     });
 *   });
 */
export interface RemoteSelection {
  userId: string;
  userName: string;
  color: string;
  range: SelectionRange;
}

export function useSharedSelection(): [
  SelectionRange | null,
  (range: SelectionRange | null) => void,
  RemoteSelection[],
] {
  const { sendSelection, users } = useCollab();
  const [ownSelection, setOwnSelection] = useState<SelectionRange | null>(null);
  const [remoteSelections, setRemoteSelections] = useState<RemoteSelection[]>([]);

  // Listen for selection events from other clients
  useEffect(() => {
    function onSelectionEvent(evt: Event) {
      const customEvt = evt as CustomEvent<{
        userId: string;
        range: SelectionRange | null;
      }>;
      const { userId, range } = customEvt.detail;
      const user = users.find((u) => u.userId === userId);
      if (!user) return;

      setRemoteSelections((prev) => {
        const filtered = prev.filter((s) => s.userId !== userId);
        if (!range) return filtered;
        return [
          ...filtered,
          {
            userId,
            userName: user.name,
            color: user.color,
            range,
          },
        ];
      });
    }

    window.addEventListener("collab:selection", onSelectionEvent);
    return () => window.removeEventListener("collab:selection", onSelectionEvent);
  }, [users]);

  const setAndBroadcastSelection = useCallback(
    (range: SelectionRange | null) => {
      setOwnSelection(range);
      sendSelection(range);
    },
    [sendSelection],
  );

  return [ownSelection, setAndBroadcastSelection, remoteSelections];
}

// ── CollabProvider event dispatcher helper ─────────────────────────────────

/**
 * Called by CollabProvider when it receives incoming shared_state or selection
 * messages over WebSocket. Dispatches the appropriate window custom event so
 * useSharedState / useSharedSelection hooks can react.
 *
 * CollabProvider should call this in its handleMessage switch:
 *   case "shared_state": dispatchSharedStateEvent(msg); break;
 *   case "selection":    dispatchSelectionEvent(msg);   break;
 */
export function dispatchSharedStateEvent(msg: Record<string, unknown>) {
  window.dispatchEvent(
    new CustomEvent("collab:shared_state", {
      detail: {
        key: msg.key,
        value: msg.value,
        clock: msg.clock,
        wallTime: msg.wallTime,
        userId: msg.userId,
      },
    }),
  );
}

export function dispatchSelectionEvent(msg: Record<string, unknown>) {
  window.dispatchEvent(
    new CustomEvent("collab:selection", {
      detail: {
        userId: msg.userId,
        range: msg.range ?? null,
      },
    }),
  );
}
