import { slugify } from "./utils";

/**
 * Parses content for wiki-style links [[topic]] or [[topic|alias]]
 * Returns transformed content with markdown links and a list of extracted link slugs.
 */
export function parseWikiLinks(content: string): {
  content: string;
  links: string[];
} {
  const wikiLinkPattern = /\[\[([^\]]+)\]\]/g;
  const links: string[] = [];

  const transformed = content.replace(wikiLinkPattern, (_, match) => {
    // Handle aliasing: [[topic|alias]]
    const parts = match.split("|");
    const topic = parts[0].trim();
    const alias = parts.length > 1 ? parts[1].trim() : topic;

    // Convert topic to slug: "Advanced React" -> "advanced-react"
    const slug = slugify(topic);

    links.push(slug);

    return `[${alias}](/learnit/${slug})`;
  });

  return { content: transformed, links };
}
