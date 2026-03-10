import { parse as parseYaml } from "yaml";
import { type McpAppDetail } from "../hooks/useApps";

const rawContentFiles = import.meta.glob("../../../../../content/apps/*.md", { query: "?raw", import: "default", eager: true });

function parseFrontmatter(rawContent: string) {
  const match = rawContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    return { data: {}, content: rawContent.trim() };
  }
  try {
    const parsed = parseYaml(match[1]);
    const data = parsed || {};
    return { data: typeof data === "object" ? data : {}, content: match[2].trim() };
  } catch (_error) {
    return { data: {}, content: rawContent.trim() };
  }
}

export const contentApps: McpAppDetail[] = Object.entries(rawContentFiles).map(([path, rawContent]) => {
  const filename = path.split("/").pop() || "";
  const { data, content } = parseFrontmatter(rawContent as string);

  const slug = data.slug || filename.replace(".md", "");
  const name = data.name || slug;
  const description = data.description || "";
  const emoji = data.emoji || "🔧";
  const category = data.category || "";
  const tags = Array.isArray(data.tags)
    ? data.tags.filter((value): value is string => typeof value === "string")
    : [];
  const tagline = data.tagline || "";
  const pricing = data.pricing || "free";
  const is_featured = Boolean(data.is_featured);
  const is_new = Boolean(data.is_new);
  const status = data.status || "draft";
  const tools = Array.isArray(data.tools)
    ? data.tools.filter((value): value is string => typeof value === "string")
    : [];
  const graph = data.graph && typeof data.graph === "object" ? data.graph : {};
  const sort_order = typeof data.sort_order === "number" ? data.sort_order : 0;
  const body = content.trim();

  return {
    slug,
    name,
    description,
    emoji,
    category,
    tags,
    tagline,
    pricing,
    is_featured,
    is_new,
    status,
    tools,
    graph,
    markdown: body,
    tool_count: tools.length,
    sort_order,
  };
});
