import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";

const DELIVERABLES = [
  { title: "3-screen working MVP", description: "A functional app with up to 3 core screens tailored to your brief." },
  { title: "MCP-powered backend", description: "API integrations and data layer built using our MCP tool ecosystem." },
  { title: "Deployed to production", description: "Live on Cloudflare's global edge network — fast everywhere." },
  { title: "Source code ownership", description: "Full ownership of everything we build. No lock-in." },
  { title: "Basic documentation", description: "README and inline docs so you can hand it to any developer." },
  { title: "14-day bug fix warranty", description: "We fix any bugs in the delivered scope, no questions asked." },
];

const STEPS = [
  {
    number: "01",
    title: "Brief",
    description: "You describe what you need in a 30-minute call. We ask the right questions and confirm scope before we start.",
  },
  {
    number: "02",
    title: "Build",
    description: "Our AI agents and MCP tools get to work. We build in parallel — frontend, backend, and integrations simultaneously.",
  },
  {
    number: "03",
    title: "Ship",
    description: "Your app is deployed, documented, and handed over with source code. You own everything.",
  },
];

const FAQ_ITEMS = [
  {
    question: "What technologies do you use?",
    answer:
      "We use React + TypeScript for the frontend, Cloudflare Workers (Hono) for the backend, and our MCP tool registry for integrations. Everything runs on Cloudflare's global edge — no servers to manage.",
  },
  {
    question: "How does the 48-hour timeline actually work?",
    answer:
      "The clock starts after your brief call. AI agents build concurrently — frontend, backend, and deployment happen in parallel, not sequentially. Most apps are ready to review within 36 hours, with the remaining time for revisions and handover.",
  },
  {
    question: "What if I need changes after delivery?",
    answer:
      "The 14-day warranty covers bugs in the delivered scope. For new features or screens beyond the original brief, we'll quote you a fixed price — same process, no surprises.",
  },
  {
    question: "Do I own the source code?",
    answer:
      "Yes. Full source code is yours from day one. No proprietary runtimes, no vendor lock-in. You can take it to any developer or hosting provider.",
  },
  {
    question: "What about hosting costs?",
    answer:
      "We deploy to Cloudflare Workers, which has a generous free tier. Most MVPs run at zero cost until significant scale. We'll set up the account under your name so you control billing.",
  },
  {
    question: "What if 3 screens isn't enough?",
    answer:
      "The fixed price covers a 3-screen MVP — the smallest useful version of your idea. If you need more screens upfront, we'll scope it out and give you a custom quote before starting.",
  },
];

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-border py-4">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-start justify-between text-left gap-4"
        aria-expanded={open}
      >
        <span className="text-sm font-semibold text-foreground">{question}</span>
        <svg
          className={`mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{answer}</p>
      )}
    </div>
  );
}

async function handleServiceCheckout(email: string, isAuthenticated: boolean) {
  const body: Record<string, string> = { service: "app_builder" };
  if (!isAuthenticated && email) {
    body["email"] = email;
  }

  const res = await fetch("/api/checkout/service", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = (await res.json()) as { error?: string };
    alert(err.error ?? "Checkout failed. Please try again.");
    return;
  }

  const data = (await res.json()) as { url: string };
  window.location.href = data.url;
}

function CtaButton({ label = "Get Started — £1,997" }: { label?: string }) {
  const { isAuthenticated } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      await handleServiceCheckout(email, isAuthenticated);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {!isAuthenticated && (
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          className="w-full max-w-xs rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          aria-label="Email address"
        />
      )}
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="rounded-lg bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
      >
        {loading ? "Redirecting..." : label}
      </button>
    </div>
  );
}

export function BuildPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-20 px-4 py-16">
      {/* Hero */}
      <section className="text-center space-y-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-4 py-1.5 text-xs font-semibold text-muted-foreground">
          MCP-first development
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
          We Build Your App<br />in 48 Hours
        </h1>
        <p className="mx-auto max-w-xl text-lg text-muted-foreground">
          Describe what you need. Our AI agents and MCP tools build a working 3-screen MVP,
          deployed to production — for a single fixed price.
        </p>
        <CtaButton />
        <p className="text-xs text-muted-foreground">One-time payment. No subscription. Source code included.</p>
      </section>

      {/* How It Works */}
      <section className="space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-foreground">How It Works</h2>
          <p className="text-sm text-muted-foreground">Three steps from idea to production.</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-3">
          {STEPS.map((step) => (
            <div key={step.number} className="rounded-2xl border border-border bg-card p-6 space-y-3">
              <span className="text-3xl font-extrabold text-primary/30">{step.number}</span>
              <h3 className="text-base font-bold text-foreground">{step.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* What You Get */}
      <section className="space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-foreground">What You Get</h2>
          <p className="text-sm text-muted-foreground">Everything you need to launch, nothing you don't.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {DELIVERABLES.map((item) => (
            <div key={item.title} className="rounded-xl border border-border bg-card p-5 space-y-2">
              <div className="flex items-start gap-2">
                <svg
                  className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
              </div>
              <p className="pl-6 text-xs text-muted-foreground leading-relaxed">{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Social Proof */}
      <section>
        <blockquote className="rounded-2xl border border-border bg-card p-8 text-center space-y-4">
          <p className="text-lg font-medium text-foreground leading-relaxed">
            "A chemistry teacher used our tools to build £90,000 worth of software in 70 hours.
            Imagine what we can build for you."
          </p>
          <footer className="text-sm text-muted-foreground">
            — From the spike.land blog
          </footer>
        </blockquote>
      </section>

      {/* Pricing */}
      <section className="space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-foreground">Simple Pricing</h2>
          <p className="text-sm text-muted-foreground">One price. No surprises.</p>
        </div>
        <div className="mx-auto max-w-sm rounded-2xl border-2 border-primary bg-primary/5 p-8 shadow-sm space-y-6 text-center ring-2 ring-primary">
          <span className="inline-block rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground">
            Fixed Price
          </span>
          <div>
            <span className="text-5xl font-extrabold text-foreground">£1,997</span>
            <p className="mt-1 text-sm text-muted-foreground">one-time payment</p>
          </div>
          <ul className="space-y-2 text-left">
            {DELIVERABLES.map((item) => (
              <li key={item.title} className="flex items-start gap-2 text-sm text-foreground">
                <svg
                  className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {item.title}
              </li>
            ))}
          </ul>
          <CtaButton />
        </div>
      </section>

      {/* FAQ */}
      <section className="space-y-6">
        <h2 className="text-center text-2xl font-bold text-foreground">Frequently Asked Questions</h2>
        <div className="mx-auto max-w-2xl">
          {FAQ_ITEMS.map((item) => (
            <FaqItem key={item.question} question={item.question} answer={item.answer} />
          ))}
        </div>
      </section>

      {/* CTA Footer */}
      <section className="rounded-2xl border border-border bg-card p-10 text-center space-y-5">
        <h2 className="text-2xl font-bold text-foreground">Ready to build?</h2>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          Tell us what you need. We'll handle the rest — from backend to deployment — in 48 hours.
        </p>
        <CtaButton label="Start Your Build — £1,997" />
        <p className="text-xs text-muted-foreground">
          Questions?{" "}
          <a href="mailto:build@spike.land" className="text-primary underline hover:text-primary/80">
            Email us at build@spike.land
          </a>
        </p>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Service",
            name: "AI App Builder",
            provider: {
              "@type": "Organization",
              name: "spike.land",
              url: "https://spike.land",
            },
            description:
              "Get a working 3-screen MVP built in 48 hours for £1,997. MCP-first development with AI agents. Source code included.",
            offers: {
              "@type": "Offer",
              price: "1997",
              priceCurrency: "GBP",
              name: "AI App Builder — 48-hour MVP",
            },
          }),
        }}
      />
    </div>
  );
}
