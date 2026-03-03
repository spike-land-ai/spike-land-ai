import { describe, expect, it } from "vitest";
import { parseWikiLinks } from "./wiki-links";

describe("learnit/wiki-links", () => {
  it("should transform simple wiki links", () => {
    const result = parseWikiLinks("Learn about [[React Hooks]].");
    expect(result.content).toBe("Learn about [React Hooks](/learnit/react-hooks).");
    expect(result.links).toEqual(["react-hooks"]);
  });

  it("should transform aliased wiki links", () => {
    const result = parseWikiLinks("Read more about [[Advanced React|React]].");
    expect(result.content).toBe(
      "Read more about [React](/learnit/advanced-react).",
    );
    expect(result.links).toEqual(["advanced-react"]);
  });

  it("should handle multiple wiki links", () => {
    const result = parseWikiLinks(
      "Compare [[React]] with [[Vue]] and [[Angular]].",
    );
    expect(result.links).toEqual(["react", "vue", "angular"]);
    expect(result.content).toContain("[React](/learnit/react)");
    expect(result.content).toContain("[Vue](/learnit/vue)");
    expect(result.content).toContain("[Angular](/learnit/angular)");
  });

  it("should return empty links when no wiki links found", () => {
    const result = parseWikiLinks("No links here.");
    expect(result.content).toBe("No links here.");
    expect(result.links).toEqual([]);
  });

  it("should handle wiki links with spaces", () => {
    const result = parseWikiLinks("Check [[TypeScript Generics]].");
    expect(result.links).toEqual(["typescript-generics"]);
    expect(result.content).toContain(
      "[TypeScript Generics](/learnit/typescript-generics)",
    );
  });
});
