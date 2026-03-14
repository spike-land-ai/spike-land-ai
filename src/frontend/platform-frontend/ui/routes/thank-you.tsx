import { useEffect, useRef, useState } from "react";
import { trackAnalyticsEvent } from "../hooks/useAnalytics";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReceiptInfo {
  amount: string | null;
  slug: string | null;
  tier: string | null;
  type: "donation" | "migration" | "unknown";
}

// ─── Confetti ─────────────────────────────────────────────────────────────────

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
}

const CONFETTI_COLORS = [
  "#6366f1", // primary (indigo)
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#f59e0b", // amber
  "#10b981", // emerald
  "#3b82f6", // blue
];

function useConfetti(active: boolean) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Size canvas to viewport
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Spawn particles from the top
    particlesRef.current = Array.from({ length: 120 }, () => ({
      x: Math.random() * canvas.width,
      y: -10 - Math.random() * 40,
      vx: (Math.random() - 0.5) * 4,
      vy: 2 + Math.random() * 4,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)] ?? "#6366f1",
      size: 6 + Math.random() * 8,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.2,
      opacity: 1,
    }));

    let done = false;

    function draw() {
      if (done || !canvas || !ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particlesRef.current = particlesRef.current.filter((p) => p.opacity > 0.05);

      for (const p of particlesRef.current) {
        ctx.save();
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();

        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.1; // gravity
        p.rotation += p.rotationSpeed;
        if (p.y > canvas.height) p.opacity -= 0.05;
      }

      if (particlesRef.current.length > 0) {
        rafRef.current = requestAnimationFrame(draw);
      } else {
        done = true;
      }
    }

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      done = true;
      cancelAnimationFrame(rafRef.current);
    };
  }, [active]);

  return canvasRef;
}

// ─── Receipt helpers ──────────────────────────────────────────────────────────

function parseReceiptInfo(): ReceiptInfo {
  if (typeof window === "undefined") {
    return { amount: null, slug: null, tier: null, type: "unknown" };
  }

  const params = new URLSearchParams(window.location.search);
  const slug = params.get("slug") ?? params.get("s");
  const tier = params.get("success"); // from migration-checkout success_url (?success=blog)
  const amount = params.get("amount");

  if (tier) {
    return { amount, slug, tier, type: "migration" };
  }

  if (params.has("supported")) {
    return { amount, slug, tier: null, type: "donation" };
  }

  return { amount, slug, tier: null, type: "unknown" };
}

const TIER_LABELS: Record<string, string> = {
  blog: "Blog Post Migration",
  script: "CLI Script",
  mcp: "MCP Server",
};

// ─── ShareButton ──────────────────────────────────────────────────────────────

function ShareButton() {
  const [copied, setCopied] = useState(false);

  function handleShare() {
    const text = "I just supported spike.land — 80+ MCP tools built by indie devs. Check it out!";
    const url = "https://spike.land";

    if (navigator.share) {
      void navigator.share({ title: "spike.land", text, url });
      return;
    }

    // Fallback: copy to clipboard
    void navigator.clipboard.writeText(`${text} ${url}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className="inline-flex items-center gap-2 rounded-2xl border border-border bg-muted/60 px-5 py-2.5 text-sm font-bold text-muted-foreground hover:border-primary/40 hover:text-foreground active:scale-95 transition-all duration-200"
    >
      {copied ? (
        <>
          <svg
            className="h-4 w-4 text-primary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Copied!
        </>
      ) : (
        <>
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
            />
          </svg>
          Share
        </>
      )}
    </button>
  );
}

// ─── ThankYouPage ─────────────────────────────────────────────────────────────

export function ThankYouPage() {
  const receipt = parseReceiptInfo();
  const [confettiActive, setConfettiActive] = useState(false);
  const canvasRef = useConfetti(confettiActive);

  useEffect(() => {
    // Small delay so the DOM is ready before firing confetti
    const t = setTimeout(() => setConfettiActive(true), 150);

    trackAnalyticsEvent("thank_you_page_view", {
      type: receipt.type,
      tier: receipt.tier,
    });

    return () => clearTimeout(t);
  }, [receipt.type, receipt.tier]);

  const tierLabel = receipt.tier ? (TIER_LABELS[receipt.tier] ?? receipt.tier) : null;

  return (
    <div className="relative min-h-[60vh] flex items-center justify-center p-6">
      {/* Confetti canvas — pointer-events-none so it doesn't block clicks */}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-50"
      />

      <div className="w-full max-w-md text-center space-y-6">
        {/* Big emoji */}
        <div className="text-6xl" aria-hidden="true" style={{ animation: "bounce 0.6s ease-out" }}>
          {receipt.type === "migration" ? "🚀" : "🙏"}
        </div>

        {/* Heading */}
        <div className="space-y-2">
          <h1 className="text-3xl font-black tracking-tight text-foreground">
            {receipt.type === "migration" ? "You're officially in!" : "Thank you so much!"}
          </h1>
          <p className="text-muted-foreground font-medium">
            {receipt.type === "migration"
              ? "Your commission has been received. Radix will be in touch within 24h."
              : "Your support keeps spike.land running and independent."}
          </p>
        </div>

        {/* Receipt card */}
        <div className="rounded-2xl border border-border bg-card p-5 text-left space-y-3">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground/50">
            Receipt
          </p>

          {receipt.type === "migration" && tierLabel && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Service</span>
              <span className="text-sm font-bold text-foreground">{tierLabel}</span>
            </div>
          )}

          {receipt.type === "donation" && receipt.slug && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Article</span>
              <span className="text-sm font-bold text-foreground truncate max-w-[160px]">
                {receipt.slug}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status</span>
            <span className="inline-flex items-center gap-1.5 text-sm font-bold text-primary">
              <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
              Confirmed
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <a
            href="/"
            className="inline-flex items-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 active:scale-[0.97] transition-all duration-200"
          >
            Back to spike.land
          </a>
          <ShareButton />
        </div>

        {receipt.type === "migration" && (
          <p className="text-xs text-muted-foreground/70">
            Questions? Email{" "}
            <a
              href="mailto:hello@spike.land"
              className="text-primary underline hover:text-primary/80"
            >
              hello@spike.land
            </a>
          </p>
        )}
      </div>

      <style>{`
        @keyframes bounce {
          0%   { transform: scale(0.3); opacity: 0; }
          60%  { transform: scale(1.1); }
          80%  { transform: scale(0.95); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
