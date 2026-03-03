"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

// ── Storage Keys ────────────────────────────────────────────────────
const FAVORITES_KEY = "mcp-explorer-favorites";
const RECENT_KEY = "mcp-explorer-recent";
const FORM_PREFIX = "mcp-form-";
const MAX_RECENT = 10;

// ── External store for cross-component sync ─────────────────────────
// When one component updates favorites, all subscribers re-render.

// Stable reference for SSR snapshots — avoids creating new arrays each render
const EMPTY_STRING_ARRAY: readonly string[] = [];

let favoritesSnapshot: readonly string[] = [];
let recentSnapshot: readonly string[] = [];
const favListeners = new Set<() => void>();
const recentListeners = new Set<() => void>();

function notifyFavorites() {
  for (const listener of favListeners) listener();
}

function notifyRecent() {
  for (const listener of recentListeners) listener();
}

function readFavorites(): readonly string[] {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function readRecent(): readonly string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function writeFavorites(names: readonly string[]) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(names));
  favoritesSnapshot = names;
  notifyFavorites();
}

function writeRecent(names: readonly string[]) {
  localStorage.setItem(RECENT_KEY, JSON.stringify(names));
  recentSnapshot = names;
  notifyRecent();
}

// Initialize snapshots from storage on module load (client side)
if (typeof window !== "undefined") {
  favoritesSnapshot = readFavorites();
  recentSnapshot = readRecent();
}

// ── useFavorites ────────────────────────────────────────────────────

export function useFavorites() {
  const favorites = useSyncExternalStore(
    cb => {
      favListeners.add(cb);
      return () => favListeners.delete(cb);
    },
    () => favoritesSnapshot,
    () => EMPTY_STRING_ARRAY,
  );

  const toggleFavorite = useCallback((toolName: string) => {
    const current = readFavorites();
    const idx = current.indexOf(toolName);
    if (idx >= 0) {
      writeFavorites(current.filter(n => n !== toolName));
    } else {
      writeFavorites([...current, toolName]);
    }
  }, []);

  const isFavorite = useCallback(
    (toolName: string) => favorites.includes(toolName),
    [favorites],
  );

  return { favorites, toggleFavorite, isFavorite } as const;
}

// ── useRecentTools ──────────────────────────────────────────────────

export function useRecentTools() {
  const recent = useSyncExternalStore(
    cb => {
      recentListeners.add(cb);
      return () => recentListeners.delete(cb);
    },
    () => recentSnapshot,
    () => EMPTY_STRING_ARRAY,
  );

  const addRecent = useCallback((toolName: string) => {
    const current = readRecent();
    const filtered = current.filter(n => n !== toolName);
    const updated = [toolName, ...filtered].slice(0, MAX_RECENT);
    writeRecent(updated);
  }, []);

  return { recent, addRecent } as const;
}

// ── useFormPersistence ──────────────────────────────────────────────
// Persists form values to sessionStorage keyed by tool name.

export function useFormPersistence(toolName: string) {
  const key = FORM_PREFIX + toolName;

  const [initialized, setInitialized] = useState(false);

  const loadValues = useCallback((): Record<string, unknown> | null => {
    try {
      const raw = sessionStorage.getItem(key);
      return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }, [key]);

  const saveValues = useCallback(
    (values: Record<string, unknown>) => {
      try {
        sessionStorage.setItem(key, JSON.stringify(values));
      } catch {
        // sessionStorage full — ignore silently
      }
    },
    [key],
  );

  const clearValues = useCallback(() => {
    sessionStorage.removeItem(key);
  }, [key]);

  useEffect(() => {
    setInitialized(true);
  }, []);

  return { loadValues, saveValues, clearValues, initialized } as const;
}
