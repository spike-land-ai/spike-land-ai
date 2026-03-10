import { Link } from "@tanstack/react-router";
import { BlogListView } from "@spike-land-ai/block-website/ui";

export function BlogIndexPage() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/30 antialiased relative">
      <main className="relative z-10 w-full">
        <BlogListView linkComponent={Link} />
      </main>
    </div>
  );
}
