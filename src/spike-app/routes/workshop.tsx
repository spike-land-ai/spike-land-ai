const LEARN_ITEMS = [
  {
    title: "What MCP is and why it's the future of AI tooling",
    description:
      "Understand the Model Context Protocol standard and why leading AI teams are adopting it as the foundation for tool integration.",
  },
  {
    title: "How to connect AI agents to your existing tools",
    description:
      "Hands-on: wire up MCP servers to databases, APIs, and internal services your team already uses.",
  },
  {
    title: "Building apps 10x faster with MCP-first development",
    description:
      "Walk through a real build session. See how a non-traditional developer shipped £90K of working software using these exact techniques.",
  },
  {
    title: "Production architecture patterns for MCP",
    description:
      "Deployment strategies, security boundaries, error handling, and observability for MCP in production environments.",
  },
];

const FORMAT_ITEMS = [
  { label: "Duration", value: "2 hours, live, online (Zoom)" },
  { label: "Exercises", value: "Hands-on with real MCP tools" },
  { label: "Group size", value: "Max 8 participants per session" },
  { label: "Recording", value: "Provided to all attendees" },
];

const AUDIENCE_ITEMS = [
  "CTOs and VP Engineering",
  "Tech leads and principal engineers",
  "Senior developers",
  "Engineering managers",
];

const INCLUDED_ITEMS = [
  "Live 2-hour workshop",
  "Workshop recording",
  "Starter templates and code",
  "30-day spike.land Pro access",
  "Certificate of completion",
];

const PRICING_OPTIONS = [
  {
    name: "Individual Seat",
    price: "£497",
    per: "/person",
    note: "Minimum 4 seats",
    description: "Book individual seats for team members. Minimum purchase of 4 seats.",
    highlighted: false,
  },
  {
    name: "Team Package",
    price: "£1,997",
    per: "",
    note: "Up to 8 people",
    description: "One fixed price for your whole team. Best value for groups of 5 or more.",
    highlighted: true,
  },
];

function CheckIcon() {
  return (
    <svg
      className="mt-0.5 h-4 w-4 shrink-0 text-primary"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

export function WorkshopPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-16 px-4 py-12">
      {/* Hero */}
      <div className="text-center space-y-4">
        <span className="inline-block rounded-full border border-border bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Live Online Workshop
        </span>
        <h1 className="text-4xl font-bold text-foreground leading-tight">
          MCP Workshop for Dev Teams
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          How a chemist built £90K of software — and how your team can too
        </p>
        <div className="pt-4">
          <a
            href="mailto:workshops@spike.land"
            className="inline-block rounded-lg bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition"
          >
            Book Your Workshop
          </a>
        </div>
      </div>

      {/* The Problem */}
      <div className="rounded-2xl border border-border bg-card p-8 space-y-4">
        <h2 className="text-2xl font-bold text-foreground">The Problem</h2>
        <p className="text-muted-foreground leading-relaxed">
          Dev teams everywhere are curious about AI-assisted development — but most don't know
          where to start. The hype is real, yet the practical steps from "AI is interesting"
          to "we ship faster because of it" remain unclear.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          MCP (Model Context Protocol) is the emerging standard for connecting AI agents to
          real tools and data. It's backed by Anthropic, adopted by major developer toolchains,
          and already in production at forward-thinking teams. But few engineering teams are
          actually using it effectively — yet.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          This workshop closes that gap in two focused hours.
        </p>
      </div>

      {/* What You'll Learn */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-foreground">What You'll Learn</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {LEARN_ITEMS.map((item) => (
            <div
              key={item.title}
              className="rounded-xl border border-border bg-card p-6 space-y-2"
            >
              <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Workshop Format */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-foreground">Workshop Format</h2>
        <div className="rounded-2xl border border-border bg-card divide-y divide-border">
          {FORMAT_ITEMS.map((item) => (
            <div key={item.label} className="flex items-start justify-between px-6 py-4 gap-4">
              <span className="text-sm font-medium text-muted-foreground w-28 shrink-0">
                {item.label}
              </span>
              <span className="text-sm text-foreground">{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Who It's For */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-foreground">Who It's For</h2>
        <div className="rounded-2xl border border-border bg-card p-6">
          <ul className="space-y-3">
            {AUDIENCE_ITEMS.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-foreground">
                <CheckIcon />
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-muted-foreground">
            No prior MCP experience required. Participants should be comfortable reading code,
            even if they don't write it daily.
          </p>
        </div>
      </div>

      {/* What's Included */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-foreground">What's Included</h2>
        <div className="rounded-2xl border border-border bg-card p-6">
          <ul className="space-y-3">
            {INCLUDED_ITEMS.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-foreground">
                <CheckIcon />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Pricing */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-foreground">Pricing</h2>
        <div className="grid gap-6 sm:grid-cols-2">
          {PRICING_OPTIONS.map((option) => (
            <div
              key={option.name}
              className={`flex flex-col rounded-2xl border p-6 shadow-sm ${
                option.highlighted
                  ? "border-primary bg-primary/5 ring-2 ring-primary"
                  : "border-border bg-card"
              }`}
            >
              {option.highlighted && (
                <span className="mb-4 self-start rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground">
                  Best Value
                </span>
              )}
              <h3 className="text-xl font-bold text-foreground">{option.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{option.note}</p>
              <div className="mt-4">
                <span className="text-3xl font-extrabold text-foreground">{option.price}</span>
                {option.per && (
                  <span className="text-base text-muted-foreground">{option.per}</span>
                )}
              </div>
              <p className="mt-4 text-sm text-muted-foreground flex-1">{option.description}</p>
              <a
                href="mailto:workshops@spike.land"
                className={`mt-8 block w-full rounded-lg px-6 py-2.5 text-center text-sm font-semibold transition ${
                  option.highlighted
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-muted text-foreground hover:bg-muted/80"
                }`}
              >
                Book Your Workshop
              </a>
            </div>
          ))}
        </div>
        <p className="text-center text-sm text-muted-foreground">
          Prices in GBP. VAT may apply. Need to pay in another currency?{" "}
          <a
            href="mailto:workshops@spike.land"
            className="text-primary underline hover:text-primary/80"
          >
            Contact us.
          </a>
        </p>
      </div>

      {/* Final CTA */}
      <div className="rounded-2xl border border-border bg-card p-10 text-center space-y-4">
        <h2 className="text-2xl font-bold text-foreground">Ready to Book?</h2>
        <p className="text-muted-foreground max-w-lg mx-auto">
          Sessions are scheduled on request to fit your team's calendar. Email us to check
          availability and reserve your date.
        </p>
        <a
          href="mailto:workshops@spike.land"
          className="inline-block rounded-lg bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition"
        >
          Book Your Workshop
        </a>
        <p className="text-xs text-muted-foreground">
          workshops@spike.land &mdash; we typically respond within one business day
        </p>
      </div>
    </div>
  );
}
