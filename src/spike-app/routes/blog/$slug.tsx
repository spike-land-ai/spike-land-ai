import { useParams, Link } from "@tanstack/react-router";
import { BlogPostView } from "@spike-land-ai/block-website/ui";

export function BlogPostPage() {
  const { slug } = useParams({ strict: false });
  return <BlogPostView slug={slug as string} linkComponent={Link} />;
}
