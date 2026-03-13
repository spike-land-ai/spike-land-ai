import { DurableObject } from "cloudflare:workers";
import type { Env } from "../core-logic/env.js";

/** Maximum messages retained in session history. */
const MAX_SESSION_MESSAGES = 100;
/** Maximum SSE events in the replay ring buffer. */
const MAX_EVENT_LOG = 200;
/** Inactivity timeout before alarm cleans up session (24 hours). */
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
/** Maximum time to wait for a browser result callback (15s). */
const BROWSER_RESULT_TIMEOUT_MS = 15_000;

export interface SessionMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  timestamp: number;
  toolCallId?: string;
}

export interface SSEEvent {
  seq: number;
  data: string;
}

interface BrowserResultWaiter {
  resolve: (value: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * SpikeChatSessionDO manages a single chat session's state:
 * - Message history (persisted to SQLite)
 * - SSE event log for stream resumption (in-memory ring buffer)
 * - Browser result callbacks (replaces D1 polling)
 * - Auto-cleanup via alarm after 24h inactivity
 */
export class SpikeChatSessionDO extends DurableObject<Env> {
  private eventLog: SSEEvent[] = [];
  private nextSeq = 1;
  private browserWaiters = new Map<string, BrowserResultWaiter>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    void ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          tool_call_id TEXT
        )
      `);
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS session_meta (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        )
      `);
    });
  }

  /** Record a message in the persistent session history. */
  async addMessage(message: SessionMessage): Promise<void> {
    this.ctx.storage.sql.exec(
      `INSERT INTO messages (role, content, timestamp, tool_call_id)
       VALUES (?, ?, ?, ?)`,
      message.role,
      message.content,
      message.timestamp,
      message.toolCallId ?? null,
    );

    // Trim old messages beyond limit
    const count = this.ctx.storage.sql
      .exec<{ cnt: number }>("SELECT COUNT(*) as cnt FROM messages")
      .one().cnt;
    if (count > MAX_SESSION_MESSAGES) {
      this.ctx.storage.sql.exec(
        `DELETE FROM messages WHERE id IN (
          SELECT id FROM messages ORDER BY id ASC LIMIT ?
        )`,
        count - MAX_SESSION_MESSAGES,
      );
    }

    await this.touchActivity();
  }

  /** Get compressed message history for LLM context. */
  async getHistory(): Promise<SessionMessage[]> {
    const rows = this.ctx.storage.sql
      .exec<{
        role: string;
        content: string;
        timestamp: number;
        tool_call_id: string | null;
      }>("SELECT role, content, timestamp, tool_call_id FROM messages ORDER BY id ASC")
      .toArray();

    return rows.map((row) => ({
      role: row.role as SessionMessage["role"],
      content: row.content,
      timestamp: row.timestamp,
      ...(row.tool_call_id ? { toolCallId: row.tool_call_id } : {}),
    }));
  }

  /** Store/update session metadata (e.g. userId, persona). */
  async setMeta(key: string, value: string): Promise<void> {
    this.ctx.storage.sql.exec(
      `INSERT INTO session_meta (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      key,
      value,
    );
  }

  /** Retrieve session metadata. */
  async getMeta(key: string): Promise<string | null> {
    const row = this.ctx.storage.sql
      .exec<{ value: string }>("SELECT value FROM session_meta WHERE key = ?", key)
      .toArray();
    return row.length > 0 ? (row[0]?.value ?? null) : null;
  }

  // ── SSE Event Log (stream resumption) ──────────────────────────────

  /**
   * Append an SSE event to the ring buffer. Returns the sequence ID.
   * Callers should include this as `id:` in the SSE frame.
   */
  appendEvent(data: string): number {
    const seq = this.nextSeq++;
    this.eventLog.push({ seq, data });
    if (this.eventLog.length > MAX_EVENT_LOG) {
      this.eventLog.shift();
    }
    return seq;
  }

  /**
   * Replay events after a given sequence ID (for Last-Event-ID reconnection).
   * Returns events with seq > lastEventId.
   */
  replayEvents(lastEventId: number): SSEEvent[] {
    return this.eventLog.filter((e) => e.seq > lastEventId);
  }

  // ── Browser Result Callbacks ───────────────────────────────────────

  /**
   * Wait for a browser result to be delivered via `deliverBrowserResult`.
   * Replaces D1 polling — the promise resolves instantly when the client
   * POSTs the result to the DO.
   */
  async waitForBrowserResult(toolCallId: string): Promise<unknown> {
    return new Promise<unknown>((resolve) => {
      const timer = setTimeout(() => {
        this.browserWaiters.delete(toolCallId);
        resolve({
          success: false,
          error: "Timed out waiting for the browser result.",
        });
      }, BROWSER_RESULT_TIMEOUT_MS);

      this.browserWaiters.set(toolCallId, { resolve, timer });
    });
  }

  /**
   * Deliver a browser result from the client. Resolves the pending promise
   * in `waitForBrowserResult` instantly — zero polling.
   */
  async deliverBrowserResult(toolCallId: string, result: unknown): Promise<boolean> {
    const waiter = this.browserWaiters.get(toolCallId);
    if (!waiter) {
      return false;
    }

    clearTimeout(waiter.timer);
    this.browserWaiters.delete(toolCallId);
    waiter.resolve(result);
    return true;
  }

  // ── Session Lifecycle ──────────────────────────────────────────────

  /** Update last-active timestamp and schedule cleanup alarm. */
  private async touchActivity(): Promise<void> {
    const now = Date.now();
    this.ctx.storage.sql.exec(
      `INSERT INTO session_meta (key, value) VALUES ('lastActiveAt', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      String(now),
    );
    await this.ctx.storage.setAlarm(now + SESSION_TTL_MS);
  }

  /** Alarm handler — clean up expired sessions. */
  override async alarm(): Promise<void> {
    const row = this.ctx.storage.sql
      .exec<{ value: string }>("SELECT value FROM session_meta WHERE key = 'lastActiveAt'")
      .toArray();

    const lastActive = row.length > 0 ? Number(row[0]?.value ?? 0) : 0;
    const elapsed = Date.now() - lastActive;

    if (elapsed >= SESSION_TTL_MS) {
      // Session expired — clear all data
      this.ctx.storage.sql.exec("DELETE FROM messages");
      this.ctx.storage.sql.exec("DELETE FROM session_meta");
      this.eventLog = [];
      this.nextSeq = 1;
    } else {
      // Not yet expired — reschedule
      await this.ctx.storage.setAlarm(lastActive + SESSION_TTL_MS);
    }
  }
}
