import { LandingHero } from "./landing/LandingHero";
import { AppShowcase } from "./landing/AppShowcase";
import { BlogListView } from "./BlogList";
import { Link } from "./ui/link";
import { Footer } from "./Footer";

export function LandingPage() {
  return (
    <main className="text-foreground font-sans">
      <LandingHero />
      
      <section className="py-12 bg-background border-y border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="bg-card rounded-2xl border border-border p-6 sm:p-8 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <svg className="w-24 h-24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 4.238 9.617 9.634 10.828.576.106.788-.25.788-.556 0-.273-.01-1.185-.015-2.171-4.037.876-4.889-1.731-4.889-1.731-.66-1.676-1.61-2.122-1.61-2.122-1.318-.9.1-.882.1-.882 1.457.102 2.224 1.496 2.224 1.496 1.296 2.218 3.39 1.577 4.216 1.206.13-.938.533-1.577.976-1.94-3.221-.366-6.608-1.61-6.608-7.17 0-1.583.565-2.877 1.492-3.892-.15-.366-.647-1.84.142-3.838 0 0 1.217-.422 3.992 1.486 1.157-.322 2.397-.483 3.633-.488 1.235.005 2.476.166 3.635.488 2.772-1.908 3.987-1.486 3.987-1.486.791 1.998.294 3.472.144 3.838.929 1.015 1.49 2.309 1.49 3.892 0 5.574-3.393 6.801-6.624 7.16.524.452.991 1.344.991 2.709 0 1.957-.014 3.532-.014 4.012 0 .31.209.669.799.554 5.393-1.213 9.629-5.526 9.629-10.828 0-6.627-5.373-12-12-12z"/></svg>
            </div>
            <div className="relative z-10">
              <h2 className="text-2xl font-bold mb-4">Get started in 60 seconds</h2>
              <p className="text-muted-foreground mb-6 max-w-2xl">
                Ready to connect your AI agent? Install the spike-cli and launch into a world of 80+ MCP tools. No registration required for free-tier tools.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                <div className="w-full sm:w-auto bg-muted rounded-lg px-4 py-3 font-mono text-sm border border-border flex items-center justify-between gap-4 group">
                  <span className="text-foreground">npx @spike-land-ai/spike-cli shell</span>
                  <button 
                    onClick={() => navigator.clipboard.writeText("npx @spike-land-ai/spike-cli shell")}
                    className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-background"
                    title="Copy to clipboard"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                  </button>
                </div>
                <Link href="/blog/getting-started-spike-land" className="text-sm font-semibold text-primary hover:underline">
                  Read the guide &rarr;
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <AppShowcase />

      <section
        aria-labelledby="features-heading"
        className="py-20 sm:py-24 border-t border-border bg-muted/50"
      >
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <h2
            id="features-heading"
            className="text-3xl font-bold tracking-tight text-foreground mb-10 text-balance"
          >
            How it works
          </h2>
          <dl className="divide-y divide-border">
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-0 py-6 first:pt-0">
              <dt className="sm:w-32 shrink-0 font-semibold text-foreground">Ready to use</dt>
              <dd className="text-muted-foreground leading-relaxed">
                Choose from 80+ pre-built apps covering everything from team operations to creative studios. Connect them instantly to your AI agent.
              </dd>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-0 py-6">
              <dt className="sm:w-32 shrink-0 font-semibold text-foreground">MCP Standard</dt>
              <dd className="text-muted-foreground leading-relaxed">
                Built on the <strong>Model Context Protocol (MCP)</strong>, these tools work natively with Claude Desktop, Cursor, and any other MCP-compatible AI client.
              </dd>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-0 py-6 last:pb-0">
              <dt className="sm:w-32 shrink-0 font-semibold text-foreground">Build your own</dt>
              <dd className="text-muted-foreground leading-relaxed">
                Can't find what you need? Use our browser-based creator to build a custom tool. We handle the servers, auth, and global deployment automatically.
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section
        aria-labelledby="updates-heading"
        className="py-20 sm:py-24 border-t border-border"
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <header className="mb-10 flex items-baseline justify-between">
            <h2
              id="updates-heading"
              className="text-3xl font-bold tracking-tight text-foreground"
            >
              Latest from the Blog
            </h2>
            <Link
              href="/blog"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              All posts &rarr;
            </Link>
          </header>

          <BlogListView limit={3} showHeader={false} />
        </div>
      </section>

      <Footer />
    </main>
  );
}

