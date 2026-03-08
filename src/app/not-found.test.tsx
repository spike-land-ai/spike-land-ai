import { render } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import NotFound from "./not-found";

describe("NotFound component", () => {
  let originalPathname: string;

  beforeEach(() => {
    // Save original pathname
    originalPathname = window.location.pathname;

    // Mock window.location.pathname
    Object.defineProperty(window, "location", {
      value: {
        pathname: "/non-existent-route",
      },
      writable: true,
    });

    // Mock fetch
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
  });

  afterEach(() => {
    // Restore window.location
    Object.defineProperty(window, "location", {
      value: {
        pathname: originalPathname,
      },
      writable: true,
    });

    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders 404 message and reports missing route to error DB", () => {
    render(<NotFound />);

    // Assert fetch was called with correct parameters
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith("/errors/ingest", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        {
          service_name: "next-app",
          error_code: "404",
          message: "Missing route",
          metadata: { path: "/non-existent-route" },
          severity: "warning",
        },
      ]),
    });
  });
});
