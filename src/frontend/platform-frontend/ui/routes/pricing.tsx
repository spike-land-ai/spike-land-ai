import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import { trackAnalyticsEvent } from "../hooks/useAnalytics";
import { usePricing } from "../hooks/usePricing";
import { useToast } from "../components/Toast";
import { apiFetch } from "../../core-logic/api";
import { trackGoogleAdsEvent } from "../../core-logic/google-ads";

interface PricingFeature {
  text: string;
}

type PlanId = "free" | "pro" | "business" | "enterprise";

interface PricingPlan {
  id: PlanId;
  name: string;
  monthlyPrice: string;
  annualPrice: string;
  annualTotal: string;
  period?: string;
  description: string;
  features: PricingFeature[];
  cta: string;
  tier?: "pro" | "business";
  ctaHref?: string;
  highlighted: boolean;
}

type TranslateFn = (key: string, options?: Record<string, unknown>) => unknown;

function translateList(t: TranslateFn, key: string): string[] {
  return t(key, { returnObjects: true }) as string[];
}

function makePlans(
  pricing: import("../hooks/usePricing").PricingData,
  t: TranslateFn,
): PricingPlan[] {
  return [
    {
      id: "free",
      name: t("plans.free.name") as string,
      monthlyPrice: "$0",
      annualPrice: "$0",
      annualTotal: "$0/yr",
      description: t("plans.free.description") as string,
      features: translateList(t, "plans.free.features").map((text) => ({ text })),
      cta: t("plans.free.cta") as string,
      ctaHref: "/apps",
      highlighted: false,
    },
    {
      id: "pro",
      name: t("plans.pro.name") as string,
      monthlyPrice: pricing.pro.monthly,
      annualPrice: pricing.pro.annual,
      annualTotal: pricing.pro.annualTotal,
      period: t("periodMonthly") as string,
      description: t("plans.pro.description") as string,
      features: translateList(t, "plans.pro.features").map((text) => ({ text })),
      cta: t("plans.pro.cta") as string,
      tier: "pro",
      highlighted: true,
    },
    {
      id: "business",
      name: t("plans.business.name") as string,
      monthlyPrice: pricing.business.monthly,
      annualPrice: pricing.business.annual,
      annualTotal: pricing.business.annualTotal,
      period: t("periodMonthly") as string,
      description: t("plans.business.description") as string,
      features: translateList(t, "plans.business.features").map((text) => ({ text })),
      cta: t("plans.business.cta") as string,
      tier: "business",
      highlighted: false,
    },
    {
      id: "enterprise",
      name: t("plans.enterprise.name") as string,
      monthlyPrice: t("plans.enterprise.customPrice") as string,
      annualPrice: t("plans.enterprise.customPrice") as string,
      annualTotal: "",
      description: t("plans.enterprise.description") as string,
      features: translateList(t, "plans.enterprise.features").map((text) => ({ text })),
      cta: t("plans.enterprise.cta") as string,
      ctaHref: "mailto:zoltan.erdos@spike.land",
      highlighted: false,
    },
  ];
}

function makeFaqItems(t: TranslateFn) {
  return Array.from({ length: 9 }, (_, index) => {
    const questionKey = `faq.q${index + 1}`;
    const answerKey = `faq.a${index + 1}`;
    return {
      question: t(questionKey) as string,
      answer: t(answerKey) as string,
    };
  });
}

async function handleCheckout(
  tier: "pro" | "business",
  annual: boolean,
  isAuthenticated: boolean,
  trackEvent: (event: string, data?: Record<string, unknown>) => void,
  showToast: (message: string, variant?: "success" | "error" | "info") => void,
) {
  if (!isAuthenticated) {
    window.location.href = "/login";
    return;
  }
  trackEvent("checkout_started", { tier, billing: annual ? "annual" : "monthly" });
  trackGoogleAdsEvent("begin_checkout", { tier, billing: annual ? "annual" : "monthly" });
  const lookupKey = annual ? `${tier}_annual` : `${tier}_monthly`;
  const res = await apiFetch("/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tier, lookup_key: lookupKey }),
  });
  if (!res.ok) {
    const err = (await res.json()) as { error?: string };
    showToast(err.error ?? "Checkout failed", "error");
    return;
  }
  const data = (await res.json()) as { url: string };
  window.location.href = data.url;
}

