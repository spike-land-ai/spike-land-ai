import { useState, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useMcpTools } from "../../src/hooks/useMcp";

export function ToolsIndexPage() {
  const { data, isLoading, isError, error } = useMcpTools();
  const [search, setSearch] = useState("");
  
  // Categorize dynamically based on tool name prefixes (e.g. fs_read -> Filesystem)
  const categorizedTools = useMemo(() => {
    if (!data?.tools) return [];
    return data.tools.map(tool => {
      let category = "General";
      if (tool.name.startsWith("fs_") || tool.name.includes("file")) category = "Filesystem";
      if (tool.name.startsWith("github_") || tool.name.includes("git")) category = "GitHub";
      if (tool.name.includes("db_") || tool.name.includes("sql")) category = "Database";
      if (tool.name.includes("chat") || tool.name.includes("ai")) category = "AI Gateway";
      if (tool.name.startsWith("auth_")) category = "Authentication";
      if (tool.name.startsWith("test_")) category = "Testing";
      if (tool.name.startsWith("bazdmeg_")) category = "Bazdmeg Code Review";
      
      return { ...tool, category };
    });
  }, [data?.tools]);

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
        <div className="text-gray-500">Loading tools from edge...</div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-600">
        <h3 className="font-bold">Error loading tools</h3>
        <p className="text-sm">{error instanceof Error ? error.message : "Unknown error"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tool Registry</h1>
        <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
          {data?.tools?.length || 0} Live Tools
        </span>
      </div>
      
      <input
        type="text"
        placeholder="Search tools by name or description..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-lg border px-4 py-2 text-gray-900 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
      />
      
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              activeCategory === cat
                ? "bg-cyan-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-zinc-800 dark:text-gray-300 dark:hover:bg-zinc-700"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>
      
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-gray-500 dark:border-zinc-800">
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
              className="group rounded-xl border bg-white p-5 shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/50"
            >
              <h3 className="font-mono text-sm font-semibold text-cyan-700 group-hover:text-cyan-600 dark:text-cyan-400">
                {tool.name}
              </h3>
              <p className="mt-2 text-sm text-gray-600 line-clamp-2 dark:text-gray-400" title={tool.description}>
                {tool.description}
              </p>
              <div className="mt-4 flex items-center justify-between">
                <span className="inline-block rounded-full bg-gray-100 px-3 py-0.5 text-xs text-gray-600 dark:bg-zinc-800 dark:text-gray-400">
                  {tool.category}
                </span>
                <span className="text-xs text-gray-400 group-hover:text-cyan-500">Run →</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
