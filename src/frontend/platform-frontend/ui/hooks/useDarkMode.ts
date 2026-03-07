import { useCallback, useEffect, useState } from "react";

export type ThemePreference = "light" | "dark";

const STORAGE_KEY = "theme-preference";

const getInitialTheme = (): ThemePreference => {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return "light";
};

const applyTheme = (isDark: boolean) => {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", isDark);
  root.classList.toggle("light", !isDark);
};

export const useDarkMode = () => {
  const [theme, setThemeState] = useState<ThemePreference>(getInitialTheme);
  const isDarkMode = theme === "dark";

  const setTheme = useCallback((newTheme: ThemePreference) => {
    setThemeState(newTheme);
    localStorage.setItem(STORAGE_KEY, newTheme);
    applyTheme(newTheme === "dark");
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  useEffect(() => {
    applyTheme(isDarkMode);
  }, [isDarkMode]);

  return { isDarkMode, theme, setTheme, toggleTheme };
};
