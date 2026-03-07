import { useCallback, useEffect, useState } from "react";

const DEV_MODE_KEY = "spike-dev-mode";
const DEV_MODE_EVENT = "spike-dev-mode-change";
const DEV_MODE_TRANSITION_EVENT = "spike-dev-mode-transition";
const DEV_MODE_TRANSITION_MS = 2000;

type DevModeTransitionDetail = {
  durationMs: number;
  targetMode: boolean;
  startedAt: number;
};

function readDevMode(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(DEV_MODE_KEY) === "true";
}

export function useDevMode() {
  const [isDeveloper, setIsDeveloper] = useState(readDevMode);

  useEffect(() => {
    const handler = () => setIsDeveloper(readDevMode());
    window.addEventListener(DEV_MODE_EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(DEV_MODE_EVENT, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const setDevMode = useCallback((value: boolean) => {
    const detail: DevModeTransitionDetail = {
      durationMs: DEV_MODE_TRANSITION_MS,
      targetMode: value,
      startedAt: Date.now(),
    };
    window.dispatchEvent(new CustomEvent<DevModeTransitionDetail>(DEV_MODE_TRANSITION_EVENT, { detail }));
    localStorage.setItem(DEV_MODE_KEY, String(value));
    setIsDeveloper(value);
    window.dispatchEvent(new CustomEvent(DEV_MODE_EVENT));
  }, []);

  const toggleDevMode = useCallback(() => {
    setDevMode(!readDevMode());
  }, [setDevMode]);

  return { isDeveloper, setDevMode, toggleDevMode };
}

export function useDevModeTransition() {
  const [transition, setTransition] = useState<DevModeTransitionDetail | null>(null);

  useEffect(() => {
    let timeoutId: number | null = null;

    const handleTransition = (event: Event) => {
      const customEvent = event as CustomEvent<DevModeTransitionDetail>;
      const detail = customEvent.detail;
      setTransition(detail);
      if (timeoutId != null) window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => setTransition(null), detail.durationMs);
    };

    window.addEventListener(DEV_MODE_TRANSITION_EVENT, handleTransition);
    return () => {
      window.removeEventListener(DEV_MODE_TRANSITION_EVENT, handleTransition);
      if (timeoutId != null) window.clearTimeout(timeoutId);
    };
  }, []);

  return {
    isTransitioning: transition != null,
    durationMs: transition?.durationMs ?? DEV_MODE_TRANSITION_MS,
    targetMode: transition?.targetMode ?? null,
    startedAt: transition?.startedAt ?? null,
  };
}
