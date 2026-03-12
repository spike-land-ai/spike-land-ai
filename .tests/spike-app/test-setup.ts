/// <reference types="@testing-library/jest-dom/vitest" />

import { expect, afterEach, beforeEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";
import i18n from "../../src/frontend/platform-frontend/ui/i18n";

expect.extend(matchers);

// Mock scrollTo on Element prototype
if (typeof window !== "undefined") {
  window.Element.prototype.scrollTo = vi.fn();
}

function ensureLocalStorage(): void {
  if (typeof window === "undefined") return;
  const candidate = window.localStorage as Storage | undefined;
  if (
    candidate &&
    typeof candidate.getItem === "function" &&
    typeof candidate.setItem === "function" &&
    typeof candidate.removeItem === "function" &&
    typeof candidate.clear === "function"
  ) {
    return;
  }

  const store = new Map<string, string>();
  const shim: Storage = {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      return [...store.keys()][index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
  };

  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: shim,
  });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: shim,
  });
}

beforeEach(async () => {
  ensureLocalStorage();
  localStorage.setItem("spike-lang", "en");
  await i18n.changeLanguage("en");
});

afterEach(() => {
  cleanup();
});
