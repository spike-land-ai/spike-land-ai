import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "../lazy-imports/link";
import { apiUrl } from "../core-logic/api";
import { useDevMode, useDevModeTransition } from "../core-logic/dev-mode";
import { triggerViewTransition } from "../core-logic/view-transition";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Code2, Globe2, Sparkles, TerminalSquare } from "lucide-react";
import { useDevModeCopy } from "./useDevModeCopy";

export const TOTAL_TOOL_COUNT = 80;

function setThemeDirectly(theme: "light" | "dark") {
  localStorage.setItem("theme-preference", theme);
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.classList.toggle("light", theme === "light");
}

export function LandingHero() {
  const [stars, setStars] = useState<number | null>(null);
  const { isDeveloper, setDevMode } = useDevMode();
  const { isTransitioning, targetMode } = useDevModeTransition();
  const devButtonRef = useRef<HTMLButtonElement>(null);
  const [showVibeButton, setShowVibeButton] = useState(isDeveloper);
  const badgeCopy = useDevModeCopy(
    "MCP RUNTIME FOR HIGH-TRUST FLOWS",
    "DEVELOPER MODE: TOOL-FIRST QA",
  );
  const headingCopy = useDevModeCopy(
    "Move critical verification below the browser.",
    "Ship typed tools your CI, agents, and product can call the same way.",
  );
  const bodyCopy = useDevModeCopy(
    "spike.land is the managed runtime for teams drowning in slow, flaky end-to-end tests. Start with one brittle Playwright or Cypress flow, keep the browser as a thin smoke layer, and run the important logic at function speed.",
    "Model billing, auth, permissions, and state transitions as typed MCP contracts. Keep Playwright for smoke coverage while spike.land handles hosting, auth, metering, and edge execution.",
  );
  const runtimeLabel = useDevModeCopy("Reference flow", "Contract surface");
  const inventoryLabel = useDevModeCopy("Starting wedge", "Execution plane");
  const inventoryBody = useDevModeCopy(
    "QA-heavy agencies and AI consultancies are the first commercial focus. The wider platform stays visible, but not as the first sales motion.",
    "One typed contract can power CI checks, internal tooling, CLI actions, and agent calls without changing the underlying semantics.",
  );
  const modeLabel = useDevModeCopy("Commercial thesis", "Builder shift");
  const modeBody = useDevModeCopy(
    "Platform business first. COMPASS stays as a proof point, not the thing investors are being asked to underwrite directly.",
    "The page pivots from fundraising-safe framing into implementation language without changing the runtime beneath it.",
  );

  useEffect(() => {
    fetch(apiUrl("/github/stars"))
      .then((res) => res.json() as Promise<{ stars: number | null }>)
      .then((data) => {
        if (data.stars != null) setStars(data.stars);
      })
      .catch(() => {
        /* graceful fallback */
      });
  }, []);

  // Sync vibe button with dev mode state
  useEffect(() => {
    if (isDeveloper) {
      const timer = setTimeout(() => setShowVibeButton(true), 300);
      return () => clearTimeout(timer);
    }
    setShowVibeButton(false);
    return undefined;
  }, [isDeveloper]);

  const handleDevToggle = useCallback(() => {
    const newDevMode = !isDeveloper;
    const newTheme = newDevMode ? ("dark" as const) : ("light" as const);
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const doToggle = () => {
      setThemeDirectly(newTheme);
      setDevMode(newDevMode);
    };

    if (prefersReduced) {
      doToggle();
      return;
    }

    triggerViewTransition(devButtonRef, doToggle);
  }, [isDeveloper, setDevMode]);

  return (
    <section
      aria-labelledby="hero-heading"
      className="rubik-container-wide rubik-section-compact relative overflow-hidden pb-16 pt-10 font-sans sm:pb-20 sm:pt-14"
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[18%] top-0 h-56 w-56 rounded-full bg-primary/10 blur-[90px]" />
        <div className="absolute right-[8%] top-24 h-48 w-48 rounded-full bg-info/20 blur-[110px]" />
        {isTransitioning && (
          <>
            <div className="absolute inset-x-0 top-0 h-px bg-primary/60 shadow-[0_0_24px_var(--primary-glow)] animate-pulse" />
            <div className="absolute left-0 right-0 top-0 h-24 bg-gradient-to-b from-primary/10 to-transparent animate-pulse" />
            <motion.div
              className="absolute left-0 right-0 h-20 bg-gradient-to-b from-primary/0 via-primary/18 to-primary/0"
              initial={{ top: "-5%" }}
              animate={{ top: "105%" }}
              transition={{ duration: 2, ease: "linear" }}
            />
          </>
        )}
      </div>

      <div className="relative grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        <div className="flex flex-col items-start text-left">
          <div className="relative mb-6 h-8 w-full">
            <AnimatePresence mode="wait">
              {isDeveloper ? (
                <motion.div
                  key="dev-badge"
                  initial={{ opacity: 0, y: -10, filter: "blur(4px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -10, filter: "blur(4px)", position: "absolute" }}
                  transition={{ duration: 0.4 }}
                  className="rubik-eyebrow border-primary/30 bg-primary/12 text-primary shadow-[var(--panel-shadow)]"
                >
                  <Sparkles className="size-3.5" />
                  {badgeCopy.text}
                </motion.div>
              ) : (
                <motion.div
                  key="default-badge"
                  initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: 10, filter: "blur(4px)", position: "absolute" }}
                  transition={{ duration: 0.4 }}
                  className="rubik-eyebrow"
                >
                  <Globe2 className="size-3.5" />
                  {badgeCopy.text}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="relative mb-4 min-h-[112px] w-full sm:min-h-[144px]">
            <AnimatePresence mode="wait">
              {isDeveloper ? (
                <motion.h1
                  key="dev-heading"
                  initial={{ opacity: 0, scale: 0.95, filter: "blur(8px)" }}
                  animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                  exit={{ opacity: 0, scale: 1.05, filter: "blur(8px)", position: "absolute" }}
                  transition={{ duration: 0.5, type: "spring", bounce: 0.2 }}
                  id="hero-heading-dev"
                  className="text-fluid-h1 max-w-4xl text-balance"
                  style={{ fontVariationSettings: `"wght" 760`, letterSpacing: "-0.04em" }}
                >
                  {headingCopy.text}
                </motion.h1>
              ) : (
                <motion.h1
                  key="default-heading"
                  initial={{ opacity: 0, scale: 1.05, filter: "blur(8px)" }}
                  animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                  exit={{ opacity: 0, scale: 0.95, filter: "blur(8px)", position: "absolute" }}
                  transition={{ duration: 0.5, type: "spring", bounce: 0.2 }}
                  id="hero-heading"
                  className="text-fluid-h1 max-w-4xl text-balance"
                  style={{ fontVariationSettings: `"wght" 700`, letterSpacing: "-0.04em" }}
                >
                  {headingCopy.text}
                </motion.h1>
              )}
            </AnimatePresence>
          </div>

          <div className="relative mb-7 min-h-[88px] w-full sm:min-h-[104px]">
            <AnimatePresence mode="wait">
              {isDeveloper ? (
                <motion.p
                  key="dev-desc"
                  initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -10, filter: "blur(4px)", position: "absolute" }}
                  transition={{ duration: 0.4, delay: 0.05 }}
                  className="max-w-2xl text-balance text-lg leading-8 text-muted-foreground sm:text-xl"
                >
                  {bodyCopy.text}
                </motion.p>
              ) : (
                <motion.p
                  key="default-desc"
                  initial={{ opacity: 0, y: -10, filter: "blur(4px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: 10, filter: "blur(4px)", position: "absolute" }}
                  transition={{ duration: 0.4, delay: 0.05 }}
                  className="max-w-2xl text-balance text-lg leading-8 text-muted-foreground sm:text-xl"
                >
                  {bodyCopy.text}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          <motion.div
            layout
            className="flex w-full flex-col items-stretch gap-4 sm:w-auto sm:flex-row sm:items-center"
            role="group"
            aria-label="Primary actions"
          >
            {/* Dev mode toggle */}
            <motion.button
              layout
              ref={devButtonRef}
              onClick={handleDevToggle}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`w-full rounded-[calc(var(--radius-control)-0.1rem)] px-6 py-3 text-base font-semibold transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 sm:w-auto
                        ${
                          isDeveloper
                            ? "ring-2 ring-primary/30 bg-primary text-primary-foreground hover:bg-primary-light focus:ring-primary glow-primary"
                            : "bg-foreground text-background hover:bg-foreground/92 focus:ring-foreground dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary-light dark:focus:ring-primary glow-primary"
                        }`}
              aria-pressed={isDeveloper}
            >
              I&apos;m a developer
            </motion.button>

            <motion.div
              layout
              className="relative w-full sm:w-auto"
              style={{ minHeight: "3.5rem" }}
            >
              <AnimatePresence mode="wait">
                {!showVibeButton ? (
                  <motion.div
                    key="btn-exploring"
                    initial={{ opacity: 0, scale: 0.9, filter: "blur(4px)" }}
                    animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                    exit={{ opacity: 0, scale: 0.9, filter: "blur(4px)", position: "absolute" }}
                    transition={{ duration: 0.2 }}
                    className="inset-0 w-full"
                  >
                    <Link
                      href="/what-we-do"
                      onClick={() => setThemeDirectly("light")}
                      className="flex w-full items-center justify-center gap-2 rounded-[calc(var(--radius-control)-0.1rem)] border border-border bg-background px-6 py-3 text-base font-semibold transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 hover:border-primary/24 hover:text-primary focus:ring-foreground sm:w-auto dark:bg-white/10 dark:border-white/20 dark:text-white dark:hover:bg-white/15 dark:backdrop-blur-md dark:focus:ring-white/30"
                    >
                      See the wedge
                      <ArrowRight className="size-4" />
                    </Link>
                  </motion.div>
                ) : (
                  <motion.div
                    key="btn-vibe"
                    initial={{ opacity: 0, scale: 0.9, filter: "blur(4px)" }}
                    animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                    exit={{ opacity: 0, scale: 0.9, filter: "blur(4px)", position: "absolute" }}
                    transition={{ duration: 0.2 }}
                    className="inset-0 w-full"
                  >
                    <Link
                      href="/apps/qa-studio"
                      className="block w-full rounded-[calc(var(--radius-control)-0.1rem)] bg-primary px-6 py-3 text-center text-base font-semibold text-primary-foreground transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary sm:w-auto hover:bg-primary-light glow-primary"
                      style={{ fontVariationSettings: '"wght" 720' }}
                    >
                      Inspect QA Studio
                    </Link>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>

          <AnimatePresence>
            {isTransitioning && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary"
              >
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                </span>
                {targetMode
                  ? "Agent rewriting builder surface"
                  : "Agent restoring explorer surface"}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-10 grid gap-3 sm:grid-cols-3">
            {[
              { icon: TerminalSquare, label: "Commercial wedge", value: "QA-heavy teams first" },
              { icon: Code2, label: "Verification model", value: "Function-speed tool checks" },
              { icon: Globe2, label: "Adoption path", value: "Keep browser smoke thin" },
            ].map((item) => (
              <div key={item.label} className="rubik-panel p-4">
                <div className="rubik-icon-badge mb-3 size-10 rounded-xl">
                  <item.icon className="size-4" />
                </div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {item.label}
                </p>
                <p className="mt-2 text-sm font-medium text-foreground">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="absolute inset-6 rounded-[var(--radius-panel-lg)] bg-primary/10 blur-[110px]" />
          <div className="rubik-panel-strong relative overflow-hidden rounded-[var(--radius-panel-lg)] p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Live surface
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
                  Tool-first QA console
                </p>
              </div>
              <div className="rubik-chip rubik-chip-accent">MCP online</div>
            </div>

            <div className="grid gap-4">
              <div className="rubik-panel p-4">
                <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  <span className="size-2 rounded-full bg-emerald-400" />
                  {runtimeLabel.text}
                </div>
                <div className="space-y-3 font-mono text-sm text-foreground">
                  <div className="rubik-signal-rail flex items-center justify-between rounded-2xl px-3 py-2">
                    <span>flow.contract()</span>
                    <span className="text-primary">{isDeveloper ? "typed" : "selected"}</span>
                  </div>
                  <div className="rubik-signal-rail flex items-center justify-between rounded-2xl px-3 py-2">
                    <span>ci.verify()</span>
                    <span className="text-primary">
                      {isDeveloper ? "function speed" : "green path"}
                    </span>
                  </div>
                  <div className="rubik-signal-rail flex items-center justify-between rounded-2xl px-3 py-2">
                    <span>browser.smoke()</span>
                    <span className="text-primary">
                      {isDeveloper ? "thin layer" : "kept intact"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rubik-panel rubik-panel-muted p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {inventoryLabel.text}
                  </p>
                  <p className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-foreground">
                    {isDeveloper ? "Typed" : "QA first"}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">{inventoryBody.text}</p>
                </div>

                <div className="rubik-panel rubik-panel-muted p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {modeLabel.text}
                  </p>
                  <p className="mt-3 text-lg font-semibold tracking-[-0.03em] text-foreground">
                    {isDeveloper ? "Builder language enabled" : "Platform story, narrowed"}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">{modeBody.text}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <dl
        className="rubik-panel relative mt-16 flex flex-wrap items-center gap-x-3 gap-y-4 p-5 text-sm text-muted-foreground sm:p-6"
        aria-label="Platform Statistics"
      >
        {stars != null && (
          <>
            <div className="flex items-baseline gap-1.5">
              <dt className="sr-only">GitHub Stars</dt>
              <dd className="font-semibold text-foreground text-base flex items-center gap-1.5">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 .587l3.668 7.568 8.332 1.151-6.064 5.828 1.48 8.279-7.416-3.967-7.417 3.967 1.481-8.279-6.064-5.828 8.332-1.151z" />
                </svg>
                {stars.toLocaleString()}
              </dd>
              <dd>on GitHub</dd>
            </div>
            <div className="hidden sm:block w-1 h-1 rounded-full bg-border" aria-hidden="true" />
          </>
        )}
        <div className="flex items-baseline gap-1.5">
          <dt className="sr-only">Hosted tools</dt>
          <dd className="font-semibold text-foreground text-base">{TOTAL_TOOL_COUNT}+</dd>
          <dd>hosted tools</dd>
        </div>
        <div className="hidden sm:block w-1 h-1 rounded-full bg-border" aria-hidden="true" />
        <div className="flex items-baseline gap-1.5">
          <dt className="sr-only">Runtime</dt>
          <dd className="font-semibold text-foreground text-base">Global</dd>
          <dd>edge runtime</dd>
        </div>
        <div className="hidden sm:block w-1 h-1 rounded-full bg-border" aria-hidden="true" />
        <div className="flex items-baseline gap-1.5">
          <dt className="sr-only">Starting scope</dt>
          <dd className="font-semibold text-foreground text-base">1</dd>
          <dd>flow to start</dd>
        </div>
        <div className="hidden sm:block w-1 h-1 rounded-full bg-border" aria-hidden="true" />
        <div className="flex items-baseline gap-1.5">
          <dt className="sr-only">Pricing</dt>
          <dd className="font-semibold text-foreground text-base">Free</dd>
          <dd>
            <Link
              href="/pricing"
              className="hover:text-foreground hover:underline transition-colors"
            >
              to start
            </Link>
          </dd>
        </div>
      </dl>
    </section>
  );
}
