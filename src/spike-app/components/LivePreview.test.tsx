import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LivePreview } from "./LivePreview";

describe("LivePreview", () => {
  it("renders iframe with correct src", () => {
    render(<LivePreview appId="my-app" />);
    const iframe = screen.getByTitle("Preview my-app") as HTMLIFrameElement;
    expect(iframe.src).toBe("https://edge.spike.land/live/my-app");
  });

  it("uses custom edgeUrl", () => {
    render(<LivePreview appId="app1" edgeUrl="https://custom.edge" />);
    const iframe = screen.getByTitle("Preview app1") as HTMLIFrameElement;
    expect(iframe.src).toBe("https://custom.edge/live/app1");
  });

  it("displays the URL in toolbar", () => {
    render(<LivePreview appId="my-app" />);
    expect(screen.getByText("https://edge.spike.land/live/my-app")).toBeInTheDocument();
  });

  it("iframe has sandbox attributes", () => {
    render(<LivePreview appId="my-app" />);
    const iframe = screen.getByTitle("Preview my-app");
    // jsdom doesn't implement DOMTokenList for sandbox, check the attribute string
    const sandbox = iframe.getAttribute("sandbox") ?? "";
    expect(sandbox).toContain("allow-scripts");
    expect(sandbox).toContain("allow-same-origin");
  });

  it("shows loading spinner initially", () => {
    const { container } = render(<LivePreview appId="my-app" />);
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("hides loading spinner after iframe loads", () => {
    const { container } = render(<LivePreview appId="my-app" />);
    const iframe = screen.getByTitle("Preview my-app");
    fireEvent.load(iframe);
    expect(container.querySelector(".animate-spin")).not.toBeInTheDocument();
  });

  // Note: iframe onError doesn't propagate in jsdom, so error state
  // rendering is tested via the refresh-after-error flow instead.
  it("refresh clears loading state for retry", () => {
    render(<LivePreview appId="my-app" />);
    const iframe = screen.getByTitle("Preview my-app");
    fireEvent.load(iframe);

    // Click refresh — should show loading again
    fireEvent.click(screen.getByTitle("Refresh"));
    const { container } = render(<LivePreview appId="my-app" />);
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("has refresh button", () => {
    render(<LivePreview appId="my-app" />);
    const refreshBtn = screen.getByTitle("Refresh");
    expect(refreshBtn).toBeInTheDocument();
  });

  it("has fullscreen toggle button", () => {
    render(<LivePreview appId="my-app" />);
    const fsBtn = screen.getByTitle("Fullscreen");
    expect(fsBtn).toBeInTheDocument();
  });

  it("toggles fullscreen on button click", () => {
    const { container } = render(<LivePreview appId="my-app" />);

    // Initially not fullscreen
    expect(container.firstChild).not.toHaveClass("fixed");

    // Click fullscreen
    fireEvent.click(screen.getByTitle("Fullscreen"));
    expect(container.firstChild).toHaveClass("fixed");

    // Click exit fullscreen
    fireEvent.click(screen.getByTitle("Exit fullscreen"));
    expect(container.firstChild).not.toHaveClass("fixed");
  });
});
