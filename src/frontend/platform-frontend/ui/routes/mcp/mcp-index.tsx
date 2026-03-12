import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useMcpTools } from "../../src/hooks/useMcp";

const CATEGORY_ICONS: Record<string, string> = {
  "File System": "📁",
  Database: "🗄️",
  Web: "🌐",
  Code: "💻",
  AI: "🤖",
  Analytics: "📊",
  Auth: "🔐",
  Messaging: "💬",
  Storage: "☁️",
  General: "⚙️",
};

function getCategoryIcon(category: string): string {
  return CATEGORY_ICONS[category] ?? "🔧";
}

export function McpPage() {
  const { data, isLoading, isError } = useMcpTools();

  const categories = useMemo(() => {
    const tools = data?.tools ?? [];
    const map = new Map<string, number>();
    for (const tool of tools) {
      const cat = tool.category || "General";
      map.set(cat, (map.get(cat) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [data]);

  const totalTools = data?.tools?.length ?? 0;

  return (
    <div className="space-y-20">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-border bg-card px-8 py-16 text-center shadow-sm">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 pointer-events-none" />
        <div className="relative space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-1.5 text-xs font-medium text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            {isLoading ? "Loading..." : `${totalTools}+ tools live`}
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            80+ AI Tools, <span className="text-primary">One Protocol</span>
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            spike.land's MCP registry gives every AI model instant access to web search, databases,
            code execution, and more — through a single, authenticated connection.
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              to="/apps"
              className="rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Browse All Apps
            </Link>
            <Link
              to="/store"
              className="rounded-lg border border-border bg-background px-6 py-3 text-sm font-semibold text-foreground hover:bg-muted transition-colors"
            >
              Explore the Store
            </Link>
          </div>
        </div>
      </section>

      {/* What is MCP */}
      <section className="space-y-6">
        <h2 className="text-2xl font-bold text-foreground">What is MCP?</h2>
        <div className="grid gap-6 sm:grid-cols-3">
          {[
            {
              title: "Model Context Protocol",
              body: "An open standard by Anthropic that lets AI models connect to external tools, data sources, and services through a unified interface.",
            },
            {
              title: "One Connection, Everything",
              body: "Connect your AI client once and get access to the entire spike.land tool registry — no per-tool configuration or separate API keys.",
            },
            {
              title: "Secure by Default",
              body: "OAuth 2.0 device flow authentication means your credentials never leave your device. Fine-grained scopes control exactly what tools each client can use.",
            },
          ].map(({ title, body }) => (
            <div key={title} className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <h3 className="font-semibold text-foreground">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Tool Categories */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-foreground">Tool Categories</h2>
          <Link to="/apps" className="text-sm font-medium text-primary hover:underline">
            View app categories <span aria-hidden="true">→</span>
          </Link>
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-2xl border border-border bg-muted"
              />
            ))}
          </div>
        ) : isError ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
            Unable to load categories.{" "}
            <Link to="/apps" className="text-primary hover:underline">
              Browse apps directly
            </Link>
            .
          </div>
        ) : categories.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {categories.map(([category, count]) => (
              <Link
                key={category}
                to="/apps"
                className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:shadow-md hover:scale-[1.01] hover:border-primary/30"
              >
                <span className="text-2xl" aria-hidden="true">
                  {getCategoryIcon(category)}
                </span>
                <div>
                  <p className="font-medium text-foreground group-hover:text-primary transition-colors">
                    {category}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {count} {count === 1 ? "tool" : "tools"}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
            Unable to load categories.{" "}
            <Link to="/apps" className="text-primary hover:underline">
              Browse apps directly
            </Link>
            .
          </div>
        )}
      </section>

      {/* How to Connect */}
      <section className="space-y-6">
        <h2 className="text-2xl font-bold text-foreground">How to Connect</h2>
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Device Flow */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-lg font-bold text-primary">
              1
            </div>
            <h3 className="font-semibold text-foreground">Device Flow Auth</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Open your MCP client, point it at{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-foreground">
                https://spike.land/mcp
              </code>{" "}
              and follow the device authorization prompt.
            </p>
            <Link
              to="/mcp/authorize"
              className="inline-block text-sm font-medium text-primary hover:underline transition-colors"
            >
              Authorize a device <span aria-hidden="true">→</span>
            </Link>
          </div>

          {/* API Keys */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-lg font-bold text-primary">
              2
            </div>
            <h3 className="font-semibold text-foreground">API Keys</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Generate a long-lived API key in your settings and pass it as a Bearer token — ideal
              for server-to-server integrations.
            </p>
            <Link
              to="/settings"
              className="inline-block text-sm font-medium text-primary hover:underline transition-colors"
            >
              Manage API keys <span aria-hidden="true">→</span>
            </Link>
          </div>

          {/* SDK */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-lg font-bold text-primary">
              3
            </div>
            <h3 className="font-semibold text-foreground">SDK Integration</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Use the MCP TypeScript SDK or any compatible client library. Full documentation covers
              all transports and auth flows.
            </p>
            <Link
              to="/docs"
              className="inline-block text-sm font-medium text-primary hover:underline transition-colors"
            >
              Read the docs <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="rounded-2xl border border-border bg-card px-8 py-12 text-center shadow-sm space-y-5">
        <h2 className="text-2xl font-bold text-foreground">Ready to give your AI superpowers?</h2>
        <p className="text-muted-foreground">
          Connect in minutes. No credit card required for the free tier.
        </p>
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            to="/store"
            className="rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Get Started Free
          </Link>
          <Link
            to="/pricing"
            className="rounded-lg border border-border bg-background px-6 py-3 text-sm font-semibold text-foreground hover:bg-muted transition-colors"
          >
            View Pricing
          </Link>
        </div>
      </section>
    </div>
  );
}
