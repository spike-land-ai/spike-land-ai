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
  const badgeCopy = useDevModeCopy("OPEN MCP PLATFORM", "DEVELOPER MODE ACTIVE");
  const headingCopy = useDevModeCopy(
    "Give your AI agents a real operating surface, not just another prompt box.",
    "Ship MCP servers with the feel of a design tool and the reach of the edge.",
  );
  const bodyCopy = useDevModeCopy(
    "spike.land connects AI assistants to real tools through MCP, so models can browse data, run workflows, and take action inside a system built for production.",
    "Deploy TypeScript tools instantly with hot reload, hosted auth, and global edge delivery. Focus on capability design while spike.land handles the runtime.",
  );
  const runtimeLabel = useDevModeCopy("Runtime", "Agent patch stream");
  const inventoryLabel = useDevModeCopy("Tool inventory", "Deployment surface");
  const inventoryBody = useDevModeCopy(
    "Ready-to-run capabilities across coding, media, research, auth, and ops.",
    "Tooling, auth, storage, and edge execution bundled into a single builder-facing layer.",
  );
  const modeLabel = useDevModeCopy("Dev mode", "Agent rewrite");
  const modeBody = useDevModeCopy(
    "One page that speaks to explorers and builders without fragmenting the brand.",
    "The copy retunes itself as if an agent is actively swapping in the implementation for builders.",
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
      className="relative overflow-hidden px-4 pb-16 pt-10 sm:px-6 sm:pb-20 sm:pt-14 font-sans"
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-[24rem] w-[24rem] -translate-x-1/2 rounded-full bg-primary/12 blur-3xl" />
        <div className="absolute right-0 top-24 h-48 w-48 rounded-full bg-primary/8 blur-3xl" />
        <div className="absolute left-0 top-40 h-40 w-40 rounded-full bg-foreground/6 blur-3xl" />
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

      <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
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
                  className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-black tracking-[0.22em] text-primary-light glow-primary"
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
                  className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/80 px-4 py-1.5 text-xs font-black tracking-[0.22em] text-muted-foreground backdrop-blur-sm"
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
              className={`w-full rounded-2xl px-8 py-4 text-lg font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 sm:w-auto
                        ${
                          isDeveloper
                            ? "ring-2 ring-primary/30 bg-primary text-primary-foreground hover:bg-primary-light focus:ring-primary glow-primary"
                            : "bg-foreground text-background hover:opacity-90 hover:shadow-lg focus:ring-foreground dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary-light dark:focus:ring-primary glow-primary"
                        }`}
              aria-pressed={isDeveloper}
            >
              I&apos;m a developer
            </motion.button>

            <motion.div layout className="relative w-full sm:w-auto" style={{ minHeight: "3.5rem" }}>
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
                      href="/blog"
                      onClick={() => setThemeDirectly("light")}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border/70 bg-background px-8 py-4 text-lg font-medium transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 hover:bg-muted/50 hover:border-border hover:shadow-sm focus:ring-foreground sm:w-auto
                                        bg-background border border-border/50 text-foreground hover:bg-muted/50 hover:border-border hover:shadow-sm focus:ring-foreground
                                        dark:bg-white/10 dark:border-white/20 dark:text-white dark:hover:bg-white/15 dark:backdrop-blur-md dark:focus:ring-white/30"
                    >
                      I&apos;m exploring
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
                      href="/vibe-code"
                      className="block w-full rounded-2xl px-8 py-4 text-center text-lg font-extrabold transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 hover:shadow-lg hover:shadow-primary/20 focus:ring-primary sm:w-auto
                                        bg-primary text-primary-foreground hover:bg-primary-light glow-primary focus:ring-primary hover:shadow-lg hover:shadow-primary/20"
                      style={{ fontVariationSettings: '"wght" 800' }}
                    >
                      Vibe Code Online Now
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
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-2 text-xs font-black uppercase tracking-[0.2em] text-primary"
              >
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                </span>
                {targetMode ? "Agent rewriting builder surface" : "Agent restoring explorer surface"}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-10 grid gap-3 sm:grid-cols-3">
            {[
              { icon: TerminalSquare, label: "Command-first setup", value: "1 command to connect" },
              { icon: Code2, label: "Custom tools", value: "Build or generate your own" },
              { icon: Globe2, label: "Edge runtime", value: "Deploy globally by default" },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-border/60 bg-card/80 p-4 backdrop-blur-sm"
              >
                <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <item.icon className="size-4" />
                </div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
                  {item.label}
                </p>
                <p className="mt-2 text-sm font-medium text-foreground">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="absolute inset-6 rounded-[2rem] bg-primary/10 blur-3xl" />
          <div className="relative overflow-hidden rounded-[2rem] border border-border/60 bg-card/80 p-6 shadow-2xl backdrop-blur-xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">
                  Live surface
                </p>
                <p className="mt-2 text-2xl font-black tracking-tight">Agent system console</p>
              </div>
              <div className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-primary">
                MCP online
              </div>
            </div>

            <div className="grid gap-4">
              <div className="rounded-[1.5rem] border border-border/50 bg-background/80 p-4">
                <div className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
                  <span className="size-2 rounded-full bg-emerald-400" />
                  {runtimeLabel.text}
                </div>
                <div className="space-y-3 font-mono text-sm text-foreground">
                  <div className="flex items-center justify-between rounded-xl bg-muted/60 px-3 py-2">
                    <span>registry.connect()</span>
                    <span className="text-primary">{isDeveloper ? "patched" : "ready"}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-muted/60 px-3 py-2">
                    <span>edge.deploy()</span>
                    <span className="text-primary">{isDeveloper ? "live build" : "4 regions"}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-muted/60 px-3 py-2">
                    <span>agent.invoke("qa-studio")</span>
                    <span className="text-primary">{isDeveloper ? "mutating" : "live"}</span>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-[1.5rem] border border-border/50 bg-muted/40 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
                    {inventoryLabel.text}
                  </p>
                  <p className="mt-3 text-4xl font-black tracking-tight text-foreground">
                    {isDeveloper ? "Edge+" : `${TOTAL_TOOL_COUNT}+`}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {inventoryBody.text}
                  </p>
                </div>

                <div className="rounded-[1.5rem] border border-border/50 bg-muted/40 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
                    {modeLabel.text}
                  </p>
                  <p className="mt-3 text-lg font-bold text-foreground">
                    {isDeveloper ? "Enabled for builder workflows" : "Toggle for deeper product surface"}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {modeBody.text}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <dl
        className="relative mx-auto mt-16 flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-4 border-t border-border/60 pt-8 text-sm text-muted-foreground"
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
          <dt className="sr-only">Available Apps</dt>
          <dd className="font-semibold text-foreground text-base">{TOTAL_TOOL_COUNT}+</dd>
          <dd>Ready-to-use Apps</dd>
        </div>
        <div className="hidden sm:block w-1 h-1 rounded-full bg-border" aria-hidden="true" />
        <div className="flex items-baseline gap-1.5">
          <dt className="sr-only">Performance</dt>
          <dd className="font-semibold text-foreground text-base">Global</dd>
          <dd>edge network</dd>
        </div>
        <div className="hidden sm:block w-1 h-1 rounded-full bg-border" aria-hidden="true" />
        <div className="flex items-baseline gap-1.5">
          <dt className="sr-only">Setup</dt>
          <dd className="font-semibold text-foreground text-base">Zero</dd>
          <dd>config required</dd>
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
