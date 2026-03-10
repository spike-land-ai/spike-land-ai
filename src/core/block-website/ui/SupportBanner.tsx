import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@spike-land-ai/shared";
import { apiUrl } from "../core-logic/api";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SupportBannerProps {
  variant: "blog" | "migration";
  slug?: string; // required for blog variant
  onTrackEvent?: (event: string, data?: Record<string, unknown>) => void;
}

// ─── Migration tier config ────────────────────────────────────────────────────

const MIGRATION_TIERS = [
  {
    id: "blog",
    label: "Blog",
    price: "$420",
    tagline: "One post, end-to-end",
    href: "/migrate#tier-blog",
  },
  {
    id: "script",
    label: "Script",
    price: "£1,000",
    tagline: "Full migration script",
    href: "/migrate#tier-script",
  },
  {
    id: "mcp",
    label: "MCP",
    price: "$10,000",
    tagline: "Production MCP server",
    href: "/migrate#tier-mcp",
  },
] as const;

// ─── Quick donate preset amounts (GBP) ───────────────────────────────────────

const DONATE_PRESETS = [3, 5, 10] as const;

// ─── Utilities ────────────────────────────────────────────────────────────────

function getClientId(): string {
  const key = "spike_client_id";
  try {
    let id = localStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(key, id);
    }
    return id;
  } catch {
    // SSR or private-browsing fallback — ephemeral ID
    return crypto.randomUUID();
  }
}

// ─── Blog Banner ─────────────────────────────────────────────────────────────

