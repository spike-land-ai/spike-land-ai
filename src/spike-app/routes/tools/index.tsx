import { useState } from "react";
import { Link } from "@tanstack/react-router";

const categories = [
  "All",
  "AI Gateway",
  "Filesystem",
  "Apps",
  "Analytics",
  "Configuration",
  "Arena",
];

const placeholderTools = [
  { name: "ai_chat", category: "AI Gateway", description: "Send a prompt to an AI model" },
  { name: "list_files", category: "Filesystem", description: "List files in a directory" },
  { name: "create_app", category: "Apps", description: "Create a new application" },
  { name: "get_metrics", category: "Analytics", description: "Retrieve usage metrics" },
  { name: "update_config", category: "Configuration", description: "Update system configuration" },
  { name: "arena_match", category: "Arena", description: "Compare model outputs side-by-side" },
];

export function ToolsIndexPage() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  const filtered = placeholderTools.filter((tool) => {
    const matchesSearch =
      tool.name.toLowerCase().includes(search.toLowerCase()) ||
      tool.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = activeCategory === "All" || tool.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Tool Registry</h1>
      <input
        type="text"
        placeholder="Search tools..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-lg border px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              activeCategory === cat
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((tool) => (
          <Link
            key={tool.name}
            to="/tools/$category"
            params={{ category: tool.category.toLowerCase().replace(/\s+/g, "-") }}
            className="rounded-xl border bg-white p-5 shadow-sm transition hover:shadow-md"
          >
            <h3 className="font-mono text-sm font-semibold">{tool.name}</h3>
            <p className="mt-1 text-sm text-gray-500">{tool.description}</p>
            <span className="mt-3 inline-block rounded-full bg-gray-100 px-3 py-0.5 text-xs text-gray-600">
              {tool.category}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
