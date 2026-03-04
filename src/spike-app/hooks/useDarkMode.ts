import { useEffect, useState } from "react";

/**
 * Gets the initial dark mode preference based strictly on system settings.
 */
export const getInitialDarkMode = (): boolean => {
  if (typeof window === "undefined") return false;
  if (!window.matchMedia) return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
};

/**
 * Hook to handle dark mode based strictly on system settings for spike-app.
 */
export const useDarkMode = () => {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(getInitialDarkMode());

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const darkModeMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (event: MediaQueryListEvent) => {
      setIsDarkMode(event.matches);
    };

    darkModeMediaQuery.addEventListener("change", handleChange);
    return () => darkModeMediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add("dark");
      root.classList.remove("light");
    } else {
      root.classList.add("light");
      root.classList.remove("dark");
    }
  }, [isDarkMode]);

  return { isDarkMode };
};
