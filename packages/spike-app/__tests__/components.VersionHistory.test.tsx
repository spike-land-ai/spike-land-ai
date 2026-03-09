import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { VersionHistory } from "@/components/VersionHistory";

const versions = [
  {
    version: 1,
    changeDescription: "Initial release",
    author: "Alice",
    timestamp: "2025-01-01T00:00:00Z",
  },
  {
    version: 3,
    changeDescription: "Added dark mode",
    author: "Bob",
    timestamp: "2025-03-01T00:00:00Z",
  },
  { version: 2, changeDescription: "Bug fixes", timestamp: "2025-02-01T00:00:00Z" },
];

describe("VersionHistory", () => {
  it("shows 'No versions recorded' when empty", () => {
    render(<VersionHistory versions={[]} />);
    expect(screen.getByText("No versions recorded")).toBeInTheDocument();
  });

  it("renders all versions", () => {
    render(<VersionHistory versions={versions} />);
    expect(screen.getByText("Initial release")).toBeInTheDocument();
    expect(screen.getByText("Added dark mode")).toBeInTheDocument();
    expect(screen.getByText("Bug fixes")).toBeInTheDocument();
  });

  it("sorts versions descending (latest first)", () => {
    const { container } = render(<VersionHistory versions={versions} />);
    // Non-latest versions render a vN label span with text-xs font-black uppercase classes
    // The latest (v3) renders a Check icon instead, so v2 appears first in vN labels
    const vLabels = container.querySelectorAll("span.text-xs.font-black.uppercase");
    // With versions [1,3,2] sorted desc=[3,2,1], v3 is latest (no vN label), so first label is v2
    expect(vLabels[0].textContent).toBe("v2");
  });

  it("shows Active badge for latest version", () => {
    render(<VersionHistory versions={versions} />);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("does not show Active badge for older versions", () => {
    render(<VersionHistory versions={versions} />);
    // Only one "Active" badge should exist
    expect(screen.getAllByText("Active")).toHaveLength(1);
  });

  it("shows author when provided", () => {
    render(<VersionHistory versions={versions} />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("does not crash when author is missing", () => {
    render(
      <VersionHistory
        versions={[
          { version: 1, changeDescription: "No author", timestamp: "2025-01-01T00:00:00Z" },
        ]}
      />,
    );
    expect(screen.getByText("No author")).toBeInTheDocument();
  });

  it("renders formatted timestamp", () => {
    render(
      <VersionHistory
        versions={[{ version: 1, changeDescription: "Release", timestamp: "2025-06-15T10:30:00Z" }]}
      />,
    );
    // Component uses toLocaleString with dateStyle/timeStyle options
    const dateText = new Date("2025-06-15T10:30:00Z").toLocaleString([], {
      dateStyle: "medium",
      timeStyle: "short",
    });
    expect(screen.getByText(dateText)).toBeInTheDocument();
  });
});
