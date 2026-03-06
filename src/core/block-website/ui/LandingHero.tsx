import { useState, useEffect } from "react";
import { Link } from "../lazy-imports/link";
import { apiUrl } from "../core-logic/api";

export const TOTAL_TOOL_COUNT = 80;

function setThemeDirectly(theme: "light" | "dark") {
    localStorage.setItem("theme-preference", theme);
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.classList.toggle("light", theme === "light");
}

export function LandingHero() {
    const [stars, setStars] = useState<number | null>(null);

    useEffect(() => {
        fetch(apiUrl("/github/stars"))
            .then(res => res.json() as Promise<{ stars: number | null }>)
            .then((data) => {
                if (data.stars != null) setStars(data.stars);
            })
            .catch(() => { /* graceful fallback — don't show stars */ });
    }, []);
    return (
        <section
            aria-labelledby="hero-heading"
            className="py-24 sm:py-32 px-4 sm:px-6 max-w-3xl mx-auto text-center font-sans"
        >
            {/* Teal glow badge */}
            <div
                className="mb-8 inline-block px-4 py-1.5 rounded-full text-xs font-semibold tracking-widest backdrop-blur-sm transition-colors shadow-sm
                           border border-border/50 bg-muted/30 text-muted-foreground hover:bg-muted/50
                           dark:border-primary/30 dark:bg-primary/10 dark:text-primary-light dark:hover:bg-primary/20 glow-primary"
                aria-label="Features: Open-Source AI App Ecosystem, Instant Deploys"
            >
                OPEN-SOURCE AI APP ECOSYSTEM · INSTANT DEPLOYS
            </div>

            <h1
                id="hero-heading"
                className="text-fluid-h1 tracking-tight mb-8 text-balance"
            >
                <span className="text-muted-foreground font-normal" style={{ fontVariationSettings: '"wght" 400' }}>Give your AI agents</span> <br />
                <span className="text-foreground">the power to act.</span>
            </h1>

            <p className="text-xl sm:text-2xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-[1.6] text-balance">
                spike.land connects your AI assistant to real-world tools using the Model Context Protocol (MCP).
                <br /><br />
                <span className="text-lg leading-[1.6]">MCP lets AI assistants use databases, APIs, and code editors through a single standard interface.</span>
            </p>

            <div
                className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6"
                role="group"
                aria-label="Primary actions"
            >
                {/* Primary CTA — clicking "I'm a developer" sets dark mode (devs love dark mode) */}
                <Link
                    href="/tools"
                    onClick={() => setThemeDirectly("dark")}
                    className="w-full sm:w-auto px-8 py-4 text-lg font-medium rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2
                               bg-foreground text-background hover:opacity-90 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] focus:ring-foreground
                               dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary-light glow-primary dark:focus:ring-primary"
                >
                    I'm a developer
                </Link>
                {/* Secondary CTA — explorers get to keep the light */}
                <Link
                    href="/store"
                    onClick={() => setThemeDirectly("light")}
                    className="w-full sm:w-auto px-8 py-4 text-lg font-medium rounded-xl inline-flex items-center justify-center gap-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2
                               bg-background border border-border/50 text-foreground hover:bg-muted/50 hover:border-border hover:shadow-sm hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] focus:ring-foreground
                               dark:bg-white/10 dark:border-white/20 dark:text-white dark:hover:bg-white/15 dark:backdrop-blur-md dark:hover:-translate-y-0.5 dark:focus:ring-white/30"
                >
                    I'm exploring
                </Link>
            </div>

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
