import { useState } from "react";
import { apiUrl } from "@/lib/api";

interface CreditPack {
  id: string;
  label: string;
  price: number;
  credits: number;
  highlighted: boolean;
}

const PACKS: CreditPack[] = [
  { id: "starter", label: "Starter", price: 5, credits: 500, highlighted: false },
  { id: "popular", label: "Popular", price: 20, credits: 2500, highlighted: true },
  { id: "power", label: "Power", price: 50, credits: 7500, highlighted: false },
];

async function purchaseCredits(credits: number): Promise<void> {
  const res = await fetch(apiUrl("/credits/purchase"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credits }),
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

  async function handleBuy() {
    setLoading(true);
    setError(null);
    try {
      await purchaseCredits(pack.credits);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Purchase failed");
      setLoading(false);
    }
  }

  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-6 shadow-sm ${
        pack.highlighted
          ? "border-primary bg-primary/5 ring-2 ring-primary"
          : "border-border bg-card"
      }`}
    >
      {pack.highlighted && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground">
          Best Value
        </span>
      )}

      <h3 className="text-lg font-bold text-foreground">{pack.label}</h3>

      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-3xl font-extrabold text-foreground">${pack.price}</span>
      </div>

      <div className="mt-2 space-y-1">
        <p className="text-sm font-semibold text-foreground">
          {pack.credits.toLocaleString()} credits
        </p>
        <p className="text-xs text-muted-foreground">${perCredit} per credit</p>
      </div>

      {error && (
        <p className="mt-3 text-xs text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleBuy}
        disabled={loading}
        aria-label={`Buy ${pack.credits.toLocaleString()} credits for $${pack.price}`}
        className={`mt-6 w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
          pack.highlighted
            ? "bg-primary text-primary-foreground hover:bg-primary/90"
            : "bg-muted text-foreground hover:bg-muted/80"
        }`}
      >
        {loading ? "Redirecting..." : `Buy for $${pack.price}`}
      </button>
    </div>
  );
}

export function BuyCredits() {
  return (
    <section aria-labelledby="buy-credits-heading">
      <div className="mb-6">
        <h2
          id="buy-credits-heading"
          className="text-xl font-bold text-foreground"
        >
          Buy Credits
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Credits never expire. Use them for AI tool calls beyond your daily limit.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {PACKS.map((pack) => (
          <PackCard key={pack.id} pack={pack} />
        ))}
      </div>
    </section>
  );
}
