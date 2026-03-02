import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockHasConsent = vi.hoisted(() => vi.fn(() => false));
const mockPathname = vi.hoisted(() => vi.fn(() => "/"));

vi.mock("@/lib/tracking/consent", () => ({
  hasConsent: mockHasConsent,
  CONSENT_CHANGED_EVENT: "consent-changed",
}));

vi.mock("next/navigation", () => ({
  usePathname: mockPathname,
}));

vi.mock("next/script", () => ({
  default: (props: Record<string, unknown>) => (
    <span data-testid={props.id ?? "gtag-script"} data-src={props.src as string} />
  ),
}));

describe("GoogleAnalytics", () => {
  const originalEnv = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  beforeEach(() => {
    vi.resetAllMocks();
    mockPathname.mockReturnValue("/");
    mockHasConsent.mockReturnValue(false);
    delete process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  });

  afterAll(() => {
    if (originalEnv) {
      process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = originalEnv;
    }
  });

  it("renders null when measurement ID is not set", async () => {
    mockHasConsent.mockReturnValue(true);
    const { GoogleAnalytics } = await import("./GoogleAnalytics");
    const { container } = render(<GoogleAnalytics />);
    expect(container.innerHTML).toBe("");
  });

  it("renders null when consent is not given", async () => {
    mockHasConsent.mockReturnValue(false);
    const { GoogleAnalytics } = await import("./GoogleAnalytics");
    const { container } = render(<GoogleAnalytics nonce="test-nonce" />);
    expect(container.innerHTML).toBe("");
  });

  it("renders GA scripts when consent is given and measurement ID is set", async () => {
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = "G-TEST123";
    mockHasConsent.mockReturnValue(true);

    // Re-import to pick up new env value
    vi.resetModules();
    vi.mock("@/lib/tracking/consent", () => ({
      hasConsent: mockHasConsent,
      CONSENT_CHANGED_EVENT: "consent-changed",
    }));
    vi.mock("next/navigation", () => ({
      usePathname: mockPathname,
    }));
    vi.mock("next/script", () => ({
      default: (props: Record<string, unknown>) => (
        <span data-testid={props.id ?? "gtag-script"} data-src={props.src as string} />
      ),
    }));

    const { GoogleAnalytics } = await import("./GoogleAnalytics");
    const { container } = render(<GoogleAnalytics nonce="test-nonce" />);
    const scripts = container.querySelectorAll("[data-testid]");
    expect(scripts.length).toBe(2);
  });

  it("listens for consent change events", async () => {
    const { GoogleAnalytics } = await import("./GoogleAnalytics");
    const addEventSpy = vi.spyOn(window, "addEventListener");
    render(<GoogleAnalytics />);
    expect(addEventSpy).toHaveBeenCalledWith("consent-changed", expect.any(Function));
    addEventSpy.mockRestore();
  });

  it("cleans up event listener on unmount", async () => {
    const { GoogleAnalytics } = await import("./GoogleAnalytics");
    const removeEventSpy = vi.spyOn(window, "removeEventListener");
    const { unmount } = render(<GoogleAnalytics />);
    unmount();
    expect(removeEventSpy).toHaveBeenCalledWith("consent-changed", expect.any(Function));
    removeEventSpy.mockRestore();
  });
});
