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
import { useEffect } from "react";

function isStaleDeploymentError(error: Error): boolean {
  if (typeof error.message !== "string") return false;
  return (
    error.message.includes("Failed to find Server Action")
    || (error.message.includes("Loading chunk")
      && error.message.includes("failed"))
  );
}

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string; };
  reset: () => void;
}) {
  useEffect(() => {
    if (isStaleDeploymentError(error)) {
      // Auto-reload once to pick up the new deployment.
      // Guard with sessionStorage to prevent infinite reload loops.
      try {
        const key = "stale-deployment-reload";
        const last = sessionStorage.getItem(key);
        const now = Date.now();
        if (!last || now - parseInt(last, 10) > 10_000) {
          sessionStorage.setItem(key, String(now));
          window.location.reload();
          return;
        }
      } catch {
        // sessionStorage unavailable (private browsing, etc.) — fall through
      }
      // If we already reloaded recently, don't report (expected noise)
      return;
    }

    reportErrorBoundary(error);
  }, [error]);

  if (isStaleDeploymentError(error)) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Page Update Available</CardTitle>
            <CardDescription>
              A newer version of this page is available.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertTitle>Refresh Required</AlertTitle>
              <AlertDescription>
                This page was loaded from an older deployment. Please refresh to get the latest
                version.
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter className="flex gap-2">
            <Button
              onClick={() => window.location.reload()}
              variant="default"
            >
              Refresh Page
            </Button>
            <Button
              onClick={() => (window.location.href = "/")}
              variant="outline"
            >
              Go home
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-destructive">
            Something went wrong!
          </CardTitle>
          <CardDescription>
            We encountered an unexpected error. Please try again.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTitle>Error Details</AlertTitle>
            <AlertDescription>
              {error.message || "An unexpected error occurred"}
            </AlertDescription>
          </Alert>
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button onClick={reset} variant="default">
            Try again
          </Button>
          <Button onClick={() => window.location.href = "/"} variant="outline">
            Go home
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
