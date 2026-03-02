import NextLink from "next/link.js";

// Mock ViewTransitions component - just renders children
export function ViewTransitions({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

// Mock Link component - wraps Next.js Link
export const Link = NextLink;

// Mock useTransitionRouter - returns Next.js router-like object
export function useTransitionRouter() {
  return {
    push: (href: string) => {
      if (typeof window !== "undefined") {
        window.location.href = href;
      }
    },
    replace: (href: string) => {
      if (typeof window !== "undefined") {
        window.location.replace(href);
      }
    },
    back: () => {
      if (typeof window !== "undefined") {
        window.history.back();
      }
    },
    forward: () => {
      if (typeof window !== "undefined") {
        window.history.forward();
      }
    },
  };
}
