"use client";

import { reportErrorBoundary } from "@/lib/errors/console-capture.client";
import Link from "next/link";
import { useEffect } from "react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function BlogError({ error, reset }: ErrorProps) {
  useEffect(() => {
    reportErrorBoundary(error);
  }, [error]);

  return (
    <div className="container mx-auto px-4 md:px-6 max-w-7xl pt-24 pb-24">
      <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
        <h1 className="mb-2 text-2xl font-bold">Blog Unavailable</h1>
        <p className="mb-8 text-muted-foreground max-w-md">
          We could not load the blog. Please try again.
        </p>
        <div className="flex gap-3">
          <button
            onClick={reset}
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Try Again
          </button>
          <Link
            href="/"
            className="rounded-lg border px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-muted"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
