import { useState } from "react";
import { apiUrl } from "../../core-logic/api";
import { usePricing } from "../hooks/usePricing";
import { trackAnalyticsEvent } from "../hooks/useAnalytics";
import { Button } from "../shared/ui/button";
import { Zap, Coins, Trophy, CreditCard, Sparkles, Check } from "lucide-react";
import { cn } from "../../styling/cn";

interface CreditPack {
  id: string;
  label: string;
  price: number;
  formattedPrice: string;
  credits: number;
  highlighted: boolean;
  icon: typeof Zap;
}

async function purchaseCredits(credits: number): Promise<void> {
  const res = await fetch(apiUrl("/credits/purchase"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pack: credits }),
  });

  if (!res.ok) {
    const err = (await res.json()) as { error?: string };
    throw new Error(err.error ?? "Purchase failed");
  }

  const data = (await res.json()) as { url?: string };
  if (data.url) {
    window.location.href = data.url;
  }
}

function PackCard({ pack }: { pack: CreditPack }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const perCredit = (pack.price / pack.credits).toFixed(3);
  const Icon = pack.icon;

  async function handleBuy() {
    setLoading(true);
    setError(null);
    trackAnalyticsEvent("credit_purchase_started", {
      packId: pack.id,
      packLabel: pack.label,
      credits: pack.credits,
      price: pack.price,
    });
    try {
      await purchaseCredits(pack.credits);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Purchase failed");
      setLoading(false);
    }
  }

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-3xl border p-8 transition-all duration-300 group",
        pack.highlighted
          ? "border-primary bg-primary/5 shadow-xl shadow-primary/10 ring-1 ring-primary/20 scale-105 z-10"
          : "border-border bg-card hover:border-primary/20 hover:shadow-lg",
      )}
    >
      {pack.highlighted && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-[10px] font-black uppercase tracking-widest text-primary-foreground shadow-lg flex items-center gap-1.5">
          <Sparkles className="size-3" />
          Best Value
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div
          className={cn(
            "p-3 rounded-2xl transition-colors",
            pack.highlighted
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary",
          )}
        >
          <Icon className="size-6" />
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">
            Pack
          </p>
          <h3 className="text-xl font-black tracking-tight text-foreground">{pack.label}</h3>
        </div>
      </div>

      <div className="flex items-baseline gap-1 mb-1">
        <span className="text-4xl font-black tracking-tighter text-foreground">
          {pack.formattedPrice}
        </span>
      </div>
      <p className="text-xs font-bold text-muted-foreground/40 mb-6 uppercase tracking-wider">
        ${perCredit} per credit
      </p>

      <div className="space-y-4 mb-8">
        <div className="flex items-center gap-2 text-sm font-bold text-foreground">
          <div className="bg-primary/10 p-1 rounded-full text-primary">
            <Check className="size-3" />
          </div>
          {pack.credits.toLocaleString()} Credits
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <div className="bg-muted p-1 rounded-full">
            <Check className="size-3" />
          </div>
          Universal Usage
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <div className="bg-muted p-1 rounded-full">
            <Check className="size-3" />
          </div>
          Never Expires
        </div>
      </div>

      {error && (
        <p className="mb-4 text-xs font-bold text-destructive animate-bounce" role="alert">
          {error}
        </p>
      )}

      <Button
        onClick={handleBuy}
        disabled={loading}
        variant={pack.highlighted ? "default" : "outline"}
        className={cn(
          "w-full rounded-2xl h-12 font-black uppercase tracking-widest text-xs transition-transform active:scale-95 shadow-md",
          pack.highlighted && "shadow-primary/20",
        )}
      >
        <CreditCard className="mr-2 size-4" />
        {loading ? "Processing..." : `Buy Now`}
      </Button>
    </div>
  );
}

export function BuyCredits() {
  const { data: pricing } = usePricing();

  const PACKS: CreditPack[] = [
    {
      id: "starter",
      label: "Starter",
      price: 5,
      formattedPrice: pricing.credits.starter,
      credits: 500,
      highlighted: false,
      icon: Coins,
    },
    {
      id: "popular",
      label: "Popular",
      price: 20,
      formattedPrice: pricing.credits.popular,
      credits: 2500,
      highlighted: true,
      icon: Zap,
    },
    {
      id: "power",
      label: "Power",
      price: 50,
      formattedPrice: pricing.credits.power,
      credits: 7500,
      highlighted: false,
      icon: Trophy,
    },
  ];

  return (
    <section aria-labelledby="buy-credits-heading" className="py-12">
      <div className="max-w-xl mb-12">
        <h2
          id="buy-credits-heading"
          className="text-3xl font-black tracking-tight text-foreground mb-3"
        >
          Power Up Your Apps
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          Need more throughput? Purchase credits to enable high-frequency AI tool calls across the
          entire platform. Credits are added instantly to your balance.
        </p>
      </div>

      <div className="grid gap-8 sm:grid-cols-3 items-center">
        {PACKS.map((pack) => (
          <PackCard key={pack.id} pack={pack} />
        ))}
      </div>

      {pricing.billedInUsd && (
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Prices shown in {pricing.currency}. Billed in USD.
        </p>
      )}
    </section>
  );
}
