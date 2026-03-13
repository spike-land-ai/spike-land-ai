import { Heart, Twitter, Linkedin } from "lucide-react";
import { getPersonaSlug, getContentVariant } from "../core-logic/persona-content-variants";
import { SupportBanner } from "./SupportBanner";
import { coerceBooleanProp } from "../core-logic/blog-mdx";

export function PersonalizedSupportBox({
  showMigrationTiers,
}: {
  showMigrationTiers?: boolean | string;
}) {
  const personaSlug = getPersonaSlug();
  const variant = getContentVariant(personaSlug);
  const showTiers = coerceBooleanProp(showMigrationTiers);

  const slug =
    typeof window !== "undefined"
      ? window.location.pathname.replace(/^\/blog\//, "").replace(/\/$/, "")
      : "";

  const pageUrl = typeof window !== "undefined" ? window.location.href : "https://spike.land";
  const shareTitle = "Check out spike.land — 80+ MCP tools built by indie developers";
  const xIntent = `https://x.com/intent/tweet?text=${encodeURIComponent(shareTitle)}&url=${encodeURIComponent(pageUrl)}`;
  const linkedInIntent = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(pageUrl)}`;

  // Show thank-you banner if redirected back from Stripe
  const supported =
    typeof window !== "undefined" && new URLSearchParams(window.location.search).has("supported");

  return (
    <div className="mt-20 space-y-6">
      {/* Thank-you banner */}
      {supported && (
        <div className="rounded-2xl border border-primary/20 bg-primary/8 p-4 text-center text-sm font-bold text-primary">
          Thank you for your support!
        </div>
      )}

      {/* Fistbump + quick donations */}
      {slug && <SupportBanner variant="blog" slug={slug} />}

      {/* Migration tiers */}
      {showTiers && <SupportBanner variant="migration" />}

      {/* Persona-aware support message + social sharing */}
      <div className="p-8 sm:p-12 rounded-[2rem] bg-card border border-border/50 shadow-[var(--panel-shadow)] relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
          <Heart size={200} fill="currentColor" />
        </div>

        <div className="max-w-2xl relative z-10">
          <h3 className="text-3xl font-black tracking-tight mb-4">Support the Journey</h3>

          <p className="text-lg text-muted-foreground/80 font-medium leading-relaxed mb-10">
            {variant.supportCopy}
          </p>

          <div className="flex flex-wrap items-center gap-6">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground/40">
              Spread the Word
            </p>
            <a
              href={xIntent}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-bold text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5"
            >
              <Twitter size={14} /> X / Twitter
            </a>
            <a
              href={linkedInIntent}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-bold text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5"
            >
              <Linkedin size={14} /> LinkedIn
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
