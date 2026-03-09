import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import type { ThemePreference } from "@/hooks/useDarkMode";

// Mock framer-motion and block-website to avoid heavy deps in tests
vi.mock("framer-motion", () => ({
  useReducedMotion: () => true,
}));

vi.mock("@spike-land-ai/block-website/core", () => ({
  triggerViewTransition: (_ref: unknown, fn: () => void) => fn(),
}));

describe("ThemeSwitcher", () => {
  it("renders a toggle button", () => {
    const setTheme = vi.fn();
    render(<ThemeSwitcher theme="light" setTheme={setTheme} />);
    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
  });

  it("has aria-pressed=false when in light mode", () => {
    const setTheme = vi.fn();
    render(<ThemeSwitcher theme={"light" as ThemePreference} setTheme={setTheme} />);
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-pressed", "false");
  });

  it("has aria-pressed=true when in dark mode", () => {
    const setTheme = vi.fn();
    render(<ThemeSwitcher theme={"dark" as ThemePreference} setTheme={setTheme} />);
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-pressed", "true");
  });

  it("calls setTheme with 'dark' when clicking from light mode", () => {
    const setTheme = vi.fn();
    render(<ThemeSwitcher theme={"light" as ThemePreference} setTheme={setTheme} />);
    fireEvent.click(screen.getByRole("button"));
    expect(setTheme).toHaveBeenCalledWith("dark");
  });

  it("calls setTheme with 'light' when clicking from dark mode", () => {
    const setTheme = vi.fn();
    render(<ThemeSwitcher theme={"dark" as ThemePreference} setTheme={setTheme} />);
    fireEvent.click(screen.getByRole("button"));
    expect(setTheme).toHaveBeenCalledWith("light");
  });

  it("renders switch to dark mode label in light mode", () => {
    const setTheme = vi.fn();
    render(<ThemeSwitcher theme={"light" as ThemePreference} setTheme={setTheme} />);
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-label", "Switch to dark mode");
  });

  it("renders switch to light mode label in dark mode", () => {
    const setTheme = vi.fn();
    render(<ThemeSwitcher theme={"dark" as ThemePreference} setTheme={setTheme} />);
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-label", "Switch to light mode");
  });
});
