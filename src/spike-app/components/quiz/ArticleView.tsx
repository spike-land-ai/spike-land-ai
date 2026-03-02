interface ArticleViewProps {
  content: string;
  collapsed?: boolean;
  onToggle?: () => void;
}

export function ArticleView({ content, collapsed = false, onToggle }: ArticleViewProps) {
  // Split content into paragraphs for rendering
  const paragraphs = content.split(/\n\n+/).filter((p) => p.trim().length > 0);

  return (
    <div className="rounded-xl border bg-white shadow-sm">
      <div className="flex items-center justify-between border-b px-6 py-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Article</h3>
        {onToggle && (
          <button
            onClick={onToggle}
            className="text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            {collapsed ? "Show Article" : "Hide Article"}
          </button>
        )}
      </div>
      {!collapsed && (
        <div className="max-h-96 overflow-y-auto px-6 py-4">
          <div className="prose prose-sm max-w-none text-gray-700">
            {paragraphs.map((p, i) => (
              <p key={i} className="mb-3 leading-relaxed">
                {p}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
