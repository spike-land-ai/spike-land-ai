import { useEffect, useState } from "react";
import { BlogPreviewSection } from "@/components/landing/BlogPreviewSection";
import { AppShowcaseSection } from "@/components/landing/AppShowcaseSection";
import { CreateCTASection } from "@/components/landing/CreateCTASection";
import { LandingHero } from "@/components/landing/LandingHero";
import { McpShowcaseSection } from "@/components/landing/McpShowcaseSection";
import { PersonalizedWelcome } from "@/components/landing/PersonalizedWelcome";
import { ThreePillarsSection } from "@/components/landing/ThreePillarsSection";
import { ScrollToTopButton } from "@/components/ui/scroll-to-top";
import { fallbackShowcaseApps } from "@/components/landing/gallery-fallback-data";

export default function Home() {
  const [showcaseApps] = useState(fallbackShowcaseApps);

  useEffect(() => {
    // In the future, fetch showcase apps from the new backend API here
    // fetch("/api/showcase-apps").then(r => r.json()).then(setShowcaseApps);
  }, []);

  return (
    <main className="relative min-h-screen bg-background overflow-x-hidden text-foreground w-full">
      {/* Ambient mesh gradient layer — static, non-interactive */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden opacity-50 dark:opacity-100">
        {/* Top-left violet orb */}
        <div className="absolute -top-40 -left-40 h-[700px] w-[700px] rounded-full bg-violet-600/10 blur-[180px]" />
        {/* Top-right cyan orb */}
        <div className="absolute -top-20 right-0 h-[600px] w-[600px] rounded-full bg-cyan-500/8 blur-[160px]" />
        {/* Mid-page emerald orb */}
        <div className="absolute top-[55%] -left-32 h-[500px] w-[500px] rounded-full bg-emerald-600/8 blur-[140px]" />
        {/* Bottom-right pink orb */}
        <div className="absolute bottom-0 right-0 h-[600px] w-[600px] rounded-full bg-pink-600/8 blur-[160px]" />
      </div>

      <div className="relative z-10 pb-20">
        <LandingHero />

        {/* Section divider — hairline gradient */}
        <div aria-hidden="true" className="mx-auto max-w-5xl px-4">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
        </div>

        <PersonalizedWelcome />
        <ThreePillarsSection />

        {/* Section divider */}
        <div aria-hidden="true" className="mx-auto max-w-5xl px-4">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
        </div>

        <AppShowcaseSection apps={showcaseApps} />

        {/* Section divider */}
        <div aria-hidden="true" className="mx-auto max-w-5xl px-4">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
        </div>

        <McpShowcaseSection />

        {/* Section divider */}
        <div aria-hidden="true" className="mx-auto max-w-5xl px-4">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
        </div>

        <BlogPreviewSection />
        <CreateCTASection />
      </div>
      <ScrollToTopButton />
    </main>
  );
}
