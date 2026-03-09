import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "@/components/StatusBadge";
import type { AppStatus } from "@/components/StatusBadge";

describe("StatusBadge", () => {
  const statuses: AppStatus[] = [
    "prompting",
    "drafting",
    "building",
    "live",
    "archived",
    "deleted",
  ];

  it.each(statuses)("renders status text for %s", (status) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(status)).toBeInTheDocument();
  });

  it("applies success color class for live status", () => {
    const { container } = render(<StatusBadge status="live" />);
    expect(container.firstChild).toHaveClass("bg-success/70");
  });

  it("applies destructive color class for deleted status", () => {
    const { container } = render(<StatusBadge status="deleted" />);
    expect(container.firstChild).toHaveClass("bg-destructive/70");
  });

  it("applies muted color class for archived status", () => {
    const { container } = render(<StatusBadge status="archived" />);
    expect(container.firstChild).toHaveClass("bg-muted/80");
  });

  it("renders a lucide icon for live status", () => {
    const { container } = render(<StatusBadge status="live" />);
    // Component renders a Circle lucide icon (svg element)
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders a lucide icon for deleted status", () => {
    const { container } = render(<StatusBadge status="deleted" />);
    // Component renders an X lucide icon (svg element)
    expect(container.querySelector("svg")).toBeInTheDocument();
  });
});
