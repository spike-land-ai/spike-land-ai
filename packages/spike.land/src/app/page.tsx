import dynamic from "next/dynamic";
import { BlogPreviewSection } from "@/components/landing/BlogPreviewSection";
import { AppShowcaseSection } from "@/components/landing/AppShowcaseSection";
import { CreateCTASection } from "@/components/landing/CreateCTASection";
import { LandingHero } from "@/components/landing/LandingHero";
import { McpShowcaseSection } from "@/components/landing/McpShowcaseSection";
import { ThreePillarsSection } from "@/components/landing/ThreePillarsSection";
import { LandingPageStructuredData } from "@/components/seo/LandingPageStructuredData";
import { ScrollToTopButton } from "@/components/ui/scroll-to-top";
import { getLatestShowcaseApps } from "@/lib/landing/showcase-feed";
import { logger } from "@/lib/logger";

// PersonalizedWelcome is purely client-side (API fetch in useEffect) — skip SSR
// and defer hydration so it doesn't block the initial page paint
const PersonalizedWelcome = dynamic(
  () =>
    import("@/components/landing/PersonalizedWelcome").then((m) => ({
      default: m.PersonalizedWelcome,
    })),
  { ssr: false },
);

// Revalidate every 5 minutes so stats stay fresh
export const revalidate = 300;

export default async function Home() {
  let showcaseApps: Awaited<ReturnType<typeof getLatestShowcaseApps>> = [];
  try {
    showcaseApps = await Promise.race([
      getLatestShowcaseApps(10),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Showcase apps fetch timed out")), 5000)
      ),
    ]);
  } catch (e) {
    logger.error("Failed to load landing page data:", e);
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <LandingPageStructuredData />

      <section aria-label="Hero">
        <LandingHero />
      </section>

      <section aria-label="Personalized welcome" className="py-4">
        <PersonalizedWelcome />
      </section>

      <section aria-label="Platform pillars" className="py-16">
        <ThreePillarsSection />
      </section>

      <section aria-label="App showcase" className="py-16">
        <AppShowcaseSection apps={showcaseApps} />
      </section>

      <section aria-label="MCP tools" className="py-16">
        <McpShowcaseSection />
      </section>

      <section aria-label="Blog" className="py-16">
        <BlogPreviewSection />
      </section>

      <section aria-label="Get started" className="py-20">
        <CreateCTASection />
      </section>

      <ScrollToTopButton />
    </div>
  );
}
