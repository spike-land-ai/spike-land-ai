import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import matter from "gray-matter";

const BLOG_DIR = resolve(process.cwd(), "../../content/blog");
const OUT_DIR = resolve(process.cwd(), "src/core");
const OUT_FILE = join(OUT_DIR, "generated-posts.ts");
const JSON_DIR = resolve(process.cwd(), "dist/blog");

async function buildContent() {
  console.log(`Building content from ${BLOG_DIR}...`);
  
  try {
    await mkdir(OUT_DIR, { recursive: true });
  } catch (_err) {
    // Ignore if exists
  }

  const entries = await readdir(BLOG_DIR, { withFileTypes: true });
  const posts = [];

  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(".mdx")) {
      const fullPath = join(BLOG_DIR, entry.name);
      const fileContent = await readFile(fullPath, "utf-8");
      
      const { data, content } = matter(fileContent);
      
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
        body = body.replace(new RegExp(`^!\\[.*?\\]\\(${escapedHero}\\)\\n?`, "m"), "").trim();
      }

      posts.push({
        slug: data.slug || entry.name.replace(".mdx", ""),
        title: data.title || entry.name,
        description: data.description || "",
        primer: data.primer || "",
        date: data.date || "",
        author: data.author || "",
        category: data.category || "",
        tags: data.tags || [],
        featured: data.featured || false,
        heroImage,
        content: body,
      });
    }
  }

  // Sort by date descending
  posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const tsCode = `// GENERATED FILE - DO NOT EDIT
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

export const posts: BlogPost[] = ${JSON.stringify(posts, null, 2)};
`;

  await writeFile(OUT_FILE, tsCode, "utf-8");
  console.log(`Generated ${posts.length} posts to ${OUT_FILE}`);

  // Also output JSON files for on-demand loading via edge API
  await mkdir(JSON_DIR, { recursive: true });

  // index.json — metadata only (no content)
  const index = posts.map(({ content: _content, ...meta }) => meta);
  await writeFile(join(JSON_DIR, "index.json"), JSON.stringify(index), "utf-8");

  // Per-slug JSON files — full post with content
  for (const post of posts) {
    await writeFile(join(JSON_DIR, `${post.slug}.json`), JSON.stringify(post), "utf-8");
  }

  console.log(`Generated ${posts.length} JSON files to ${JSON_DIR}`);
}

buildContent().catch(console.error);
