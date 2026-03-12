import { useCallback, useEffect, useState } from "react";

export type ThemePreference = "light" | "dark";

const STORAGE_KEY = "theme-preference";

/**
 * Returns `true` when `value` is a valid `ThemePreference` string.
 */
function isThemePreference(value: string | null): value is ThemePreference {
  return value === "light" || value === "dark";
}

const getInitialTheme = (): ThemePreference => {
  if (typeof window === "undefined") return "light";

  const stored = localStorage.getItem(STORAGE_KEY);
  if (isThemePreference(stored)) return stored;
  return "light";
};

const applyTheme = (isDark: boolean) => {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", isDark);
  root.classList.toggle("light", !isDark);
};

const dispatchThemeChange = (theme: ThemePreference) => {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new StorageEvent("storage", {
      key: STORAGE_KEY,
      newValue: theme,
    }),
  );
};

/**
 * Manages the user's dark/light theme preference with localStorage persistence
 * and cross-tab synchronisation via the `storage` event.
 *
 * @returns `isDarkMode` — `true` when the active theme is dark.
 * @returns `theme` — the current `ThemePreference` value.
 * @returns `setTheme` — explicitly sets the theme and persists it.
 * @returns `toggleTheme` — flips between light and dark.
 */
export const useDarkMode = () => {
  const [theme, setThemeState] = useState<ThemePreference>(getInitialTheme);
  const isDarkMode = theme === "dark";

  const setTheme = useCallback((newTheme: ThemePreference) => {
    setThemeState(newTheme);
    localStorage.setItem(STORAGE_KEY, newTheme);
    applyTheme(newTheme === "dark");
    dispatchThemeChange(newTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  useEffect(() => {
    applyTheme(isDarkMode);
  }, [isDarkMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY || !isThemePreference(event.newValue)) return;
      setThemeState(event.newValue);
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  return { isDarkMode, theme, setTheme, toggleTheme };
};
