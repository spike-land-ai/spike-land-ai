import { useState, useEffect } from "react";
import { Link } from "../ui/link";

export const TOTAL_TOOL_COUNT = 80;

export function LandingHero() {
    const [stars, setStars] = useState<number | null>(null);

    useEffect(() => {
        fetch("/api/github/stars")
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
            <div
                className="mb-8 inline-block px-4 py-1.5 border border-border/50 rounded-full text-xs font-semibold text-muted-foreground tracking-widest bg-muted/30 hover:bg-muted/50 transition-colors shadow-sm backdrop-blur-sm"
                aria-label="Features: Open-Source AI App Ecosystem, Instant Deploys"
            >
                OPEN-SOURCE AI APP ECOSYSTEM · INSTANT DEPLOYS
            </div>

            <h1
                id="hero-heading"
                className="text-5xl sm:text-7xl font-bold tracking-tight mb-8 leading-[1.1] text-balance"
            >
                <span className="text-muted-foreground font-medium">Give your AI agents</span> <br />
                <span className="text-foreground">the power to act.</span>
            </h1>

            <p className="text-xl sm:text-2xl text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed text-balance">
                spike.land connects your AI assistant to real-world tools using the Model Context Protocol (MCP).
                <br /><br />
                <span className="text-lg">MCP lets AI assistants use databases, APIs, and code editors through a single standard interface.</span>
            </p>

            <div
                className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6"
                role="group"
                aria-label="Primary actions"
            >
                <Link
                    href="/tools"
                    className="w-full sm:w-auto px-8 py-4 bg-foreground text-background text-lg font-medium rounded-xl hover:opacity-90 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-foreground"
                >
                    I'm a developer
                </Link>
                <Link
                    href="/store"
                    className="w-full sm:w-auto px-8 py-4 bg-background border border-border/50 text-foreground text-lg font-medium rounded-xl hover:bg-muted/50 hover:border-border hover:shadow-sm hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-foreground inline-flex items-center justify-center gap-2"
                >
                    I'm exploring
                </Link>
            </div>

            <dl
                className="mt-20 pt-10 border-t border-border flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-8 text-sm text-muted-foreground"
                aria-label="Platform Statistics"
            >
                {stars != null && (
                    <>
                        <div className="flex gap-2.5 items-center">
                            <dt className="sr-only">GitHub Stars</dt>
                            <dd className="font-semibold text-foreground text-base flex items-center gap-1.5">
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .587l3.668 7.568 8.332 1.151-6.064 5.828 1.48 8.279-7.416-3.967-7.417 3.967 1.481-8.279-6.064-5.828 8.332-1.151z"/></svg>
                                {stars.toLocaleString()}
                            </dd>
                            <span>on GitHub</span>
                        </div>
                        <div className="hidden sm:block w-1.5 h-1.5 rounded-full bg-border" aria-hidden="true" />
                    </>
                )}
                <div className="flex gap-2.5 items-center">
                    <dt className="sr-only">Available Apps</dt>
                    <dd className="font-semibold text-foreground text-base">{TOTAL_TOOL_COUNT}+</dd>
                    <span>Ready-to-use Apps</span>
                </div>
                <div className="hidden sm:block w-1.5 h-1.5 rounded-full bg-border" aria-hidden="true" />
                <div className="flex gap-2.5 items-center">
                    <dt className="sr-only">Performance</dt>
                    <dd className="font-semibold text-foreground text-base">Global</dd>
                    <span>edge network</span>
                </div>
                <div className="hidden sm:block w-1.5 h-1.5 rounded-full bg-border" aria-hidden="true" />
                <div className="flex gap-2.5 items-center">
                    <dt className="sr-only">Setup</dt>
                    <dd className="font-semibold text-foreground text-base">Zero</dd>
                    <span>config required</span>
                </div>
                <div className="hidden sm:block w-1.5 h-1.5 rounded-full bg-border" aria-hidden="true" />
                <div className="flex gap-2.5 items-center">
                    <dt className="sr-only">Pricing</dt>
                    <dd className="font-semibold text-foreground text-base">
                        <Link href="/pricing" className="hover:text-foreground hover:underline transition-colors flex gap-2.5 items-center">
                            <span>Free</span>
                            <span>to start</span>
                        </Link>
                    </dd>
                </div>
            </dl>
        </section>
    );
}
