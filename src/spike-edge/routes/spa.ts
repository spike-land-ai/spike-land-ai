import { Hono } from "hono";
import type { Env } from "../env.js";
import { getClientId, sendGA4Events } from "../lib/ga4.js";
import { safeCtx, withEdgeCache } from "../lib/edge-cache.js";
import { getBlogPostRow } from "./blog.js";

const spa = new Hono<{ Bindings: Env }>();

const IMMUTABLE_EXTENSIONS = new Set([".js", ".css", ".wasm", ".woff2", ".woff", ".ttf"]);

function isHashedAsset(path: string): boolean {
  // Match patterns like filename.abc123.js or filename-abc123.css
  return /\.[a-f0-9]{8,}\.\w+$/.test(path);
}

spa.get("/*", async (c) => {
  const path = new URL(c.req.url).pathname;

  // Strip leading slash for R2 key
  let key = path.startsWith("/") ? path.slice(1) : path;

  // Default to index.html for root
  if (!key) {
    key = "index.html";
  }

  // For static assets (not index.html), use edge cache to avoid R2 reads
  const hasExtension = key.includes(".") && key !== "index.html";
  if (hasExtension) {
    const ext = key.substring(key.lastIndexOf("."));
    const isImmutable = IMMUTABLE_EXTENSIONS.has(ext) && isHashedAsset(key);
    const ttl = isImmutable ? 31536000 : 3600;

    const cacheKey = `${c.req.url}?_cv=${c.env.CACHE_VERSION ?? "v1"}`;
    const cached = await withEdgeCache(c.req.raw, safeCtx(c), async () => {
      const object = await c.env.SPA_ASSETS.get(key);
      if (!object) return null;

      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set("etag", object.httpEtag);
      return new Response(object.body, { headers });
    }, { ttl, swr: isImmutable ? undefined : 3600, immutable: isImmutable, cacheKey });

    if (cached) return cached;

    // Static asset not in cache and not in R2 — return 404, never serve index.html
    return c.text("Not Found", 404);
  }

  const object = await c.env.SPA_ASSETS.get(key);

  if (!object) {
    // 1. First attempt: check if a prerendered HTML file exists for this route path
    // For example /blog -> blog.html, or /blog/ -> blog/index.html
    const prerenderedKey = key.endsWith("/") ? `${key}index.html` : `${key}.html`;
    let fallback = await c.env.SPA_ASSETS.get(prerenderedKey);

    // 2. Second attempt: check reverse (some static generators output /about/index.html for /about)
    if (!fallback && !key.endsWith("/")) {
      fallback = await c.env.SPA_ASSETS.get(`${key}/index.html`);
    }

    // 3. Last fallback: the SPA generic index.html shell
    if (!fallback) {
      fallback = await c.env.SPA_ASSETS.get("index.html");
    }

    if (!fallback) {
      return c.text("Not Found", 404);
    }

    let html = await fallback.text();

    // Inject dynamic metadata for /apps/:appId routes
    const appId = path.startsWith("/apps/") && path !== "/apps/new"
      ? path.split("/")[2]
      : undefined;
    if (appId) {
      const url = new URL(c.req.url);
      const tab = escapeHtml(url.searchParams.get("tab") || "App");

      // Better capitalization for known apps
      let appName = escapeHtml(appId.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()));
      if (appId === "qa-studio") appName = "QA Studio";
      if (appId === "mcp-auth") appName = "MCP Auth";

      const title = `${appName} (${tab}) — spike.land`;
      const description = `Explore ${appName} on spike.land — the AI multi-agent operating system.`;
      const canonicalPath = escapeHtml(path);
      const canonicalSearch = escapeHtml(url.search);

      // Replace title and inject meta tags
      html = html.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);
      html = html.replace(
        /<meta name="description" content="[^"]*" \/>/,
        `<meta name="description" content="${description}" />`,
      );

      // Inject OG and Twitter tags if not present or update them
      const metaTags = `
        <meta property="og:title" content="${title}" />
        <meta property="og:description" content="${description}" />
        <meta name="twitter:title" content="${title}" />
        <meta name="twitter:description" content="${description}" />
        <link rel="canonical" href="https://spike.land${canonicalPath}${canonicalSearch}" />
      `;
      html = html.replace("</head>", `${metaTags}</head>`);
    }

    // Inject blog post metadata + content for crawlers on /blog/:slug routes
    const blogSlugMatch = path.match(/^\/blog\/([a-z0-9-]+)$/);
    const blogSlug = blogSlugMatch?.[1];
    if (blogSlug) {
      try {
        const row = await getBlogPostRow(c.env.DB, blogSlug);
        if (row) {
          const postTitle = escapeHtml(row.title);
          const postDesc = escapeHtml(row.description);
          const postAuthor = escapeHtml(row.author);
          const postImage = row.hero_image
            ? `https://spike.land${row.hero_image}`
            : "https://spike.land/og-image.png";
          const postUrl = `https://spike.land${path}`;

          html = html.replace(/<title>[^<]*<\/title>/, `<title>${postTitle} — spike.land</title>`);
          html = html.replace(
            /<meta name="description" content="[^"]*" \/>/,
            `<meta name="description" content="${postDesc}" />`,
          );

          const blogMeta = `
        <meta property="og:type" content="article" />
        <meta property="og:title" content="${postTitle}" />
        <meta property="og:description" content="${postDesc}" />
        <meta property="og:image" content="${escapeHtml(postImage)}" />
        <meta property="og:url" content="${postUrl}" />
        <meta property="article:published_time" content="${escapeHtml(row.date)}" />
        <meta property="article:author" content="${postAuthor}" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="${postTitle}" />
        <meta name="twitter:description" content="${postDesc}" />
        <meta name="twitter:image" content="${escapeHtml(postImage)}" />
        <link rel="canonical" href="${postUrl}" />
        <script type="application/ld+json">${JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            headline: row.title,
            description: row.description,
            image: postImage,
            datePublished: row.date,
            author: { "@type": "Person", name: row.author },
            publisher: { "@type": "Organization", name: "spike.land" },
            url: postUrl,
          })}</script>`;
          html = html.replace("</head>", `${blogMeta}\n</head>`);

          // Inject article content for crawlers (hidden, React hydrates over root div)
          const articleHtml = markdownToBasicHtml(row.content);
          html = html.replace(
            "</body>",
            `<article id="ssr-blog" style="display:none"><h1>${postTitle}</h1>${articleHtml}</article>\n</body>`,
          );
        }
      } catch { /* D1 unavailable — serve SPA shell without blog metadata */ }
    }

    // Inject route-specific metadata for known routes (if not already injected by app/blog handlers)
    if (!appId && !blogSlug) {
      const routeMeta: Record<string, { title: string; description: string }> = {
        "/": { title: "spike.land - Open App Ecosystem for AI", description: "Connect your AI to real-world tools. Browse, build, and share AI-powered applications with 80+ tools on spike.land." },
        "/tools": { title: "AI Tools - spike.land", description: "Browse 80+ AI tools on spike.land. Find tools for code review, image generation, data analysis, and more." },
        "/store": { title: "Tool Store - spike.land", description: "Discover and install AI-powered tools from the spike.land store." },
        "/pricing": { title: "Pricing - spike.land", description: "Simple, transparent pricing. Free plan for individuals, Pro at $29/mo, Business at $99/mo." },
        "/about": { title: "About spike.land", description: "Learn about spike.land — who we are, our mission, and how we're building an open platform for AI tools." },
        "/login": { title: "Sign In - spike.land", description: "Sign in to spike.land to access your AI development tools." },
        "/privacy": { title: "Privacy Policy - spike.land", description: "spike.land Privacy Policy. How we handle your data, cookies, and your rights." },
        "/terms": { title: "Terms of Service - spike.land", description: "spike.land Terms of Service. Acceptable use, billing, and legal terms." },
        "/learn": { title: "Learn &amp; Verify - spike.land", description: "Learn from any content and prove your understanding through AI-powered quizzes." },
        "/blog": { title: "Blog - spike.land", description: "Articles and tutorials from the spike.land team about AI, MCP, and edge computing." },
        "/apps": { title: "MCP Tools & Apps - spike.land", description: "Browse and interact with AI-powered applications on spike.land." },
        "/bugbook": { title: "Bugbook - spike.land", description: "Public bug tracker with ELO-based prioritization on spike.land." },
        "/settings": { title: "Settings - spike.land", description: "Configure your spike.land account, billing, and API keys." },
        "/version": { title: "Version - spike.land", description: "View the current spike.land build version and deployed assets." },
      };
      const meta = routeMeta[path];
      if (meta) {
        html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(meta.title)}</title>`);
        html = html.replace(
          /<meta name="description" content="[^"]*" \/>/,
          `<meta name="description" content="${escapeHtml(meta.description)}" />`,
        );
        const ogTags = `
        <meta property="og:title" content="${escapeHtml(meta.title)}" />
        <meta property="og:description" content="${escapeHtml(meta.description)}" />
        <meta property="og:url" content="https://spike.land${path}" />
        <meta name="twitter:title" content="${escapeHtml(meta.title)}" />
        <meta name="twitter:description" content="${escapeHtml(meta.description)}" />`;
        html = html.replace("</head>", `${ogTags}\n</head>`);
      }
    }

    const response = new Response(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-cache",
      },
    });

    const existingCookie = c.req.header("cookie") ?? "";
    // Only set tracking cookie if user has consented (GDPR compliance)
    const hasConsent = existingCookie.includes("cookie_consent=accepted");
    if (hasConsent && !existingCookie.includes("spike_client_id=")) {
      const clientId = await getClientId(c.req.raw);
      response.headers.append(
        "set-cookie",
        `spike_client_id=${clientId}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax; Secure`,
      );
    }

    if (hasConsent) {
      try {
        const cid = hasConsent ? await getClientId(c.req.raw) : "anonymous";
        c.executionCtx.waitUntil(
          sendGA4Events(c.env, cid, [{
            name: "page_view",
            params: {
              page_path: path,
              referrer: (c.req.header("referer") ?? "").slice(0, 500),
              user_agent: (c.req.header("user-agent") ?? "").slice(0, 200),
            },
          }])
        );
      } catch { /* no ExecutionContext in test environment */ }
    }

    return response;
  }

  // Non-extension path that matched an R2 object directly (rare)
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=3600");

  return new Response(object.body, { headers });
});

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Minimal markdown→HTML for crawler-visible content. Handles headings, paragraphs, bold, italic, links, images, lists, code blocks, and horizontal rules. */
function markdownToBasicHtml(md: string): string {
  // Strip frontmatter
  const content = md.replace(/^---[\s\S]*?---\s*/, "");

  const lines = content.split("\n");
  const out: string[] = [];
  let inCodeBlock = false;
  let inList = false;
  let listType: "ul" | "ol" = "ul";

  for (const line of lines) {
    // Fenced code blocks
    if (line.trimStart().startsWith("```")) {
      if (inCodeBlock) {
        out.push("</code></pre>");
        inCodeBlock = false;
      } else {
        if (inList) { out.push(`</${listType}>`); inList = false; }
        out.push("<pre><code>");
        inCodeBlock = true;
      }
      continue;
    }
    if (inCodeBlock) {
      out.push(escapeHtml(line));
      continue;
    }

    const trimmed = line.trim();

    // Empty line — close list if open
    if (!trimmed) {
      if (inList) { out.push(`</${listType}>`); inList = false; }
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      if (inList) { out.push(`</${listType}>`); inList = false; }
      out.push("<hr />");
      continue;
    }

    // Headings
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch?.[1] && headingMatch[2] !== undefined) {
      if (inList) { out.push(`</${listType}>`); inList = false; }
      const level = headingMatch[1].length;
      out.push(`<h${level}>${inlineMarkdown(headingMatch[2])}</h${level}>`);
      continue;
    }

    // Unordered list items
    if (/^[-*+]\s+/.test(trimmed)) {
      if (!inList || listType !== "ul") {
        if (inList) out.push(`</${listType}>`);
        out.push("<ul>");
        inList = true;
        listType = "ul";
      }
      out.push(`<li>${inlineMarkdown(trimmed.replace(/^[-*+]\s+/, ""))}</li>`);
      continue;
    }

    // Ordered list items
    const olMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
    if (olMatch?.[2]) {
      if (!inList || listType !== "ol") {
        if (inList) out.push(`</${listType}>`);
        out.push("<ol>");
        inList = true;
        listType = "ol";
      }
      out.push(`<li>${inlineMarkdown(olMatch[2])}</li>`);
      continue;
    }

    // Images on their own line (before paragraph catch-all)
    const imgMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imgMatch?.[1] !== undefined && imgMatch[2]) {
      if (inList) { out.push(`</${listType}>`); inList = false; }
      out.push(`<img alt="${escapeHtml(imgMatch[1])}" src="${escapeHtml(imgMatch[2])}" />`);
      continue;
    }

    // Default: paragraph
    if (inList) { out.push(`</${listType}>`); inList = false; }
    out.push(`<p>${inlineMarkdown(trimmed)}</p>`);
  }

  if (inCodeBlock) out.push("</code></pre>");
  if (inList) out.push(`</${listType}>`);

  return out.join("\n");
}

/** Only allow safe URL schemes in markdown links/images. */
function isSafeUrl(url: string): boolean {
  const decoded = url.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  const trimmed = decoded.trim().toLowerCase();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("/") || trimmed.startsWith("#") || trimmed.startsWith("mailto:")) return true;
  return false;
}

/** Convert inline markdown (bold, italic, code, links, images) to HTML. */
function inlineMarkdown(text: string): string {
  let s = escapeHtml(text);
  // Images — only safe URLs
  s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_match, alt: string, src: string) =>
    isSafeUrl(src) ? `<img alt="${alt}" src="${src}" />` : escapeHtml(`![${alt}](${src})`));
  // Links — only safe URLs
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label: string, href: string) =>
    isSafeUrl(href) ? `<a href="${href}">${label}</a>` : escapeHtml(`[${label}](${href})`));
  // Bold
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/__(.+?)__/g, "<strong>$1</strong>");
  // Italic
  s = s.replace(/\*(.+?)\*/g, "<em>$1</em>");
  s = s.replace(/_(.+?)_/g, "<em>$1</em>");
  // Inline code
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  return s;
}

export { spa };
