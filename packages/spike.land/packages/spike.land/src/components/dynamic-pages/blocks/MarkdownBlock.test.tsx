import { render, screen } from "@testing-library/react";
import { MarkdownBlock } from "./MarkdownBlock";
import { describe, expect, it } from "vitest";

describe("MarkdownBlock", () => {
  it("renders markdown content", () => {
    const content = { content: "# Hello World" };
    render(<MarkdownBlock content={content} />);

    // Check for the heading
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("Hello World");
  });

  it("sanitizes HTML input", () => {
    const content = {
      content: "Hello <script data-testid=\"evil\">alert(1)</script>",
    };
    render(<MarkdownBlock content={content} />);

    // The script tag should NOT be in the document as an element
    const script = screen.queryByTestId("evil");
    expect(script).not.toBeInTheDocument();

    // It might be rendered as text
    expect(screen.getByText(/script/)).toBeInTheDocument();
  });

  it("renders GFM tables", () => {
    const content = {
      content: "| Header 1 | Header 2 |\n| --- | --- |\n| Cell 1 | Cell 2 |",
    };
    render(<MarkdownBlock content={content} />);

    // Check for table elements
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(2); // Header row + 1 data row
  });
});
