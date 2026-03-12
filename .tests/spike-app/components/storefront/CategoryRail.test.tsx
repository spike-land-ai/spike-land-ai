import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CategoryRail } from "@/ui/components/storefront/CategoryRail";
import type { AppCategoryGroup } from "@/ui/hooks/useApps";

const mockGroups: AppCategoryGroup[] = [
  { category: "Productivity", apps: [] },
  { category: "Developer Tools", apps: [] },
  { category: "AI", apps: [] },
];

describe("CategoryRail", () => {
  it("renders Discover button and all category buttons", () => {
    render(<CategoryRail groups={mockGroups} activeCategory={null} onSelectCategory={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Discover" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Productivity" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Developer Tools" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "AI" })).toBeInTheDocument();
  });

  it("marks Discover as pressed when activeCategory is null", () => {
    render(<CategoryRail groups={mockGroups} activeCategory={null} onSelectCategory={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Discover" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Productivity" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("marks the active category button as pressed", () => {
    render(
      <CategoryRail
        groups={mockGroups}
        activeCategory="Developer Tools"
        onSelectCategory={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Discover" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: /Developer Tools/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("calls onSelectCategory with null when Discover is clicked", async () => {
    const onSelect = vi.fn();
    render(<CategoryRail groups={mockGroups} activeCategory="AI" onSelectCategory={onSelect} />);

    await userEvent.click(screen.getByRole("button", { name: "Discover" }));
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("calls onSelectCategory with category name when a category is clicked", async () => {
    const onSelect = vi.fn();
    render(<CategoryRail groups={mockGroups} activeCategory={null} onSelectCategory={onSelect} />);

    await userEvent.click(screen.getByRole("button", { name: "Productivity" }));
    expect(onSelect).toHaveBeenCalledWith("Productivity");
  });

  it("navigates forward with ArrowDown key", async () => {
    render(<CategoryRail groups={mockGroups} activeCategory={null} onSelectCategory={vi.fn()} />);

    const discoverBtn = screen.getByRole("button", { name: "Discover" });
    discoverBtn.focus();
    await userEvent.keyboard("{ArrowDown}");

    // Focus should move to first category button
    expect(screen.getByRole("button", { name: "Productivity" })).toHaveFocus();
  });

  it("navigates backward with ArrowUp key", async () => {
    render(<CategoryRail groups={mockGroups} activeCategory={null} onSelectCategory={vi.fn()} />);

    const productivityBtn = screen.getByRole("button", { name: "Productivity" });
    productivityBtn.focus();
    await userEvent.keyboard("{ArrowUp}");

    // Focus should wrap back to Discover
    expect(screen.getByRole("button", { name: "Discover" })).toHaveFocus();
  });

  it("shows skeleton when isLoading is true", () => {
    const { container } = render(
      <CategoryRail groups={[]} activeCategory={null} onSelectCategory={vi.fn()} isLoading />,
    );

    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    // No buttons should be rendered in loading state
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});
