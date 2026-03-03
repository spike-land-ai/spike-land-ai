"use client";

import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import { Rocket, Terminal } from "lucide-react";

export function PlatformHero() {
  return (
    <section className="relative overflow-hidden pt-24 pb-8">
      <div className="container mx-auto px-4 py-16 sm:py-24">
        <div className="mx-auto max-w-5xl text-center">
          {/* Main headline */}
          <h1 className="mb-6 text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl text-foreground">
            Ship apps. <span className="text-gradient-primary">Not infrastructure.</span>
          </h1>

          {/* Subheadline */}
          <p className="mx-auto mb-6 max-w-2xl text-lg text-muted-foreground sm:text-xl leading-relaxed">
            spike-cli multiplexes MCP servers and lazy-loads tool definitions — AI agents see only
            the tools they need. Deploy apps from a prompt, zero config.
          </p>
          <p className="mx-auto mb-12 text-base text-muted-foreground/80">
            Free to start -- no credit card required.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col gap-5 sm:flex-row sm:justify-center">
            <Button
              asChild
              size="lg"
              className="text-lg font-semibold px-10 py-6"
            >
              <Link href="/waitlist">
                <Rocket className="mr-2 h-5 w-5" />
                Get Started Free
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="text-lg font-semibold px-10 py-6"
            >
              <Link href="/docs">
                <Terminal className="mr-2 h-5 w-5" />
                Read the Docs
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Decorative gradient orbs */}
      <div className="absolute top-20 right-10 h-64 w-64 bg-primary/10 rounded-full blur-3xl pointer-events-none hidden lg:block" />
      <div className="absolute bottom-20 left-10 h-48 w-48 bg-accent/10 rounded-full blur-3xl pointer-events-none hidden lg:block" />
    </section>
  );
}
