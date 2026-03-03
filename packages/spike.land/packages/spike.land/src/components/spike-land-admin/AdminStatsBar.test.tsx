/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { AdminStatsBar } from "./AdminStatsBar";

afterEach(cleanup);

describe("AdminStatsBar", () => {
  const mockStats = [
    { label: "Total Users", value: "12,450", delta: "+5.2%", deltaType: "up" as const },
    { label: "MRR", value: "$8,320", delta: "+12%", deltaType: "up" as const },
    { label: "Errors", value: "3", delta: "-80%", deltaType: "down" as const },
  ];

  it("renders all stat labels", () => {
    render(<AdminStatsBar stats={mockStats} />);
    expect(screen.getByText("Total Users")).toBeDefined();
    expect(screen.getByText("MRR")).toBeDefined();
    expect(screen.getByText("Errors")).toBeDefined();
  });

  it("renders stat values", () => {
    render(<AdminStatsBar stats={mockStats} />);
    expect(screen.getByText("12,450")).toBeDefined();
  });

  it("renders delta indicators", () => {
    render(<AdminStatsBar stats={mockStats} />);
    expect(screen.getByText("+5.2%")).toBeDefined();
    expect(screen.getByText("-80%")).toBeDefined();
  });

  it("renders stat icons when provided", () => {
    const statsWithIcons = [
      { label: "Users", value: 100, icon: "👤" },
    ];
    render(<AdminStatsBar stats={statsWithIcons} />);
    expect(screen.getByText("👤")).toBeDefined();
  });

  it("renders numeric values correctly", () => {
    const statsWithNumber = [
      { label: "Active Sessions", value: 42 },
    ];
    render(<AdminStatsBar stats={statsWithNumber} />);
    expect(screen.getByText("42")).toBeDefined();
  });
});
