import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { HeroShelf } from "../HeroShelf";
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
    t: (key: string) => {
      const map: Record<string, string> = {
        featuredApp: "Featured App",
        getApp: "Get App",
        free: "Free",
        premium: "Premium",
      };
      return map[key] ?? key;
    },
  }),
}));

describe("HeroShelf", () => {
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

  it("renders nothing when no featured apps provided", () => {
    const { container } = render(<HeroShelf featuredApps={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the hero app data correctly", () => {
    render(<HeroShelf featuredApps={mockApps} />);

    expect(screen.getByText("Super Featured App")).toBeInTheDocument();
    expect(screen.getByText("The best app ever.")).toBeInTheDocument();
    expect(screen.getByText("Free • General Utility")).toBeInTheDocument();
    expect(screen.getByText("🌟")).toBeInTheDocument();

    const link = screen.getByRole("link", { name: /Get App/i });
    expect(link).toHaveAttribute("href", "/apps/$appSlug/featured-app-1");
  });
});
