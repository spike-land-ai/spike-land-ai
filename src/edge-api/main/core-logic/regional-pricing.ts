/**
 * Regional currency pricing — PPP-adjusted prices for 27 currencies.
 * Stripe charges stay in USD; this module provides display-only local equivalents.
 */

// ISO 3166 alpha-2 → ISO 4217
export const COUNTRY_TO_CURRENCY: Record<string, string> = {
  // Eurozone
  AT: "EUR", BE: "EUR", CY: "EUR", EE: "EUR", FI: "EUR", FR: "EUR",
  DE: "EUR", GR: "EUR", IE: "EUR", IT: "EUR", LV: "EUR", LT: "EUR",
  LU: "EUR", MT: "EUR", NL: "EUR", PT: "EUR", SK: "EUR", SI: "EUR",
  ES: "EUR", HR: "EUR",
  // Individual currencies
  GB: "GBP", HU: "HUF", CH: "CHF", SE: "SEK", NO: "NOK", DK: "DKK",
  PL: "PLN", CZ: "CZK", RO: "RON", BG: "BGN", TR: "TRY",
  JP: "JPY", KR: "KRW", IN: "INR", BR: "BRL",
  AU: "AUD", NZ: "NZD", CA: "CAD",
  SG: "SGD", HK: "HKD", TW: "TWD",
  MX: "MXN", ZA: "ZAR", AE: "AED", IL: "ILS",
  US: "USD", PR: "USD", GU: "USD", VI: "USD", AS: "USD",
};

export interface RegionalPriceSet {
  currency: string;
  pro: { monthly: number; annual: number };
  business: { monthly: number; annual: number };
  credits: { starter: number; popular: number; power: number };
}

export const REGIONAL_PRICES: Record<string, RegionalPriceSet> = {
  USD: { currency: "USD", pro: { monthly: 29, annual: 276 }, business: { monthly: 99, annual: 948 }, credits: { starter: 5, popular: 20, power: 50 } },
  EUR: { currency: "EUR", pro: { monthly: 27, annual: 258 }, business: { monthly: 89, annual: 852 }, credits: { starter: 5, popular: 19, power: 45 } },
  GBP: { currency: "GBP", pro: { monthly: 23, annual: 220 }, business: { monthly: 79, annual: 756 }, credits: { starter: 4, popular: 16, power: 40 } },
  HUF: { currency: "HUF", pro: { monthly: 4990, annual: 47900 }, business: { monthly: 16990, annual: 163100 }, credits: { starter: 990, popular: 3990, power: 9990 } },
  CHF: { currency: "CHF", pro: { monthly: 29, annual: 276 }, business: { monthly: 99, annual: 948 }, credits: { starter: 5, popular: 20, power: 50 } },
  SEK: { currency: "SEK", pro: { monthly: 279, annual: 2676 }, business: { monthly: 949, annual: 9108 }, credits: { starter: 49, popular: 199, power: 479 } },
  NOK: { currency: "NOK", pro: { monthly: 289, annual: 2772 }, business: { monthly: 989, annual: 9492 }, credits: { starter: 49, popular: 199, power: 499 } },
  DKK: { currency: "DKK", pro: { monthly: 199, annual: 1908 }, business: { monthly: 669, annual: 6420 }, credits: { starter: 35, popular: 139, power: 349 } },
  PLN: { currency: "PLN", pro: { monthly: 119, annual: 1140 }, business: { monthly: 399, annual: 3828 }, credits: { starter: 19, popular: 79, power: 199 } },
  CZK: { currency: "CZK", pro: { monthly: 599, annual: 5748 }, business: { monthly: 1990, annual: 19100 }, credits: { starter: 99, popular: 399, power: 999 } },
  RON: { currency: "RON", pro: { monthly: 129, annual: 1236 }, business: { monthly: 449, annual: 4308 }, credits: { starter: 22, popular: 89, power: 219 } },
  BGN: { currency: "BGN", pro: { monthly: 49, annual: 468 }, business: { monthly: 169, annual: 1620 }, credits: { starter: 9, popular: 35, power: 89 } },
  TRY: { currency: "TRY", pro: { monthly: 499, annual: 4788 }, business: { monthly: 1690, annual: 16224 }, credits: { starter: 89, popular: 349, power: 879 } },
  JPY: { currency: "JPY", pro: { monthly: 2900, annual: 27840 }, business: { monthly: 9900, annual: 95040 }, credits: { starter: 500, popular: 2000, power: 5000 } },
  KRW: { currency: "KRW", pro: { monthly: 29900, annual: 287040 }, business: { monthly: 99000, annual: 950400 }, credits: { starter: 5000, popular: 20000, power: 50000 } },
  INR: { currency: "INR", pro: { monthly: 499, annual: 4788 }, business: { monthly: 1690, annual: 16224 }, credits: { starter: 89, popular: 349, power: 879 } },
  BRL: { currency: "BRL", pro: { monthly: 79, annual: 756 }, business: { monthly: 269, annual: 2580 }, credits: { starter: 14, popular: 55, power: 139 } },
  AUD: { currency: "AUD", pro: { monthly: 39, annual: 372 }, business: { monthly: 139, annual: 1332 }, credits: { starter: 7, popular: 29, power: 69 } },
  CAD: { currency: "CAD", pro: { monthly: 35, annual: 336 }, business: { monthly: 119, annual: 1140 }, credits: { starter: 6, popular: 25, power: 59 } },
  NZD: { currency: "NZD", pro: { monthly: 42, annual: 396 }, business: { monthly: 149, annual: 1428 }, credits: { starter: 7, popular: 29, power: 72 } },
  SGD: { currency: "SGD", pro: { monthly: 35, annual: 336 }, business: { monthly: 119, annual: 1140 }, credits: { starter: 6, popular: 25, power: 59 } },
  HKD: { currency: "HKD", pro: { monthly: 219, annual: 2100 }, business: { monthly: 749, annual: 7188 }, credits: { starter: 39, popular: 155, power: 389 } },
  TWD: { currency: "TWD", pro: { monthly: 799, annual: 7668 }, business: { monthly: 2790, annual: 26784 }, credits: { starter: 139, popular: 559, power: 1390 } },
  MXN: { currency: "MXN", pro: { monthly: 399, annual: 3828 }, business: { monthly: 1390, annual: 13344 }, credits: { starter: 69, popular: 279, power: 699 } },
  ZAR: { currency: "ZAR", pro: { monthly: 399, annual: 3828 }, business: { monthly: 1390, annual: 13344 }, credits: { starter: 69, popular: 279, power: 699 } },
  AED: { currency: "AED", pro: { monthly: 99, annual: 948 }, business: { monthly: 349, annual: 3348 }, credits: { starter: 18, popular: 72, power: 179 } },
  ILS: { currency: "ILS", pro: { monthly: 99, annual: 948 }, business: { monthly: 349, annual: 3348 }, credits: { starter: 18, popular: 72, power: 179 } },
};

