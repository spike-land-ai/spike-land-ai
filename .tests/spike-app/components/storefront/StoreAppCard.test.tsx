import React from "react";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { StoreAppCard } from "@/ui/components/storefront/StoreAppCard";
import type { McpAppSummary } from "@/ui/hooks/useApps";

interface LinkProps {
  children: ReactNode;
  className?: string;
  params?: { appSlug?: string };
  to: string;
}

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, params, className }: LinkProps) => (
    <a href={`${to}/${params?.appSlug}`} className={className}>
      {children}
    </a>
  ),
}));

const mockApp: McpAppSummary = {
  slug: "test-app",
  name: "Test App",
  description: "A test description that might be long enough to get truncated in the UI.",
  emoji: "🧪",
  category: "General Utility",
  tags: [],
  tagline: "Just a test",
  pricing: "free",
  is_featured: false,
  is_new: false,
  tool_count: 3,
  sort_order: 1,
};

describe("StoreAppCard", () => {
  it("renders in grid layout correctly", () => {
    render(<StoreAppCard app={mockApp} layout="grid" />);

    expect(screen.getByText("Test App")).toBeInTheDocument();
    expect(screen.getByText("🧪")).toBeInTheDocument();
    expect(screen.getByText(/A test description/i)).toBeInTheDocument();
    expect(screen.getByText("General Utility")).toBeInTheDocument();
    // i18n key "tool_other" returns "3 tools" with real i18n loaded in test-setup
    expect(screen.getByText("3 tools")).toBeInTheDocument();
    // i18n key "get" returns "GET"
    expect(screen.getByText("GET")).toBeInTheDocument();
  });

  it("renders in list layout correctly", () => {
    render(<StoreAppCard app={mockApp} layout="list" rank={42} />);

    expect(screen.getByText("Test App")).toBeInTheDocument();
    expect(screen.getByText("🧪")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("General Utility")).toBeInTheDocument();
    expect(screen.queryByText(/A test description/i)).not.toBeInTheDocument();
    expect(screen.getByText("GET")).toBeInTheDocument();
  });

  it("uses provided categoryName override", () => {
    render(<StoreAppCard app={mockApp} layout="grid" categoryName="Custom Override" />);
    expect(screen.getByText("Custom Override")).toBeInTheDocument();
    expect(screen.queryByText("General Utility")).not.toBeInTheDocument();
  });
});
