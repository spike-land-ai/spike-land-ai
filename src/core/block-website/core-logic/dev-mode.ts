import { useCallback, useEffect, useState } from "react";

const DEV_MODE_KEY = "spike-dev-mode";
const DEV_MODE_EVENT = "spike-dev-mode-change";

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
    localStorage.setItem(DEV_MODE_KEY, String(value));
    setIsDeveloper(value);
    window.dispatchEvent(new CustomEvent(DEV_MODE_EVENT));
  }, []);

  const toggleDevMode = useCallback(() => {
    setDevMode(!readDevMode());
  }, [setDevMode]);

  return { isDeveloper, setDevMode, toggleDevMode };
}
