/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { ComplexityBadge } from "./ComplexityBadge";

afterEach(cleanup);

describe("ComplexityBadge", () => {
  it("renders low complexity", () => {
    render(<ComplexityBadge level="low" />);
    expect(screen.getByText("low")).toBeDefined();
  });

  it("renders medium complexity", () => {
    render(<ComplexityBadge level="medium" />);
    expect(screen.getByText("medium")).toBeDefined();
  });

  it("renders high complexity", () => {
    render(<ComplexityBadge level="high" />);
    expect(screen.getByText("high")).toBeDefined();
  });

  it("renders critical complexity", () => {
    render(<ComplexityBadge level="critical" />);
    expect(screen.getByText("critical")).toBeDefined();
  });
});
