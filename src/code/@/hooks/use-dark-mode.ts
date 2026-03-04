import { useEffect, useState } from "react";

/**
 * Gets the initial dark mode preference based strictly on system settings.
 * Ignores any previously stored localStorage preferences.
 */
export const getInitialDarkMode = (): boolean => {
  if (typeof window === "undefined") return false;

  if (!window.matchMedia || typeof window.matchMedia !== "function") {
    return false;
  }

  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch (_e) {
    return false;
  }
};

/**
 * Hook to handle dark mode based strictly on system settings.
 * Automatically updates when system preference changes.
 * No manual override allowed for now!
 */
export const useDarkMode = () => {
  // Use a state variable to track the current preference
  const [isDarkMode, setIsDarkMode] = useState<boolean>(getInitialDarkMode());

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !window.matchMedia ||
      typeof window.matchMedia !== "function"
    ) {
      return;
    }

    try {
      const darkModeMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

      // Handler for media query changes
      const handleChange = (event: MediaQueryListEvent) => {
        setIsDarkMode(event.matches);
      };

      // Listen for system preference changes
      darkModeMediaQuery.addEventListener("change", handleChange);
      return () => darkModeMediaQuery.removeEventListener("change", handleChange);
    } catch (e) {
      console.error("Error setting up media query listener for dark mode:", e);
      return;
    }
  }, []);

  // Synchronize the DOM classes with the current state
  useEffect(() => {
    if (typeof document === "undefined") return;

    const root = document.documentElement;

    // Remove any potentially conflicting theme classes first
    root.classList.remove("dark", "light", "theme-soft-light", "theme-deep-dark");

    // Apply the correct class based on OS setting
    if (isDarkMode) {
      root.classList.add("dark");
    } else {
      root.classList.add("light");
    }
  }, [isDarkMode]);

  // Disable manual toggle functionality as requested
  const toggleDarkMode = () => {
    console.warn(
      "The dark mode / light mode should follow the operating systems settings - without override for now!",
    );
  };

  return { isDarkMode, toggleDarkMode };
};
