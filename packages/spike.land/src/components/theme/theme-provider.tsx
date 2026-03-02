"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ThemeProviderProps } from "next-themes";

interface ExtendedThemeProviderProps extends ThemeProviderProps {
  /** CSP nonce for inline script execution */
  nonce?: string;
}

export function ThemeProvider({ children, nonce, ...props }: ExtendedThemeProviderProps) {
  return (
    <NextThemesProvider attribute="class" {...(nonce !== undefined ? { nonce } : {})} {...props}>
      {children}
    </NextThemesProvider>
  );
}
