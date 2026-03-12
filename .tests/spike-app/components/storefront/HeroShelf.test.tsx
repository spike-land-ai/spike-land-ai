import React from "react";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { HeroShelf } from "@/ui/components/storefront/HeroShelf";
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

const mockApps: McpAppSummary[] = [
  {
    slug: "featured-app-1",
    name: "Super Featured App",
    description: "This app does everything you need.",
    emoji: "🌟",
    category: "General Utility",
    tags: [],
    tagline: "The best app ever.",
    pricing: "free",
    is_featured: true,
    is_new: false,
    tool_count: 5,
    sort_order: 1,
  },
];

describe("HeroShelf", () => {
  it("renders nothing when no featured apps provided", () => {
    const { container } = render(<HeroShelf featuredApps={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the hero app name and tagline", () => {
    render(<HeroShelf featuredApps={mockApps} />);

    expect(screen.getByText("Super Featured App")).toBeInTheDocument();
    expect(screen.getByText("The best app ever.")).toBeInTheDocument();
    expect(screen.getByText("🌟")).toBeInTheDocument();
  });

  it("renders the Get App link pointing to the correct slug", () => {
    render(<HeroShelf featuredApps={mockApps} />);
    // i18n returns the key as-is in test env (key "getApp")
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/apps/$appSlug/featured-app-1");
  });

  it("shows skeleton when isLoading is true", () => {
    const { container } = render(<HeroShelf featuredApps={[]} isLoading />);
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  });
});
