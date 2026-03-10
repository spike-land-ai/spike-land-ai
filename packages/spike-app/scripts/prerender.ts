import { chromium } from "playwright";
import { exec } from "child_process";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";
import grayMatter from "gray-matter";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const DIST_DIR = path.join(ROOT_DIR, "dist");
const BLOG_DIR = path.resolve(ROOT_DIR, "../../content/blog");

async function getBlogData(slug: string) {
  try {
    const filePath = path.join(BLOG_DIR, `${slug}.mdx`);
    let content = "";
    try {
      content = await fs.readFile(filePath, "utf-8");
    } catch {
      content = await fs.readFile(path.join(BLOG_DIR, `${slug}.md`), "utf-8");
    }
    const { data: frontmatter, content: markdownBody } = grayMatter(content);
    return {
      slug,
      title: frontmatter.title,
      description: frontmatter.description,
      date: frontmatter.date,
      author: frontmatter.author,
      unlisted: Boolean(frontmatter.unlisted),
      content: markdownBody,
      hero_image: frontmatter.heroImage || null,
    };
  } catch (err) {
    console.error(`Error reading blog post ${slug}:`, err);
    return null;
  }
}

async function getAllBlogData() {
  const files = await fs.readdir(BLOG_DIR);
  const slugs = files
    .filter((file) => file.endsWith(".mdx") || file.endsWith(".md"))
    .map((file) => file.replace(/\.mdx?$/, ""));

  const posts = [];
  for (const slug of slugs) {
    const data = await getBlogData(slug);
    if (data) {
      posts.push({
        slug: data.slug,
        title: data.title,
        description: data.description,
        date: data.date,
        author: data.author,
        unlisted: data.unlisted,
      });
    }
  }
  // Sort by date descending
  return posts
    .filter((post) => !post.unlisted)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

// Start a mock server on port 8787 to intercept /api calls
async function startMockApiServer(): Promise<http.Server> {
  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      // Set CORS headers
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Content-Type", "application/json");

      try {
        if (req.url === "/api/blog") {
          const posts = await getAllBlogData();
          res.writeHead(200);
          res.end(JSON.stringify(posts));
          return;
        }

        if (req.url?.startsWith("/api/blog/")) {
          const slug = req.url.split("/").pop();
          if (slug) {
            const data = await getBlogData(slug);
            if (data) {
              res.writeHead(200);
              res.end(JSON.stringify(data));
              return;
            }
          }
          res.writeHead(404);
          res.end(JSON.stringify({ error: "Not found" }));
          return;
        }

        if (req.url === "/api/docs") {
          res.writeHead(200);
          res.end(
            JSON.stringify({
              categories: [
                {
                  category: "Guides",
                  docs: [
                    {
                      slug: "getting-started",
                      title: "Getting Started",
                      category: "Guides",
                      description: "Quick start guide for spike.land",
                    },
                    {
                      slug: "deployment",
                      title: "Deployment Guide",
                      category: "Guides",
                      description: "Deploy your tools to spike.land",
                    },
                  ],
                },
                {
                  category: "MCP",
                  docs: [
                    {
                      slug: "mcp-overview",
                      title: "MCP Overview",
                      category: "MCP",
                      description: "Introduction to Model Context Protocol",
                    },
                    {
                      slug: "mcp-tools",
                      title: "MCP Tools Reference",
                      category: "MCP",
                      description: "Complete reference for all 80+ MCP tools",
                    },
                  ],
                },
                {
                  category: "API",
                  docs: [
                    {
                      slug: "api-reference",
                      title: "API Reference",
                      category: "API",
                      description: "REST API documentation",
                    },
                    {
                      slug: "authentication",
                      title: "Authentication",
                      category: "API",
                      description: "OAuth and API keys",
                    },
                    {
                      slug: "webhooks",
                      title: "Webhooks",
                      category: "API",
                      description: "Webhook integrations",
                    },
                    {
                      slug: "rate-limits",
                      title: "Rate Limits",
                      category: "API",
                      description: "Rate limits and quotas",
                    },
                  ],
                },
                {
                  category: "Architecture",
                  docs: [
                    {
                      slug: "architecture",
                      title: "Architecture Overview",
                      category: "Architecture",
                      description: "System architecture",
                    },
                  ],
                },
                {
                  category: "Security",
                  docs: [
                    {
                      slug: "security",
                      title: "Security Model",
                      category: "Security",
                      description: "Security practices",
                    },
                  ],
                },
              ],
              total: 10,
            }),
          );
          return;
        }

        if (req.url?.startsWith("/api/docs/")) {
          const slug = req.url.split("/").pop();
          res.writeHead(200);
          res.end(
            JSON.stringify({
              slug,
              title: slug,
              category: "Guides",
              description: "Documentation page",
              content: `# ${slug}\n\nDocumentation coming soon.`,
            }),
          );
          return;
        }

        if (req.url?.startsWith("/api/support/engagement/")) {
          res.writeHead(200);
          res.end(JSON.stringify({ fistBumps: 12, supporters: 3 }));
          return;
        }

        if (req.url?.startsWith("/api/experiments/")) {
          res.writeHead(200);
          res.end(
            JSON.stringify({
              assignments: {},
              config: {
                showSocialProof: true,
                socialProofStyle: "exact",
                defaultSliderIdx: 2,
                ctaColor: "#000",
                ctaText: "Support us \${amount}",
              },
            }),
          );
          return;
        }

        // Mock empty response for other endpoints like /mcp/tools
        res.writeHead(200);
        res.end(JSON.stringify({ categories: [], featured: [], total: 0 }));
      } catch (err) {
        console.error("Mock server error:", err);
        res.writeHead(500);
        res.end(JSON.stringify({ error: "Internal server error" }));
      }
    });

    server.listen(8787, () => {
      resolve(server);
    });
  });
}

