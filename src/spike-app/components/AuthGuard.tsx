import { useAuth } from "@/hooks/useAuth";
import { Navigate, useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";

interface AuthGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function AuthGuard({ children, fallback }: AuthGuardProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 animate-in fade-in duration-500">
        <div className="relative flex items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary/20" />
          <div className="absolute h-4 w-4 animate-pulse rounded-full bg-primary" />
        </div>
        <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground/50 animate-pulse">
          Verifying Identity
        </p>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (fallback) {
      return <>{fallback}</>;
    }
    return <Navigate to="/login" search={{ returnUrl: location.pathname }} />;
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
      {children}
    </div>
  );
}
