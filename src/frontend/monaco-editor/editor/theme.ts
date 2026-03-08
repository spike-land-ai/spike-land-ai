import { editor } from "monaco-editor";
import {
  createSpikeLandMonacoTheme,
  getSpikeLandThemeSignature,
  SPIKE_LAND_MONACO_THEME,
} from "./theme-palette";

export { createSpikeLandMonacoTheme, SPIKE_LAND_MONACO_THEME } from "./theme-palette";

let activeThemeSignature = "";
let themeObserverBound = false;

function scheduleThemeSync(): void {
  if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(() => applySpikeLandMonacoTheme());
    return;
  }

  setTimeout(() => applySpikeLandMonacoTheme(), 0);
}

function applySpikeLandMonacoTheme(): void {
  if (typeof document === "undefined") {
    return;
  }

  const styles = getComputedStyle(document.documentElement);
  const signature = getSpikeLandThemeSignature(styles);

  if (signature !== activeThemeSignature) {
    editor.defineTheme(SPIKE_LAND_MONACO_THEME, createSpikeLandMonacoTheme(styles));
    activeThemeSignature = signature;
  }

  editor.setTheme(SPIKE_LAND_MONACO_THEME);
}

export function ensureSpikeLandMonacoTheme(): string {
  if (typeof document === "undefined") {
    return SPIKE_LAND_MONACO_THEME;
  }

  applySpikeLandMonacoTheme();

  if (themeObserverBound) {
    return SPIKE_LAND_MONACO_THEME;
  }

  themeObserverBound = true;

  const observer = new MutationObserver(() => scheduleThemeSync());
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "style"],
  });

  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    const colorScheme = window.matchMedia("(prefers-color-scheme: dark)");
    colorScheme.addEventListener("change", scheduleThemeSync);
  }

  return SPIKE_LAND_MONACO_THEME;
}
