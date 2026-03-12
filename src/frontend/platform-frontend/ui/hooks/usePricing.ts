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

/** Wire format returned by the `/pricing` API endpoint. */
interface PricingApiResponse {
  currency: string;
  billedInUsd: boolean;
  pro: {
    monthlyFormatted: string;
    annualFormatted: string;
    annualTotalFormatted: string;
  };
  business: {
    monthlyFormatted: string;
    annualFormatted: string;
    annualTotalFormatted: string;
  };
  credits: {
    starter: { formatted: string };
    popular: { formatted: string };
    power: { formatted: string };
  };
}

/** Standardised return shape for the `usePricing` hook. */
export interface UsePricingResult {
  /** The resolved pricing data, or the USD defaults while loading. */
  data: PricingData;
  /** `true` while the remote pricing fetch is in flight. */
  isLoading: boolean;
  /** `true` when the fetch failed and fell back to USD defaults. */
  isError: boolean;
  /** The error that caused the fetch to fail, or `null` when successful. */
  error: Error | null;
}

const USD_DEFAULTS: PricingData = {
  currency: "USD",
  billedInUsd: false,
  pro: { monthly: "$29", annual: "$23", annualTotal: "$276/yr" },
  business: { monthly: "$99", annual: "$79", annualTotal: "$948/yr" },
  credits: { starter: "$5", popular: "$20", power: "$50" },
};

// Module-level singleton cache shared across all hook instances.
let cachedPricing: PricingData | null = null;
// The in-flight promise is stored so concurrent callers share one request.
// Reset to null on failure so the next mount will retry.
let fetchPromise: Promise<void> | null = null;

function normalizePricingResponse(data: PricingApiResponse): PricingData {
  return {
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
}

function doFetch(): Promise<void> {
  if (fetchPromise) return fetchPromise;

  fetchPromise = fetch(apiUrl("/pricing"))
    .then(async (res) => {
      if (!res.ok) return;
      const raw = (await res.json()) as PricingApiResponse;
      cachedPricing = normalizePricingResponse(raw);
    })
    .catch(() => {
      // Stay on USD defaults silently; reset promise so the next mount retries.
      fetchPromise = null;
    });

  return fetchPromise;
}

/**
 * Fetches localised pricing data from the `/pricing` edge endpoint and exposes
 * it with a standard `{ data, isLoading, isError, error }` shape.
 *
 * A module-level singleton cache ensures only one network request is made per
 * page load, regardless of how many components mount this hook simultaneously.
 * Subsequent mounts after the first successful fetch are synchronous (no
 * loading state).
 *
 * Falls back silently to USD defaults when the endpoint is unavailable or
 * returns an error status. When a fallback occurs `isError` is `true` and
 * `error` carries the caught exception.
 *
 * @returns A {@link UsePricingResult} containing the resolved pricing data and
 *   query-state flags.
 */
export function usePricing(): UsePricingResult {
  const [pricing, setPricing] = useState<PricingData>(cachedPricing ?? USD_DEFAULTS);
  const [isLoading, setIsLoading] = useState(!cachedPricing);
  const [fetchError, setFetchError] = useState<Error | null>(null);

  useEffect(() => {
    if (cachedPricing) {
      setPricing(cachedPricing);
      setIsLoading(false);
      return;
    }

    doFetch()
      .then(() => {
        if (cachedPricing) setPricing(cachedPricing);
      })
      .catch((err: unknown) => {
        setFetchError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  return {
    data: pricing,
    isLoading,
    isError: fetchError !== null,
    error: fetchError,
  };
}
