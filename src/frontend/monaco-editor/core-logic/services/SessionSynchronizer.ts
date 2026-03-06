import type { ICodeSession } from "../../ui/@/lib/interfaces";
import { computeSessionHash, sanitizeSession } from "../lib/make-sess";
import { tryCatch } from "../../lazy-imports/try-catch";
import type { ISessionSynchronizer } from "./types";

/**
 * SessionSynchronizer enables communication for code sessions.
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
  }

  // handleDbUpdate removed — will be re-added when real-time WebSocket subscriptions are implemented

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
      this.session = sanitizeSession(data as ICodeSession);
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
    } catch (error) {
      console.error("Error in SessionSynchronizer.broadcastSession", error);
    }
  }

  close(): void {
    this.subscribers = [];
  }
}
