/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { ContentStatusBadge } from "./ContentStatusBadge";

afterEach(cleanup);

describe("ContentStatusBadge", () => {
  it("renders draft status", () => {
    render(<ContentStatusBadge status="draft" />);
    expect(screen.getByText("draft")).toBeDefined();
  });

  it("renders published status", () => {
    render(<ContentStatusBadge status="published" />);
    expect(screen.getByText("published")).toBeDefined();
  });

  it("renders scheduled status", () => {
    render(<ContentStatusBadge status="scheduled" />);
    expect(screen.getByText("scheduled")).toBeDefined();
  });

  it("renders archived status", () => {
    render(<ContentStatusBadge status="archived" />);
    expect(screen.getByText("archived")).toBeDefined();
  });
});
