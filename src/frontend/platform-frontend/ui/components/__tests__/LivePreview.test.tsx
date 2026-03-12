import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LivePreview } from "../LivePreview";

// Mock Button component
vi.mock("../../shared/ui/button", () => ({
  Button: ({
    children,
    onClick,
    "aria-label": ariaLabel,
    asChild,
    ...rest
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    "aria-label"?: string;
    asChild?: boolean;
    [key: string]: unknown;
  }) => {
    if (asChild && React.isValidElement(children)) {
      return children;
    }
    return (
      <button onClick={onClick} aria-label={ariaLabel} {...rest}>
        {children}
      </button>
    );
  },
}));

// Need React in scope for isValidElement
import React from "react";

// Mock cn utility
vi.mock("../../../styling/cn", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  RefreshCw: ({ className }: { className?: string }) => (
    <svg data-testid="icon-refresh" className={className} />
  ),
  Maximize: () => <svg data-testid="icon-maximize" />,
  Minimize: () => <svg data-testid="icon-minimize" />,
  ExternalLink: () => <svg data-testid="icon-external-link" />,
  AlertCircle: () => <svg data-testid="icon-alert" />,
}));

describe("LivePreview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without crashing", () => {
    render(<LivePreview appId="my-app" />);
    expect(screen.getByTitle("Preview — my-app")).toBeInTheDocument();
  });

  it("renders the iframe with correct src based on appId", () => {
    render(<LivePreview appId="demo-app" />);
    const iframe = screen.getByTitle("Preview — demo-app");
    expect(iframe).toHaveAttribute("src", "https://edge.spike.land/live/demo-app/index.html");
  });

  it("uses custom edgeUrl when provided", () => {
    render(<LivePreview appId="demo-app" edgeUrl="https://custom.edge.dev" />);
    const iframe = screen.getByTitle("Preview — demo-app");
    expect(iframe).toHaveAttribute("src", "https://custom.edge.dev/live/demo-app/index.html");
  });

  it("shows loading skeleton while iframe is loading", () => {
    render(<LivePreview appId="my-app" />);
    expect(screen.getByLabelText("Loading preview")).toBeInTheDocument();
    expect(screen.getByLabelText("Loading preview")).toHaveAttribute("aria-busy", "true");
  });

  it("hides loading skeleton after iframe loads", () => {
    render(<LivePreview appId="my-app" />);
    const iframe = screen.getByTitle("Preview — my-app");
    fireEvent.load(iframe);
    expect(screen.queryByLabelText("Loading preview")).not.toBeInTheDocument();
  });

  it("renders the URL bar showing the src URL", () => {
    render(<LivePreview appId="test-app" />);
    const src = "https://edge.spike.land/live/test-app/index.html";
    expect(screen.getByTitle(src)).toBeInTheDocument();
  });

  it("renders the Refresh preview button", () => {
    render(<LivePreview appId="my-app" />);
    expect(screen.getByRole("button", { name: "Refresh preview" })).toBeInTheDocument();
  });

  it("renders the Open in new tab link", () => {
    render(<LivePreview appId="my-app" />);
    expect(screen.getByRole("link", { name: "Open preview in new tab" })).toBeInTheDocument();
  });

  it("open in new tab link has correct href", () => {
    render(<LivePreview appId="my-app" />);
    const link = screen.getByRole("link", { name: "Open preview in new tab" });
    expect(link).toHaveAttribute("href", "https://edge.spike.land/live/my-app/index.html");
  });

  it("open in new tab link opens in new tab", () => {
    render(<LivePreview appId="my-app" />);
    const link = screen.getByRole("link", { name: "Open preview in new tab" });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders the Enter fullscreen button initially", () => {
    render(<LivePreview appId="my-app" />);
    expect(screen.getByRole("button", { name: "Enter fullscreen" })).toBeInTheDocument();
  });

  it("toggles to Exit fullscreen after clicking Enter fullscreen", () => {
    render(<LivePreview appId="my-app" />);
    fireEvent.click(screen.getByRole("button", { name: "Enter fullscreen" }));
    expect(screen.getByRole("button", { name: "Exit fullscreen" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enter fullscreen" })).not.toBeInTheDocument();
  });

  it("Escape key exits fullscreen mode", () => {
    render(<LivePreview appId="my-app" />);
    fireEvent.click(screen.getByRole("button", { name: "Enter fullscreen" }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByRole("button", { name: "Enter fullscreen" })).toBeInTheDocument();
  });

  it("Escape key does nothing when not in fullscreen", () => {
    render(<LivePreview appId="my-app" />);
    // Should not throw; still shows Enter fullscreen
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByRole("button", { name: "Enter fullscreen" })).toBeInTheDocument();
  });

  it("refresh button re-mounts iframe (key change) and shows skeleton again", () => {
    render(<LivePreview appId="my-app" />);
    const iframe = screen.getByTitle("Preview — my-app");
    fireEvent.load(iframe);
    expect(screen.queryByLabelText("Loading preview")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Refresh preview" }));
    expect(screen.getByLabelText("Loading preview")).toBeInTheDocument();
  });

  it("shows error overlay when iframe fires onError", () => {
    render(<LivePreview appId="my-app" />);
    const iframe = screen.getByTitle("Preview — my-app");
    fireEvent.error(iframe);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Preview Failed to Load")).toBeInTheDocument();
  });

  it("error overlay has a Try Again button", () => {
    render(<LivePreview appId="my-app" />);
    fireEvent.error(screen.getByTitle("Preview — my-app"));
    expect(screen.getByRole("button", { name: /Try Again/ })).toBeInTheDocument();
  });

  it("Try Again button clears error and reloads", () => {
    render(<LivePreview appId="my-app" />);
    fireEvent.error(screen.getByTitle("Preview — my-app"));
    expect(screen.getByRole("alert")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Try Again/ }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Loading preview")).toBeInTheDocument();
  });

  it("iframe has sandbox attribute for security", () => {
    render(<LivePreview appId="my-app" />);
    const iframe = screen.getByTitle("Preview — my-app");
    expect(iframe).toHaveAttribute(
      "sandbox",
      "allow-scripts allow-same-origin allow-forms allow-popups",
    );
  });

  it("renders correctly with isDarkMode=true (does not crash)", () => {
    render(<LivePreview appId="dark-app" isDarkMode />);
    expect(screen.getByTitle("Preview — dark-app")).toBeInTheDocument();
  });

  it("renders maximize icon when not in fullscreen", () => {
    render(<LivePreview appId="my-app" />);
    expect(screen.getByTestId("icon-maximize")).toBeInTheDocument();
  });

  it("renders minimize icon when in fullscreen", () => {
    render(<LivePreview appId="my-app" />);
    fireEvent.click(screen.getByRole("button", { name: "Enter fullscreen" }));
    expect(screen.getByTestId("icon-minimize")).toBeInTheDocument();
  });
});
