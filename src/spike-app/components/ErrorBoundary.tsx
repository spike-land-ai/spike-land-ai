import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { reportError } from "@/lib/reportError";
import { Button } from "@/shared/ui/button";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
    reportError(error, {
      severity: "fatal",
      metadata: { componentStack: info.componentStack ?? undefined },
    });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex min-h-[400px] w-full flex-col items-center justify-center p-8 text-center bg-card rounded-3xl border border-destructive/20 shadow-xl shadow-destructive/5 animate-in fade-in zoom-in-95 duration-500">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-6 relative">
            <AlertTriangle className="h-10 w-10 animate-pulse" />
            <div className="absolute inset-0 rounded-full bg-destructive/5 animate-ping duration-1000" />
          </div>
          
          <h2 className="text-2xl font-black tracking-tight text-foreground mb-3">
            Ouch! Something broke.
          </h2>
          
          <div className="max-w-md mx-auto space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              We've encountered an unexpected error. Our engineers have been notified and are looking into it.
            </p>
            
            {this.state.error && (
              <div className="rounded-xl bg-destructive/5 border border-destructive/10 p-4 text-left overflow-hidden">
                <p className="text-[11px] font-bold uppercase tracking-wider text-destructive/70 mb-1">
                  Error Details
                </p>
                <code className="text-[13px] font-mono text-destructive break-all line-clamp-3">
                  {this.state.error.message}
                </code>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
              <Button
                variant="destructive"
                className="w-full sm:w-auto px-8 rounded-xl font-bold"
                onClick={() => window.location.reload()}
              >
                <RefreshCw className="mr-2 size-4" />
                Reload Application
              </Button>
              <Button
                variant="outline"
                className="w-full sm:w-auto px-8 rounded-xl font-bold"
                onClick={() => {
                  window.location.href = "/";
                }}
              >
                <Home className="mr-2 size-4" />
                Go to Home
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
