import { Link } from "../lazy-imports/link";
import { Github, Twitter, Mail, ShieldCheck, Globe, Cpu, Zap } from "lucide-react";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-24 px-4 pb-8 pt-8">
      <div className="rubik-container space-y-6">
        <div className="rubik-panel-strong flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-4">
            <span className="rubik-eyebrow">
              <span className="h-2 w-2 rounded-full bg-primary" />
              Edge-native delivery layer
            </span>
            <div className="space-y-3">
              <h2 className="text-3xl font-semibold tracking-[-0.05em] text-foreground sm:text-4xl">
                One surface for discovery, docs, and deployment.
              </h2>
              <p className="rubik-lede">
                spike.land packages MCP capability into product-grade interfaces with a shared
                runtime, trust model, and shipping loop.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/store"
              className="inline-flex items-center justify-center rounded-[calc(var(--radius-control)-0.1rem)] border border-transparent bg-foreground px-5 py-3 text-sm font-semibold text-background shadow-[0_18px_40px_color-mix(in_srgb,var(--fg)_12%,transparent)] transition-colors hover:bg-foreground/92"
            >
              Browse apps
            </Link>
            <Link
              href="/docs"
              className="inline-flex items-center justify-center rounded-[calc(var(--radius-control)-0.1rem)] border border-border bg-background/85 px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:border-primary/28 hover:text-primary"
            >
              Read docs
            </Link>
          </div>
        </div>

        <div className="rubik-panel p-6 sm:p-8">
          <div className="grid gap-10 lg:grid-cols-[1.35fr_repeat(3,minmax(0,1fr))]">
            <div className="space-y-5">
              <Link href="/" className="flex items-center gap-3">
                <div className="rubik-icon-badge h-11 w-11 rounded-2xl text-sm font-semibold tracking-[-0.06em] text-foreground">
                  SL
                </div>
                <div>
                  <p className="text-lg font-semibold tracking-[-0.04em] text-foreground">
                    spike.land
                  </p>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    MCP-native AI platform
                  </p>
                </div>
              </Link>

              <p className="max-w-sm text-sm leading-7 text-muted-foreground">
                Build apps, tools, and operational workflows with one design system and one runtime
                model.
              </p>

              <div className="flex items-center gap-3">
                <a
                  href="https://github.com/spike-land-ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary"
                  aria-label="GitHub"
                >
                  <Github className="size-4" />
                </a>
                <a
                  href="https://x.com/ai_spike_land"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary"
                  aria-label="Twitter"
                >
                  <Twitter className="size-4" />
                </a>
                <a
                  href="mailto:hello@spike.land"
                  className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary"
                  aria-label="Email"
                >
                  <Mail className="size-4" />
                </a>
              </div>
            </div>

            <div className="space-y-6">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Platform
              </p>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li>
                  <Link
                    href="/tools"
                    className="hover:text-primary transition-colors flex items-center gap-2"
                  >
                    Tools <Zap size={12} className="text-primary fill-primary" />
                  </Link>
                </li>
                <li>
                  <Link href="/pricing" className="hover:text-primary transition-colors">
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link href="/apps/new" className="hover:text-primary transition-colors">
                    Create Tool
                  </Link>
                </li>
                <li>
                  <Link href="/store" className="hover:text-primary transition-colors">
                    Store
                  </Link>
                </li>
              </ul>
            </div>

            <div className="space-y-6">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Developer
              </p>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li>
                  <Link href="/docs" className="hover:text-primary transition-colors">
                    Documentation
                  </Link>
                </li>
                <li>
                  <Link href="/blog" className="hover:text-primary transition-colors">
                    Engineering Blog
                  </Link>
                </li>
                <li>
                  <Link href="/about" className="hover:text-primary transition-colors">
                    Our Mission
                  </Link>
                </li>
                <li>
                  <Link href="/bugbook" className="hover:text-primary transition-colors">
                    Bug Tracker
                  </Link>
                </li>
              </ul>
            </div>

            <div className="space-y-6">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Legal
              </p>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li>
                  <Link href="/privacy" className="hover:text-primary transition-colors">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="hover:text-primary transition-colors">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link
                    href="/security"
                    className="hover:text-primary transition-colors flex items-center gap-1.5"
                  >
                    <ShieldCheck className="size-3.5" /> Security
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="rubik-divider my-6" />

          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold tracking-[0.04em] text-muted-foreground">
                &copy; {currentYear} spike.land. Built for edge-native AI product surfaces.
              </p>
              <div className="flex flex-wrap items-center gap-4">
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/80">
                  <Globe size={11} /> Cloudflare D1
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/80">
                  <Cpu size={11} /> V8 isolates
                </span>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-success/20 bg-success/70 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-success-foreground">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/40 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-success"></span>
                </span>
                Operational
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
