import { describe, expect, it } from "vitest";
import { slugify, stripMarkdown } from "./utils";

describe("learnit/utils", () => {
  describe("slugify", () => {
    it("should lowercase and replace spaces with hyphens", () => {
      expect(slugify("Advanced React")).toBe("advanced-react");
    });

    it("should strip non-alphanumeric characters except hyphens and slashes", () => {
      expect(slugify("Hello World!")).toBe("hello-world");
      expect(slugify("What's New?")).toBe("whats-new");
    });

    it("should preserve forward slashes", () => {
      expect(slugify("topic/subtopic")).toBe("topic/subtopic");
    });

    it("should handle empty string", () => {
      expect(slugify("")).toBe("");
    });

    it("should collapse multiple spaces into a single hyphen", () => {
      expect(slugify("multiple   spaces")).toBe("multiple-spaces");
    });
  });

  describe("stripMarkdown", () => {
    it("should remove code blocks", () => {
      const input = "Before\n```js\nconst x = 1;\n```\nAfter";
      expect(stripMarkdown(input)).toContain("Before");
      expect(stripMarkdown(input)).toContain("After");
      expect(stripMarkdown(input)).not.toContain("const x = 1");
    });

    it("should remove inline code but keep content", () => {
      expect(stripMarkdown("Use `useState` hook")).toContain("useState");
      expect(stripMarkdown("Use `useState` hook")).not.toContain("`");
    });

    it("should remove image syntax but keep alt text", () => {
      expect(stripMarkdown("![Logo](http://example.com/logo.png)")).toBe(
        "Logo",
      );
    });

    it("should remove link syntax but keep text", () => {
      expect(stripMarkdown("[Click here](http://example.com)")).toBe(
        "Click here",
      );
    });

    it("should remove headings", () => {
      expect(stripMarkdown("## My Heading")).toBe("My Heading");
      expect(stripMarkdown("### Sub Heading")).toBe("Sub Heading");
    });

    it("should remove bold and italic markers", () => {
      expect(stripMarkdown("**bold** and *italic*")).toBe("bold and italic");
    });

    it("should remove strikethrough", () => {
      expect(stripMarkdown("~~deleted~~")).toBe("deleted");
    });

    it("should remove horizontal rules", () => {
      expect(stripMarkdown("before\n---\nafter")).toBe("before after");
    });

    it("should remove blockquote markers", () => {
      expect(stripMarkdown("> quoted text")).toBe("quoted text");
    });

    it("should remove list markers", () => {
      expect(stripMarkdown("- item one\n- item two")).toContain("item one");
      expect(stripMarkdown("1. first\n2. second")).toContain("first");
    });

    it("should collapse multiple newlines", () => {
      const input = "Line one\n\n\nLine two";
      expect(stripMarkdown(input)).toBe("Line one Line two");
    });
  });
});