// Currencies where fraction digits should be 0
const ZERO_DECIMAL_CURRENCIES = new Set(["HUF", "JPY", "KRW", "TWD"]);

export function formatPrice(amount: number, currency: string): string {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: ZERO_DECIMAL_CURRENCIES.has(currency) ? 0 : 2,
    minimumFractionDigits: 0,
  }).format(amount);
}

export interface FormattedPrices {
  pro: { monthly: string; annual: string; annualTotal: string };
  business: { monthly: string; annual: string; annualTotal: string };
  credits: { starter: string; popular: string; power: string };
  free: string;
  currencyCode: string;
  billedInUsd: boolean;
}

export function getRegionalPricing(countryCode: string): {
  currency: string;
  prices: RegionalPriceSet;
  formatted: FormattedPrices;
} {
  const cc = (countryCode ?? "").toUpperCase();
  const currency = COUNTRY_TO_CURRENCY[cc] ?? "USD";
  const prices = REGIONAL_PRICES[currency] ?? REGIONAL_PRICES.USD;
  const fmt = (n: number) => formatPrice(n, prices.currency);

  const proAnnualPerMonth = Math.round(prices.pro.annual / 12);
  const bizAnnualPerMonth = Math.round(prices.business.annual / 12);

  const formatted: FormattedPrices = {
    pro: {
      monthly: fmt(prices.pro.monthly),
      annual: fmt(proAnnualPerMonth),
      annualTotal: `${fmt(prices.pro.annual)}/yr`,
    },
    business: {
      monthly: fmt(prices.business.monthly),
      annual: fmt(bizAnnualPerMonth),
      annualTotal: `${fmt(prices.business.annual)}/yr`,
    },
    credits: {
      starter: fmt(prices.credits.starter),
      popular: fmt(prices.credits.popular),
      power: fmt(prices.credits.power),
    },
    free: fmt(0),
    currencyCode: prices.currency,
    billedInUsd: prices.currency !== "USD",
  };

  return { currency: prices.currency, prices, formatted };
}
