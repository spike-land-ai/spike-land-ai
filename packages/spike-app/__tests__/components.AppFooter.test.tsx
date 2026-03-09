import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppFooter } from "@/components/AppFooter";

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Link: ({
      to,
      children,
      className,
    }: {
      to: string;
      children: React.ReactNode;
      className?: string;
    }) => (
      <a href={to} className={className}>
        {children}
      </a>
    ),
  };
});

describe("AppFooter", () => {
  it("renders the spike.land brand name", () => {
    render(<AppFooter />);
    expect(screen.getByText("spike.land")).toBeInTheDocument();
  });

  it("renders current year in copyright notice", () => {
    render(<AppFooter />);
    const currentYear = new Date().getFullYear();
    expect(screen.getByText(new RegExp(String(currentYear)))).toBeInTheDocument();
  });

  it("renders platform navigation links", () => {
    render(<AppFooter />);
    expect(screen.getByText("Packages")).toBeInTheDocument();
    expect(screen.getByText("Pricing")).toBeInTheDocument();
    expect(screen.getByText("App Store")).toBeInTheDocument();
  });

  it("renders resources links", () => {
    render(<AppFooter />);
    expect(screen.getByText("Documentation")).toBeInTheDocument();
    expect(screen.getByText("Blog")).toBeInTheDocument();
    expect(screen.getByText("About")).toBeInTheDocument();
  });

  it("renders legal links", () => {
    render(<AppFooter />);
    expect(screen.getByText("Privacy Policy")).toBeInTheDocument();
    expect(screen.getByText("Terms of Service")).toBeInTheDocument();
  });

  it("renders social links with proper rel attributes", () => {
    render(<AppFooter />);
    const githubLink = screen.getByLabelText("Visit our GitHub").closest("a");
    expect(githubLink).toHaveAttribute("rel", "noopener noreferrer");
    expect(githubLink).toHaveAttribute("target", "_blank");

    const twitterLink = screen.getByLabelText("Follow us on Twitter").closest("a");
    expect(twitterLink).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("shows system status indicator", () => {
    render(<AppFooter />);
    expect(screen.getByRole("status")).toHaveTextContent("Status healthy");
  });

  it("renders section headings", () => {
    render(<AppFooter />);
    expect(screen.getByText("Product")).toBeInTheDocument();
    expect(screen.getByText("Resources")).toBeInTheDocument();
    expect(screen.getByText("Trust")).toBeInTheDocument();
  });
});
