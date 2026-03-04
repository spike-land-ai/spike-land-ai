import type { BlogPost } from "./types";

const EDGE_BASE = "https://edge.spike.land";

/**
 * Fetch all blog posts from the edge API, optionally filtered.
 */
export async function getPosts(options?: { tag?: string; category?: string; limit?: number }): Promise<BlogPost[]> {
  const res = await fetch(`${EDGE_BASE}/api/blog`);
  if (!res.ok) return [];
  let posts: BlogPost[] = await res.json();

  if (options?.tag) {
    posts = posts.filter(p => p.tags.includes(options.tag!));
  }

  if (options?.category) {
    posts = posts.filter(p => p.category === options.category);
  }

  if (options?.limit) {
    posts = posts.slice(0, options.limit);
  }

  return posts;
}

/**
 * Fetch a specific post by slug from the edge API.
 */
export async function getPostBySlug(slug: string): Promise<BlogPost | undefined> {
  const res = await fetch(`${EDGE_BASE}/api/blog/${slug}`);
  if (!res.ok) return undefined;
  return res.json();
}
