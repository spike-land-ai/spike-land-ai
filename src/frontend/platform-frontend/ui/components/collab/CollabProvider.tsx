/**
 * CollabProvider — React context wrapping a WebSocket connection to the
 * PresenceDurableObject. Tracks connected users (avatar, name, cursor),
 * handles reconnection with exponential backoff, and exposes:
 *
 *   const { users, sendCursorUpdate, sendEdit, connectionStatus } = useCollab();
 *
 * Usage:
 *   <CollabProvider roomId="doc-abc123" userId="user-42" userName="Alice">
 *     <YourEditor />
 *   </CollabProvider>
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";

// ── Types ──────────────────────────────────────────────────────────────────

export type UserStatus = "online" | "away" | "dnd" | "offline";

export interface CollabUser {
  userId: string;
  name: string;
  avatarUrl?: string;
  status: UserStatus;
  /** Viewport-relative cursor position in [0,1] x [0,1] coords */
  cursor?: { x: number; y: number };
  /** ISO string of last activity */
  lastSeen: number;
  /** Assigned collaboration color (deterministic from userId) */
  color: string;
}

export type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "disconnected";

export interface EditOperation {
  type: "insert" | "delete" | "replace";
  offset: number;
  text?: string;
  length?: number;
  /** Logical clock for last-writer-wins conflict resolution */
  timestamp: number;
  userId: string;
}

