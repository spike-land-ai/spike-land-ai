import { Hono } from "hono";
import type { Env } from "../../core-logic/env.js";
import { getClientId, sendGA4Events } from "../../lazy-imports/ga4.js";
import { safeCtx, withEdgeCache } from "../lib/edge-cache.js";
import { getBlogPostRow } from "./blog.js";
import { trackPageView } from "../../core-logic/analytics.js";
import { getCacheVersion } from "../lib/cache-version.js";
import {
  getSpaResponseCacheControl,
  getSpaShellStatusCode,
  getSpaStaticAssetEdgeCacheSettings,
  isHtmlLikeResponse,
  normalizeSpaAssetKey,
  resolveSpaFallbackKeys,
  shouldServeSpaShell,
} from "./spa-route-logic.js";

const spa = new Hono<{ Bindings: Env }>();

spa.get("/*", async (c) => {
  const path = new URL(c.req.url).pathname;
  const key = normalizeSpaAssetKey(path);

  // For static assets (not index.html), use edge cache to avoid R2 reads
  const staticAssetCacheSettings = await (async () => {
    const cv = await getCacheVersion(c.env.SPA_ASSETS);
    return getSpaStaticAssetEdgeCacheSettings(c.req.url, key, cv);
  })();
  if (staticAssetCacheSettings) {
    const cached = await withEdgeCache(
      c.req.raw,
      safeCtx(c),
      async () => {
        const object = await c.env.SPA_ASSETS.get(key);
        if (!object) return null;

        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set("etag", object.httpEtag);
        return new Response(object.body, { headers });
      },
      staticAssetCacheSettings,
    );

    if (cached) return cached;

    // Static asset not in cache and not in R2 — return 404, never serve index.html
    return c.text("Not Found", 404);
  }

  const object = await c.env.SPA_ASSETS.get(key);

  if (!object) {
    let fallback: R2ObjectBody | null = null;
    for (const fallbackKey of resolveSpaFallbackKeys(path)) {
      fallback = await c.env.SPA_ASSETS.get(fallbackKey);
      if (fallback) {
        break;
      }
    }

    // API-like prefixes must not serve SPA shell unless they are explicit product pages.
    if (!shouldServeSpaShell(path)) {
      return c.json({ error: "Not Found", path }, 404);
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
    const appId =
      path.startsWith("/apps/") && path !== "/apps/new" ? path.split("/")[2] : undefined;
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
        <meta name="twitter:site" content="@ai_spike_land" />
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
        <meta name="twitter:site" content="@ai_spike_land" />
        <link rel="canonical" href="${postUrl}" />
        <script type="application/ld+json">${JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: row.title,
          description: row.description,
          image: postImage,
          datePublished: row.date,
          dateModified: row.updated_at ?? row.date,
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
      } catch {
        /* D1 unavailable — serve SPA shell without blog metadata */
      }
    }

    // Inject route-specific metadata for known routes (if not already injected by app/blog handlers)
    if (!appId && !blogSlug) {
      const routeMeta: Record<string, { title: string; description: string; ssrContent?: string }> =
        {
          "/": {
            title: "spike.land - Open App Ecosystem for AI",
            description:
              "Connect your AI to real-world tools. Browse, build, and share AI-powered applications with 80+ tools on spike.land.",
            ssrContent:
              "<h1>spike.land - Build, run, and share AI apps instantly</h1><p>Connect your AI agent to the real world using the Model Context Protocol (MCP).</p>",
          },
          "/tools": {
            title: "AI Tools - spike.land",
            description:
              "Browse 80+ AI tools on spike.land. Find tools for code review, image generation, data analysis, and more.",
            ssrContent: "<h1>AI Tools Registry</h1><p>Browse and connect 80+ MCP tools.</p>",
          },
          "/store": {
            title: "Tool Store - spike.land",
            description: "Discover and install AI-powered tools from the spike.land store.",
            ssrContent:
              "<h1>Tool Store</h1><p>Discover and install AI-powered tools from the spike.land store.</p>",
          },
          "/pricing": {
            title: "Pricing - spike.land",
            description:
              "Simple, transparent pricing. Free plan for individuals, Pro at $29/mo, Business at $99/mo.",
            ssrContent:
              "<h1>Pricing</h1><p>Simple, transparent pricing. Free, Pro, and Business plans available.</p>",
          },
          "/about": {
            title: "About spike.land",
            description:
              "Learn about spike.land — who we are, our mission, and how we're building an open platform for AI tools.",
            ssrContent:
              "<h1>About spike.land</h1><p>An open platform where AI agents connect to real-world tools.</p>",
          },
          "/login": {
            title: "Sign In - spike.land",
            description: "Sign in to spike.land to access your AI development tools.",
          },
          "/privacy": {
            title: "Privacy Policy - spike.land",
            description:
              "spike.land Privacy Policy. How we handle your data, cookies, and your rights.",
            ssrContent:
              "<h1>Privacy Policy</h1><p>We respect your privacy. Read our policy on data handling, GDPR compliance, and cookies.</p>",
          },
          "/terms": {
            title: "Terms of Service - spike.land",
            description: "spike.land Terms of Service. Acceptable use, billing, and legal terms.",
            ssrContent:
              "<h1>Terms of Service</h1><p>Read our acceptable use, subscription, and platform terms.</p>",
          },
          "/learn": {
            title: "Learn &amp; Verify - spike.land",
            description:
              "Learn from any content and prove your understanding through AI-powered quizzes.",
            ssrContent:
              "<h1>Learn &amp; Verify</h1><p>Learn from any content and prove your understanding through interactive AI-powered quizzes. Earn verifiable badges.</p>",
          },
          "/blog": {
            title: "Blog - spike.land",
            description:
              "Articles and tutorials from the spike.land team about AI, MCP, and edge computing.",
            ssrContent:
              "<h1>Blog</h1><p>Articles, tutorials, and engineering insights from the spike.land team.</p>",
          },
          "/mcp": {
            title: "MCP Registry - spike.land",
            description:
              "Browse 80+ MCP tools on spike.land. Connect your AI agent to real-world capabilities.",
            ssrContent:
              "<h1>MCP Registry</h1><p>Browse and connect 80+ Model Context Protocol tools.</p>",
          },
          "/apps": {
            title: "MCP Tools & Apps - spike.land",
            description: "Browse and interact with AI-powered applications on spike.land.",
            ssrContent:
              "<h1>MCP Tools &amp; Apps</h1><p>Browse and interact with AI-powered applications on spike.land.</p>",
          },
          "/bugbook": {
            title: "Bugbook - spike.land",
            description: "Public bug tracker with ELO-based prioritization on spike.land.",
            ssrContent:
              "<h1>Bugbook</h1><p>Public bug tracker with ELO-based prioritization.</p>",
          },
          "/settings": {
            title: "Settings - spike.land",
            description: "Configure your spike.land account, billing, and API keys.",
          },
          "/version": {
            title: "Version - spike.land",
            description: "View the current spike.land build version and deployed assets.",
            ssrContent:
              "<h1>Version</h1><p>View the current spike.land build version and deployed assets.</p>",
          },
          "/docs": {
            title: "Documentation - spike.land",
            description:
              "Technical documentation, API reference, MCP tools guide, and architecture overview for spike.land.",
            ssrContent:
              "<h1>Documentation</h1><p>Technical documentation, API reference, MCP tools guide, and architecture overview for spike.land.</p>",
          },
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
        <meta name="twitter:description" content="${escapeHtml(meta.description)}" />
        <meta name="twitter:site" content="@ai_spike_land" />`;
        html = html.replace("</head>", `${ogTags}\n</head>`);

        if (meta.ssrContent) {
          html = html.replace(
            "</body>",
            `<div id="ssr-content" style="display:none">${meta.ssrContent}</div>\n</body>`,
          );
        }

        // FAQPage structured data for /pricing
        if (path === "/pricing") {
          const faqJsonLd = JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: [
              {
                "@type": "Question",
                name: "What is included in the free plan?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "The free plan includes 50 requests per day, access to free-tier tools, bug reporting, and community support.",
                },
              },
              {
                "@type": "Question",
                name: "What does the Pro plan cost?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "The Pro plan costs $29/month and includes 500 requests per day, pro tools, BYOK support, natural language chat, and priority bug reporting.",
                },
              },
              {
                "@type": "Question",
                name: "What is the Business plan?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "The Business plan costs $99/month and includes unlimited requests, all tools, priority support, early access to new features, and bug bounty eligibility.",
                },
              },
              {
                "@type": "Question",
                name: "Can I bring my own API keys?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Yes, the Pro and Business plans support BYOK (Bring Your Own Key) for AI providers like Anthropic, OpenAI, and Google.",
                },
              },
            ],
          });
          html = html.replace(
            "</head>",
            `<script type="application/ld+json">${faqJsonLd}</script>\n</head>`,
          );
        }
      }
    }

    // Inject noindex for utility pages that shouldn't appear in search results
    const noindexPaths = ["/callback", "/settings", "/login"];
    if (noindexPaths.includes(path)) {
      html = html.replace(
        "</head>",
        `<meta name="robots" content="noindex, nofollow" />\n</head>`,
      );
    }

    const response = new Response(html, {
      status: getSpaShellStatusCode(path),
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": getSpaResponseCacheControl(true),
      },
    });

    const existingCookie = c.req.header("cookie") ?? "";
    // Only set tracking cookie if user has consented (GDPR compliance)
    const hasConsent = existingCookie.includes("cookie_consent=accepted");
    let clientId = "anonymous";

    if (hasConsent) {
      if (!existingCookie.includes("spike_client_id=")) {
        clientId = await getClientId(c.req.raw);
        response.headers.append(
          "set-cookie",
          `spike_client_id=${clientId}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax; Secure`,
        );
      } else {
        clientId =
          existingCookie.match(/spike_client_id=([^;]+)/)?.[1] || (await getClientId(c.req.raw));
      }

      try {
        c.executionCtx.waitUntil(
          sendGA4Events(c.env, clientId, [
            {
              name: "page_view",
              params: {
                page_path: path,
                referrer: (c.req.header("referer") ?? "").slice(0, 500),
                user_agent: (c.req.header("user-agent") ?? "").slice(0, 200),
              },
            },
          ]),
        );
      } catch {
        /* no ExecutionContext in test environment */
      }
    }

    // Analytics Engine — no PII, runs for all requests
    try {
      trackPageView(
        c.env,
        path,
        c.req.header("user-agent") ?? "",
        c.req.header("cf-ipcountry") ?? "",
      );
    } catch {
      /* best-effort */
    }

    return response;
  }

  // Non-extension path that matched an R2 object directly (rare)
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  const contentType = headers.get("content-type") ?? "";
  headers.set("cache-control", getSpaResponseCacheControl(isHtmlLikeResponse(key, contentType)));

  return new Response(object.body, { headers });
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
        if (inList) {
          out.push(`</${listType}>`);
          inList = false;
        }
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
      if (inList) {
        out.push(`</${listType}>`);
        inList = false;
      }
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      if (inList) {
        out.push(`</${listType}>`);
        inList = false;
      }
      out.push("<hr />");
      continue;
    }

    // Headings
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch?.[1] && headingMatch[2] !== undefined) {
      if (inList) {
        out.push(`</${listType}>`);
        inList = false;
      }
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
      if (inList) {
        out.push(`</${listType}>`);
        inList = false;
      }
      out.push(`<img alt="${escapeHtml(imgMatch[1])}" src="${escapeHtml(imgMatch[2])}" />`);
      continue;
    }

    // Default: paragraph
    if (inList) {
      out.push(`</${listType}>`);
      inList = false;
    }
    out.push(`<p>${inlineMarkdown(trimmed)}</p>`);
  }

  if (inCodeBlock) out.push("</code></pre>");
  if (inList) out.push(`</${listType}>`);

  return out.join("\n");
}

/** Only allow safe URL schemes in markdown links/images. */
function isSafeUrl(url: string): boolean {
  const decoded = url
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  const trimmed = decoded.trim().toLowerCase();
  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("/") ||
    trimmed.startsWith("#") ||
    trimmed.startsWith("mailto:")
  )
    return true;
  return false;
}

/** Convert inline markdown (bold, italic, code, links, images) to HTML. */
function inlineMarkdown(text: string): string {
  let s = escapeHtml(text);
  // Images — only safe URLs
  s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_match, alt: string, src: string) =>
    isSafeUrl(src) ? `<img alt="${alt}" src="${src}" />` : escapeHtml(`![${alt}](${src})`),
  );
  // Links — only safe URLs
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label: string, href: string) =>
    isSafeUrl(href) ? `<a href="${href}">${label}</a>` : escapeHtml(`[${label}](${href})`),
  );
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
