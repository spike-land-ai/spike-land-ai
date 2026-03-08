import { describe, expect, it } from "vitest";

import {
  collectEditorHighlightSegments,
  isJsxLikeFile,
} from "../../../src/frontend/platform-frontend/editor/tsx-highlighting";

describe("TSX editor highlighting", () => {
  it("only enables JSX-specific highlighting for JSX-like files", () => {
    expect(isJsxLikeFile("App.tsx")).toBe(true);
    expect(isJsxLikeFile("App.jsx")).toBe(true);
    expect(isJsxLikeFile("utils.ts")).toBe(false);
  });

  it("collects JSX and Tailwind highlight segments from TSX code", () => {
    const code = `
      export default function App() {
        return (
          <div
            className="flex items-center bg-amber-500/20 hover:bg-amber-500"
            data-testid="hero"
          >
            <button className={cn("px-4 py-2 text-white", active && "shadow-lg")} />
          </div>
        );
      }
    `;

    const segments = collectEditorHighlightSegments(code, "App.tsx");
    const classes = segments.map((segment) => segment.className);
    const rendered = segments.map((segment) => code.slice(segment.startOffset, segment.endOffset));

    expect(classes).toContain("spike-jsx-tag");
    expect(classes).toContain("spike-jsx-attr");
    expect(classes).toContain("spike-tailwind-variant");
    expect(classes).toContain("spike-tailwind-color");
    expect(classes).toContain("spike-tailwind-spacing");
    expect(classes).toContain("spike-tailwind-layout");

    expect(rendered).toContain("div");
    expect(rendered).toContain("button");
    expect(rendered).toContain("className");
    expect(rendered).toContain("hover:");
    expect(rendered).toContain("bg-amber-500/20");
    expect(rendered).toContain("px-4");
  });

  it("does not emit TSX-specific decorations for plain TypeScript files", () => {
    const segments = collectEditorHighlightSegments(
      `const classes = cn("flex items-center", active && "bg-amber-500");`,
      "utils.ts",
    );

    expect(segments).toEqual([]);
  });
});
