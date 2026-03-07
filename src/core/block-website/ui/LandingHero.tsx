import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "../lazy-imports/link";
import { apiUrl } from "../core-logic/api";
import { useDevMode } from "../core-logic/dev-mode";
import { triggerViewTransition } from "../core-logic/view-transition";
import { motion, AnimatePresence } from "framer-motion";

export const TOTAL_TOOL_COUNT = 80;

function setThemeDirectly(theme: "light" | "dark") {
    localStorage.setItem("theme-preference", theme);
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.classList.toggle("light", theme === "light");
}

export function LandingHero() {
    const [stars, setStars] = useState<number | null>(null);
    const { isDeveloper, setDevMode } = useDevMode();
    const devButtonRef = useRef<HTMLButtonElement>(null);
    const [showVibeButton, setShowVibeButton] = useState(isDeveloper);

    useEffect(() => {
        fetch(apiUrl("/github/stars"))
            .then(res => res.json() as Promise<{ stars: number | null }>)
            .then((data) => {
                if (data.stars != null) setStars(data.stars);
            })
            .catch(() => { /* graceful fallback */ });
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
        const newTheme = newDevMode ? "dark" as const : "light" as const;
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
            className="py-24 sm:py-32 px-4 sm:px-6 max-w-3xl mx-auto text-center font-sans relative flex flex-col items-center"
        >
            {/* Badge */}
            <div className="relative h-8 mb-8 flex justify-center items-center w-full">
                <AnimatePresence mode="wait">
                    {isDeveloper ? (
                        <motion.div
                            key="dev-badge"
                            initial={{ opacity: 0, y: -10, filter: "blur(4px)" }}
                            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                            exit={{ opacity: 0, y: -10, filter: "blur(4px)", position: "absolute" }}
                            transition={{ duration: 0.4 }}
                            className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold tracking-widest backdrop-blur-sm transition-colors shadow-sm border border-primary/30 bg-primary/10 text-primary-light glow-primary"
                        >
                            DEVELOPER MODE ACTIVE
                        </motion.div>
                    ) : (
                        <motion.div
                            key="default-badge"
                            initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
                            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                            exit={{ opacity: 0, y: 10, filter: "blur(4px)", position: "absolute" }}
                            transition={{ duration: 0.4 }}
                            className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold tracking-widest backdrop-blur-sm transition-colors shadow-sm border border-border/50 bg-muted/30 text-muted-foreground"
                        >
                            OPEN-SOURCE AI APP ECOSYSTEM · INSTANT DEPLOYS
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Heading */}
            <div className="relative mb-8 min-h-[140px] sm:min-h-[160px] flex justify-center items-center w-full">
                <AnimatePresence mode="wait">
                    {isDeveloper ? (
                        <motion.h1
                            key="dev-heading"
                            initial={{ opacity: 0, scale: 0.95, filter: "blur(8px)" }}
                            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                            exit={{ opacity: 0, scale: 1.05, filter: "blur(8px)", position: "absolute" }}
                            transition={{ duration: 0.5, type: "spring", bounce: 0.2 }}
                            id="hero-heading-dev"
                            className="text-fluid-h1 text-balance w-full"
                            style={{ fontVariationSettings: `"wght" 700`, letterSpacing: "-0.03em" }}
                        >
                            <span className="text-foreground">
                                Build powerful MCP servers
                            </span>
                            <br />
                            <span className="text-primary-light">at the edge.</span>
                        </motion.h1>
                    ) : (
                        <motion.h1
                            key="default-heading"
                            initial={{ opacity: 0, scale: 1.05, filter: "blur(8px)" }}
                            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                            exit={{ opacity: 0, scale: 0.95, filter: "blur(8px)", position: "absolute" }}
                            transition={{ duration: 0.5, type: "spring", bounce: 0.2 }}
                            id="hero-heading"
                            className="text-fluid-h1 text-balance w-full"
                            style={{ fontVariationSettings: `"wght" 400`, letterSpacing: "-0.02em" }}
                        >
                            <span className="text-muted-foreground">
                                Give your AI agents
                            </span>
                            <br />
                            <span className="text-foreground">the power to act.</span>
                        </motion.h1>
                    )}
                </AnimatePresence>
            </div>

            {/* Description */}
            <div className="relative mb-10 min-h-[120px] flex justify-center items-center w-full">
                <AnimatePresence mode="wait">
                    {isDeveloper ? (
                        <motion.p
                            key="dev-desc"
                            initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
                            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                            exit={{ opacity: 0, y: -10, filter: "blur(4px)", position: "absolute" }}
                            transition={{ duration: 0.4, delay: 0.05 }}
                            className="text-xl sm:text-2xl text-muted-foreground max-w-2xl mx-auto leading-[1.6] text-balance w-full"
                        >
                            Deploy typescript tools instantly with HMR, zero-config caching, and global edge network distribution.
                            <br /><br />
                            <span className="text-lg leading-[1.6] text-primary-light/80">Stop worrying about infrastructure. Start building agent capabilities.</span>
                        </motion.p>
                    ) : (
                        <motion.p
                            key="default-desc"
                            initial={{ opacity: 0, y: -10, filter: "blur(4px)" }}
                            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                            exit={{ opacity: 0, y: 10, filter: "blur(4px)", position: "absolute" }}
                            transition={{ duration: 0.4, delay: 0.05 }}
                            className="text-xl sm:text-2xl text-muted-foreground max-w-2xl mx-auto leading-[1.6] text-balance w-full"
                        >
                            spike.land connects your AI assistant to real-world tools using the Model Context Protocol (MCP).
                            <br /><br />
                            <span className="text-lg leading-[1.6]">MCP lets AI assistants use databases, APIs, and code editors through a single standard interface.</span>
                        </motion.p>
                    )}
                </AnimatePresence>
            </div>

            <motion.div
                layout
                className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 mt-4 relative z-10 w-full"
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
                    className={`w-full sm:w-auto px-8 py-4 text-lg font-medium rounded-xl transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2
                        ${isDeveloper
                            ? "bg-primary text-primary-foreground hover:bg-primary-light glow-primary focus:ring-primary ring-2 ring-primary/30"
                            : "bg-foreground text-background hover:opacity-90 hover:shadow-lg focus:ring-foreground dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary-light glow-primary dark:focus:ring-primary"
                        }`}
                    aria-pressed={isDeveloper}
                >
                    I'm a developer
                </motion.button>

                {/* Secondary CTA: crossfade between "I'm exploring" and "Vibe Code Online Now" */}
                <motion.div layout className="w-full sm:w-auto relative" style={{ minHeight: "3.5rem" }}>
                    <AnimatePresence mode="wait">
                        {!showVibeButton ? (
                            <motion.div
                                key="btn-exploring"
                                initial={{ opacity: 0, scale: 0.9, filter: "blur(4px)" }}
                                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                                exit={{ opacity: 0, scale: 0.9, filter: "blur(4px)", position: "absolute" }}
                                transition={{ duration: 0.2 }}
                                className="w-full inset-0"
                            >
                                <Link
                                    href="/blog"
                                    onClick={() => setThemeDirectly("light")}
                                    className="block w-full sm:w-auto px-8 py-4 text-lg font-medium rounded-xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2
                                        bg-background border border-border/50 text-foreground hover:bg-muted/50 hover:border-border hover:shadow-sm focus:ring-foreground
                                        dark:bg-white/10 dark:border-white/20 dark:text-white dark:hover:bg-white/15 dark:backdrop-blur-md dark:focus:ring-white/30"
                                >
                                    I'm exploring
                                </Link>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="btn-vibe"
                                initial={{ opacity: 0, scale: 0.9, filter: "blur(4px)" }}
                                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                                exit={{ opacity: 0, scale: 0.9, filter: "blur(4px)", position: "absolute" }}
                                transition={{ duration: 0.2 }}
                                className="w-full inset-0"
                            >
                                <Link
                                    href="/vibe-code"
                                    className="block w-full sm:w-auto px-8 py-4 text-lg font-extrabold rounded-xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2
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

            <dl
                className="mt-20 pt-10 border-t border-border flex flex-wrap items-center justify-center gap-x-3 gap-y-4 text-sm text-muted-foreground"
                aria-label="Platform Statistics"
            >
                {stars != null && (
                    <>
                        <div className="flex items-baseline gap-1.5">
                            <dt className="sr-only">GitHub Stars</dt>
                            <dd className="font-semibold text-foreground text-base flex items-center gap-1.5">
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .587l3.668 7.568 8.332 1.151-6.064 5.828 1.48 8.279-7.416-3.967-7.417 3.967 1.481-8.279-6.064-5.828 8.332-1.151z" /></svg>
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
                    <dd><Link href="/pricing" className="hover:text-foreground hover:underline transition-colors">to start</Link></dd>
                </div>
            </dl>
        </section>
    );
}
