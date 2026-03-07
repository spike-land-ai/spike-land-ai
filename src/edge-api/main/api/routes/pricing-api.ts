import { Hono } from "hono";
import type { Env, Variables } from "../../core-logic/env.js";
import { getRegionalPricing } from "../../core-logic/regional-pricing.js";

export const pricingApi = new Hono<{ Bindings: Env; Variables: Variables }>();

pricingApi.get("/api/pricing", (c) => {
  const country = c.req.header("cf-ipcountry") ?? "US";
  const { currency, prices, formatted } = getRegionalPricing(country);

  c.header("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
  c.header("Vary", "CF-IPCountry");

  return c.json({
    currency,
    billedInUsd: currency !== "USD",
    free: formatted.free,
    pro: {
      monthly: prices.pro.monthly,
      monthlyFormatted: formatted.pro.monthly,
      annual: Math.round(prices.pro.annual / 12),
      annualFormatted: formatted.pro.annual,
      annualTotal: prices.pro.annual,
      annualTotalFormatted: formatted.pro.annualTotal,
    },
    business: {
      monthly: prices.business.monthly,
      monthlyFormatted: formatted.business.monthly,
      annual: Math.round(prices.business.annual / 12),
      annualFormatted: formatted.business.annual,
      annualTotal: prices.business.annual,
      annualTotalFormatted: formatted.business.annualTotal,
    },
    credits: {
      starter: { price: prices.credits.starter, formatted: formatted.credits.starter },
      popular: { price: prices.credits.popular, formatted: formatted.credits.popular },
      power: { price: prices.credits.power, formatted: formatted.credits.power },
    },
  });
});
