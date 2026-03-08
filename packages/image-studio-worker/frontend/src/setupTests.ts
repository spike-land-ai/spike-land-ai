import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock resize observer
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock intersection observer
global.IntersectionObserver = class IntersectionObserver {
  constructor(callback) {}
  observe() {}
  unobserve() {}
  disconnect() {}
};
// Add fetch mock to prevent network requests during tests
global.fetch = vi.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve([]),
    ok: true,
  } as any)
);

// Mock hooks that cause issues with undefined data
vi.mock("@/hooks/useGallery", () => ({
  useGallery: vi.fn(() => ({
    images: [],
    loading: false,
    error: null,
    refetch: vi.fn(),
  })),
}));
