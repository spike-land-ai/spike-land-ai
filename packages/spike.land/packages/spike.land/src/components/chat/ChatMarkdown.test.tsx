import { render, screen } from "@testing-library/react";
import { ChatMarkdown } from "./ChatMarkdown";

describe("ChatMarkdown", () => {
  it("renders markdown content", () => {
    render(<ChatMarkdown content="**Bold**" />);
    const strong = screen.getByText("Bold");
    expect(strong.tagName).toBe("STRONG");
  });

  it("renders code blocks", () => {
    render(<ChatMarkdown content="`code`" />);
    const code = screen.getByText("code");
    expect(code.tagName).toBe("CODE");
  });

  it("renders basic text", () => {
    render(<ChatMarkdown content="Hello World" />);
    expect(screen.getByText("Hello World")).toBeDefined();
  });
});
