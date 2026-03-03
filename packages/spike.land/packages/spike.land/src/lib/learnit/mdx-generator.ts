import type { GeneratedLearnItContent } from "./content-generator";

export function generateMdxFromResponse(
  generated: GeneratedLearnItContent,
): string {
  let mdx = "";

  generated.sections.forEach(section => {
    mdx += `\n\n## ${section.heading}\n\n${section.content}`;
  });

  if (generated.relatedTopics?.length > 0) {
    mdx +=
      `\n\n---\n\n### Detailed Related Topics\n\nThe following topics are typically studied next:\n`;
    generated.relatedTopics.forEach(topic => {
      mdx += `- [[${topic}]]\n`;
    });
  }

  return mdx;
}
