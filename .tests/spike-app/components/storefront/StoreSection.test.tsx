import React from "react";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { StoreSection } from "@/ui/components/storefront/StoreSection";
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
    slug: "app1",
    name: "App 1",
    description: "Desc 1",
    emoji: "🔧",
    category: "Cat 1",
    tags: [],
    tagline: "Tag 1",
    pricing: "free",
    is_featured: false,
    is_new: false,
    tool_count: 1,
    sort_order: 1,
  },
  {
    slug: "app2",
    name: "App 2",
    description: "Desc 2",
    emoji: "🔧",
    category: "Cat 1",
    tags: [],
    tagline: "Tag 2",
    pricing: "free",
    is_featured: false,
    is_new: false,
    tool_count: 1,
    sort_order: 2,
  },
];

describe("StoreSection", () => {
  it("renders empty state with CTA when no apps and onViewAll provided", () => {
    const onViewAll = vi.fn();
    render(<StoreSection title="Testing" apps={[]} onViewAll={onViewAll} />);
    // i18n key "emptySection"
    expect(screen.getByText("No apps found.")).toBeInTheDocument();
    // i18n key "emptySectionCta"
    expect(screen.getByRole("button", { name: "Browse all categories" })).toBeInTheDocument();
  });

  it("renders empty state without CTA when no onViewAll provided", () => {
    render(<StoreSection title="Testing" apps={[]} />);
    expect(screen.getByText("No apps found.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Browse all categories" })).not.toBeInTheDocument();
  });

  it("renders title, subtitle, and apps", () => {
    render(<StoreSection title="Featured" subtitle="Best apps" apps={mockApps} layout="grid" />);

    expect(screen.getByText("Featured")).toBeInTheDocument();
    expect(screen.getByText("Best apps")).toBeInTheDocument();
    expect(screen.getByText("App 1")).toBeInTheDocument();
    expect(screen.getByText("App 2")).toBeInTheDocument();
  });

  it("shows skeleton placeholders when isLoading is true", () => {
    const { container } = render(
      <StoreSection title="Loading Section" apps={[]} isLoading skeletonCount={3} />,
    );
    const skeletons = container.querySelectorAll('[aria-hidden="true"]');
    expect(skeletons.length).toBe(3);
  });
});
