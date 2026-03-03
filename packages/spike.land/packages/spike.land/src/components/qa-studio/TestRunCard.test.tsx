/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { TestRunCard } from "./TestRunCard";

afterEach(cleanup);

describe("TestRunCard", () => {
  const baseProps = {
    runId: "run-1",
    suiteName: "Auth Tests",
    passed: 42,
    failed: 3,
    skipped: 1,
    durationMs: 4200,
    timestamp: "2026-02-26T10:00:00Z",
    status: "failed" as const,
  };

  it("renders the suite name", () => {
    render(<TestRunCard {...baseProps} />);
    expect(screen.getByText("Auth Tests")).toBeDefined();
  });

  it("renders passed count", () => {
    render(<TestRunCard {...baseProps} />);
    expect(screen.getByText("42")).toBeDefined();
  });

  it("renders failed count", () => {
    render(<TestRunCard {...baseProps} />);
    expect(screen.getByText("3")).toBeDefined();
  });
});
