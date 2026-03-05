import { useState, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useMcpTools } from "../../src/hooks/useMcp";

export function ToolsIndexPage() {
  const { data, isLoading, isError, error } = useMcpTools();
  const [search, setSearch] = useState("");

  const categorizedTools = useMemo(() => {
    // Gracefully handle both { tools: [...] } and direct array responses
    const toolsArray = Array.isArray(data) ? data : data?.tools;
    if (!toolsArray || !Array.isArray(toolsArray)) return [];
    
    return toolsArray.map((tool: any) => ({
      ...tool,
      category: tool.category || "General",
      name: tool.name || "Unknown Tool",
      description: tool.description || "",
    }));
  }, [data]);

  const categories = ["All", ...Array.from(new Set(categorizedTools.map(t => t.category)))].sort();
  const [activeCategory, setActiveCategory] = useState("All");

  const filtered = categorizedTools.filter((tool) => {
    const matchesSearch =
      tool.name.toLowerCase().includes(search.toLowerCase()) ||
      tool.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = activeCategory === "All" || tool.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div role="status" aria-live="polite" className="text-muted-foreground animate-pulse">Loading tools...</div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Tool Registry</h1>
        </div>
        <div className="rounded-xl border border-border bg-card p-8 text-center space-y-4">
          <p className="text-muted-foreground">
            Unable to load live tool data. Here are some of our popular tools:
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-left">
            {[
              { name: "QA Studio", desc: "Automated browser testing" },
              { name: "Code Review", desc: "AI-powered code review" },
              { name: "Image Studio", desc: "AI image generation" },
              { name: "Chess Arena", desc: "Play chess against AI" },
              { name: "State Machine", desc: "Visual workflow builder" },
              { name: "HackerNews", desc: "Tech news reader" },
            ].map((tool) => (
              <div key={tool.name} className="rounded-xl border border-border p-4">
                <h3 className="font-semibold text-foreground">{tool.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{tool.desc}</p>
              </div>
            ))}
          </div>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tools Registry</h1>
          <p className="text-sm text-muted-foreground mt-1">Explore developer tools, MCP schemas, and endpoints.</p>
        </div>
        <span className="inline-flex items-center rounded-md bg-success/10 px-2 py-1 text-xs font-medium text-success-foreground ring-1 ring-inset ring-success/20">
          {categorizedTools.length} Live Tools
        </span>
      </div>

      <input
        type="text"
        placeholder="Search tools by name or description..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        aria-label="Search tools"
        className="w-full rounded-lg border border-border bg-background px-4 py-2 text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
      />

      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            aria-pressed={activeCategory === cat}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              activeCategory === cat
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-foreground hover:bg-muted/80"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border border-dashed p-12 text-center text-muted-foreground">
          No tools found matching your criteria.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((tool) => (
            <Link
              key={tool.name}
              to="/tools/$toolName"
              params={{
                toolName: tool.name,
              }}
              className="group rounded-xl border border-border bg-card p-5 shadow-sm transition hover:shadow-md hover:bg-muted/50"
            >
              <h3 className="font-mono text-sm font-semibold text-info-foreground group-hover:text-primary">
                {tool.name}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground line-clamp-2" title={tool.description}>
                {tool.description}
              </p>
              <div className="mt-4 flex items-center justify-between">
                <span className="inline-block rounded-full bg-muted px-3 py-0.5 text-xs text-muted-foreground">
                  {tool.category}
                </span>
                <span className="text-xs text-muted-foreground group-hover:text-primary">Run →</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
