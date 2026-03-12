import { Link } from "@tanstack/react-router";
import { apiUrl } from "../../../core-logic/api";
import { useEffect, useState } from "react";

interface DocEntry {
  slug: string;
  title: string;
  category: string;
  description: string;
}

interface DocsCategory {
  category: string;
  docs: DocEntry[];
}

function Breadcrumb() {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex items-center gap-1.5 text-sm text-[var(--muted-fg)]">
        <li>
          <Link to="/" className="transition-colors hover:text-[var(--fg)]">
            Home
          </Link>
        </li>
        <li aria-hidden="true" className="opacity-40 select-none">
          /
        </li>
        <li>
          <span className="text-[var(--fg)] font-medium">Documentation</span>
        </li>
      </ol>
    </nav>
  );
}

export function DocsIndexPage() {
  const [categories, setCategories] = useState<DocsCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(apiUrl("/docs"))
      .then((res) => res.json())
      .then((data: { categories: DocsCategory[] }) => {
        setCategories(data.categories);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="rubik-container rubik-page">
      <div className="rubik-stack">
        <Breadcrumb />

        <div className="space-y-3">
          <h1 className="text-3xl font-bold text-[var(--fg)]">Documentation</h1>
          <p className="text-[var(--muted-fg)] max-w-prose">
            Everything you need to build with spike.land. From getting started guides to the full
            API reference.
          </p>
        </div>

        {loading ? (
          <div className="text-[var(--muted-fg)] text-sm">Loading documentation...</div>
        ) : (
          <div className="space-y-10">
            {categories.map(({ category, docs }) => (
              <section key={category} className="space-y-4">
                <h2 className="text-xl font-semibold text-[var(--fg)] border-b border-[var(--border-color)] pb-2">
                  {category}
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {docs.map((doc) => (
                    <Link
                      key={doc.slug}
                      to="/docs/$slug"
                      params={{ slug: doc.slug }}
                      className="group block rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-5 hover:border-[var(--muted-fg)]/30 hover:bg-[var(--muted-bg)]/30 transition-colors"
                    >
                      <h3 className="font-semibold text-[var(--fg)] group-hover:text-[var(--primary-color)] transition-colors">
                        {doc.title}
                      </h3>
                      <p className="mt-1 text-sm text-[var(--muted-fg)] line-clamp-2">
                        {doc.description}
                      </p>
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
