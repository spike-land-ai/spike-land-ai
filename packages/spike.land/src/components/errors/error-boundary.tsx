"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { reportErrorBoundary } from "@/lib/errors/console-capture.client";
import { getUserFriendlyError } from "@/lib/errors/error-messages";
import { AlertCircle } from "lucide-react";
import React, { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showDetails?: boolean;
  resetKeys?: unknown[];
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * React Error Boundary component
 * Catches rendering errors and displays fallback UI
 *
 * @example
 * ```tsx
 * <ErrorBoundary>
 *   <MyComponent />
 * </ErrorBoundary>
 * ```
 *
 * @example With custom fallback
 * ```tsx
 * <ErrorBoundary fallback={<div>Custom error UI</div>}>
 *   <MyComponent />
 * </ErrorBoundary>
 * ```
 *
 * @example With error callback
 * ```tsx
 * <ErrorBoundary onError={(error) => console.error(error)}>
 *   <MyComponent />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Report error to tracking service
    reportErrorBoundary(error, errorInfo.componentStack || undefined);

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Update state with error info
    this.setState({
      errorInfo,
    });
  }

  override componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    // Reset error state if resetKeys change
    if (
      this.state.hasError &&
      this.props.resetKeys &&
      prevProps.resetKeys &&
      !this.areResetKeysEqual(prevProps.resetKeys, this.props.resetKeys)
    ) {
      this.resetError();
    }
  }

  areResetKeysEqual(prevKeys: unknown[], nextKeys: unknown[]): boolean {
    if (prevKeys.length !== nextKeys.length) return false;
    return prevKeys.every((key, index) => key === nextKeys[index]);
  }

  resetError = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  override render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      // Render custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Render default error UI
      const userFriendlyError = getUserFriendlyError(this.state.error);

      return (
        <div className="flex min-h-[400px] items-center justify-center p-4">
          <Card className="w-full max-w-lg">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <CardTitle className="text-destructive">{userFriendlyError.title}</CardTitle>
              </div>
              <CardDescription>{userFriendlyError.message}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {userFriendlyError.suggestion && (
                <Alert>
                  <AlertTitle>Suggestion</AlertTitle>
                  <AlertDescription>{userFriendlyError.suggestion}</AlertDescription>
                </Alert>
              )}
              {this.props.showDetails && process.env.NODE_ENV === "development" && (
                <Alert variant="destructive">
                  <AlertTitle>Technical Details (Development Only)</AlertTitle>
                  <AlertDescription className="mt-2 space-y-2">
                    <div className="text-sm">
                      <strong>Error:</strong> {this.state.error.message}
                    </div>
                    {this.state.error.stack && (
                      <pre className="mt-2 overflow-auto rounded bg-muted p-2 text-xs">
                        {this.state.error.stack}
                      </pre>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button onClick={this.resetError} variant="default">
                Try again
              </Button>
              <Button onClick={() => (window.location.href = "/")} variant="outline">
                Go home
              </Button>
            </CardFooter>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Hook-based error boundary wrapper
 * Useful for functional components
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, "children">,
): React.ComponentType<P> {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${
    Component.displayName || Component.name || "Component"
  })`;

  return WrappedComponent;
}
