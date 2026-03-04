import { describe, expect, it } from "vitest";
import {
  escapeSQL,
  parseMdxContent,
  sortByDateDesc,
  generateSQL,
  type BlogPost,
} from "../seed-blog-lib.js";

// ---------- escapeSQL ----------

describe("escapeSQL", () => {
  it("doubles single quotes", () => {
    expect(escapeSQL("it's a test")).toBe("it''s a test");
  });

  it("handles multiple single quotes", () => {
    expect(escapeSQL("it's Bob's test")).toBe("it''s Bob''s test");
  });

  it("returns empty string unchanged", () => {
    expect(escapeSQL("")).toBe("");
  });

  it("passes through strings without quotes", () => {
    expect(escapeSQL("hello world")).toBe("hello world");
  });

  it("handles string that is just a single quote", () => {
    expect(escapeSQL("'")).toBe("''");
  });

  it("preserves backslashes (SQLite does not treat them as escape chars)", () => {
    expect(escapeSQL("path\\to\\file")).toBe("path\\to\\file");
  });

  it("handles newlines in content", () => {
    expect(escapeSQL("line1\nline2")).toBe("line1\nline2");
  });
});

// ---------- parseMdxContent ----------

describe("parseMdxContent", () => {
  it("extracts frontmatter fields", () => {
    const mdx = `---
title: "My Post"
slug: "my-post"
description: "A description"
date: "2026-03-01"
author: "Test Author"
category: "Testing"
tags: ["a", "b"]
featured: true
primer: "Short primer"
---

Body content here.
`;
    const post = parseMdxContent(mdx, "my-post.mdx");
    expect(post).not.toBeNull();
    expect(post!.title).toBe("My Post");
    expect(post!.slug).toBe("my-post");
    expect(post!.description).toBe("A description");
    expect(post!.date).toBe("2026-03-01");
    expect(post!.author).toBe("Test Author");
    expect(post!.category).toBe("Testing");
    expect(post!.tags).toEqual(["a", "b"]);
    expect(post!.featured).toBe(true);
    expect(post!.primer).toBe("Short primer");
    expect(post!.content).toBe("Body content here.");
  });

  it("falls back to filename for slug when not in frontmatter", () => {
    const mdx = `---
title: "No Slug"
date: "2026-01-01"
---

Content.
`;
    const post = parseMdxContent(mdx, "fallback-slug.mdx");
    expect(post!.slug).toBe("fallback-slug");
  });

  it("auto-detects hero image from body when not in frontmatter", () => {
    const mdx = `---
title: "Auto Hero"
slug: "auto-hero"
date: "2026-01-01"
---

![Hero](/blog/auto-hero/hero.png)

Rest of the content.
`;
    const post = parseMdxContent(mdx, "auto-hero.mdx");
    expect(post!.heroImage).toBe("/blog/auto-hero/hero.png");
    expect(post!.content).not.toContain("![Hero]");
    expect(post!.content).toBe("Rest of the content.");
  });

  it("skips placehold.co images for auto-detection", () => {
    const mdx = `---
title: "Placeholder"
slug: "placeholder"
date: "2026-01-01"
---

![Placeholder](https://placehold.co/600x400)

Content.
`;
    const post = parseMdxContent(mdx, "placeholder.mdx");
    expect(post!.heroImage).toBeNull();
  });

  it("strips hero image line from body when heroImage is in frontmatter", () => {
    const mdx = `---
title: "FM Hero"
slug: "fm-hero"
date: "2026-01-01"
heroImage: "/blog/fm-hero/hero.png"
---

![Alt text](/blog/fm-hero/hero.png)

Body after hero.
`;
    const post = parseMdxContent(mdx, "fm-hero.mdx");
    expect(post!.heroImage).toBe("/blog/fm-hero/hero.png");
    expect(post!.content).not.toContain("![Alt text]");
    expect(post!.content).toBe("Body after hero.");
  });

  it("defaults missing fields to empty values", () => {
    const mdx = `---
title: "Minimal"
date: "2026-01-01"
---

Content.
`;
    const post = parseMdxContent(mdx, "minimal.mdx");
    expect(post!.description).toBe("");
    expect(post!.primer).toBe("");
    expect(post!.author).toBe("");
    expect(post!.category).toBe("");
    expect(post!.tags).toEqual([]);
    expect(post!.featured).toBe(false);
    expect(post!.heroImage).toBeNull();
  });
});

// ---------- sortByDateDesc ----------

describe("sortByDateDesc", () => {
  it("sorts posts by date descending", () => {
    const posts = [
      { date: "2026-01-01" },
      { date: "2026-03-01" },
      { date: "2026-02-01" },
    ] as BlogPost[];

    const sorted = sortByDateDesc(posts);
    expect(sorted[0].date).toBe("2026-03-01");
    expect(sorted[1].date).toBe("2026-02-01");
    expect(sorted[2].date).toBe("2026-01-01");
  });

  it("does not mutate original array", () => {
    const posts = [
      { date: "2026-01-01" },
      { date: "2026-03-01" },
    ] as BlogPost[];

    sortByDateDesc(posts);
    expect(posts[0].date).toBe("2026-01-01");
  });
});

// ---------- generateSQL ----------

describe("generateSQL", () => {
  const post: BlogPost = {
    slug: "test-post",
    title: "Test Post",
    description: "Desc",
    primer: "Primer",
    date: "2026-03-01",
    author: "Author",
    category: "Cat",
    tags: ["a", "b"],
    featured: false,
    heroImage: null,
    content: "# Hello",
  };

  it("produces INSERT OR REPLACE statement", () => {
    const sql = generateSQL([post]);
    expect(sql).toContain("INSERT OR REPLACE INTO blog_posts");
  });

  it("uses NULL for null heroImage", () => {
    const sql = generateSQL([post]);
    expect(sql).toContain(", NULL, ");
  });

  it("quotes non-null heroImage", () => {
    const withHero = { ...post, heroImage: "/blog/test/hero.png" };
    const sql = generateSQL([withHero]);
    expect(sql).toContain("'/blog/test/hero.png'");
  });

  it("serializes tags as JSON array", () => {
    const sql = generateSQL([post]);
    expect(sql).toContain('["a","b"]');
  });

  it("uses 1 for featured=true, 0 for false", () => {
    const sqlFalse = generateSQL([post]);
    expect(sqlFalse).toContain(", 0, ");

    const sqlTrue = generateSQL([{ ...post, featured: true }]);
    expect(sqlTrue).toContain(", 1, ");
  });

  it("escapes single quotes in content", () => {
    const withQuote = { ...post, content: "it's a test" };
    const sql = generateSQL([withQuote]);
    expect(sql).toContain("it''s a test");
  });

  it("generates multiple statements separated by blank lines", () => {
    const sql = generateSQL([post, { ...post, slug: "second" }]);
    const statements = sql.split("\n\n");
    expect(statements).toHaveLength(2);
  });

  it("includes unixepoch() for updated_at", () => {
    const sql = generateSQL([post]);
    expect(sql).toContain("unixepoch()");
  });
});
