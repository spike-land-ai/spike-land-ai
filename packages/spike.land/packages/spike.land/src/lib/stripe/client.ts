import Stripe from "stripe";

// Lazy initialization to avoid build-time errors
let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeClient) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripeClient;
}

// For backwards compatibility - lazy getter
export const stripe = {
  get customers() {
    return getStripe().customers;
  },
  get checkout() {
    return getStripe().checkout;
  },
  get subscriptions() {
    return getStripe().subscriptions;
  },
  get webhooks() {
    return getStripe().webhooks;
  },
};

// Currency configuration
export const CURRENCY = {
  code: "GBP",
  symbol: "£",
} as const;

// Token package definitions
export const TOKEN_PACKAGES = {
  starter: { tokens: 10, price: 2.99, name: "Starter Pack" },
  basic: { tokens: 50, price: 9.99, name: "Basic Pack" },
  pro: { tokens: 150, price: 24.99, name: "Pro Pack" },
  power: { tokens: 500, price: 69.99, name: "Power Pack" },
} as const;

// Subscription plan definitions
export const SUBSCRIPTION_PLANS = {
  hobby: { tokensPerMonth: 30, priceGBP: 4.99, maxRollover: 30, name: "Hobby" },
  creator: {
    tokensPerMonth: 100,
    priceGBP: 12.99,
    maxRollover: 100,
    name: "Creator",
  },
  studio: {
    tokensPerMonth: 300,
    priceGBP: 29.99,
    maxRollover: 0,
    name: "Studio",
  }, // 0 = unlimited
} as const;

// Enhancement token costs
export const ENHANCEMENT_COSTS = {
  TIER_1K: 2,
  TIER_2K: 5,
  TIER_4K: 10,
} as const;

/**
 * Token Well Tier Subscriptions
 * Progressive tier system where users upgrade when balance depletes to 0
 * - wellCapacity: Regeneration cap AND tokens granted on upgrade
 * - Monthly billing maintains tier status but does NOT auto-refill tokens
 */
export const TIER_SUBSCRIPTIONS = {
  BASIC: {
    priceGBP: 5,
    wellCapacity: 20,
    stripePriceId: process.env.STRIPE_PRICE_TIER_BASIC || "",
    name: "Basic",
    description: "20 token well capacity",
  },
  STANDARD: {
    priceGBP: 10,
    wellCapacity: 50,
    stripePriceId: process.env.STRIPE_PRICE_TIER_STANDARD || "",
    name: "Standard",
    description: "50 token well capacity",
  },
  PREMIUM: {
    priceGBP: 20,
    wellCapacity: 100,
    stripePriceId: process.env.STRIPE_PRICE_TIER_PREMIUM || "",
    name: "Premium",
    description: "100 token well capacity",
  },
} as const;

// Workspace tier plan definitions (Orbit PRO/BUSINESS)
export const WORKSPACE_TIER_PLANS = {
  PRO: {
    name: "Pro",
    priceGBP: 29,
    monthlyAiCredits: 1000,
    tier: "PRO" as const,
  },
  BUSINESS: {
    name: "Business",
    priceGBP: 99,
    monthlyAiCredits: 5000,
    tier: "BUSINESS" as const,
  },
} as const;

export type TokenPackageId = keyof typeof TOKEN_PACKAGES;
export type SubscriptionPlanId = keyof typeof SUBSCRIPTION_PLANS;
export type TierSubscriptionId = keyof typeof TIER_SUBSCRIPTIONS;
export type WorkspaceTierPlanId = keyof typeof WORKSPACE_TIER_PLANS;
