/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { BrandScoreGauge } from "./BrandScoreGauge";

afterEach(cleanup);

describe("BrandScoreGauge", () => {
  it("renders the score", () => {
    render(<BrandScoreGauge score={85} />);
    expect(screen.getByText("85")).toBeDefined();
  });

  it("renders a label when provided", () => {
    render(<BrandScoreGauge score={50} label="Brand Voice" />);
    expect(screen.getByText("Brand Voice")).toBeDefined();
  });

  it("renders low score", () => {
    render(<BrandScoreGauge score={25} />);
    expect(screen.getByText("25")).toBeDefined();
  });
});
