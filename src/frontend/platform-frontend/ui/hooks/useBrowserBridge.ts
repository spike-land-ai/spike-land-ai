import { useEffect, useCallback, useRef } from "react";
import type { AnyRouter } from "@tanstack/react-router";
import type { ConversationItem } from "./useChat";

interface BrowserBridgeOptions {
  items: ConversationItem[];
  onResult?: (toolCallId: string, result: unknown) => void;
  router?: AnyRouter;
}

interface SurfaceEntry {
  targetId: string;
  selectorHint: string;
  element: Element;
}

interface BrowserSurfaceElement {
  targetId: string;
  role: string;
  label: string;
  selectorHint: string;
  tag: string;
  type?: string | undefined;
  href?: string | undefined;
  disabled?: boolean | undefined;
  valuePreview?: string | undefined;
}

interface BrowserSurface {
  surfaceId: string;
  url: string;
  title: string;
  generatedAt: number;
  textPreview: string;
  elements: BrowserSurfaceElement[];
}

const SPIKE_APP_SECTIONS = [
  "tools",
  "store",
  "apps",
  "analytics",
  "messages",
  "settings",
  "bugbook",
  "pricing",
  "docs",
  "blog",
];

const INTERACTIVE_SELECTOR =
  "button, a, input, select, textarea, [role='button'], [role='link'], [data-testid]";

/**
 * Trims and truncates a string to `maxLength`, appending `"..."` when cut.
 * Returns an empty string for nullish / whitespace-only input.
 */
