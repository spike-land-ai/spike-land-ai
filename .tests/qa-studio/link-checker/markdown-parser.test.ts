import { describe, expect, it } from "vitest";
import {
  extractLinks,
  categorizeLink,
  slugifyHeading,
  extractHeadings,
} from "../../../src/core/browser-automation/core-logic/link-checker/markdown-parser.js";

describe("categorizeLink", () => {
  it("classifies relative file links", () => {
    expect(categorizeLink("./README.md")).toBe("relative_file");
    expect(categorizeLink("../docs/guide.md")).toBe("relative_file");
    expect(categorizeLink("file.txt")).toBe("relative_file");
  });

  it("classifies anchor links", () => {
    expect(categorizeLink("#section")).toBe("anchor");
    expect(categorizeLink("#my-heading")).toBe("anchor");
  });

  it("classifies file with anchor links", () => {
    expect(categorizeLink("./README.md#section")).toBe("file_with_anchor");
    expect(categorizeLink("docs/guide.md#install")).toBe("file_with_anchor");
  });

  it("classifies GitHub repo links", () => {
    expect(categorizeLink("https://github.com/spike-land-ai/chess-engine")).toBe("github_repo");
  });

  it("classifies GitHub file links", () => {
    expect(categorizeLink("https://github.com/org/repo/blob/main/README.md")).toBe("github_file");
  });

  it("classifies GitHub tree links", () => {
    expect(categorizeLink("https://github.com/org/repo/tree/main/src")).toBe("github_tree");
  });

  it("classifies raw GitHub links", () => {
    expect(categorizeLink("https://raw.githubusercontent.com/org/repo/main/logo.svg")).toBe(
      "github_raw",
    );
  });

  it("classifies shields.io badges", () => {
    expect(
      categorizeLink("https://img.shields.io/github/actions/workflow/status/org/repo/ci.yml"),
    ).toBe("github_badge");
  });

  it("classifies external URLs", () => {
    expect(categorizeLink("https://example.org/page")).toBe("external_url");
    expect(categorizeLink("http://docs.something.com")).toBe("external_url");
  });

  it("skips mailto and tel", () => {
    expect(categorizeLink("mailto:hello@test.com")).toBe("skipped");
    expect(categorizeLink("tel:+123456")).toBe("skipped");
  });

  it("skips example.com and localhost", () => {
    expect(categorizeLink("https://example.com/test")).toBe("skipped");
    expect(categorizeLink("http://localhost:3000")).toBe("skipped");
  });
});

describe("slugifyHeading", () => {
  it("converts headings to slugs", () => {
    expect(slugifyHeading("Getting Started")).toBe("getting-started");
    expect(slugifyHeading("API Reference (v2)")).toBe("api-reference-v2");
    expect(slugifyHeading("Hello World!")).toBe("hello-world");
  });

  it("handles special characters", () => {
    expect(slugifyHeading("C++ Guide")).toBe("c-guide");
    expect(slugifyHeading("foo & bar")).toBe("foo-bar");
  });

  it("strips HTML tags", () => {
    expect(slugifyHeading("Hello <code>world</code>")).toBe("hello-world");
  });
});

describe("extractHeadings", () => {
  it("extracts heading slugs from markdown", () => {
    const md = "# Hello World\n## Getting Started\n### API Reference";
    const headings = extractHeadings(md);
    expect(headings).toEqual(["hello-world", "getting-started", "api-reference"]);
  });

  it("skips headings inside code blocks", () => {
    const md = "# Real Heading\n```\n# Fake Heading\n```\n## Another Real";
    const headings = extractHeadings(md);
    expect(headings).toEqual(["real-heading", "another-real"]);
  });
});

describe("extractLinks", () => {
  it("extracts inline links", () => {
    const md = "Check [Google](https://google.com) for info.";
    const links = extractLinks(md, "test.md");
    expect(links).toHaveLength(1);
    expect(links[0]!.target).toBe("https://google.com");
    expect(links[0]!.text).toBe("Google");
    expect(links[0]!.line).toBe(1);
  });

  it("extracts multiple links on same line", () => {
    const md = "[A](a.md) and [B](b.md)";
    const links = extractLinks(md, "test.md");
    expect(links).toHaveLength(2);
  });

  it("extracts reference-style links", () => {
    const md = "[docs]: https://docs.example.com";
    const links = extractLinks(md, "test.md");
    expect(links).toHaveLength(1);
    expect(links[0]!.target).toBe("https://docs.example.com");
  });

  it("extracts HTML href links", () => {
    const md = '<a href="https://test.com">click</a>';
    const links = extractLinks(md, "test.md");
    expect(links).toHaveLength(1);
    expect(links[0]!.target).toBe("https://test.com");
  });

  it("extracts img src links", () => {
    const md = '<img src="https://example.com/logo.png" alt="logo">';
    const links = extractLinks(md, "test.md");
    expect(links).toHaveLength(1);
    expect(links[0]!.target).toBe("https://example.com/logo.png");
  });

  it("skips links inside code blocks", () => {
    const md = "```\n[link](https://inside.code)\n```\n[real](https://real.com)";
    const links = extractLinks(md, "test.md");
    // Code block links are skipped during extraction (not even added)
    expect(links).toHaveLength(1);
    expect(links[0]!.target).toBe("https://real.com");
  });

  it("handles relative file links", () => {
    const md = "[see](./other.md)";
    const links = extractLinks(md, "test.md");
    expect(links[0]!.category).toBe("relative_file");
  });

  it("handles links with anchors", () => {
    const md = "[section](./doc.md#usage)";
    const links = extractLinks(md, "test.md");
    expect(links[0]!.category).toBe("file_with_anchor");
  });

  it("records correct line numbers", () => {
    const md = "line1\n[link1](a.md)\nline3\n[link2](b.md)";
    const links = extractLinks(md, "test.md");
    expect(links[0]!.line).toBe(2);
    expect(links[1]!.line).toBe(4);
  });
});
