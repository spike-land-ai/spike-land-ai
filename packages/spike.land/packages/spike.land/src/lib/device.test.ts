import { describe, expect, it, vi } from "vitest";

import { detectSlowDevice } from "./device";

describe("detectSlowDevice", () => {
  it("returns false when navigator is undefined (server)", () => {
    vi.stubGlobal("navigator", undefined);
    expect(detectSlowDevice()).toBe(false);
  });

  it("returns false for fast device (8 cores, 8GB)", () => {
    vi.stubGlobal("navigator", {
      hardwareConcurrency: 8,
      deviceMemory: 8,
    });
    expect(detectSlowDevice()).toBe(false);
  });

  it("returns true for low CPU cores (2 cores, 8GB)", () => {
    vi.stubGlobal("navigator", {
      hardwareConcurrency: 2,
      deviceMemory: 8,
    });
    expect(detectSlowDevice()).toBe(true);
  });

  it("returns true for low memory (8 cores, 2GB)", () => {
    vi.stubGlobal("navigator", {
      hardwareConcurrency: 8,
      deviceMemory: 2,
    });
    expect(detectSlowDevice()).toBe(true);
  });

  it("returns false at threshold boundary (4 cores, 4GB)", () => {
    vi.stubGlobal("navigator", {
      hardwareConcurrency: 4,
      deviceMemory: 4,
    });
    expect(detectSlowDevice()).toBe(false);
  });

  it("defaults to 4 when hardwareConcurrency is 0", () => {
    vi.stubGlobal("navigator", {
      hardwareConcurrency: 0,
      deviceMemory: 8,
    });
    // 0 is falsy, so fallback to 4, which is NOT < 4 => false
    expect(detectSlowDevice()).toBe(false);
  });

  it("defaults to 4 when deviceMemory is not available", () => {
    vi.stubGlobal("navigator", {
      hardwareConcurrency: 8,
      // deviceMemory not set => undefined => nullish coalescing => 4
    });
    expect(detectSlowDevice()).toBe(false);
  });
});
