import { z } from "zod";

/**
 * Zod schema for blog post frontmatter validation.
 * Used for runtime validation of MDX file frontmatter.
 */
export const blogPostFrontmatterSchema = z.object({
  /** Title of the blog post */
  title: z.string().min(1, "Title is required"),
  /** URL slug for the blog post */
  slug: z.string().min(1, "Slug is required"),
  /** Short description for SEO and previews */
  description: z.string().min(1, "Description is required"),
  /** Publication date in YYYY-MM-DD format */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  /** Author name */
  author: z.string().min(1, "Author is required"),
  /** Category for the blog post */
  category: z.string().min(1, "Category is required"),
  /** Tags for categorization and search */
  tags: z.array(z.string()),
  /** Optional cover image URL */
  image: z.string().optional(),
  /** Whether to feature this post on the homepage */
  featured: z.boolean().optional(),
  /** Whether to list this post in blog listings (default: true). Unlisted posts are still accessible via direct URL. */
  listed: z.boolean().optional().default(true),
  /** Persona slug when this post is a persona-specific variant */
  personaSlug: z.string().optional(),
  /** Slug of the canonical (original) post this variant is based on */
  canonicalSlug: z.string().optional(),
});

/**
 * Blog post frontmatter metadata.
 * Inferred from the Zod schema for type safety.
 */
export type BlogPostFrontmatter = z.infer<typeof blogPostFrontmatterSchema>;

/**
 * Blog post with content
 */
export interface BlogPost {
  frontmatter: BlogPostFrontmatter;
  content: string;
  slug: string;
  readingTime: string;
}

/**
 * Blog post metadata for listing (without content)
 */
export interface BlogPostMeta {
  frontmatter: BlogPostFrontmatter;
  slug: string;
  readingTime: string;
}
