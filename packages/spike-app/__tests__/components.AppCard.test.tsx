import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppCard } from "@/components/AppCard";

// Mock TanStack router Link
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Link: ({
      children,
      className,
    }: {
      to: string;
      children: React.ReactNode;
      className?: string;
      params?: unknown;
      search?: unknown;
    }) => <a className={className}>{children}</a>,
  };
});

const baseProps = {
  id: "app-1",
  name: "My App",
  status: "live" as const,
};

describe("AppCard", () => {
  it("renders the app name", () => {
    render(<AppCard {...baseProps} />);
    expect(screen.getByText("My App")).toBeInTheDocument();
  });

  it("renders MCP badge", () => {
    render(<AppCard {...baseProps} />);
    expect(screen.getByText("MCP")).toBeInTheDocument();
  });

  it("renders status badge", () => {
    render(<AppCard {...baseProps} />);
    expect(screen.getByText("live")).toBeInTheDocument();
  });

  it("renders description when provided", () => {
    render(<AppCard {...baseProps} description="An awesome app" />);
    expect(screen.getByText("An awesome app")).toBeInTheDocument();
  });

  it("does not render description when not provided", () => {
    const { container } = render(<AppCard {...baseProps} />);
    expect(container.querySelector("p.line-clamp-2")).not.toBeInTheDocument();
  });

  it("renders category badge when provided", () => {
    render(<AppCard {...baseProps} category="mcp" />);
    expect(screen.getByText("mcp")).toBeInTheDocument();
  });

  it("renders tool count (singular)", () => {
    render(<AppCard {...baseProps} toolCount={1} />);
    expect(screen.getByText("1 tool")).toBeInTheDocument();
  });

  it("renders tool count (plural)", () => {
    render(<AppCard {...baseProps} toolCount={5} />);
    expect(screen.getByText("5 tools")).toBeInTheDocument();
  });

  it("does not render tool count when 0", () => {
    const { container } = render(<AppCard {...baseProps} toolCount={0} />);
    expect(container.textContent).not.toContain("0 tool");
  });

  it("renders owner name when provided", () => {
    render(<AppCard {...baseProps} ownerName="Alice" />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("renders formatted createdAt date using short locale format", () => {
    render(<AppCard {...baseProps} createdAt="2025-01-15T00:00:00Z" />);
    // Component uses toLocaleDateString([], { month: "short", day: "numeric" })
    const dateText = new Date("2025-01-15T00:00:00Z").toLocaleDateString([], {
      month: "short",
      day: "numeric",
    });
    expect(screen.getByText(dateText)).toBeInTheDocument();
  });

  it("uses 'other' category color as fallback for valid category", () => {
    const { container } = render(<AppCard {...baseProps} category="other" />);
    // The category badge span uses rounded-full px-2.5
    const categorySpan = container.querySelector(".rounded-full.px-2\\.5");
    expect(categorySpan?.className).toContain("bg-muted");
  });

  it("renders all status types without crashing", () => {
    const statuses = ["prompting", "drafting", "building", "live", "archived", "deleted"] as const;
    for (const status of statuses) {
      const { unmount } = render(<AppCard {...baseProps} status={status} />);
      unmount();
    }
  });
});