export interface SelectionRange {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

interface CollabContextValue {
  /** All currently online/away/dnd users (excludes self by default) */
  users: CollabUser[];
  /** Own connection status to the presence DO */
  connectionStatus: ConnectionStatus;
  /** Broadcast cursor position to other users */
  sendCursorUpdate: (x: number, y: number) => void;
  /** Broadcast an edit operation */
  sendEdit: (op: Omit<EditOperation, "userId" | "timestamp">) => void;
  /** Broadcast a Monaco selection range */
  sendSelection: (range: SelectionRange | null) => void;
  /** Change own status */
  setStatus: (status: UserStatus) => void;
  /** Typing indicator broadcast */
  sendTyping: (isTyping: boolean) => void;
  /** Users currently typing (excludes self) */
  typingUsers: string[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

const COLLAB_COLORS = [
  "#3b82f6", // blue
  "#ef4444", // red
  "#22c55e", // green
  "#f59e0b", // amber
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#14b8a6", // teal
  "#f97316", // orange
];

function userColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return COLLAB_COLORS[hash % COLLAB_COLORS.length] ?? COLLAB_COLORS[0]!;
}

const MAX_BACKOFF_MS = 30_000;

function backoffDelay(attempt: number): number {
  return Math.min(500 * 2 ** attempt + Math.random() * 200, MAX_BACKOFF_MS);
}

function resolveWsUrl(roomId: string, userId: string): string {
  const base =
    typeof import.meta !== "undefined" && (import.meta as Record<string, unknown>).env
      ? ((import.meta as Record<string, unknown>).env as Record<string, unknown>)["VITE_PRESENCE_WS_URL"] as
          | string
          | undefined
      : undefined;

  const origin = base ?? (typeof window !== "undefined" ? window.location.origin : "");
  const wsOrigin = origin.replace(/^http/, "ws");
  return `${wsOrigin}/api/presence/${encodeURIComponent(roomId)}?userId=${encodeURIComponent(userId)}`;
}

// ── Context ────────────────────────────────────────────────────────────────

const CollabContext = createContext<CollabContextValue | null>(null);

export function useCollab(): CollabContextValue {
  const ctx = useContext(CollabContext);
  if (!ctx) throw new Error("useCollab must be used inside <CollabProvider>");
  return ctx;
}

// ── Provider ───────────────────────────────────────────────────────────────

interface CollabProviderProps {
  /** Unique identifier for the shared room / document */
  roomId: string;
  /** Current user's ID (used as WebSocket tag in the DO) */
  userId: string;
  /** Human-readable display name */
  userName: string;
  /** Optional avatar URL */
  avatarUrl?: string;
  children: ReactNode;
}

export function CollabProvider({
  roomId,
  userId,
  userName,
  avatarUrl,
  children,
}: CollabProviderProps) {
  const [users, setUsers] = useState<Map<string, CollabUser>>(new Map());
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempt = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const typingTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const isMounted = useRef(true);

  // Merge a partial update into the users map
  const updateUser = useCallback(
    (uid: string, patch: Partial<CollabUser>) => {
      if (uid === userId) return; // never show self in the users list
      setUsers((prev) => {
        const next = new Map(prev);
        const existing = next.get(uid);
        next.set(uid, {
          userId: uid,
          name: uid,
          status: "online",
          lastSeen: Date.now(),
          color: userColor(uid),
          ...existing,
          ...patch,
        });
        return next;
      });
    },
    [userId],
  );

  const removeUser = useCallback(
    (uid: string) => {
      if (uid === userId) return;
      setUsers((prev) => {
        const next = new Map(prev);
        next.delete(uid);
        return next;
      });
    },
    [userId],
  );

  const sendJson = useCallback((payload: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
  }, []);

  // ── WebSocket lifecycle ────────────────────────────────────────────────

  const connect = useCallback(() => {
    if (!isMounted.current) return;
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.close();
      wsRef.current = null;
    }

    setConnectionStatus(reconnectAttempt.current === 0 ? "connecting" : "reconnecting");

    const ws = new WebSocket(resolveWsUrl(roomId, userId));
    wsRef.current = ws;

    ws.onopen = () => {
      if (!isMounted.current) return;
      reconnectAttempt.current = 0;
      setConnectionStatus("connected");

      // Announce our identity
      ws.send(
        JSON.stringify({
          type: "presence_set",
          status: "online",
          name: userName,
          avatarUrl,
        }),
      );

      // Start heartbeat every 20s (DO timeout is 60s)
      if (heartbeatInterval.current) clearInterval(heartbeatInterval.current);
      heartbeatInterval.current = setInterval(() => {
        sendJson({ type: "heartbeat" });
      }, 20_000);
    };

    ws.onmessage = (evt: MessageEvent) => {
      if (typeof evt.data !== "string") return;
      try {
        const msg = JSON.parse(evt.data) as Record<string, unknown>;
        handleMessage(msg);
      } catch {
        // ignore malformed
      }
    };

    ws.onclose = () => {
      if (!isMounted.current) return;
      if (heartbeatInterval.current) clearInterval(heartbeatInterval.current);
      setConnectionStatus("reconnecting");
      scheduleReconnect();
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [roomId, userId, userName, avatarUrl, sendJson]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMessage = useCallback(
    (msg: Record<string, unknown>) => {
      switch (msg.type) {
        case "presence_state": {
          // Full snapshot from DO on first connection
          const state = msg.state as Record<string, { status: UserStatus; lastSeen: number }>;
          setUsers(() => {
            const next = new Map<string, CollabUser>();
            for (const [uid, data] of Object.entries(state)) {
              if (uid === userId) continue;
              next.set(uid, {
                userId: uid,
                name: uid,
                status: data.status,
                lastSeen: data.lastSeen,
                color: userColor(uid),
              });
            }
            return next;
          });
          break;
        }
        case "presence_changed": {
          const uid = msg.userId as string;
          const status = msg.status as UserStatus;
          if (status === "offline") {
            removeUser(uid);
          } else {
            updateUser(uid, { status, lastSeen: msg.lastSeen as number });
          }
          break;
        }
        case "cursor_update": {
          const uid = msg.userId as string;
          const x = msg.x as number;
          const y = msg.y as number;
          updateUser(uid, { cursor: { x, y }, lastSeen: Date.now() });
          break;
        }
        case "user_info": {
          const uid = msg.userId as string;
          updateUser(uid, {
            name: (msg.name as string) ?? uid,
            avatarUrl: msg.avatarUrl as string | undefined,
          });
          break;
        }
        case "typing": {
          const uid = msg.userId as string;
          if (uid === userId) break;
          const isTyping = msg.isTyping as boolean;
          if (isTyping) {
            setTypingUsers((prev) => (prev.includes(uid) ? prev : [...prev, uid]));
            const existing = typingTimers.current.get(uid);
            if (existing) clearTimeout(existing);
            typingTimers.current.set(
              uid,
              setTimeout(() => {
                setTypingUsers((prev) => prev.filter((u) => u !== uid));
                typingTimers.current.delete(uid);
              }, 4_000),
            );
          } else {
            setTypingUsers((prev) => prev.filter((u) => u !== uid));
            const existing = typingTimers.current.get(uid);
            if (existing) clearTimeout(existing);
            typingTimers.current.delete(uid);
          }
          break;
        }
        case "pong":
          break;
        default:
          break;
      }
    },
    [userId, updateUser, removeUser],
  );

  const scheduleReconnect = useCallback(() => {
    if (!isMounted.current) return;
    const delay = backoffDelay(reconnectAttempt.current);
    reconnectAttempt.current += 1;
    reconnectTimer.current = setTimeout(() => {
      if (isMounted.current) connect();
    }, delay);
  }, [connect]);

  useEffect(() => {
    isMounted.current = true;
    connect();
    return () => {
      isMounted.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (heartbeatInterval.current) clearInterval(heartbeatInterval.current);
      for (const t of typingTimers.current.values()) clearTimeout(t);
      wsRef.current?.close();
    };
  }, [connect]);

  // ── Public API ─────────────────────────────────────────────────────────

  const sendCursorUpdate = useCallback(
    (x: number, y: number) => {
      sendJson({ type: "cursor_update", userId, x, y });
    },
    [sendJson, userId],
  );

  const sendEdit = useCallback(
    (op: Omit<EditOperation, "userId" | "timestamp">) => {
      sendJson({ type: "edit", ...op, userId, timestamp: Date.now() });
    },
    [sendJson, userId],
  );

  const sendSelection = useCallback(
    (range: SelectionRange | null) => {
      sendJson({ type: "selection", userId, range });
    },
    [sendJson, userId],
  );

  const setStatus = useCallback(
    (status: UserStatus) => {
      sendJson({ type: "presence_set", status });
    },
    [sendJson],
  );

  const sendTyping = useCallback(
    (isTyping: boolean) => {
      sendJson({ type: "typing", userId, isTyping });
    },
    [sendJson, userId],
  );

  const visibleUsers = useMemo(() => {
    return Array.from(users.values()).filter((u) => u.status !== "offline");
  }, [users]);

  const value = useMemo<CollabContextValue>(
    () => ({
      users: visibleUsers,
      connectionStatus,
      sendCursorUpdate,
      sendEdit,
      sendSelection,
      setStatus,
      sendTyping,
      typingUsers,
    }),
    [
      visibleUsers,
      connectionStatus,
      sendCursorUpdate,
      sendEdit,
      sendSelection,
      setStatus,
      sendTyping,
      typingUsers,
    ],
  );

  return <CollabContext.Provider value={value}>{children}</CollabContext.Provider>;
}
