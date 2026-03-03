"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  componentName?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * Error boundary for interactive blog components.
 * Catches runtime errors from Framer Motion animations, scroll hooks,
 * and dynamic imports, displaying a minimal fallback so the rest of
 * the blog post continues to render.
 */
export class InteractiveBlogErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    // Log to console in development; in production a real error reporter would go here
    if (process.env.NODE_ENV !== "production") {
      console.error(
        `[InteractiveBlogErrorBoundary] Component "${this.props.componentName ?? "unknown"}" threw:`,
        error,
        info.componentStack,
      );
    }
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="w-full aspect-video bg-muted/30 border border-border rounded-xl my-16 flex items-center justify-center">
          <p className="text-sm text-muted-foreground font-mono">
            Interactive component unavailable
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
