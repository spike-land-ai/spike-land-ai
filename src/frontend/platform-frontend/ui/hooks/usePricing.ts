import { useEffect, useState } from "react";
import { apiUrl } from "../../core-logic/api";

export interface PricingTier {
  monthly: string;
  annual: string;
  annualTotal: string;
}

export interface CreditPricing {
  starter: string;
  popular: string;
  power: string;
}

export interface PricingData {
  currency: string;
  billedInUsd: boolean;
  pro: PricingTier;
  business: PricingTier;
  credits: CreditPricing;
}

const USD_DEFAULTS: PricingData = {
  currency: "USD",
  billedInUsd: false,
  pro: { monthly: "$29", annual: "$23", annualTotal: "$276/yr" },
  business: { monthly: "$99", annual: "$79", annualTotal: "$948/yr" },
  credits: { starter: "$5", popular: "$20", power: "$50" },
};

// Module-level singleton cache
let cachedPricing: PricingData | null = null;
let fetchPromise: Promise<void> | null = null;

function doFetch(): Promise<void> {
  if (fetchPromise) return fetchPromise;
  fetchPromise = fetch(apiUrl("/pricing"))
    .then(async (res) => {
      if (!res.ok) return;
      const data = await res.json() as {
        currency: string;
        billedInUsd: boolean;
        pro: { monthlyFormatted: string; annualFormatted: string; annualTotalFormatted: string };
        business: { monthlyFormatted: string; annualFormatted: string; annualTotalFormatted: string };
        credits: { starter: { formatted: string }; popular: { formatted: string }; power: { formatted: string } };
      };
      cachedPricing = {
        currency: data.currency,
        billedInUsd: data.billedInUsd,
        pro: {
          monthly: data.pro.monthlyFormatted,
          annual: data.pro.annualFormatted,
          annualTotal: data.pro.annualTotalFormatted,
        },
        business: {
          monthly: data.business.monthlyFormatted,
          annual: data.business.annualFormatted,
          annualTotal: data.business.annualTotalFormatted,
        },
        credits: {
          starter: data.credits.starter.formatted,
          popular: data.credits.popular.formatted,
          power: data.credits.power.formatted,
        },
      };
    })
    .catch(() => {
      // Stay on USD defaults silently
    });
  return fetchPromise;
}

export function usePricing(): { loading: boolean; pricing: PricingData } {
  const [pricing, setPricing] = useState<PricingData>(cachedPricing ?? USD_DEFAULTS);
  const [loading, setLoading] = useState(!cachedPricing);

  useEffect(() => {
    if (cachedPricing) {
      setPricing(cachedPricing);
      setLoading(false);
      return;
    }
    doFetch().then(() => {
      if (cachedPricing) setPricing(cachedPricing);
      setLoading(false);
    });
  }, []);

  return { loading, pricing };
}
