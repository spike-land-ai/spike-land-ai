/**
 * Reconnect manager with exponential backoff.
 */

import type { ServerConfig } from "../config/types.js";

export type ReconnectFn = (serverName: string, config: ServerConfig) => Promise<void>;

export interface BackoffOptions {
  initialDelayMs?: number;
  maxDelayMs?: number;
}

export interface ReconnectOptions extends BackoffOptions {
  maxAttempts?: number;
}

const DEFAULT_INITIAL_DELAY = 1000;
const DEFAULT_MAX_DELAY = 30000;
const DEFAULT_MAX_ATTEMPTS = 5;

/**
 * Calculate exponential backoff delay for a given attempt index.
 */
export function calculateBackoff(attempt: number, options: BackoffOptions = {}): number {
  const initialDelayMs = options.initialDelayMs ?? DEFAULT_INITIAL_DELAY;
  const maxDelayMs = options.maxDelayMs ?? DEFAULT_MAX_DELAY;
  const delay = initialDelayMs * Math.pow(2, attempt);
  return Math.min(delay, maxDelayMs);
}

/**
 * Manages reconnection scheduling with exponential backoff.
 */
export class ReconnectManager {
  private reconnectFn: ReconnectFn;
  private options: ReconnectOptions;
  private timers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private attempts: Map<string, number> = new Map();

  constructor(reconnectFn: ReconnectFn, options: ReconnectOptions = {}) {
    this.reconnectFn = reconnectFn;
    this.options = options;
  }

  get pendingReconnects(): number {
    return this.timers.size;
  }

  scheduleReconnect(serverName: string, config: ServerConfig): void {
    const maxAttempts = this.options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    const attempt = this.attempts.get(serverName) ?? 0;

    if (maxAttempts === 0 || attempt >= maxAttempts) {
      return;
    }

    const delay = calculateBackoff(attempt, this.options);
    this.attempts.set(serverName, attempt + 1);

    const timer = setTimeout(async () => {
      this.timers.delete(serverName);
      try {
        await this.reconnectFn(serverName, config);
        this.attempts.delete(serverName);
      } catch {
        this.scheduleReconnect(serverName, config);
      }
    }, delay);

    this.timers.set(serverName, timer);
  }

  cancelAll(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.attempts.clear();
  }
}