function PlanCard({
  plan,
  annual,
  isAuthenticated,
  getStartedLabel,
  trackEvent,
  showToast,
}: {
  plan: PricingPlan;
  annual: boolean;
  isAuthenticated: boolean;
  getStartedLabel: string;
  trackEvent: (event: string, data?: Record<string, unknown>) => void;
  showToast: (message: string, variant?: "success" | "error" | "info") => void;
}) {
  const { t } = useTranslation("pricing");
  const isFree = plan.id === "free";
  const displayPrice = annual ? plan.annualPrice : plan.monthlyPrice;
  const planId = `plan-${plan.id}`;

  const buttonClass = `mt-8 block w-full rounded-[calc(var(--radius-control)-0.1rem)] border px-6 py-3 text-center text-sm font-semibold transition ${
    plan.highlighted
      ? "border-transparent bg-foreground text-background hover:bg-foreground/92"
      : isFree
        ? "border-border bg-background text-foreground hover:border-primary/24 hover:text-primary"
        : "border-border bg-secondary text-foreground hover:border-primary/24 hover:bg-secondary/88"
  }`;

  return (
    <div
      role="region"
      aria-labelledby={planId}
      className={`flex h-full flex-col p-6 ${plan.highlighted ? "rubik-panel-strong" : "rubik-panel"}`}
    >
      {plan.highlighted && (
        <span className="rubik-chip rubik-chip-accent mb-4 self-start">{t("mostPopular")}</span>
      )}

      <h2 id={planId} className="text-xl font-display font-bold tracking-tight text-foreground">
        {plan.name}
      </h2>
      <p className="mt-2 text-sm leading-7 text-muted-foreground">{plan.description}</p>

      <div className="mt-4">
        <span className="text-3xl font-semibold tracking-[-0.05em] text-foreground">
          {displayPrice}
        </span>
        {plan.period && <span className="text-base text-muted-foreground">{plan.period}</span>}
        {annual && !isFree && (
          <p className="mt-1 text-xs uppercase tracking-[0.12em] text-muted-foreground">
            {t("billedAnnually", { total: plan.annualTotal })}
          </p>
        )}
      </div>

      {annual && !isFree && (
        <span className="mt-3 inline-flex self-start rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
          {t("saveAmount")}
        </span>
      )}

      <ul className="mt-6 flex-1 space-y-3">
        {plan.features.map((f) => (
          <li key={f.text} className="flex items-start gap-2 text-sm leading-7 text-foreground">
            <svg
              className="mt-0.5 h-4 w-4 shrink-0 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            {f.text}
          </li>
        ))}
      </ul>

      {plan.tier ? (
        <button
          type="button"
          onClick={() => handleCheckout(plan.tier!, annual, isAuthenticated, trackEvent, showToast)}
          className={buttonClass}
        >
          {!isAuthenticated && plan.tier ? getStartedLabel : plan.cta}
        </button>
      ) : (
        <a
          href={plan.ctaHref}
          onClick={() => trackEvent("cta_clicked", { plan: plan.name, tier: plan.tier ?? "free" })}
          className={buttonClass}
        >
          {plan.cta}
        </a>
      )}
    </div>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  return (
    <details className="group border-b border-border py-4 last:border-b-0">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-left [&::-webkit-details-marker]:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm">
        <span className="text-sm font-semibold text-foreground">{question}</span>
        <svg
          className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </summary>
      <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{answer}</p>
    </details>
  );
}

export function PricingPage() {
  const { t } = useTranslation("pricing");
  const [annual, setAnnual] = useState(false);
  const { isAuthenticated } = useAuth();
  const { data: pricing } = usePricing();
  const { showToast } = useToast();
  const plans = useMemo(() => makePlans(pricing, t), [pricing, t]);
  const faqItems = useMemo(() => makeFaqItems(t), [t]);

  return (
    <div className="rubik-container rubik-page rubik-stack">
      <section className="rubik-panel-strong space-y-6 p-6 text-center sm:p-8">
        <div className="space-y-4">
          <span className="rubik-eyebrow">
            <span className="h-2 w-2 rounded-full bg-primary" />
            {t("eyebrow")}
          </span>
          <div className="space-y-3">
            <h1 className="text-4xl font-display font-bold tracking-tight text-foreground sm:text-5xl">
              {t("title")}
            </h1>
            <p className="rubik-lede mx-auto">{t("subtitle")}</p>
          </div>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
          {t("launchPromo")}
        </div>

        <div
          role="radiogroup"
          aria-label={t("billingFrequency") as string}
          className="mx-auto inline-flex items-center gap-3 rounded-full border border-border bg-muted p-1"
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
              e.preventDefault();
              setAnnual(false);
            }
            if (e.key === "ArrowRight" || e.key === "ArrowDown") {
              e.preventDefault();
              setAnnual(true);
            }
          }}
        >
          <button
            type="button"
            role="radio"
            aria-checked={!annual}
            tabIndex={!annual ? 0 : -1}
            onClick={() => setAnnual(false)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
              !annual ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            {t("monthly")}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={annual}
            tabIndex={annual ? 0 : -1}
            onClick={() => setAnnual(true)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
              annual ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            {t("annual")}
            <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
              {t("annualSavings")}
            </span>
          </button>
        </div>
      </section>

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {plans.map((plan) => (
          <PlanCard
            key={plan.name}
            plan={plan}
            annual={annual}
            isAuthenticated={isAuthenticated}
            getStartedLabel={t("getStarted") as string}
            trackEvent={trackAnalyticsEvent}
            showToast={showToast}
          />
        ))}
      </div>

      <p className="text-center text-sm text-muted-foreground">
        {t("customPlanPrefix")}{" "}
        <a
          href="mailto:zoltan.erdos@spike.land"
          className="text-primary underline hover:text-primary/80"
        >
          {t("customPlanLink")}
        </a>
      </p>

      <p className="text-center text-sm text-muted-foreground">
        {t("pricingDisclaimer")}{" "}
        {pricing.billedInUsd
          ? t("priceDisplayUsd", { currency: pricing.currency })
          : t("priceDisplayDefault")}{" "}
        {t("vatNotice")}
        <br />
        {t("academicPrefix")}{" "}
        <a
          href="mailto:zoltan.erdos@spike.land"
          className="text-primary underline hover:text-primary/80"
        >
          {t("academicLink")}
        </a>
        .
      </p>

      {/* FAQ */}
      <div className="rubik-panel mx-auto max-w-3xl p-6 sm:p-8">
        <h2 className="mb-6 text-center text-2xl font-display font-bold tracking-tight text-foreground">
          {t("faq.title")}
        </h2>
        <div>
          {faqItems.map((item) => (
            <FaqItem key={item.question} question={item.question} answer={item.answer} />
          ))}
        </div>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqItems.map((item) => ({
              "@type": "Question",
              name: item.question,
              acceptedAnswer: {
                "@type": "Answer",
                text: item.answer,
              },
            })),
          }),
        }}
      />
    </div>
  );
}
