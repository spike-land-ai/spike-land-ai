import { useAuth } from "../hooks/useAuth";
import { Navigate } from "@tanstack/react-router";
import type { ReactNode } from "react";

interface AuthGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
}

function AuthLoadingSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading protected content"
      aria-live="polite"
      className="w-full animate-pulse space-y-6 px-4 py-8"
    >
      {/* Page header skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-7 w-40 rounded-lg bg-muted" />
        <div className="h-8 w-24 rounded-lg bg-muted" />
      </div>

      {/* Content card skeletons */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-[var(--radius-panel)] border border-border bg-card p-5 space-y-3"
          >
            <div className="h-5 w-3/4 rounded-md bg-muted" />
            <div className="h-4 w-full rounded-md bg-muted" />
            <div className="h-4 w-5/6 rounded-md bg-muted" />
            <div className="h-8 w-1/2 rounded-md bg-muted mt-2" />
          </div>
        ))}
      </div>

      {/* Table / list skeleton */}
      <div className="rounded-[var(--radius-panel)] border border-border bg-card overflow-hidden">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-border/50 px-5 py-4 last:border-b-0"
          >
            <div className="h-8 w-8 flex-shrink-0 rounded-xl bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/3 rounded-md bg-muted" />
              <div className="h-3 w-1/2 rounded-md bg-muted" />
            </div>
            <div className="h-6 w-16 rounded-full bg-muted" />
          </div>
        ))}
      </div>

      {/* Screen-reader announcement */}
      <span className="sr-only">Verifying your session, please wait.</span>
    </div>
  );
}

export function AuthGuard({ children, fallback }: AuthGuardProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const returnUrl = window.location.pathname + window.location.search;

  if (isLoading) {
    return <AuthLoadingSkeleton />;
  }

  if (!isAuthenticated) {
    if (fallback) {
      return <>{fallback}</>;
    }
    return <Navigate to="/login" search={{ returnUrl }} />;
  }

  return <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">{children}</div>;
}
