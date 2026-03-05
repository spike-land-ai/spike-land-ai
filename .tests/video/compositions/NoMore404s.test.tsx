import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NoMore404s } from "../../../src/video/compositions/no-more-404s/NoMore404s";

describe("NoMore404s Composition Smoke Test", () => {
  it("renders without crashing", () => {
    const { container } = render(<NoMore404s />);
    expect(container).toBeTruthy();
  });
});
