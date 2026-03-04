interface PricingFeature {
  text: string;
}

interface PricingPlan {
  name: string;
  price: string;
  description: string;
  features: PricingFeature[];
  cta: string;
  ctaHref: string;
  highlighted: boolean;
}

const PLANS: PricingPlan[] = [
  {
    name: "Free",
    price: "Free",
    description: "Get started with AI-powered development tools.",
    features: [
      { text: "50 messages per day" },
      { text: "Free-tier tools" },
      { text: "Bug reporting" },
      { text: "Community support" },
    ],
    cta: "Current Plan",
    ctaHref: "/settings?tab=billing",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "Coming soon",
    description: "Unlock professional tools and higher limits.",
    features: [
      { text: "500 messages per day" },
      { text: "Pro tools" },
      { text: "BYOK support (bring your own API keys)" },
      { text: "Natural language chat" },
      { text: "Priority bug reporting" },
    ],
    cta: "Upgrade to Pro",
    ctaHref: "#stripe-pro",
    highlighted: true,
  },
  {
    name: "Elite",
    price: "Coming soon",
    description: "Unlimited access and priority support for power users.",
    features: [
      { text: "Unlimited messages per day" },
      { text: "All tools" },
      { text: "Priority support" },
      { text: "Early access to new features" },
      { text: "Bug bounty eligibility" },
    ],
    cta: "Upgrade to Elite",
    ctaHref: "#stripe-elite",
    highlighted: false,
  },
];

function PlanCard({ plan }: { plan: PricingPlan }) {
  return (
    <div
      className={`flex flex-col rounded-2xl border p-6 shadow-sm ${
        plan.highlighted
          ? "border-primary bg-primary/5 ring-2 ring-primary"
          : "border-border bg-card"
      }`}
    >
      {plan.highlighted && (
        <span className="mb-4 self-start rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground">
          Most Popular
        </span>
      )}

      <h2 className="text-xl font-bold text-foreground">{plan.name}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>

      <div className="mt-4">
        <span className="text-3xl font-extrabold text-foreground">{plan.price}</span>
      </div>

      <ul className="mt-6 flex-1 space-y-2">
        {plan.features.map((f) => (
          <li key={f.text} className="flex items-start gap-2 text-sm text-foreground">
            <svg
              className="mt-0.5 h-4 w-4 shrink-0 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {f.text}
          </li>
        ))}
      </ul>

      <a
        href={plan.ctaHref}
        className={`mt-8 block rounded-lg px-6 py-2.5 text-center text-sm font-semibold transition ${
          plan.highlighted
            ? "bg-primary text-primary-foreground hover:bg-primary/90"
            : plan.name === "Free"
            ? "border border-border text-muted-foreground cursor-default"
            : "bg-muted text-foreground hover:bg-muted/80"
        }`}
      >
        {plan.cta}
      </a>
    </div>
  );
}

export function PricingPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-10">
      <div className="text-center space-y-3">
        <h1 className="text-3xl font-bold text-foreground">Simple, Transparent Pricing</h1>
        <p className="text-muted-foreground max-w-xl mx-auto">
          Choose the plan that fits your workflow. All plans include access to the core platform.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {PLANS.map((plan) => (
          <PlanCard key={plan.name} plan={plan} />
        ))}
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Pricing and limits are subject to change. Pro and Elite plans launch soon.
      </p>
    </div>
  );
}
