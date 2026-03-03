import { describe, expect, it } from "vitest";

import { generateMdxFromResponse } from "./mdx-generator";
import type { GeneratedLearnItContent } from "./content-generator";

describe("generateMdxFromResponse", () => {
  it("generates sections with H2 headings", () => {
    const content: GeneratedLearnItContent = {
      title: "Test Topic",
      description: "A test topic",
      sections: [
        { heading: "Introduction", content: "Hello world" },
        { heading: "Details", content: "More details here" },
      ],
      relatedTopics: [],
    };
    const mdx = generateMdxFromResponse(content);
    expect(mdx).toContain("## Introduction");
    expect(mdx).toContain("Hello world");
    expect(mdx).toContain("## Details");
    expect(mdx).toContain("More details here");
  });

  it("includes related topics as wiki links", () => {
    const content: GeneratedLearnItContent = {
      title: "React",
      description: "About React",
      sections: [{ heading: "Basics", content: "React basics" }],
      relatedTopics: ["State Management", "Hooks"],
    };
    const mdx = generateMdxFromResponse(content);
    expect(mdx).toContain("[[State Management]]");
    expect(mdx).toContain("[[Hooks]]");
    expect(mdx).toContain("### Detailed Related Topics");
  });

  it("omits related topics section when empty", () => {
    const content: GeneratedLearnItContent = {
      title: "Simple",
      description: "Minimal",
      sections: [{ heading: "Intro", content: "Just intro" }],
      relatedTopics: [],
    };
    const mdx = generateMdxFromResponse(content);
    expect(mdx).not.toContain("### Detailed Related Topics");
  });

  it("handles single section", () => {
    const content: GeneratedLearnItContent = {
      title: "One",
      description: "Single section",
      sections: [{ heading: "Only Section", content: "Content here" }],
      relatedTopics: [],
    };
    const mdx = generateMdxFromResponse(content);
    expect(mdx).toContain("## Only Section");
    expect(mdx).toContain("Content here");
  });

  it("handles multiple related topics", () => {
    const content: GeneratedLearnItContent = {
      title: "Topic",
      description: "Desc",
      sections: [{ heading: "Intro", content: "Intro text" }],
      relatedTopics: ["A", "B", "C", "D", "E"],
    };
    const mdx = generateMdxFromResponse(content);
    expect(mdx).toContain("[[A]]");
    expect(mdx).toContain("[[E]]");
    // Each related topic should be a list item
    const wikiLinks = mdx.match(/\[\[.*?\]\]/g);
    expect(wikiLinks).toHaveLength(5);
  });
});