function BlogBanner({
  slug,
  onTrackEvent,
}: {
  slug: string;
  onTrackEvent?: SupportBannerProps["onTrackEvent"];
}) {
  const [bumped, setBumped] = useState(false);
  const [bumpCount, setBumpCount] = useState(0);
  const [bumpAnimating, setBumpAnimating] = useState(false);
  const [donatingAmount, setDonatingAmount] = useState<number | null>(null);
  const bumpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restore bumped state and fetch engagement counts
  useEffect(() => {
    try {
      if (localStorage.getItem(`spike_bumped_${slug}`)) {
        setBumped(true);
      }
    } catch {
      /* localStorage unavailable */
    }

    fetch(apiUrl(`/support/engagement/${encodeURIComponent(slug)}`))
      .then((r) => (r.ok ? (r.json() as Promise<{ fistBumps: number; supporters: number }>) : null))
      .then((data) => {
        if (data) setBumpCount(data.fistBumps);
      })
      .catch(() => {});
  }, [slug]);

  useEffect(() => {
    return () => {
      if (bumpTimerRef.current !== null) clearTimeout(bumpTimerRef.current);
    };
  }, []);

  const handleBump = useCallback(async () => {
    if (bumped) return;
    onTrackEvent?.("support_fistbump", { slug });

    setBumpAnimating(true);
    if (bumpTimerRef.current !== null) clearTimeout(bumpTimerRef.current);
    bumpTimerRef.current = setTimeout(() => setBumpAnimating(false), 650);

    try {
      const res = await fetch(apiUrl("/support/fistbump"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, clientId: getClientId() }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { count: number };
      setBumpCount(data.count);
      setBumped(true);
      try {
        localStorage.setItem(`spike_bumped_${slug}`, "1");
      } catch {
        /* best-effort */
      }
    } catch {
      /* non-critical — animation already played */
    }
  }, [bumped, slug, onTrackEvent]);

  const handleDonate = useCallback(
    async (amount: number) => {
      onTrackEvent?.("support_donate_click", { slug, amount });
      setDonatingAmount(amount);
      try {
        const res = await fetch(apiUrl("/support/donate"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, amount, clientId: getClientId() }),
        });
        if (!res.ok) {
          setDonatingAmount(null);
          return;
        }
        const data = (await res.json()) as { url?: string };
        if (data.url) {
          // Only redirect to same-origin or trusted domains
          try {
            const target = new URL(data.url, window.location.origin);
            const trusted = ["spike.land", "checkout.stripe.com"];
            if (
              target.origin === window.location.origin ||
              trusted.some((d) => target.hostname === d || target.hostname.endsWith(`.${d}`))
            ) {
              window.location.href = data.url;
            } else {
              setDonatingAmount(null);
            }
          } catch {
            setDonatingAmount(null);
          }
        } else {
          setDonatingAmount(null);
        }
      } catch {
        setDonatingAmount(null);
      }
    },
    [slug, onTrackEvent],
  );

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border/60 p-5 sm:p-6",
        "bg-gradient-to-br from-card via-card to-primary/[0.04]",
        "shadow-lg shadow-black/5",
      )}
    >
      {/* Subtle ambient glow */}
      <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/5" />
      <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-primary/5 blur-3xl" />

      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        {/* Left: fist bump */}
        <div className="flex items-center gap-4 min-w-0">
          <button
            onClick={handleBump}
            disabled={bumped}
            aria-label={bumped ? "Already fist-bumped" : "Fist bump this post"}
            className={cn(
              "relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border text-xl transition-all duration-300 select-none",
              bumped
                ? "border-primary/20 bg-primary/10 text-primary cursor-default"
                : "border-border bg-muted hover:border-primary/40 hover:bg-primary/10 hover:scale-110 active:scale-95 cursor-pointer",
              bumpAnimating && "scale-125 rotate-[20deg]",
            )}
          >
            {/* Ripple on bump */}
            {bumpAnimating && (
              <span className="absolute inset-0 rounded-2xl animate-ping bg-primary/20" />
            )}
            <span
              className={cn(
                "transition-transform duration-300",
                bumpAnimating ? "scale-125" : "scale-100",
              )}
            >
              {bumped ? "✊" : "🤜"}
            </span>
          </button>

          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground leading-snug">
              {bumped ? "Thanks for the love!" : "Enjoyed this? Fist bump it."}
            </p>
            {bumpCount > 0 && (
              <p
                aria-live="polite"
                className="text-[11px] font-semibold text-muted-foreground/70 mt-0.5 tabular-nums"
              >
                {bumpCount.toLocaleString()} {bumpCount === 1 ? "bump" : "bumps"}
              </p>
            )}
          </div>
        </div>

        {/* Right: quick donate */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap sm:shrink-0">
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 mr-1 hidden sm:block">
            Support
          </span>
          {DONATE_PRESETS.map((amount) => (
            <button
              key={amount}
              onClick={() => handleDonate(amount)}
              disabled={donatingAmount !== null}
              aria-label={`Donate £${amount}`}
              className={cn(
                "h-9 px-4 rounded-xl border text-xs font-bold tabular-nums transition-all duration-200",
                donatingAmount === amount
                  ? "border-primary bg-primary/10 text-primary cursor-wait"
                  : "border-border bg-muted/60 text-muted-foreground hover:border-primary/50 hover:text-foreground hover:bg-primary/5 active:scale-95",
              )}
            >
              {donatingAmount === amount ? "..." : `£${amount}`}
            </button>
          ))}
          <button
            onClick={() => {
              onTrackEvent?.("support_donate_click", { slug, amount: "custom" });
              window.location.href = `/support?slug=${encodeURIComponent(slug)}&ref=banner`;
            }}
            disabled={donatingAmount !== null}
            className={cn(
              "h-9 px-4 rounded-xl border text-xs font-bold transition-all duration-200",
              "border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 active:scale-95",
            )}
          >
            Custom
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Migration Banner ─────────────────────────────────────────────────────────

function MigrationBanner({ onTrackEvent }: { onTrackEvent?: SupportBannerProps["onTrackEvent"] }) {
  const handleTierClick = useCallback(
    (tierId: string, price: string) => {
      onTrackEvent?.("migration_tier_click", { tier: tierId, price });

      // Google Ads conversion tracking (fires if gtag is available on the page)
      if (typeof window !== "undefined" && "gtag" in window) {
        (window as unknown as { gtag: (...args: unknown[]) => void }).gtag("event", "conversion", {
          send_to: "AW-17978085462/migration_tier_click",
          event_category: "migration",
          event_label: tierId,
          value: price,
        });
      }
    },
    [onTrackEvent],
  );

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border/60 p-5 sm:p-6",
        "bg-gradient-to-br from-card via-card to-primary/[0.06]",
        "shadow-lg shadow-black/5",
      )}
    >
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/5" />
      <div className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-primary/8 blur-3xl" />

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Headline */}
        <div className="shrink-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-primary/70 mb-1">
            Migration service
          </p>
          <h3 className="text-lg font-black tracking-tight text-foreground leading-tight">
            Ready to migrate?
          </h3>
          <p className="text-xs text-muted-foreground font-medium mt-0.5">
            Edge-first. MCP-native. Shipped fast.
          </p>
        </div>

        {/* Tier cards */}
        <div className="flex items-stretch gap-2 sm:gap-3 flex-wrap sm:flex-nowrap">
          {MIGRATION_TIERS.map((tier) => (
            <a
              key={tier.id}
              href={tier.href}
              onClick={() => handleTierClick(tier.id, tier.price)}
              className={cn(
                "group flex flex-col items-center gap-0.5 min-w-[82px] flex-1 sm:flex-none",
                "rounded-xl border border-border bg-muted/50 px-3 py-3",
                "text-center transition-all duration-200",
                "hover:border-primary/50 hover:bg-primary/5 hover:shadow-md hover:shadow-primary/5",
                "active:scale-95",
              )}
            >
              <span className="text-base font-black text-foreground leading-none group-hover:text-primary transition-colors">
                {tier.price}
              </span>
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 group-hover:text-primary/70 transition-colors">
                {tier.label}
              </span>
              <span className="text-[10px] text-muted-foreground/50 font-medium leading-tight mt-0.5 hidden sm:block">
                {tier.tagline}
              </span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Public export ────────────────────────────────────────────────────────────

export function SupportBanner({ variant, slug, onTrackEvent }: SupportBannerProps) {
  if (variant === "migration") {
    return <MigrationBanner onTrackEvent={onTrackEvent} />;
  }

  if (!slug) {
    // Guard: blog variant requires a slug — fail silently in production
    if (process.env.NODE_ENV !== "production") {
      console.warn("[SupportBanner] variant='blog' requires a `slug` prop.");
    }
    return null;
  }

  return <BlogBanner slug={slug} onTrackEvent={onTrackEvent} />;
}
