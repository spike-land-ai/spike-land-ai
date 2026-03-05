"use client";

import { Link } from "../ui/link";

export const TOTAL_TOOL_COUNT = 80;

export function LandingHero() {
    return (
        <section
            aria-labelledby="hero-heading"
            className="py-24 sm:py-32 px-4 sm:px-6 max-w-3xl mx-auto text-center font-sans"
        >
            <div
                className="mb-8 inline-block px-4 py-1.5 border border-border rounded-full text-xs font-semibold text-muted-foreground tracking-widest bg-muted/50"
                role="text"
                aria-label="Features: Open AI App Ecosystem, Instant Deploys"
            >
                OPEN AI APP ECOSYSTEM · INSTANT DEPLOYS
            </div>

            <h1
                id="hero-heading"
                className="text-5xl sm:text-7xl font-bold tracking-tight mb-8 leading-[1.1] text-balance"
            >
                <span className="text-muted-foreground font-medium">Build, run, and share</span> <br />
                <span className="text-foreground">AI apps instantly.</span>
            </h1>

            <p className="text-xl sm:text-2xl text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed text-balance">
                Connect your AI agent to the real world using the <strong>Model Context Protocol (MCP)</strong>. 
                spike.land gives your AI the tools it needs to act—from building code to scaling your business.
            </p>

            <div
                className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6"
                role="group"
                aria-label="Primary actions"
            >
                <Link
                    href="/tools"
                    className="w-full sm:w-auto px-8 py-4 bg-foreground text-background text-lg font-medium rounded-xl hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-foreground active:opacity-80"
                    aria-label="Get Started Free or Browse Apps"
                >
                    Get Started Free
                </Link>
                <Link
                    href="https://github.com/spike-land-ai"
                    className="w-full sm:w-auto px-8 py-4 bg-background border border-border text-foreground text-lg font-medium rounded-xl hover:bg-muted/50 hover:border-muted-foreground/30 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-foreground active:bg-muted inline-flex items-center justify-center gap-2"
                    aria-label="View on GitHub"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 4.238 9.617 9.634 10.828.576.106.788-.25.788-.556 0-.273-.01-1.185-.015-2.171-4.037.876-4.889-1.731-4.889-1.731-.66-1.676-1.61-2.122-1.61-2.122-1.318-.9.1-.882.1-.882 1.457.102 2.224 1.496 2.224 1.496 1.296 2.218 3.39 1.577 4.216 1.206.13-.938.533-1.577.976-1.94-3.221-.366-6.608-1.61-6.608-7.17 0-1.583.565-2.877 1.492-3.892-.15-.366-.647-1.84.142-3.838 0 0 1.217-.422 3.992 1.486 1.157-.322 2.397-.483 3.633-.488 1.235.005 2.476.166 3.635.488 2.772-1.908 3.987-1.486 3.987-1.486.791 1.998.294 3.472.144 3.838.929 1.015 1.49 2.309 1.49 3.892 0 5.574-3.393 6.801-6.624 7.16.524.452.991 1.344.991 2.709 0 1.957-.014 3.532-.014 4.012 0 .31.209.669.799.554 5.393-1.213 9.629-5.526 9.629-10.828 0-6.627-5.373-12-12-12z"/></svg>
                    <span>GitHub</span>
                    <span className="ml-1 text-xs text-muted-foreground font-normal border-l border-border pl-2">5.2k+</span>
                </Link>
            </div>

            <dl
                className="mt-20 pt-10 border-t border-border flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-8 text-sm text-muted-foreground"
                aria-label="Platform Statistics"
            >
                <div className="flex gap-2.5 items-center">
                    <dt className="sr-only">Available Apps</dt>
                    <dd className="font-semibold text-foreground text-base">{TOTAL_TOOL_COUNT}+</dd>
                    <span>Ready-to-use Apps</span>
                </div>
                <div className="hidden sm:block w-1.5 h-1.5 rounded-full bg-border" aria-hidden="true" />
                <div className="flex gap-2.5 items-center">
                    <dt className="sr-only">Performance</dt>
                    <dd className="font-semibold text-foreground text-base">Sub-100ms</dd>
                    <span>latency at the edge</span>
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
                    <Link href="/pricing" className="hover:text-foreground hover:underline transition-colors flex gap-2.5 items-center">
                        <dd className="font-semibold text-foreground text-base">Free</dd>
                        <span>to start</span>
                    </Link>
                </div>
            </dl>
        </section>
    );
}
