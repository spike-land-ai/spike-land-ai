import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { VersionHistory, type AppVersion } from "./VersionHistory";

describe("VersionHistory", () => {
  it("renders empty state when no versions", () => {
    render(<VersionHistory versions={[]} />);
    expect(screen.getByText("No versions yet.")).toBeInTheDocument();
  });

  it("renders versions sorted descending", () => {
    const versions: AppVersion[] = [
      { version: 1, changeDescription: "Initial", timestamp: "2025-01-01T00:00:00Z" },
      { version: 3, changeDescription: "Third", timestamp: "2025-03-01T00:00:00Z" },
      { version: 2, changeDescription: "Second", timestamp: "2025-02-01T00:00:00Z" },
    ];

    const { container } = render(<VersionHistory versions={versions} />);
    const badges = container.querySelectorAll("span.flex.h-8.w-8");
    const labels = Array.from(badges).map((b) => b.textContent);

    expect(labels).toEqual(["v3", "v2", "v1"]);
  });

  it("marks the latest version as Current", () => {
    const versions: AppVersion[] = [
      { version: 1, changeDescription: "Old", timestamp: "2025-01-01T00:00:00Z" },
      { version: 2, changeDescription: "New", timestamp: "2025-02-01T00:00:00Z" },
    ];

    render(<VersionHistory versions={versions} />);
    expect(screen.getByText("Current")).toBeInTheDocument();
  });

  it("displays change description", () => {
    const versions: AppVersion[] = [
      { version: 1, changeDescription: "Added auth flow", timestamp: "2025-01-01T00:00:00Z" },
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
      { version: 1, changeDescription: "Fix", timestamp: "2025-01-01T00:00:00Z" },
    ];

    render(<VersionHistory versions={versions} />);
    expect(screen.queryByText("alice")).not.toBeInTheDocument();
  });
});
