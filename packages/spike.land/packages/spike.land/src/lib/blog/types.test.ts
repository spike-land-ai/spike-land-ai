import { describe, expect, it } from "vitest";

import { blogPostFrontmatterSchema } from "./types";

const validFrontmatter = {
  title: "My Blog Post",
  slug: "my-blog-post",
  description: "A test blog post",
  date: "2026-01-15",
  author: "Test Author",
  category: "tech",
  tags: ["typescript", "testing"],
};

describe("blogPostFrontmatterSchema", () => {
  it("accepts valid frontmatter", () => {
    const result = blogPostFrontmatterSchema.safeParse(validFrontmatter);
    expect(result.success).toBe(true);
  });

  it("rejects empty title", () => {
    const result = blogPostFrontmatterSchema.safeParse({ ...validFrontmatter, title: "" });
    expect(result.success).toBe(false);
  });

  it("rejects empty slug", () => {
    const result = blogPostFrontmatterSchema.safeParse({ ...validFrontmatter, slug: "" });
    expect(result.success).toBe(false);
  });

  it("rejects empty description", () => {
    const result = blogPostFrontmatterSchema.safeParse({ ...validFrontmatter, description: "" });
    expect(result.success).toBe(false);
  });

  it("validates date format YYYY-MM-DD", () => {
    const valid = blogPostFrontmatterSchema.safeParse(validFrontmatter);
    expect(valid.success).toBe(true);

    const invalid = blogPostFrontmatterSchema.safeParse({
      ...validFrontmatter,
      date: "01-15-2026",
    });
    expect(invalid.success).toBe(false);

    const invalid2 = blogPostFrontmatterSchema.safeParse({
      ...validFrontmatter,
      date: "2026/01/15",
    });
    expect(invalid2.success).toBe(false);
  });

  it("rejects empty author", () => {
    const result = blogPostFrontmatterSchema.safeParse({ ...validFrontmatter, author: "" });
    expect(result.success).toBe(false);
  });

  it("rejects empty category", () => {
    const result = blogPostFrontmatterSchema.safeParse({ ...validFrontmatter, category: "" });
    expect(result.success).toBe(false);
  });

  it("accepts empty tags array", () => {
    const result = blogPostFrontmatterSchema.safeParse({ ...validFrontmatter, tags: [] });
    expect(result.success).toBe(true);
  });

  it("accepts optional image", () => {
    const result = blogPostFrontmatterSchema.safeParse({
      ...validFrontmatter,
      image: "https://example.com/img.png",
    });
    expect(result.success).toBe(true);
  });

  it("accepts optional featured boolean", () => {
    const result = blogPostFrontmatterSchema.safeParse({ ...validFrontmatter, featured: true });
    expect(result.success).toBe(true);
  });

  it("defaults listed to true", () => {
    const result = blogPostFrontmatterSchema.safeParse(validFrontmatter);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.listed).toBe(true);
    }
  });

  it("allows listed to be set to false", () => {
    const result = blogPostFrontmatterSchema.safeParse({ ...validFrontmatter, listed: false });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.listed).toBe(false);
    }
  });

  it("accepts optional persona fields", () => {
    const result = blogPostFrontmatterSchema.safeParse({
      ...validFrontmatter,
      personaSlug: "startup-steve",
      canonicalSlug: "original-post",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing required fields", () => {
    const result = blogPostFrontmatterSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
