import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock cookie helper
const mockGetCookie = vi.hoisted(() => vi.fn<() => string | null>());
vi.mock("@/lib/onboarding/get-persona-cookie", () => ({
  getPersonaCookieClient: mockGetCookie,
  setPersonaCookieClient: vi.fn(),
}));

import { PersonaLandingPreview } from "./PersonaLandingPreview";

describe("PersonaLandingPreview", () => {
  beforeEach(() => {
    mockGetCookie.mockReturnValue(null);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows onboarding CTA when no persona cookie is set", () => {
    mockGetCookie.mockReturnValue(null);
    render(<PersonaLandingPreview />);

    expect(screen.getByText("Personalise your experience")).toBeDefined();
    expect(screen.getByText("Start Onboarding")).toBeDefined();
  });

  it("shows landing page content when persona cookie is set", () => {
    mockGetCookie.mockReturnValue("ai-indie");
    render(<PersonaLandingPreview />);

    expect(screen.getByText("Ship your AI product solo")).toBeDefined();
    expect(screen.getByText("Start Building")).toBeDefined();
  });

  it("shows CTA when cookie has an invalid slug", () => {
    mockGetCookie.mockReturnValue("nonexistent-persona");
    render(<PersonaLandingPreview />);

    expect(screen.getByText("Personalise your experience")).toBeDefined();
  });
});
