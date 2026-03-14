import { Link } from "@tanstack/react-router";
import { Github, Twitter, Mail, ExternalLink, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

export function AppFooter() {
  const { t } = useTranslation("footer");

  return (
    <footer
      role="contentinfo"
      className="mt-24 px-4 pb-8 pt-8"
      style={{ contentVisibility: "auto", containIntrinsicSize: "auto 500px" }}
    >
      <div className="rubik-container space-y-6">
        <div className="rubik-panel-strong flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-4">
            <span className="rubik-eyebrow">
              <span className="h-2 w-2 rounded-full bg-primary" />
              {t("heroHeading")}
            </span>
            <div className="space-y-3">
              <h2 className="text-3xl font-semibold tracking-[-0.05em] text-foreground sm:text-4xl">
                {t("heroTitle")}
              </h2>
              <p className="rubik-lede">{t("heroBody")}</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              to="/store"
              className="inline-flex items-center justify-center rounded-[calc(var(--radius-control)-0.1rem)] border border-transparent bg-foreground px-5 py-3 text-sm font-semibold text-background shadow-[0_18px_40px_color-mix(in_srgb,var(--fg)_12%,transparent)] transition-colors hover:bg-foreground/92"
            >
              {t("browseApps")}
            </Link>
            <Link
              to="/docs"
              className="inline-flex items-center justify-center rounded-[calc(var(--radius-control)-0.1rem)] border border-border bg-background/85 px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:border-primary/28 hover:text-primary"
            >
              {t("readDocs")}
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
                    {t("brandTagline")}
                  </p>
                </div>
              </Link>

              <p className="max-w-sm text-sm leading-7 text-muted-foreground">
                {t("brandDescription")}
              </p>

              <div className="flex items-center gap-3">
                <a
                  href="https://github.com/spike-land-ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary"
                  aria-label={t("ariaGitHub")}
                >
                  <Github className="size-4" />
                  <span className="sr-only">GitHub</span>
                </a>
                <a
                  href="https://x.com/ai_spike_land"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary"
                  aria-label={t("ariaTwitter")}
                >
                  <Twitter className="size-4" />
                  <span className="sr-only">Twitter</span>
                </a>
                <a
                  href="mailto:hello@spike.land"
                  className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary"
                  aria-label={t("ariaEmail")}
                >
                  <Mail className="size-4" />
                  <span className="sr-only">Email</span>
                </a>
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {t("product")}
              </p>
              <ul className="space-y-3 text-sm">
                <li>
                  <Link
                    to="/apps"
                    className="text-muted-foreground transition-colors hover:text-primary"
                  >
                    {t("packages")}
                  </Link>
                </li>
                <li>
                  <Link
                    to="/store"
                    className="text-muted-foreground transition-colors hover:text-primary"
                  >
                    {t("appStore")}
                  </Link>
                </li>
                <li>
                  <Link
                    to="/pricing"
                    className="text-muted-foreground transition-colors hover:text-primary"
                  >
                    {t("pricing")}
                  </Link>
                </li>
                <li>
                  <Link
                    to="/vibe-code"
                    className="text-muted-foreground transition-colors hover:text-primary"
                  >
                    {t("vibeCode")}
                  </Link>
                </li>
              </ul>
            </div>

            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {t("resources")}
              </p>
              <ul className="space-y-3 text-sm">
                <li>
                  <Link
                    to="/docs"
                    className="text-muted-foreground transition-colors hover:text-primary"
                  >
                    {t("documentation")}
                  </Link>
                </li>
                <li>
                  <Link
                    to="/blog"
                    className="text-muted-foreground transition-colors hover:text-primary"
                  >
                    {t("blog")}
                  </Link>
                </li>
                <li>
                  <Link
                    to="/about"
                    className="text-muted-foreground transition-colors hover:text-primary"
                  >
                    {t("about")}
                  </Link>
                </li>
                <li>
                  <Link
                    to="/status"
                    className="text-muted-foreground transition-colors hover:text-primary"
                  >
                    {t("systemStatus")}
                  </Link>
                </li>
              </ul>
            </div>

            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {t("trust")}
              </p>
              <ul className="space-y-3 text-sm">
                <li>
                  <Link
                    to="/privacy"
                    className="text-muted-foreground transition-colors hover:text-primary"
                  >
                    {t("privacyPolicy")}
                  </Link>
                </li>
                <li>
                  <Link
                    to="/terms"
                    className="text-muted-foreground transition-colors hover:text-primary"
                  >
                    {t("termsOfService")}
                  </Link>
                </li>
                <li>
                  <Link
                    to="/security"
                    className="inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-primary"
                  >
                    <ShieldCheck className="size-3.5" />
                    {t("security")}
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
                    {t("changelog")}
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="rubik-divider my-6" />

          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold tracking-[0.04em] text-muted-foreground">
                {t("copyright", { year: new Date().getFullYear() })}
              </p>
              <p className="text-xs text-muted-foreground/80">{t("tagline")}</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <a
                href="/status"
                aria-label="System status"
                className="inline-flex items-center gap-2 rounded-full border border-success/20 bg-success/70 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-success-foreground"
              >
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/40 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-success"></span>
                </span>
                {t("statusHealthy")}
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
