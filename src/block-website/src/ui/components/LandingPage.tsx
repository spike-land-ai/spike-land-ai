import { LandingHero } from "./landing/LandingHero";
import { BlogListView } from "./BlogList";

export function LandingPage() {
  return (
    <main className="text-zinc-900 dark:text-zinc-100 font-sans selection:bg-zinc-900 selection:text-white dark:selection:bg-zinc-100 dark:selection:text-zinc-900">
      <LandingHero />
      
      <section 
        aria-labelledby="features-heading"
        className="py-20 sm:py-24 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50"
      >
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h2 
            id="features-heading"
            className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 mb-6 text-balance"
          >
            The Database for Agents
          </h2>
          <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed text-balance">
            Agents subscribe, tools register, tasks flow. Built on Cloudflare Workers for real-time coordination and lightning-fast execution.
          </p>
        </div>
      </section>

      <section 
        aria-labelledby="updates-heading"
        className="py-20 sm:py-24 border-t border-zinc-100 dark:border-zinc-800"
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <header className="mb-12 text-center">
            <h2 
              id="updates-heading"
              className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100"
            >
              Latest Updates
            </h2>
            <p className="mt-4 text-zinc-600 dark:text-zinc-400">News, guides, and engineering updates from the team.</p>
          </header>
          
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
             <BlogListView />
          </div>
        </div>
      </section>
    </main>
  );
}
