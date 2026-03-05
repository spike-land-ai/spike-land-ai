import { Link } from "@tanstack/react-router";
import { apiUrl } from "@/lib/api";
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

export function DocsIndexPage() {
  const [categories, setCategories] = useState<DocsCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(apiUrl("/docs"))
      .then(res => res.json())
      .then((data: { categories: DocsCategory[] }) => {
        setCategories(data.categories);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 space-y-10">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold text-foreground">Documentation</h1>
        <p className="text-muted-foreground max-w-2xl">
          Everything you need to build with spike.land. From getting started guides to the full API reference.
        </p>
      </div>

      {loading ? (
        <div className="text-muted-foreground text-sm">Loading documentation...</div>
      ) : (
        <div className="space-y-10">
          {categories.map(({ category, docs }) => (
            <section key={category} className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground border-b border-border pb-2">{category}</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {docs.map((doc) => (
                  <Link
                    key={doc.slug}
                    to="/docs/$slug"
                    params={{ slug: doc.slug }}
                    className="group block rounded-xl border border-border bg-card p-5 hover:border-muted-foreground/30 hover:bg-muted/30 transition-colors"
                  >
                    <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">{doc.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{doc.description}</p>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
