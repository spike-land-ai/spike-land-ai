import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { type AppStatus, StatusBadge } from "../../../src/spike-app/components/StatusBadge";

describe("StatusBadge", () => {
  const allStatuses: AppStatus[] = [
    "prompting",
    "drafting",
    "building",
    "live",
    "archived",
    "deleted",
  ];

  it.each(allStatuses)("renders %s status text", (status) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(status)).toBeInTheDocument();
  });

  it("renders with correct icon for live status", () => {
    const { container } = render(<StatusBadge status="live" />);
    // The live icon is ● (U+25CF)
    expect(container.textContent).toContain("\u25CF");
  });

  it("renders with correct icon for deleted status", () => {
    const { container } = render(<StatusBadge status="deleted" />);
    // The deleted icon is ✕ (U+2715)
    expect(container.textContent).toContain("\u2715");
  });

  it("applies color classes for live status", () => {
    render(<StatusBadge status="live" />);
    const badge = screen.getByText("live").closest("span");
    expect(badge?.className).toContain("bg-success");
    expect(badge?.className).toContain("text-success-foreground");
  });

  it("applies color classes for archived status", () => {
    render(<StatusBadge status="archived" />);
    const badge = screen.getByText("archived").closest("span");
    expect(badge?.className).toContain("bg-muted");
  });
});
