import type { ICodeSession } from "@/lib/interfaces";
import { computeSessionHash, sanitizeSession } from "@/lib/make-sess";
import { tryCatch } from "@/lib/try-catch";
import type { ISessionSynchronizer } from "./types";
import { getStdbClient, connectToSpacetimeDB, onStdbConnect } from "@/lib/stdb";

/**
 * SessionSynchronizer enables communication for code sessions
 * using SpacetimeDB.
 */
export class SessionSynchronizer implements ISessionSynchronizer {
  private session: ICodeSession | null = null;
  private subscribers: Array<(session: ICodeSession & { sender: string }) => void> = [];

  constructor(
    private codeSpace: string,
    session?: ICodeSession,
  ) {
    if (session) {
      this.session = session;
    }

    // Ensure connection is started
    connectToSpacetimeDB();

    // Subscribe when connected
    onStdbConnect((conn) => {
      conn.db.code_session?.onInsert((ctx, row) => {
        if (row.codeSpace === this.codeSpace) {
          const event = ctx.event as Record<string, unknown>;
          const identity = event.callerIdentity as { toHexString(): string } | undefined;
          this.handleDbUpdate(row, identity?.toHexString() ?? "unknown");
        }
      });

      conn.db.code_session?.onUpdate((ctx, _oldRow, newRow) => {
        if (newRow.codeSpace === this.codeSpace) {
          const event = ctx.event as Record<string, unknown>;
          const identity = event.callerIdentity as { toHexString(): string } | undefined;
          this.handleDbUpdate(newRow, identity?.toHexString() ?? "unknown");
        }
      });
    });
  }

  private handleDbUpdate(row: Record<string, unknown>, senderId: string) {
    try {
      let messages = [];
      try {
        messages = JSON.parse((row.messagesJson as string) || "[]");
      } catch (_e) {}

      const newData: ICodeSession = {
        codeSpace: row.codeSpace as string,
        code: row.code as string,
        html: row.html as string,
        css: row.css as string,
        transpiled: row.transpiled as string,
        messages: messages,
      };

      if (!this.session) {
        this.session = sanitizeSession(newData);
      } else {
        this.session = sanitizeSession({
          ...this.session,
          ...newData,
        });
      }

      this.notifySubscribers({ ...this.session, sender: senderId });
    } catch (error) {
      console.error("Error in SessionSynchronizer SpacetimeDB handler:", error);
    }
  }

  private notifySubscribers(session: ICodeSession & { sender: string }): void {
    this.subscribers.forEach((cb) => {
      try {
        cb(session);
      } catch (error) {
        console.error("Error notifying subscriber:", error);
      }
    });
  }

  async getCode(): Promise<string> {
    if (!this.session) {
      this.session = await this.init();
    }
    return this.session!.code;
  }

  getSession(): ICodeSession | null {
    return this.session;
  }

  async init(session?: ICodeSession): Promise<ICodeSession> {
    if (session) {
      this.session = sanitizeSession(session);
      return this.session;
    }

    if (this.session) {
      return this.session;
    }

    const fetchSessionPromise = async () => {
      const response = await fetch(`/live/${this.codeSpace}/session.json`);
      if (!response.ok) {
        throw new Error(`Failed to fetch session: ${response.status}`);
      }
      return response.json();
    };

    const { data, error } = await tryCatch(fetchSessionPromise());

    if (error) {
      console.error("Error initializing session:", error);
      this.session = sanitizeSession({
        codeSpace: this.codeSpace,
        code: "",
        html: "",
        css: "",
        transpiled: "",
      });
    } else {
      this.session = sanitizeSession(data);
    }
    return this.session!;
  }

  subscribe(callback: (session: ICodeSession & { sender: string }) => void): () => void {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter((cb) => cb !== callback);
    };
  }

  broadcastSession(session: ICodeSession & { sender: string }): void {
    try {
      if (!this.session) {
        this.session = sanitizeSession(session);
        this.notifySubscribers(session);
      } else {
        const currentSessionHash = computeSessionHash(this.session);
        const newSessionHash = computeSessionHash(sanitizeSession(session));
        if (currentSessionHash === newSessionHash) {
          return;
        }
        this.session = sanitizeSession(session);
        this.notifySubscribers(session);
      }

      // Sync to SpacetimeDB
      const client = getStdbClient();
      if (client?.reducers) {
        const reducers = client.reducers as Record<string, ((...args: unknown[]) => void) | undefined>;
        reducers.update_code_session?.(
          this.session.codeSpace,
          this.session.code || "",
          this.session.html || "",
          this.session.css || "",
          this.session.transpiled || "",
          JSON.stringify(this.session.messages || []),
        );
      }
    } catch (error) {
      console.error("Error in SessionSynchronizer.broadcastSession", error);
    }
  }

  close(): void {
    try {
      this.subscribers = [];
    } catch (error) {
      console.error("Error closing synchronizer:", error);
    }
  }
}
