import { useParams, Link } from "@tanstack/react-router";

export function ToolsCategoryPage() {
  const { category } = useParams({ strict: false });

  const displayName = category
    ? category.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "Category";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/tools" className="text-blue-600 hover:underline">
          Tools
        </Link>
        <span className="text-gray-400">/</span>
        <h1 className="text-2xl font-bold">{displayName}</h1>
      </div>
      <div className="rounded-xl border bg-white p-8 text-center text-gray-500">
        <p>Tools in the "{displayName}" category will appear here.</p>
        <p className="mt-2 text-sm">Connected to SpacetimeDB for live updates.</p>
      </div>
    </div>
  );
}
