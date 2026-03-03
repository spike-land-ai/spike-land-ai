"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const [pathname, setPathname] = useState("");
  const logged = useRef(false);

  useEffect(() => {
    const path = typeof window !== "undefined" ? window.location.pathname : "";
    setPathname(path);

    // Fire-and-forget 404 log
    if (!logged.current && path) {
      logged.current = true;
      const payload = JSON.stringify({
        url: path,
        referrer: document.referrer || null,
        timestamp: Date.now(),
      });

      if (navigator.sendBeacon) {
        navigator.sendBeacon(
          "/api/404-log",
          new Blob([payload], { type: "application/json" }),
        );
      } else {
        fetch("/api/404-log", {
          method: "POST",
          body: payload,
          headers: { "Content-Type": "application/json" },
          keepalive: true,
        }).catch(() => {});
      }
    }
  }, []);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      {/* Aurora gradient blobs */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-cyan-500/20 blur-3xl animate-float-slow" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-violet-500/20 blur-3xl animate-float-slow-reverse" />
      <div className="bg-noise pointer-events-none absolute inset-0" />

      <div className="relative z-10 flex flex-col items-center gap-6">
        {/* Giant 404 */}
        <h1 className="font-heading select-none text-[8rem] leading-none font-black tracking-tighter sm:text-[12rem] bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent animate-gradient-x">
          404
        </h1>

        {/* Glass card */}
        <div className="glass-1 mx-auto max-w-md rounded-2xl p-8 text-center">
          <h2 className="text-2xl font-semibold text-foreground">
            Lost in the void
          </h2>
          <p className="mt-2 text-muted-foreground">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>

          {pathname && (
            <code className="mt-4 inline-block rounded-lg bg-cyan-500/10 px-3 py-1.5 font-mono text-sm text-cyan-400">
              {pathname}
            </code>
          )}

          <div className="mt-6 flex items-center justify-center gap-3">
            <Button asChild>
              <Link href="/">Go Home</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/store">Explore Store</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
