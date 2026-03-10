import "@testing-library/jest-dom";
import i18n from "../../src/frontend/platform-frontend/ui/i18n";

// Mock window.matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();
Object.defineProperty(window, "localStorage", { value: localStorageMock });

// Mock document.cookie setter
Object.defineProperty(document, "cookie", {
  writable: true,
  value: "",
});

// Mock fetch
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  status: 200,
  json: async () => ({}),
});

// Mock navigator.sendBeacon
Object.defineProperty(navigator, "sendBeacon", {
  writable: true,
  value: vi.fn().mockReturnValue(true),
});

beforeEach(async () => {
  localStorage.setItem("spike-lang", "en");
  await i18n.changeLanguage("en");
});
