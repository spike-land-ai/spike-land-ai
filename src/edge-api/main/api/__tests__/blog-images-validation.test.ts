import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const CONTENT_DIR = resolve(__dirname, "../../../../../content/blog");

function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match?.[1]) return {};

  const result: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const kv = line.match(/^(\w+):\s*(.+)$/);
    if (kv) {
      result[kv[1]] = kv[2].replace(/^['"]|['"]$/g, "").trim();
    }
  }
  return result;
}

describe("blog hero image path validation", () => {
  const mdxFiles = readdirSync(CONTENT_DIR).filter((f) => f.endsWith(".mdx"));

  it("should find at least one blog post", () => {
    expect(mdxFiles.length).toBeGreaterThan(0);
  });

  for (const file of mdxFiles) {
    const fileSlug = file.replace(/\.mdx$/, "");

    it(`${fileSlug}: heroImage path slug matches frontmatter slug (or has heroPrompt)`, () => {
      const content = readFileSync(join(CONTENT_DIR, file), "utf-8");
      const fm = parseFrontmatter(content);

      const heroImage = fm["heroImage"];
      if (!heroImage || !heroImage.startsWith("/blog/")) return; // no hero image or external URL — skip

      const slug = fm["slug"] || fileSlug;
      const heroPrompt = fm["heroPrompt"];

      // Extract the slug portion from the heroImage path: /blog/{slug}/filename
      const pathMatch = heroImage.match(/^\/blog\/([^/]+)\//);
      if (!pathMatch) return; // unusual path format — skip

      const imagePathSlug = pathMatch[1];

      // The image path slug should match the post slug, OR a heroPrompt must exist
      // so the fallback query can still resolve the generation prompt
      const slugMatches = imagePathSlug === slug;
      const hasPrompt = Boolean(heroPrompt);

      expect(
        slugMatches || hasPrompt,
        `heroImage path slug "${imagePathSlug}" does not match frontmatter slug "${slug}" and no heroPrompt is defined. ` +
          `Either fix the heroImage path to use "/blog/${slug}/..." or add a heroPrompt field.`,
      ).toBe(true);
    });
  }
});
