"use client";

import { Link } from "../ui/link";

export const TOTAL_TOOL_COUNT = 15;

export function LandingHero() {
    return (
        <section 
            aria-labelledby="hero-heading" 
            className="py-24 sm:py-32 px-4 sm:px-6 max-w-3xl mx-auto text-center font-sans selection:bg-zinc-900 selection:text-white dark:selection:bg-zinc-100 dark:selection:text-zinc-900"
        >
            <div 
                className="mb-8 inline-block px-4 py-1.5 border border-zinc-200 dark:border-zinc-800 rounded-full text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-widest bg-zinc-50/50 dark:bg-zinc-900/50"
                role="text"
                aria-label="Features: MCP Multiplexer and Lazy Tool Loading"
            >
                MCP Multiplexer · Lazy Tool Loading
            </div>

            <h1 
                id="hero-heading"
                className="text-5xl sm:text-7xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 mb-8 leading-[1.1] text-balance"
            >
                <span className="text-zinc-400 dark:text-zinc-500 font-medium">Less context.</span> <br />
                Better AI.
            </h1>

            <p className="text-xl sm:text-2xl text-zinc-600 dark:text-zinc-400 mb-12 max-w-2xl mx-auto leading-relaxed text-balance">
                spike-cli lazy-loads MCP tools into on-demand toolsets. Your AI sees only what it needs —
                less context waste, better responses.
            </p>

            <div 
                className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6"
                role="group"
                aria-label="Primary actions"
            >
                <Link 
                    href="/apps/new" 
                    className="w-full sm:w-auto px-8 py-4 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-lg font-medium rounded-xl hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-900 active:bg-zinc-950"
                    aria-label="Start building a new app"
                >
                    Start Building
                </Link>
                <Link 
                    href="/tools" 
                    className="w-full sm:w-auto px-8 py-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 text-lg font-medium rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-900 active:bg-zinc-100"
                    aria-label="Explore available MCP tools"
                >
                    Explore Tools
                </Link>
            </div>

            <dl 
                className="mt-20 pt-10 border-t border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-8 text-sm text-zinc-500 dark:text-zinc-400"
                aria-label="Platform Statistics"
            >
                <div className="flex gap-2.5 items-center">
                    <dt className="sr-only">Available Tools</dt>
                    <dd className="font-semibold text-zinc-900 dark:text-zinc-100 text-base">{TOTAL_TOOL_COUNT}+</dd>
                    <span>Tools</span>
                </div>
                <div className="hidden sm:block w-1.5 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800" aria-hidden="true" />
                <div className="flex gap-2.5 items-center">
                    <dt className="sr-only">Feature: Lazy Load</dt>
                    <dd className="font-semibold text-zinc-900 dark:text-zinc-100 text-base">Lazy Load</dd>
                    <span className="sr-only">which results in</span>
                    <span>Save Context</span>
                </div>
                <div className="hidden sm:block w-1.5 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800" aria-hidden="true" />
                <div className="flex gap-2.5 items-center">
                    <dt className="sr-only">Configuration</dt>
                    <dd className="font-semibold text-zinc-900 dark:text-zinc-100 text-base">One Config</dd>
                    <span className="sr-only">for</span>
                    <span>All Servers</span>
                </div>
                <div className="hidden sm:block w-1.5 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800" aria-hidden="true" />
                <div className="flex gap-2.5 items-center">
                    <dt className="sr-only">Pricing</dt>
                    <dd className="font-semibold text-zinc-900 dark:text-zinc-100 text-base">Free</dd>
                    <span>to start</span>
                </div>
            </dl>
        </section>
    );
}
