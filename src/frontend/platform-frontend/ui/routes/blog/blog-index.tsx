import { Link } from "@tanstack/react-router";
import { BlogListView } from "@spike-land-ai/block-website/ui";

function Breadcrumb() {
  return (
    <nav className="rubik-container pt-6 pb-2" aria-label="Breadcrumb">
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
          <span className="text-[var(--fg)] font-medium">Blog</span>
        </li>
      </ol>
    </nav>
  );
}

export function BlogIndexPage() {
  return (
    <div className="min-h-screen font-sans antialiased">
      <Breadcrumb />
      <main>
        <BlogListView linkComponent={Link} />
      </main>
    </div>
  );
}
