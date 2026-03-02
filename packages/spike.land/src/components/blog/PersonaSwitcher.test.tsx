import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

// Mock cookie helpers
const mockGetCookie = vi.hoisted(() => vi.fn<() => string | null>());
const mockSetCookie = vi.hoisted(() => vi.fn());
vi.mock("@/lib/onboarding/get-persona-cookie", () => ({
  getPersonaCookieClient: mockGetCookie,
  setPersonaCookieClient: mockSetCookie,
}));

import { PERSONAS } from "@/lib/onboarding/personas";
import { PersonaSwitcher } from "./PersonaSwitcher";

describe("PersonaSwitcher", () => {
  beforeEach(() => {
    mockGetCookie.mockReturnValue(null);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders all 16 personas as options", () => {
    render(<PersonaSwitcher />);

    const select = screen.getByRole("combobox");
    expect(select).toBeDefined();

    // 16 persona options + 1 disabled placeholder
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(PERSONAS.length + 1);

    for (const persona of PERSONAS) {
      expect(screen.getByText(new RegExp(persona.name))).toBeDefined();
    }
  });

  it("shows the current persona badge when a cookie is set", () => {
    mockGetCookie.mockReturnValue("ai-indie");
    render(<PersonaSwitcher />);
    expect(screen.getByText("AI Indie")).toBeDefined();
  });

  it("does not show a badge when no cookie is set", () => {
    mockGetCookie.mockReturnValue(null);
    render(<PersonaSwitcher />);
    expect(screen.queryByText("AI Indie")).toBeNull();
  });
});
