import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PagesTemplateChooserApp } from "../../../src/frontend/platform-frontend/ui/apps/pages-template-chooser";

describe("PagesTemplateChooserApp", () => {
  it("shows the premium banner on the all templates view", () => {
    render(<PagesTemplateChooserApp />);

    expect(screen.getByText("Included with Apple Creator Studio")).toBeInTheDocument();
    expect(screen.getByText("Elevate Your Documents")).toBeInTheDocument();
  });

  it(
    "filters down to premium templates",
    () => {
      render(<PagesTemplateChooserApp />);

      fireEvent.click(screen.getByRole("button", { name: "Premium" }));

      expect(screen.getByText("Culinary Plain Proposal")).toBeInTheDocument();
      expect(screen.queryByText("Blank Layout")).not.toBeInTheDocument();
    },
    60_000,
  );

  it(
    "enables create once a template is selected",
    () => {
      render(<PagesTemplateChooserApp />);

      const createButton = screen.getByRole("button", { name: "Create" });
      expect(createButton).toBeDisabled();

      fireEvent.click(screen.getByRole("button", { name: /Blank Black/i }));

      expect(createButton).toBeEnabled();
      expect(screen.getByText("Selected: Blank Black")).toBeInTheDocument();
    },
    60_000,
  );
});
