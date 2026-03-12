import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { StoreSection } from "../StoreSection";
import type { McpAppSummary } from "../../../hooks/useApps";

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

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) => {
      if (key === "tool_other") {
        return `${options?.count ?? 0} tools`;
      }
      const map: Record<string, string> = {
        seeAll: "See All",
        emptySection: "No apps found.",
        emptySectionCta: "Browse all categories",
        get: "GET",
      };
      return map[key] ?? key;
    },
  }),
}));

describe("StoreSection", () => {
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

  it("renders empty state with CTA when no apps and onViewAll provided", () => {
    const onViewAll = vi.fn();
    render(<StoreSection title="Testing" apps={[]} onViewAll={onViewAll} />);
    expect(screen.getByText("No apps found.")).toBeInTheDocument();
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
    // 3 skeleton divs should be aria-hidden
    const skeletons = container.querySelectorAll('[aria-hidden="true"]');
    expect(skeletons.length).toBe(3);
  });
});
