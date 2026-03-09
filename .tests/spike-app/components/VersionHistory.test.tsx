import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { type AppVersion, VersionHistory } from "@/ui/components/VersionHistory";

describe("VersionHistory", () => {
  it("renders empty state when no versions", () => {
    render(<VersionHistory versions={[]} />);
    expect(screen.getByText("No versions recorded")).toBeInTheDocument();
  });

  it("renders versions sorted descending", () => {
    const versions: AppVersion[] = [
      {
        version: 1,
        changeDescription: "Initial",
        timestamp: "2025-01-01T00:00:00Z",
      },
      {
        version: 3,
        changeDescription: "Third",
        timestamp: "2025-03-01T00:00:00Z",
      },
      {
        version: 2,
        changeDescription: "Second",
        timestamp: "2025-02-01T00:00:00Z",
      },
    ];

    const { container } = render(<VersionHistory versions={versions} />);
    // Non-latest versions render a "v{n}" badge; latest renders a Check icon.
    // With versions [1,2,3], v3 is latest (shows Check), v2 and v1 show text badges.
    const badges = container.querySelectorAll("span.text-xs.font-black.uppercase");
    const labels = Array.from(badges).map((b) => b.textContent);

    // Sorted descending: v2 then v1 (v3 is latest, shown as Active with Check icon)
    expect(labels).toEqual(["v2", "v1"]);
  });

  it("marks the latest version as Active", () => {
    const versions: AppVersion[] = [
      {
        version: 1,
        changeDescription: "Old",
        timestamp: "2025-01-01T00:00:00Z",
      },
      {
        version: 2,
        changeDescription: "New",
        timestamp: "2025-02-01T00:00:00Z",
      },
    ];

    render(<VersionHistory versions={versions} />);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("displays change description", () => {
    const versions: AppVersion[] = [
      {
        version: 1,
        changeDescription: "Added auth flow",
        timestamp: "2025-01-01T00:00:00Z",
      },
    ];

    render(<VersionHistory versions={versions} />);
    expect(screen.getByText("Added auth flow")).toBeInTheDocument();
  });

  it("displays author when provided", () => {
    const versions: AppVersion[] = [
      {
        version: 1,
        changeDescription: "Fix",
        author: "alice",
        timestamp: "2025-01-01T00:00:00Z",
      },
    ];

    render(<VersionHistory versions={versions} />);
    expect(screen.getByText("alice")).toBeInTheDocument();
  });

  it("does not show author when not provided", () => {
    const versions: AppVersion[] = [
      {
        version: 1,
        changeDescription: "Fix",
        timestamp: "2025-01-01T00:00:00Z",
      },
    ];

    render(<VersionHistory versions={versions} />);
    expect(screen.queryByText("alice")).not.toBeInTheDocument();
  });
});
