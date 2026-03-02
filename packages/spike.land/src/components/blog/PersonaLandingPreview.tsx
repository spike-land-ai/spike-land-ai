"use client";

import { Link } from "@/components/ui/link";
import { Button } from "@/components/ui/button";
import { getPersonaCookieClient } from "@/lib/onboarding/get-persona-cookie";
import { getLandingPageBySlug } from "@/lib/onboarding/landing-pages";
import type { LandingPageContent } from "@/lib/onboarding/landing-pages";
import { useEffect, useState } from "react";

export function PersonaLandingPreview() {
  const [landing, setLanding] = useState<LandingPageContent | null>(null);
  const [hasPersona, setHasPersona] = useState<boolean | null>(null);

  useEffect(() => {
    const slug = getPersonaCookieClient();
    if (slug) {
      const page = getLandingPageBySlug(slug);
      setLanding(page ?? null);
      setHasPersona(true);
    } else {
      setHasPersona(false);
    }
  }, []);

  if (hasPersona === null) {
    return <div className="my-8 w-full h-48 bg-muted animate-pulse rounded-xl" />;
  }

  if (!hasPersona || !landing) {
    return (
      <div className="my-8 p-6 rounded-xl border border-border bg-card text-center">
        <p className="text-lg font-semibold text-foreground mb-2">Personalise your experience</p>
        <p className="text-muted-foreground mb-4">
          Take the onboarding quiz to see content tailored to your needs.
        </p>
        <Button asChild size="lg">
          <Link href="/onboarding" className="no-underline">
            Start Onboarding
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="my-8 rounded-xl border border-border bg-gradient-to-br from-card to-muted/30 overflow-hidden">
      <div className="p-6 space-y-4">
        <h3 className="font-heading text-2xl font-bold text-foreground">{landing.headline}</h3>
        <p className="text-muted-foreground">{landing.subheadline}</p>

        <div className="space-y-2">
          <h4 className="font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Pain points we solve
          </h4>
          <ul className="space-y-1">
            {landing.painPoints.map((pp) => (
              <li key={pp.title} className="text-foreground">
                <span className="font-semibold">{pp.title}</span>{" "}
                <span className="text-muted-foreground">&mdash; {pp.description}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-2">
          <h4 className="font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Recommended tools
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {landing.features.map((feat) => (
              <div key={feat.appSlug} className="p-3 rounded-lg border border-border bg-card">
                <p className="font-semibold text-foreground text-sm">{feat.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{feat.description}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-sm italic text-muted-foreground">{landing.brightonMessage}</p>

        <div className="pt-2">
          <Button asChild size="lg">
            <Link href={landing.ctaHref} className="no-underline">
              {landing.ctaLabel}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
