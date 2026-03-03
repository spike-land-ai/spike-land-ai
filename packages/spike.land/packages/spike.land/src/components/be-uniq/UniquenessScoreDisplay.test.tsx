/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { UniquenessScoreDisplay } from "./UniquenessScoreDisplay";

afterEach(cleanup);

describe("UniquenessScoreDisplay", () => {
  it("renders score as '1 in X people' format", () => {
    render(
      <UniquenessScoreDisplay
        score={1000}
        category="Creative"
        description="Highly creative thinker"
      />,
    );
    expect(screen.getByText(/1 in 1,000/)).toBeDefined();
  });

  it("renders category", () => {
    render(
      <UniquenessScoreDisplay score={500} category="Analytical" description="Analytical mind" />,
    );
    expect(screen.getByText("Analytical")).toBeDefined();
  });

  it("renders description", () => {
    render(
      <UniquenessScoreDisplay score={250} category="Creative" description="Unique perspective" />,
    );
    expect(screen.getByText("Unique perspective")).toBeDefined();
  });
});
