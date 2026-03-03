/**
 * Session cache for app data.
 * Uses sessionStorage to avoid redundant API calls on page revisits.
 * Session cache for app workspace data.
 */

import type { AppData } from "./types";

export const SESSION_CACHE_TTL_MS = 5 * 60 * 1000;

export function getSessionCacheKey(codeSpace: string): string {
  return `app-session-${codeSpace}`;
}

interface SessionCacheData {
  app?: AppData;
  hasContent?: boolean;
  isPromptMode?: boolean;
}

interface StoredCacheEntry extends SessionCacheData {
  timestamp: number;
}

export function getSessionCache(codeSpace: string): SessionCacheData | null {
  if (typeof window === "undefined") return null;

  const key = getSessionCacheKey(codeSpace);
  const raw = sessionStorage.getItem(key);
  if (!raw) return null;

  try {
    const entry: StoredCacheEntry = JSON.parse(raw);
    if (Date.now() - entry.timestamp >= SESSION_CACHE_TTL_MS) {
      sessionStorage.removeItem(key);
      return null;
    }
    const { timestamp: _, ...data } = entry;
    return data;
  } catch {
    sessionStorage.removeItem(key);
    return null;
  }
}

export function setSessionCache(
  codeSpace: string,
  data: SessionCacheData,
): void {
  if (typeof window === "undefined") return;

  const key = getSessionCacheKey(codeSpace);
  const entry: StoredCacheEntry = { ...data, timestamp: Date.now() };
  sessionStorage.setItem(key, JSON.stringify(entry));
}

export function invalidateSessionCache(codeSpace: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(getSessionCacheKey(codeSpace));
}
