import { useEffect, useCallback, useRef } from "react";
import type { ChatMessage } from "./useChat";

interface BrowserBridgeOptions {
  messages: ChatMessage[];
  onResult?: (requestId: string, result: unknown) => void;
}

export function useBrowserBridge({ messages, onResult }: BrowserBridgeOptions) {
  const processedRef = useRef<Set<string>>(new Set());

  const executeBrowserCommand = useCallback(
    async (tool: string, args: Record<string, unknown>): Promise<unknown> => {
      switch (tool) {
        case "browser_navigate": {
          const url = args.url as string;
          // Check if it's a section name
          const sections = ["terminal", "generate", "library", "albums", "pipelines", "credits", "settings"];
          if (sections.includes(url)) {
            // Click the sidebar nav item
            const btn = document.querySelector(`[data-section="${url}"]`) as HTMLElement;
            if (btn) btn.click();
            return { success: true, navigated: url };
          }
          window.location.href = url;
          return { success: true, navigated: url };
        }

        case "browser_click": {
          const el = document.querySelector(args.selector as string) as HTMLElement;
          if (!el) return { success: false, error: `Element not found: ${args.selector}` };
          el.click();
          return { success: true, clicked: args.selector };
        }

        case "browser_fill": {
          const input = document.querySelector(args.selector as string) as HTMLInputElement;
          if (!input) return { success: false, error: `Input not found: ${args.selector}` };
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype, "value",
          )?.set;
          nativeInputValueSetter?.call(input, args.value as string);
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
          return { success: true, filled: args.selector };
        }

        case "browser_screenshot": {
          // Return a text description since we can't easily screenshot in-browser without html-to-image
          return {
            success: true,
            description: `Viewport: ${window.innerWidth}x${window.innerHeight}, Title: ${document.title}, URL: ${window.location.href}`,
          };
        }

        case "browser_read_text": {
          const selector = (args.selector as string) || "body";
          const el = document.querySelector(selector);
          if (!el) return { success: false, error: `Element not found: ${selector}` };
          const text = el.textContent?.slice(0, 2000) || "";
          return { success: true, text };
        }

        case "browser_evaluate": {
          try {
            const fn = new Function(`return (${args.script as string})`);
            const result = fn();
            return { success: true, result: String(result).slice(0, 1000) };
          } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : "Eval failed" };
          }
        }

        case "browser_scroll": {
          if (args.selector) {
            const el = document.querySelector(args.selector as string);
            if (el) {
              el.scrollIntoView({ behavior: "smooth", block: "center" });
              return { success: true, scrolledTo: args.selector };
            }
            return { success: false, error: `Element not found: ${args.selector}` };
          }
          window.scrollTo({ top: Number(args.y) || 0, behavior: "smooth" });
          return { success: true, scrolledTo: args.y };
        }

        case "browser_get_elements": {
          const sel = (args.selector as string) || "button, a, input, select, textarea";
          const elements = Array.from(document.querySelectorAll(sel)).slice(0, 50).map((el) => ({
            tag: el.tagName.toLowerCase(),
            text: el.textContent?.trim().slice(0, 80) || "",
            id: el.id || undefined,
            className: el.className?.toString().slice(0, 100) || undefined,
            type: (el as HTMLInputElement).type || undefined,
          }));
          return { success: true, elements };
        }

        default:
          return { success: false, error: `Unknown browser tool: ${tool}` };
      }
    },
    [],
  );

  useEffect(() => {
    for (const msg of messages) {
      if (!msg.browserCommands) continue;
      for (const cmd of msg.browserCommands) {
        if (processedRef.current.has(cmd.requestId)) continue;
        processedRef.current.add(cmd.requestId);

        executeBrowserCommand(cmd.tool, cmd.args).then((result) => {
          onResult?.(cmd.requestId, result);
        });
      }
    }
  }, [messages, executeBrowserCommand, onResult]);
}
