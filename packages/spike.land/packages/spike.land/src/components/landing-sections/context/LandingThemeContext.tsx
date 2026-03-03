"use client";

import React, { createContext, useContext } from "react";
import type { LandingTheme } from "../themes/types";

interface LandingThemeContextType {
  theme: LandingTheme;
}

const LandingThemeContext = createContext<LandingThemeContextType | undefined>(
  undefined,
);

export function LandingThemeProvider({
  children,
  theme,
}: {
  children: React.ReactNode;
  theme: LandingTheme;
}) {
  return (
    <LandingThemeContext.Provider value={{ theme }}>
      <div
        style={{
          "--landing-bg": theme.colors.background,
          "--landing-fg": theme.colors.foreground,
          "--landing-primary": theme.colors.primary,
          "--landing-primary-fg": theme.colors.primaryForeground,
          "--landing-secondary": theme.colors.secondary,
          "--landing-secondary-fg": theme.colors.secondaryForeground,
          "--landing-accent": theme.colors.accent,
          "--landing-accent-fg": theme.colors.accentForeground,
          "--landing-muted": theme.colors.muted,
          "--landing-muted-fg": theme.colors.mutedForeground,
          "--landing-border": theme.colors.border,
          "--landing-radius": theme.styles.radius,
        } as React.CSSProperties}
        className="w-full min-h-screen bg-[var(--landing-bg)] text-[var(--landing-fg)] transition-colors duration-300"
      >
        {children}
      </div>
    </LandingThemeContext.Provider>
  );
}

export function useLandingTheme() {
  const context = useContext(LandingThemeContext);
  if (context === undefined) {
    throw new Error(
      "useLandingTheme must be used within a LandingThemeProvider",
    );
  }
  return context;
}