function normalizeText(value: string | null | undefined, maxLength: number) {
  const normalized = (value ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

/**
 * Returns the most specific CSS selector hint that identifies `element`
 * (prefers `data-testid`, then `id`, then `name`, then `aria-label`, then `href`).
 */
function getSelectorHint(element: Element) {
  if (element instanceof HTMLElement && element.dataset.testid) {
    return `[data-testid="${element.dataset.testid}"]`;
  }

  if (element instanceof HTMLElement && element.id) {
    return `#${element.id}`;
  }

  const name = element.getAttribute("name");
  if (name) {
    return `${element.tagName.toLowerCase()}[name="${name}"]`;
  }

  const ariaLabel = element.getAttribute("aria-label");
  if (ariaLabel) {
    return `${element.tagName.toLowerCase()}[aria-label="${ariaLabel}"]`;
  }

  if (element instanceof HTMLAnchorElement && element.href) {
    return `a[href="${element.getAttribute("href") ?? element.href}"]`;
  }

  return element.tagName.toLowerCase();
}

/**
 * Resolves the ARIA / implicit role for `element`.
 */
function getElementRole(element: Element) {
  const explicitRole = element.getAttribute("role");
  if (explicitRole) {
    return explicitRole;
  }

  if (element instanceof HTMLAnchorElement) {
    return "link";
  }
  if (element instanceof HTMLButtonElement) {
    return "button";
  }
  if (element instanceof HTMLInputElement) {
    return element.type || "input";
  }
  if (element instanceof HTMLSelectElement) {
    return "select";
  }
  if (element instanceof HTMLTextAreaElement) {
    return "textarea";
  }

  return element.tagName.toLowerCase();
}

/**
 * Derives a human-readable label for `element` (prefers `aria-label`, `title`,
 * associated `<label>`, `placeholder`, `name`, `value`, then `textContent`).
 */
function getElementLabel(element: Element) {
  const ariaLabel = element.getAttribute("aria-label");
  if (ariaLabel) {
    return normalizeText(ariaLabel, 80);
  }

  const title = element.getAttribute("title");
  if (title) {
    return normalizeText(title, 80);
  }

  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    return normalizeText(
      element.labels?.[0]?.textContent ??
        element.placeholder ??
        element.name ??
        element.value ??
        "",
      80,
    );
  }

  return normalizeText(element.textContent, 80);
}

/**
 * Waits two animation frames so that any pending DOM mutations and React
 * re-renders triggered by a prior command have settled before capturing state.
 */
async function waitForBrowserSettle() {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

/**
 * Listens for pending `browser`-transport tool calls in `items` and executes
 * them against the live DOM. Results are reported back via `onResult`.
 *
 * Supported tools:
 * - `browser_get_surface` — snapshot of interactive elements.
 * - `browser_navigate` — router-aware navigation (internal) or `window.open` (external).
 * - `browser_click` — click a resolved element.
 * - `browser_fill` — set an input / textarea value via React-compatible events.
 * - `browser_screenshot` — viewport metadata (no actual image capture in browser context).
 * - `browser_read_text` — extract text content from a target or the full document body.
 * - `browser_scroll` — scroll an element into view or to an absolute Y position.
 * - `browser_get_elements` — alias for `browser_get_surface` returning the elements array.
 *
 * @param items - The full conversation item list from `useChat`.
 * @param onResult - Callback invoked with `(toolCallId, result)` after execution.
 * @param router - Optional TanStack Router instance for client-side navigation.
 */
export function useBrowserBridge({ items, onResult, router }: BrowserBridgeOptions) {
  const processedRef = useRef<Set<string>>(new Set());
  const surfaceMapRef = useRef<Map<string, SurfaceEntry[]>>(new Map());

  const buildSurface = useCallback((): BrowserSurface => {
    const surfaceId = `surface-${Date.now()}-${crypto.randomUUID()}`;
    const entries: SurfaceEntry[] = [];

    const elements = Array.from(document.querySelectorAll(INTERACTIVE_SELECTOR))
      .filter((element) => {
        if (!(element instanceof HTMLElement)) {
          return false;
        }
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      })
      .slice(0, 40)
      .map((element, index) => {
        const targetId = `t${index + 1}`;
        const selectorHint = getSelectorHint(element);
        entries.push({
          targetId,
          selectorHint,
          element,
        });

        return {
          targetId,
          role: getElementRole(element),
          label: getElementLabel(element),
          selectorHint,
          tag: element.tagName.toLowerCase(),
          ...(element instanceof HTMLInputElement || element instanceof HTMLButtonElement
            ? { type: element.type || undefined }
            : {}),
          ...(element instanceof HTMLAnchorElement
            ? { href: element.getAttribute("href") ?? element.href }
            : {}),
          ...(element instanceof HTMLInputElement || element instanceof HTMLButtonElement
            ? { disabled: element.disabled }
            : {}),
          ...(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement
            ? { valuePreview: normalizeText(element.value, 60) || undefined }
            : {}),
        } satisfies BrowserSurfaceElement;
      });

    surfaceMapRef.current.set(surfaceId, entries);

    return {
      surfaceId,
      url: window.location.href,
      title: document.title,
      generatedAt: Date.now(),
      textPreview: normalizeText(document.body?.innerText, 600),
      elements,
    };
  }, []);

  const resolveElement = useCallback((args: Record<string, unknown>) => {
    const surfaceId = typeof args["surfaceId"] === "string" ? args["surfaceId"] : "";
    const targetId = typeof args["targetId"] === "string" ? args["targetId"] : "";
    const selector = typeof args["selector"] === "string" ? args["selector"] : "";

    if (surfaceId && targetId) {
      const surfaceEntries = surfaceMapRef.current.get(surfaceId) ?? [];
      const matched = surfaceEntries.find((entry) => entry.targetId === targetId);
      if (matched) {
        return matched.element;
      }
    }

    if (selector) {
      return document.querySelector(selector);
    }

    return null;
  }, []);

  const executeBrowserCommand = useCallback(
    async (tool: string, args: Record<string, unknown>): Promise<unknown> => {
      switch (tool) {
        case "browser_get_surface": {
          return {
            success: true,
            surface: buildSurface(),
          };
        }

        case "browser_navigate": {
          const url = typeof args["url"] === "string" ? args["url"] : "";
          if (!url) {
            return { success: false, error: "Navigation URL is required." };
          }

          if (url.startsWith("/")) {
            if (router) {
              await router.navigate({ to: url });
            } else {
              window.location.href = url;
            }
          } else if (SPIKE_APP_SECTIONS.includes(url)) {
            const path = `/${url}`;
            if (router) {
              await router.navigate({ to: path });
            } else {
              window.location.href = path;
            }
          } else {
            window.open(url, "_blank");
          }

          await waitForBrowserSettle();

          return {
            success: true,
            navigated: url,
            surface: buildSurface(),
          };
        }

        case "browser_click": {
          const element = resolveElement(args);
          if (!(element instanceof HTMLElement)) {
            return {
              success: false,
              error: "Click target not found. Refresh the surface and use a valid targetId.",
            };
          }

          element.click();
          await waitForBrowserSettle();

          return {
            success: true,
            clicked:
              (typeof args["targetId"] === "string" && args["targetId"]) ||
              (typeof args["selector"] === "string" ? args["selector"] : getSelectorHint(element)),
            surface: buildSurface(),
          };
        }

        case "browser_fill": {
          const value = typeof args["value"] === "string" ? args["value"] : "";
          const element = resolveElement(args);

          if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
            return {
              success: false,
              error: "Fill target not found or is not an input. Refresh the surface and retry.",
            };
          }

          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype,
            "value",
          )?.set;

          if (element instanceof HTMLInputElement) {
            nativeInputValueSetter?.call(element, value);
          } else {
            element.value = value;
          }

          element.dispatchEvent(new Event("input", { bubbles: true }));
          element.dispatchEvent(new Event("change", { bubbles: true }));
          await waitForBrowserSettle();

          return {
            success: true,
            filled:
              (typeof args["targetId"] === "string" && args["targetId"]) ||
              (typeof args["selector"] === "string" ? args["selector"] : getSelectorHint(element)),
            surface: buildSurface(),
          };
        }

        case "browser_screenshot": {
          return {
            success: true,
            description: `Viewport: ${window.innerWidth}x${window.innerHeight}, Title: ${document.title}, URL: ${window.location.href}`,
            surface: buildSurface(),
          };
        }

        case "browser_read_text": {
          const element = resolveElement(args);
          const target = element ?? document.body;

          if (!target) {
            return { success: false, error: "Read target not found." };
          }

          return {
            success: true,
            text: normalizeText(target.textContent, 2000),
            surface: buildSurface(),
          };
        }

        case "browser_scroll": {
          const element = resolveElement(args);

          if (element instanceof HTMLElement) {
            element.scrollIntoView({ behavior: "smooth", block: "center" });
            await waitForBrowserSettle();

            return {
              success: true,
              scrolledTo:
                (typeof args["targetId"] === "string" && args["targetId"]) ||
                (typeof args["selector"] === "string"
                  ? args["selector"]
                  : getSelectorHint(element)),
              surface: buildSurface(),
            };
          }

          const y = typeof args["y"] === "number" ? args["y"] : Number(args["y"]) || 0;
          window.scrollTo({ top: y, behavior: "smooth" });
          await waitForBrowserSettle();

          return {
            success: true,
            scrolledTo: y,
            surface: buildSurface(),
          };
        }

        case "browser_get_elements": {
          const surface = buildSurface();
          return {
            success: true,
            elements: surface.elements,
            surface,
          };
        }

        default:
          return { success: false, error: `Unknown browser tool: ${tool}` };
      }
    },
    [buildSurface, resolveElement, router],
  );

  useEffect(() => {
    for (const item of items) {
      if (item.kind !== "tool_call" || item.transport !== "browser" || item.status !== "pending") {
        continue;
      }

      if (processedRef.current.has(item.toolCallId)) {
        continue;
      }

      processedRef.current.add(item.toolCallId);

      executeBrowserCommand(item.name, item.args).then((result) => {
        onResult?.(item.toolCallId, result);
      });
    }
  }, [items, executeBrowserCommand, onResult]);
}
