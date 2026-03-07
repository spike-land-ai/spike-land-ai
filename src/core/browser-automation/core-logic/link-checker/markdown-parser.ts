import type { ExtractedLink, LinkCategory } from "./types.js";

// Regex patterns
const INLINE_LINK_RE = /\[([^\]]{0,1000})\]\(([^)\s]{1,2000})\)/g;
const REFERENCE_LINK_RE = /^[ \t]*\[([^\]]{1,100})\]:[ \t]+([^\s]{1,2000})[ \t]*$/;
const HTML_HREF_RE = /<a\s+(?:[^>]{0,500}?)href="([^"]{1,2000})"/gi;
const HTML_SRC_RE = /<img\s+(?:[^>]{0,500}?)src="([^"]{1,2000})"/gi;
const HEADING_RE = /^(#{1,6})[ \t]+([^\n]+)$/;

const SKIP_PROTOCOLS = new Set(["mailto:", "tel:", "data:", "javascript:", "ftp:"]);
const SKIP_DOMAINS = new Set(["example.com", "localhost", "127.0.0.1", "0.0.0.0"]);

export function extractLinks(source: string, _filePath: string): ExtractedLink[] {
  const links: ExtractedLink[] = [];
  const lines = source.split("\n");
  let inCodeBlock = false;
  let inComment = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const lineNum = i + 1;

    // Track code block state
    if (line.trimStart().startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }

    // Track HTML comment state (simplified - handles single-line and multi-line)
    if (!inCodeBlock) {
      if (line.includes("<!--") && !line.includes("-->")) {
        inComment = true;
        continue;
      }
      if (inComment && line.includes("-->")) {
        inComment = false;
        continue;
      }
      // Single-line comment: skip whole line if it's entirely a comment
      if (line.includes("<!--") && line.includes("-->")) {
        if (line.trim().startsWith("<!--") && line.trim().endsWith("-->")) {
          continue;
        }
      }
    }

    if (inCodeBlock) continue;

    // Inline links: [text](target)
    let match: RegExpExecArray | null;
    INLINE_LINK_RE.lastIndex = 0;
    while ((match = INLINE_LINK_RE.exec(line)) !== null) {
      const text = match[1]!;
      const target = match[2]!.trim();
      links.push({
        target,
        text,
        line: lineNum,
        column: match.index + 1,
        category: categorizeLink(target),
        inCodeBlock: false,
        inComment,
      });
    }

    // Reference-style links: [label]: url
    const refMatch = REFERENCE_LINK_RE.exec(line);
    if (refMatch) {
      const text = refMatch[1]!;
      const target = refMatch[2]!.trim();
      links.push({
        target,
        text,
        line: lineNum,
        column: 1,
        category: categorizeLink(target),
        inCodeBlock: false,
        inComment,
      });
    }

    // HTML <a href="..."> tags
    HTML_HREF_RE.lastIndex = 0;
    while ((match = HTML_HREF_RE.exec(line)) !== null) {
      const target = match[1]!;
      links.push({
        target,
        text: "",
        line: lineNum,
        column: match.index + 1,
        category: categorizeLink(target),
        inCodeBlock: false,
        inComment,
      });
    }

    // HTML <img src="..."> tags
    HTML_SRC_RE.lastIndex = 0;
    while ((match = HTML_SRC_RE.exec(line)) !== null) {
      const target = match[1]!;
      links.push({
        target,
        text: "",
        line: lineNum,
        column: match.index + 1,
        category: categorizeLink(target),
        inCodeBlock: false,
        inComment,
      });
    }
  }

  return links;
}

export function categorizeLink(target: string): LinkCategory {
  // Skip protocols
  for (const proto of SKIP_PROTOCOLS) {
    if (target.startsWith(proto)) return "skipped";
  }

  // Skip known non-real domains
  try {
    const url = new URL(target);
    if (SKIP_DOMAINS.has(url.hostname)) return "skipped";
  } catch {
    // Not a valid URL, could be a relative path
  }

  // GitHub URLs
  try {
    const url = new URL(target, "http://dummy"); // Handle both absolute and relative
    const hostname = url.hostname;

    if (hostname === "github.com" || hostname === "www.github.com") {
      const path = url.pathname;
      if (path.includes("/blob/")) return "github_file";
      if (path.includes("/tree/")) return "github_tree";
      // Just org/repo pattern
      const ghMatch = path.match(/^\/([^/]+)\/([^/]+)/);
      if (ghMatch) return "github_repo";
    }

    if (hostname === "raw.githubusercontent.com") return "github_raw";
  } catch {
    // Ignore URL parse errors
  }

  if (target.includes("img.shields.io/github/")) return "github_badge";

  // Anchor-only
  if (target.startsWith("#")) return "anchor";

  // External URLs
  if (target.startsWith("http://") || target.startsWith("https://")) return "external_url";

  // Relative file with anchor
  if (target.includes("#") && !target.startsWith("#")) return "file_with_anchor";

  // Relative file
  return "relative_file";
}

export function slugifyHeading(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/<[^>]{0,500}>/g, "") // strip HTML (bounded)
    .replace(/[^\w\s-]/g, "") // strip special chars except hyphens
    .replace(/[ \t]+/g, "-") // spaces to hyphens (bounded)
    .replace(/-+/g, "-") // collapse multiple hyphens
    .replace(/^-|-$/g, ""); // trim leading/trailing hyphens
}

export function extractHeadings(source: string): string[] {
  const headings: string[] = [];
  const lines = source.split("\n");
  let inCodeBlock = false;

  for (const line of lines) {
    if (line.trimStart().startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    const match = HEADING_RE.exec(line);
    if (match) {
      headings.push(slugifyHeading(match[2]!));
    }
  }

  return headings;
}
