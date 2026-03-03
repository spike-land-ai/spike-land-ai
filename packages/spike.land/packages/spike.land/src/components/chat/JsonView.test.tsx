import { fireEvent, render, screen } from "@testing-library/react";
import { JsonView } from "./JsonView";

describe("JsonView", () => {
  it("renders primitives correctly", () => {
    const data = {
      str: "hello",
      num: 42,
      bool: true,
      nil: null,
    };
    render(<JsonView data={data} />);

    // Values are rendered in their own spans
    expect(screen.getByText("hello")).toBeDefined();
    expect(screen.getByText("42")).toBeDefined();
    expect(screen.getByText("true")).toBeDefined();
    expect(screen.getByText("null")).toBeDefined();
  });

  it("renders nested objects", () => {
    const data = {
      user: {
        name: "Alice",
      },
    };
    render(<JsonView data={data} />);

    // Keys are rendered as "key"
    expect(screen.getByText("\"user\"")).toBeDefined();
    expect(screen.getByText("\"name\"")).toBeDefined();
    expect(screen.getByText("Alice")).toBeDefined();
  });

  it("renders arrays", () => {
    const data = ["apple", "banana"];
    render(<JsonView data={data} />);

    expect(screen.getByText("apple")).toBeDefined();
    expect(screen.getByText("banana")).toBeDefined();
  });

  it("collapses deep objects based on maxExpandDepth", () => {
    const data = {
      a: {
        b: {
          c: {
            d: "deep",
          },
        },
      },
    };
    render(<JsonView data={data} maxExpandDepth={2} />);

    expect(screen.getByText("\"a\"")).toBeDefined();
    expect(screen.getByText("\"b\"")).toBeDefined();
    // "d" should not be visible as c is collapsed
    expect(screen.queryByText("deep")).toBeNull();
  });

  it("expands when clicked", () => {
    const data = {
      nested: {
        secret: "value",
      },
    };
    render(<JsonView data={data} maxExpandDepth={0} />);

    // Initially collapsed, root shows { 1 item }
    expect(screen.queryByText("\"nested\"")).toBeNull();

    // Click root
    const rootToggle = screen.getByText(content => content.includes("1 item"));
    const rootButton = rootToggle.closest("button");
    if (!rootButton) throw new Error("Root button not found");
    fireEvent.click(rootButton);

    // Now "nested" should be visible (but collapsed because depth 1 > maxExpandDepth 0)
    expect(screen.getByText("\"nested\"")).toBeDefined();
    expect(screen.queryByText("\"secret\"")).toBeNull();

    // Click "nested"
    const nestedKey = screen.getByText("\"nested\"");
    const nestedButton = nestedKey.closest("button");
    if (!nestedButton) throw new Error("Nested button not found");

    fireEvent.click(nestedButton);

    // Now "secret" should be visible
    expect(screen.getByText("\"secret\"")).toBeDefined();
  });
});
