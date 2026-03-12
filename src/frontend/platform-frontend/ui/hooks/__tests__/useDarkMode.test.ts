import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDarkMode } from "../useDarkMode";

describe("useDarkMode", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark", "light");
    // Reset matchMedia to return light mode by default
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  });

  it("defaults to light theme when no preference stored", () => {
    const { result } = renderHook(() => useDarkMode());
    expect(result.current.theme).toBe("light");
  });

  it("loads stored dark preference", () => {
    localStorage.setItem("theme-preference", "dark");
    const { result } = renderHook(() => useDarkMode());
    expect(result.current.theme).toBe("dark");
    expect(result.current.isDarkMode).toBe(true);
  });

  it("loads stored light preference", () => {
    localStorage.setItem("theme-preference", "light");
    const { result } = renderHook(() => useDarkMode());
    expect(result.current.theme).toBe("light");
    expect(result.current.isDarkMode).toBe(false);
  });

  it("setTheme('dark') updates state and localStorage", async () => {
    const { result } = renderHook(() => useDarkMode());

    await act(async () => {
      result.current.setTheme("dark");
    });

    expect(result.current.theme).toBe("dark");
    expect(result.current.isDarkMode).toBe(true);
    expect(localStorage.getItem("theme-preference")).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("setTheme('light') updates state and removes dark class", async () => {
    localStorage.setItem("theme-preference", "dark");
    const { result } = renderHook(() => useDarkMode());

    await act(async () => {
      result.current.setTheme("light");
    });

    expect(result.current.theme).toBe("light");
    expect(result.current.isDarkMode).toBe(false);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.documentElement.classList.contains("light")).toBe(true);
  });

  it("isDarkMode is false when theme is light", () => {
    const { result } = renderHook(() => useDarkMode());
    expect(result.current.isDarkMode).toBe(false);
  });

  it("isDarkMode is true when theme is dark", () => {
    localStorage.setItem("theme-preference", "dark");
    const { result } = renderHook(() => useDarkMode());
    expect(result.current.isDarkMode).toBe(true);
  });

  it("toggleTheme switches between light and dark", async () => {
    const { result } = renderHook(() => useDarkMode());
    expect(result.current.theme).toBe("light");

    await act(async () => {
      result.current.toggleTheme();
    });

    expect(result.current.theme).toBe("dark");
    expect(result.current.isDarkMode).toBe(true);
  });

  it("responds to storage events from other tabs", async () => {
    const { result } = renderHook(() => useDarkMode());
    expect(result.current.theme).toBe("light");

    await act(async () => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "theme-preference",
          newValue: "dark",
        }),
      );
    });

    expect(result.current.theme).toBe("dark");
  });
});
