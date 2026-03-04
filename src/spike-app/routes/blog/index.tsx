import { Link } from "@tanstack/react-router";
import { BlogListView } from "@spike-land-ai/block-website/ui";

export function BlogIndexPage() {
  return <BlogListView linkComponent={Link} />;
}
