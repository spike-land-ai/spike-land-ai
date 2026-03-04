#!/usr/bin/env tsx
/**
 * Seed blog posts from MDX files into D1 and upload images to R2.
 *
 * Usage:
 *   tsx scripts/seed-blog.ts          # local D1
 *   tsx scripts/seed-blog.ts --remote # remote D1 + R2
 */
import { readdir, readFile, writeFile, unlink, stat } from "node:fs/promises";
import { join, resolve, extname } from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  type BlogPost,
  parseMdxContent,
  sortByDateDesc,
  generateSQL,
} from "./seed-blog-lib.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = resolve(__dirname, "..");
const BLOG_DIR = resolve(ROOT, "content/blog");
const SPIKE_EDGE_DIR = resolve(ROOT, "packages/spike-edge");
const IMAGE_DIR = resolve(ROOT, "content/blog-images");
const DB_NAME = "spike-edge-analytics";
const R2_BUCKET = "spike-app-assets";

const isRemote = process.argv.includes("--remote");

async function parseMdxFiles(): Promise<BlogPost[]> {
  const entries = await readdir(BLOG_DIR, { withFileTypes: true });
  const posts: BlogPost[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".mdx")) continue;

    const fullPath = join(BLOG_DIR, entry.name);
    const fileContent = await readFile(fullPath, "utf-8");
    const post = parseMdxContent(fileContent, entry.name);
    if (post) posts.push(post);
  }

  return sortByDateDesc(posts);
}

async function seedD1(posts: BlogPost[]): Promise<void> {
  const sql = generateSQL(posts);
  const tmpFile = resolve(SPIKE_EDGE_DIR, ".seed-blog-tmp.sql");

  try {
    await writeFile(tmpFile, sql, "utf-8");
    const remoteFlag = isRemote ? "--remote" : "--local";
    const cmd = `npx wrangler d1 execute ${DB_NAME} --file="${tmpFile}" ${remoteFlag}`;
    console.log(`Executing: ${cmd}`);
    execSync(cmd, { cwd: SPIKE_EDGE_DIR, stdio: "inherit" });
    console.log(
      `Seeded ${posts.length} blog posts to D1 (${isRemote ? "remote" : "local"}).`,
    );
  } finally {
    await unlink(tmpFile).catch(() => {});
  }
}

async function uploadImages(): Promise<void> {
  if (!isRemote) {
    console.log(
      "Skipping image upload (local mode). Use --remote to upload to R2.",
    );
    return;
  }

  let slugDirs: string[];
  try {
    const entries = await readdir(IMAGE_DIR, { withFileTypes: true });
    slugDirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    console.log("No blog image directory found, skipping image upload.");
    return;
  }

  const IMAGE_EXTS = new Set([
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".svg",
    ".avif",
  ]);

  for (const slugDir of slugDirs) {
    const dirPath = join(IMAGE_DIR, slugDir);
    const files = await readdir(dirPath);

    for (const file of files) {
      const ext = extname(file).toLowerCase();
      if (!IMAGE_EXTS.has(ext)) continue;

      const filePath = join(dirPath, file);
      const fileStat = await stat(filePath);
      if (!fileStat.isFile()) continue;

      const r2Key = `blog-images/${slugDir}/${file}`;
      const contentTypeMap: Record<string, string> = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".svg": "image/svg+xml",
        ".avif": "image/avif",
      };
      const contentType = contentTypeMap[ext] || "application/octet-stream";

      console.log(`Uploading ${r2Key} (${contentType})...`);
      execSync(
        `npx wrangler r2 object put "${R2_BUCKET}/${r2Key}" --file="${filePath}" --content-type="${contentType}" --remote`,
        { cwd: SPIKE_EDGE_DIR, stdio: "inherit" },
      );
    }
  }

  console.log("Blog images uploaded to R2.");
}

async function main(): Promise<void> {
  console.log(`Seeding blog posts from ${BLOG_DIR}...`);
  console.log(`Mode: ${isRemote ? "REMOTE" : "LOCAL"}`);

  const posts = await parseMdxFiles();
  console.log(`Parsed ${posts.length} blog posts.`);

  await seedD1(posts);
  await uploadImages();

  console.log("Done!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
