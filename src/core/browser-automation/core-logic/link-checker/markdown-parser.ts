import type { ExtractedLink, LinkCategory } from "./types.js";

// Regex patterns
const INLINE_LINK_RE = /\[([^\]]*)\]\(([^)]+)\)/g;
const REFERENCE_LINK_RE = /^\s*\[([^\]]+)\]:\s+(.+)$/;
const HTML_HREF_RE = /<a\s+[^>]*href="([^"]+)"[^>]*>/gi;
const HTML_SRC_RE = /<img\s+[^>]*src="([^"]+)"[^>]*>/gi;
const HEADING_RE = /^(#{1,6})\s+(.+)$/;

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
  if (target.includes("github.com/")) {
    if (target.includes("/blob/")) return "github_file";
    if (target.includes("/tree/")) return "github_tree";
    // Just org/repo pattern
    const ghMatch = target.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (ghMatch) return "github_repo";
  }

  if (target.includes("raw.githubusercontent.com/")) return "github_raw";

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
    .replace(/<[^>]+>/g, "") // strip HTML
    .replace(/[^\w\s-]/g, "") // strip special chars except hyphens
    .replace(/\s+/g, "-") // spaces to hyphens
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
