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

beforeEach(async () => {
  localStorage.setItem("spike-lang", "en");
  await i18n.changeLanguage("en");
});

afterEach(() => {
  cleanup();
});
