/**
 * Web Reader MCP Tools
 *
 * 10 tools for navigating, reading, and interacting with web pages
 * via the accessibility tree (screen-reader style).
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  createZodTool,
  errorResult,
  textResult,
} from "@spike-land-ai/mcp-server-base";
import { z } from "zod";

import { closeTab, getActiveTab, getOrCreateTab, getPageSnapshot, listTabs } from "../core-logic/browser-session.js";
import { narrate, narrateSection, narrateCompact, narrateCompactSection, findElementByRef } from "../core-logic/narrate.js";
import type { AccessibilityNode } from "../core-logic/types.js";

async function narrateCurrentPage(
  landmark?: string,
  detail: "compact" | "full" | "landmark" = "compact",
): Promise<string> {
  const snapshot = await getPageSnapshot();
  if (!snapshot) return "No active browser tab. Use web_navigate first.";
  if (!snapshot.tree) return `[Page: "${snapshot.title}" - ${snapshot.url}]\n[Empty page - no accessibility tree]`;

  if (detail === "landmark" && landmark) {
    const result = narrateCompactSection(snapshot.tree, landmark, snapshot.title, snapshot.url);
    return result.text;
  }

  if (landmark) {
    const fn = detail === "compact" ? narrateCompactSection : narrateSection;
    const result = fn(snapshot.tree, landmark, snapshot.title, snapshot.url);
    return result.text;
  }

  const fn = detail === "compact" ? narrateCompact : narrate;
  const result = fn(snapshot.tree, snapshot.title, snapshot.url);
  return result.text;
}

async function getTreeAndPage(): Promise<{
  tree: AccessibilityNode;
  page: NonNullable<Awaited<ReturnType<typeof getPageSnapshot>>>["page"];
} | null> {
  const snapshot = await getPageSnapshot();
  if (!snapshot?.tree) return null;
  return { tree: snapshot.tree, page: snapshot.page };
}

export function registerWebTools(server: McpServer): void {
  // 1. web_navigate
  createZodTool(server, {
    name: "web_navigate",
    description: "Navigate to a URL and return the page narrated as accessibility text. Use this to open websites.",
    schema: {
      url: z.string().url().describe("URL to navigate to"),
      tab: z.number().optional().describe("Tab index to use (creates new tab if omitted)"),
      wait_until: z.enum(["load", "domcontentloaded", "networkidle", "commit"]).optional()
        .describe("When to consider navigation complete (default: load)"),
    },
    async handler(args) {
      const url = String(args.url);
      const tabIndex = args.tab as number | undefined;
      const waitUntil = (args.wait_until as string) ?? "load";

      const { page } = await getOrCreateTab(tabIndex);
      await page.goto(url, { waitUntil });
      const text = await narrateCurrentPage();
      return textResult(text);
    },
  });

  // 2. web_read
  createZodTool(server, {
    name: "web_read",
    description: "Re-read the current page as accessibility text. Optionally filter by landmark (banner, navigation, main, contentinfo, complementary, form, region, search).",
    schema: {
      landmark: z.string().optional()
        .describe("Landmark to read (e.g. 'main', 'banner', 'navigation', 'contentinfo')"),
      detail: z.enum(["compact", "full", "landmark"]).optional()
        .describe("compact (default, token-efficient) | full (verbose) | landmark (single section)"),
    },
    async handler(args) {
      const landmark = args.landmark as string | undefined;
      const detail = (args.detail as "compact" | "full" | "landmark" | undefined) ?? "compact";
      const text = await narrateCurrentPage(landmark, detail);
      return textResult(text);
    },
  });

  // 3. web_click
  createZodTool(server, {
    name: "web_click",
    description: "Click an element by ref number (from narration) or by role+name. Returns updated page narration.",
    schema: {
      ref: z.number().optional().describe("Ref number from narration output"),
      role: z.string().optional().describe("ARIA role (e.g. 'button', 'link')"),
      name: z.string().optional().describe("Accessible name to match"),
    },
    async handler(args) {
      const ref = args.ref as number | undefined;
      const role = args.role as string | undefined;
      const name = args.name as string | undefined;

      const data = await getTreeAndPage();
      if (!data) return errorResult("NO_PAGE", "No active browser tab. Use web_navigate first.");

      if (ref !== undefined) {
        const node = findElementByRef(data.tree, ref);
        if (!node) return errorResult("REF_NOT_FOUND", `No element with ref=${ref}. Re-read the page to get current refs.`);
        const locator = data.page.getByRole(node.role, node.name !== undefined ? { name: node.name } : undefined);
        await locator.click();
      } else if (role) {
        const opts = name ? { name } : undefined;
        const locator = data.page.getByRole(role, opts);
        await locator.click();
      } else {
        return errorResult("INVALID_INPUT", "Provide either ref or role (with optional name).");
      }

      const text = await narrateCurrentPage();
      return textResult(text);
    },
  });

  // 4. web_type
  createZodTool(server, {
    name: "web_type",
    description: "Type text into an input field identified by ref number or name. Returns updated page narration.",
    schema: {
      ref: z.number().optional().describe("Ref number from narration output"),
      name: z.string().optional().describe("Accessible name of the input field"),
      text: z.string().describe("Text to type"),
      clear: z.boolean().optional().describe("Clear the field before typing (default: true)"),
    },
    async handler(args) {
      const ref = args.ref as number | undefined;
      const name = args.name as string | undefined;
      const text = String(args.text);
      const clear = args.clear !== false;

      const data = await getTreeAndPage();
      if (!data) return errorResult("NO_PAGE", "No active browser tab. Use web_navigate first.");

      let role = "textbox";
      let targetName = name;

      if (ref !== undefined) {
        const node = findElementByRef(data.tree, ref);
        if (!node) return errorResult("REF_NOT_FOUND", `No element with ref=${ref}.`);
        role = node.role;
        targetName = node.name;
      }

      const locator = data.page.getByRole(role, targetName ? { name: targetName } : undefined);
      if (clear) {
        await locator.clear();
      }
      await locator.fill(text);

      const narration = await narrateCurrentPage();
      return textResult(narration);
    },
  });

  // 5. web_select
  createZodTool(server, {
    name: "web_select",
    description: "Select an option from a dropdown/combobox by ref number or name.",
    schema: {
      ref: z.number().optional().describe("Ref number from narration output"),
      name: z.string().optional().describe("Accessible name of the select element"),
      option: z.string().describe("Option value or label to select"),
    },
    async handler(args) {
      const ref = args.ref as number | undefined;
      const name = args.name as string | undefined;
      const option = String(args.option);

      const data = await getTreeAndPage();
      if (!data) return errorResult("NO_PAGE", "No active browser tab. Use web_navigate first.");

      let role = "combobox";
      let targetName = name;

      if (ref !== undefined) {
        const node = findElementByRef(data.tree, ref);
        if (!node) return errorResult("REF_NOT_FOUND", `No element with ref=${ref}.`);
        role = node.role;
        targetName = node.name;
      }

      const locator = data.page.getByRole(role, targetName ? { name: targetName } : undefined);
      await locator.selectOption(option);

      const narration = await narrateCurrentPage();
      return textResult(narration);
    },
  });

  // 6. web_press
  createZodTool(server, {
    name: "web_press",
    description: "Press a key or key combination (e.g. 'Enter', 'Tab', 'Ctrl+a', 'Escape'). Returns updated page narration.",
    schema: {
      key: z.string().describe("Key or combo to press (e.g. 'Enter', 'Tab', 'Ctrl+a', 'ArrowDown')"),
    },
    async handler(args) {
      const key = String(args.key);
      const tab = getActiveTab();
      if (!tab) return errorResult("NO_PAGE", "No active browser tab. Use web_navigate first.");

      await tab.page.keyboard.press(key);
      const text = await narrateCurrentPage();
      return textResult(text);
    },
  });

  // 7. web_scroll
  createZodTool(server, {
    name: "web_scroll",
    description: "Scroll the page up or down. Returns updated page narration.",
    schema: {
      direction: z.enum(["up", "down"]).optional().describe("Scroll direction (default: down)"),
      amount: z.number().optional().describe("Number of viewport heights to scroll (default: 1)"),
    },
    async handler(args) {
      const direction = (args.direction as string) ?? "down";
      const amount = (args.amount as number) ?? 1;

      const tab = getActiveTab();
      if (!tab) return errorResult("NO_PAGE", "No active browser tab. Use web_navigate first.");

      const viewport = tab.page.viewportSize();
      const height = viewport?.height ?? 720;
      const delta = height * amount * (direction === "up" ? -1 : 1);
      await tab.page.mouse.wheel(0, delta);

      const text = await narrateCurrentPage();
      return textResult(text);
    },
  });

  // 8. web_tabs
  createZodTool(server, {
    name: "web_tabs",
    description: "List, switch, or close browser tabs.",
    schema: {
      action: z.enum(["list", "switch", "close"]).describe("Action to perform"),
      tab: z.number().optional().describe("Tab index (required for switch/close)"),
    },
    async handler(args) {
      const action = String(args.action);
      const tabIndex = args.tab as number | undefined;

      if (action === "list") {
        const tabList = await listTabs();
        if (tabList.length === 0) return textResult("No open tabs.");
        const lines = tabList.map(
          (t) => `[Tab ${t.index}] "${t.title}" - ${t.url}`,
        );
        return textResult(lines.join("\n"));
      }

      if (action === "switch") {
        if (tabIndex === undefined) return errorResult("INVALID_INPUT", "Provide tab index to switch to.");
        const { page } = await getOrCreateTab(tabIndex);
        if (!page) return errorResult("TAB_NOT_FOUND", `Tab ${tabIndex} not found.`);
        const text = await narrateCurrentPage();
        return textResult(text);
      }

      if (action === "close") {
        if (tabIndex === undefined) return errorResult("INVALID_INPUT", "Provide tab index to close.");
        const closed = await closeTab(tabIndex);
        if (!closed) return errorResult("TAB_NOT_FOUND", `Tab ${tabIndex} not found.`);
        return textResult(`Tab ${tabIndex} closed.`);
      }

      return errorResult("INVALID_INPUT", `Unknown action: ${action}`);
    },
  });

  // 9. web_screenshot
  createZodTool(server, {
    name: "web_screenshot",
    description: "Take a screenshot of the current page. Returns base64 PNG.",
    schema: {
      full_page: z.boolean().optional().describe("Capture full scrollable page (default: false)"),
    },
    async handler(args) {
      const fullPage = args.full_page as boolean | undefined;
      const tab = getActiveTab();
      if (!tab) return errorResult("NO_PAGE", "No active browser tab. Use web_navigate first.");

      const buffer = await tab.page.screenshot({
        fullPage: fullPage ?? false,
        type: "png",
      });

      const data = Buffer.isBuffer(buffer)
        ? buffer.toString("base64")
        : String(buffer);

      return {
        content: [{
          type: "image" as const,
          data,
          mimeType: "image/png",
        }],
      } as unknown as ReturnType<typeof textResult>;
    },
  });

  // 10. web_forms
  createZodTool(server, {
    name: "web_forms",
    description: "List all form fields on the current page with their current values.",
    schema: {},
    async handler() {
      const snapshot = await getPageSnapshot();
      if (!snapshot?.tree) return errorResult("NO_PAGE", "No active browser tab. Use web_navigate first.");

      const fields = collectFormFields(snapshot.tree);
      if (fields.length === 0) return textResult("No form fields found on the page.");

      const lines = fields.map((f) => {
        const parts = [`[${f.role} ref=${f.ref}]`];
        if (f.name) parts.push(`"${f.name}"`);
        if (f.value) parts.push(`value: "${f.value}"`);
        if (f.states.length > 0) parts.push(`(${f.states.join(", ")})`);
        return parts.join(" ");
      });

      return textResult(lines.join("\n"));
    },
  });
}

const FORM_ROLES = new Set([
  "textbox",
  "searchbox",
  "checkbox",
  "radio",
  "combobox",
  "slider",
  "spinbutton",
  "switch",
]);

interface FormField {
  ref: number;
  role: string;
  name?: string | undefined;
  value?: string | undefined;
  states: string[];
}

function collectFormFields(tree: AccessibilityNode): FormField[] {
  const fields: FormField[] = [];
  let nextRef = 1;

  function walk(node: AccessibilityNode): void {
    const isInteractive = FORM_ROLES.has(node.role) ||
      node.role === "link" || node.role === "button" ||
      node.role === "tab" || node.role === "menuitem" ||
      node.role === "heading" || node.role === "option" ||
      node.role === "menuitemcheckbox" || node.role === "menuitemradio" ||
      node.role === "treeitem";

    if (isInteractive) {
      const ref = nextRef++;
      if (FORM_ROLES.has(node.role)) {
        const states: string[] = [];
        if (node.checked === true) states.push("checked");
        if (node.checked === "mixed") states.push("mixed");
        if (node.disabled) states.push("disabled");
        fields.push({
          ref,
          role: node.role,
          ...(node.name !== undefined ? { name: node.name } : {}),
          ...(node.value !== undefined ? { value: node.value } : {}),
          states,
        });
      }
      return; // Don't recurse into interactive elements
    }

    for (const child of node.children ?? []) {
      walk(child);
    }
  }

  for (const child of tree.children ?? []) {
    walk(child);
  }

  return fields;
}
