/**
 * Pure functions for blog seed script. Extracted for testability.
 */
import matter from "gray-matter";

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  primer: string;
  date: string;
  author: string;
  category: string;
  tags: string[];
  featured: boolean;
  heroImage: string | null;
  content: string;
}

/**
 * Escape a string for use in a SQLite single-quoted string literal.
 * SQLite only requires doubling single quotes inside '...' literals.
 */
export function escapeSQL(str: string): string {
  return str.replace(/'/g, "''");
}

/**
 * Parse frontmatter + body from raw MDX content.
 * Returns null if the content has no title.
 */
export function parseMdxContent(
  rawContent: string,
  filename: string,
): BlogPost | null {
  const { data, content } = matter(rawContent);

  if (data.draft) return null;

  let heroImage: string | null = data.heroImage || null;
  let body = content.trim();

  // Auto-detect hero image from first 5 lines if not in frontmatter
  if (!heroImage) {
    const lines = body.split("\n").slice(0, 5);
    for (const line of lines) {
      const match = line.match(/^!\[.*?\]\((\/blog\/[^)]+)\)$/);
      if (match?.[1] && !line.includes("placehold.co")) {
        heroImage = match[1];
        body = body.replace(line + "\n", "").replace(line, "").trim();
        break;
      }
    }
  } else {
    // Strip hero image line from body if it matches the frontmatter heroImage
    const escapedHero = heroImage.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    body = body
      .replace(new RegExp(`^!\\[.*?\\]\\(${escapedHero}\\)\\n?`, "m"), "")
      .trim();
  }

  return {
    slug: data.slug || filename.replace(".mdx", ""),
    title: data.title || filename,
    description: data.description || "",
    primer: data.primer || "",
    date: data.date || "",
    author: data.author || "",
    category: data.category || "",
    tags: data.tags || [],
    featured: data.featured || false,
    heroImage,
    content: body,
  };
}

/**
 * Sort posts by date descending (newest first).
 */
export function sortByDateDesc(posts: BlogPost[]): BlogPost[] {
  return [...posts].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
}

/**
 * Generate SQL INSERT OR REPLACE statements for an array of blog posts.
 */
export function generateSQL(posts: BlogPost[]): string {
  const statements: string[] = [];

  for (const post of posts) {
    statements.push(
      `INSERT OR REPLACE INTO blog_posts (slug, title, description, primer, date, author, category, tags, featured, hero_image, content, updated_at)
VALUES ('${escapeSQL(post.slug)}', '${escapeSQL(post.title)}', '${escapeSQL(post.description)}', '${escapeSQL(post.primer)}', '${escapeSQL(post.date)}', '${escapeSQL(post.author)}', '${escapeSQL(post.category)}', '${escapeSQL(JSON.stringify(post.tags))}', ${post.featured ? 1 : 0}, ${post.heroImage ? `'${escapeSQL(post.heroImage)}'` : "NULL"}, '${escapeSQL(post.content)}', unixepoch());`,
    );
  }

  return statements.join("\n\n");
}
