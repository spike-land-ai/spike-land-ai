import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";

interface StoreTool {
  name: string;
  description: string;
  category?: string;
  version?: string;
  stability?: string;
}

interface StoreCategory {
  name: string;
  tools: StoreTool[];
}

interface StoreData {
  categories: StoreCategory[];
  featured: StoreTool[];
  total: number;
}

function ToolCard({ tool, featured = false }: { tool: StoreTool; featured?: boolean }) {
  const categoryColors: Record<string, string> = {
    marketplace: "bg-info text-info-foreground",
    ai: "bg-primary/10 text-primary",
    storage: "bg-success/50 text-success-foreground",
    auth: "bg-destructive/50 text-destructive-foreground",
    code: "bg-accent text-accent-foreground",
    analytics: "bg-warning/50 text-warning-foreground",
    career: "bg-secondary text-secondary-foreground",
    other: "bg-muted text-muted-foreground",
  };

  const cat = tool.category ?? "other";
  const colorClass = categoryColors[cat] ?? categoryColors.other;

  return (
    <div
      className={`rounded-xl border border-border bg-card p-5 shadow-sm transition hover:shadow-md hover:bg-muted/50 ${featured ? "ring-1 ring-primary/20" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold leading-tight text-foreground">{tool.name}</h3>
          <span className="inline-flex items-center rounded bg-info px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-info-foreground">
            MCP
          </span>
        </div>
        {tool.stability === "stable" && (
          <span className="rounded-full bg-success/20 px-2 py-0.5 text-[10px] font-medium text-success-foreground">
            stable
          </span>
        )}
      </div>
      {tool.description && (
        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{tool.description}</p>
      )}
      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <span className={`rounded-full px-2 py-0.5 font-medium ${colorClass}`}>{cat}</span>
        {tool.version && <span>v{tool.version}</span>}
      </div>
    </div>
  );
}

export function StorePage() {
  const [data, setData] = useState<StoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/store/tools")
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load store (${res.status})`);
        return res.json<StoreData>();
      })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Unknown error");
        setLoading(false);
      });
  }, []);

  const filteredData = useMemo(() => {
    if (!data || !search.trim()) return data;
    const q = search.toLowerCase();
    const filterTools = (tools: StoreTool[]) =>
      tools.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          (t.description?.toLowerCase().includes(q) ?? false),
      );
    return {
      ...data,
      featured: filterTools(data.featured),
      categories: data.categories
        .map((cat) => ({ ...cat, tools: filterTools(cat.tools) }))
        .filter((cat) => cat.tools.length > 0),
    };
  }, [data, search]);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Tool Store</h1>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 rounded-xl border border-border bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Tool Store</h1>
        <div className="rounded-xl border border-border bg-card p-8 text-center space-y-4">
          <p className="text-muted-foreground">
            We couldn't load the tool store right now. This might be a temporary issue.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!filteredData) return null;

  return (
    <div className="space-y-8">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-bold">App Store</h1>
          <p className="text-sm text-muted-foreground mt-1">Discover, install, rate, and review AI applications.</p>
        </div>
        <span className="text-sm text-muted-foreground">{data?.total} apps</span>
      </div>

      <input
        type="text"
        placeholder="Search tools by name or description..."
        aria-label="Search tools"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-lg border border-border bg-background px-4 py-2 text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
      />

      {filteredData.featured.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Featured</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredData.featured.map((tool) => (
              <Link key={tool.name} to="/tools" className="block">
                <ToolCard tool={tool} featured />
              </Link>
            ))}
          </div>
        </section>
      )}

      {filteredData.categories.map((cat) => (
        <section key={cat.name} className="space-y-3">
          <h2 className="text-lg font-semibold capitalize">{cat.name}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cat.tools.map((tool) => (
              <Link key={tool.name} to="/tools" className="block">
                <ToolCard tool={tool} />
              </Link>
            ))}
          </div>
        </section>
      ))}

      {filteredData.featured.length === 0 && filteredData.categories.length === 0 && (
        <div className="rounded-xl border border-border border-dashed p-12 text-center text-muted-foreground">
          No tools found matching your search.
        </div>
      )}
    </div>
  );
}