async function startServer(): Promise<{ url: string; close: () => void }> {
  return new Promise((resolve, reject) => {
    console.log("Starting preview server...");
    const server = exec("yarn vite preview --port 4173", { cwd: ROOT_DIR });

    let isReady = false;

    server.stdout?.on("data", (data) => {
      const output = data.toString();
      if (output.includes("localhost:4173")) {
        isReady = true;
        resolve({
          url: "https://localhost:4173",
          close: () => server.kill(),
        });
      }
    });

    server.stderr?.on("data", (data) => {
      // Vite prints proxy errors to stderr, don't crash on them
      console.error("[Vite Warn/Error]", data.toString().trim());
    });

    server.on("error", (err) => {
      if (!isReady) reject(err);
    });

    // Timeout
    setTimeout(() => {
      if (!isReady) {
        server.kill();
        reject(new Error("Preview server timeout"));
      }
    }, 15000);
  });
}

async function run() {
  const mockApiServer = await startMockApiServer();

  const files = await fs.readdir(BLOG_DIR);
  const blogSlugs = files
    .filter((file) => file.endsWith(".mdx") || file.endsWith(".md"))
    .map((file) => file.replace(/\.mdx?$/, ""));

  const routes = [
    "/",
    "/about",
    "/pricing",
    "/blog",
    "/tools",
    "/store",
    "/login",
    "/learn",
    "/docs",
    "/privacy",
    "/terms",
    ...blogSlugs.map((slug) => `/blog/${slug}`),
  ];

  console.log(`Found ${routes.length} routes to prerender`);

  let server;
  try {
    server = await startServer();
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();

    for (const route of routes) {
      console.log(`Prerendering ${route}...`);
      const url = `${server.url}${route}`;

      try {
        // Wait for network idle to ensure React has fully mounted and fetched any needed data
        await page.goto(url, { waitUntil: "networkidle", timeout: 15000 });

        // Additional small wait to ensure Framer Motion or effects have settled
        await page.waitForTimeout(1000);

        const html = await page.content();

        // Save HTML
        let fileName = route === "/" ? "index.html" : `${route.slice(1)}.html`;
        const filePath = path.join(DIST_DIR, fileName);

        // Ensure directory exists
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, html, "utf-8");

        console.log(`✅ Saved ${fileName}`);
      } catch (e) {
        console.error(`❌ Failed to prerender ${route}:`, e);
      }
    }

    await browser.close();
  } catch (err) {
    console.error("Prerender failed:", err);
    process.exit(1);
  } finally {
    if (server) {
      console.log("Shutting down Vite preview...");
      server.close();
    }
    mockApiServer.close(() => {
      console.log("Mock API server shut down.");
    });
  }
}

run();
