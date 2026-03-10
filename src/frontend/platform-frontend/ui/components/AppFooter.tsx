import { Link } from "@tanstack/react-router";
import { Github, Twitter, Mail, ExternalLink, ShieldCheck } from "lucide-react";

export function AppFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer
      className="mt-24 px-4 pb-8 pt-8"
      style={{ contentVisibility: "auto", containIntrinsicSize: "auto 500px" }}
    >
      <div className="rubik-container space-y-6">
        <div className="rubik-panel-strong flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-4">
            <span className="rubik-eyebrow">
              <span className="h-2 w-2 rounded-full bg-primary" />
              Ship enterprise-ready app surfaces
            </span>
            <div className="space-y-3">
              <h2 className="text-3xl font-semibold tracking-[-0.05em] text-foreground sm:text-4xl">
                One product layer for chat, tools, docs, and deployment.
              </h2>
              <p className="rubik-lede">
                spike.land turns MCP capability into real software surfaces with shared auth,
                observability, and edge-native runtime defaults.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              to="/store"
              className="inline-flex items-center justify-center rounded-[calc(var(--radius-control)-0.1rem)] border border-transparent bg-foreground px-5 py-3 text-sm font-semibold text-background shadow-[0_18px_40px_color-mix(in_srgb,var(--fg)_12%,transparent)] transition-colors hover:bg-foreground/92"
            >
              Browse apps
            </Link>
            <Link
              to="/docs"
              className="inline-flex items-center justify-center rounded-[calc(var(--radius-control)-0.1rem)] border border-border bg-background/85 px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:border-primary/28 hover:text-primary"
            >
              Read docs
            </Link>
          </div>
        </div>

        <div className="rubik-panel p-6 sm:p-8">
          <div className="grid gap-10 lg:grid-cols-[1.35fr_repeat(3,minmax(0,1fr))]">
            <div className="space-y-5">
              <Link to="/" className="flex items-center gap-3">
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
                  aria-label="Visit our GitHub"
                >
                  <Github className="size-4" />
                  <span className="sr-only">GitHub</span>
                </a>
                <a
                  href="https://x.com/ai_spike_land"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary"
                  aria-label="Follow us on Twitter"
                >
                  <Twitter className="size-4" />
                  <span className="sr-only">Twitter</span>
                </a>
                <a
                  href="mailto:zoltan.erdos@spike.land"
                  className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary"
                  aria-label="Email us"
                >
                  <Mail className="size-4" />
                  <span className="sr-only">Email</span>
                </a>
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Product
              </p>
              <ul className="space-y-3 text-sm">
                <li>
                  <Link
                    to="/apps"
                    className="text-muted-foreground transition-colors hover:text-primary"
                  >
                    Packages
                  </Link>
                </li>
                <li>
                  <Link
                    to="/store"
                    className="text-muted-foreground transition-colors hover:text-primary"
                  >
                    App Store
                  </Link>
                </li>
                <li>
                  <Link
                    to="/pricing"
                    className="text-muted-foreground transition-colors hover:text-primary"
                  >
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link
                    to="/vibe-code"
                    className="text-muted-foreground transition-colors hover:text-primary"
                  >
                    Vibe Code
                  </Link>
                </li>
              </ul>
            </div>

            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Resources
              </p>
              <ul className="space-y-3 text-sm">
                <li>
                  <Link
                    to="/docs"
                    className="text-muted-foreground transition-colors hover:text-primary"
                  >
                    Documentation
                  </Link>
                </li>
                <li>
                  <Link
                    to="/blog"
                    className="text-muted-foreground transition-colors hover:text-primary"
                  >
                    Blog
                  </Link>
                </li>
                <li>
                  <Link
                    to="/about"
                    className="text-muted-foreground transition-colors hover:text-primary"
                  >
                    About
                  </Link>
                </li>
                <li>
                  <Link
                    to="/status"
                    className="text-muted-foreground transition-colors hover:text-primary"
                  >
                    System Status
                  </Link>
                </li>
              </ul>
            </div>

            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Trust
              </p>
              <ul className="space-y-3 text-sm">
                <li>
                  <Link
                    to="/privacy"
                    className="text-muted-foreground transition-colors hover:text-primary"
                  >
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link
                    to="/terms"
                    className="text-muted-foreground transition-colors hover:text-primary"
                  >
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link
                    to="/security"
                    className="inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-primary"
                  >
                    <ShieldCheck className="size-3.5" />
                    Security
                  </Link>
                </li>
                <li>
                  <a
                    href="https://github.com/spike-land-ai/spike-land-ai/releases"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-primary"
                  >
                    <ExternalLink className="size-3.5" />
                    Changelog
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="rubik-divider my-6" />

          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold tracking-[0.04em] text-muted-foreground">
                &copy; {currentYear} SPIKE LAND LTD. Built for edge-native AI product surfaces.
              </p>
              <p className="text-xs text-muted-foreground/80">Brighton-built. Global by default.</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <a
                href="/status"
                role="status"
                className="inline-flex items-center gap-2 rounded-full border border-success/20 bg-success/70 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-success-foreground"
              >
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/40 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-success"></span>
                </span>
                Status healthy
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
