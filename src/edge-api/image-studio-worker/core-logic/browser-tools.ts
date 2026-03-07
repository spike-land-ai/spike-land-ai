export interface BrowserToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, { type: string; description: string }>;
    required: string[];
  };
}

export const BROWSER_TOOLS: BrowserToolDefinition[] = [
  {
    name: "browser_navigate",
    description: "Navigate the current tab to a URL or app section",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "URL or section name (e.g. 'generate', 'library', 'albums')",
        },
      },
      required: ["url"],
    },
  },
  {
    name: "browser_click",
    description: "Click an element by CSS selector",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "CSS selector of the element to click",
        },
      },
      required: ["selector"],
    },
  },
  {
    name: "browser_fill",
    description: "Fill an input field with text",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "CSS selector of the input element",
        },
        value: { type: "string", description: "Text value to fill" },
      },
      required: ["selector", "value"],
    },
  },
  {
    name: "browser_screenshot",
    description: "Capture a screenshot of the current viewport",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "browser_read_text",
    description: "Get text content of an element or the full page",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "CSS selector (optional, defaults to body)",
        },
      },
      required: [],
    },
  },
  {
    name: "browser_scroll",
    description: "Scroll to an element or position",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "CSS selector to scroll to (optional)",
        },
        y: {
          type: "string",
          description: "Y pixel offset (optional, used if no selector)",
        },
      },
      required: [],
    },
  },
  {
    name: "browser_get_elements",
    description: "List interactive elements on the page (buttons, links, inputs)",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description:
            "CSS selector filter (optional, defaults to 'button, a, input, select, textarea')",
        },
      },
      required: [],
    },
  },
];

export function isBrowserTool(name: string): boolean {
  return name.startsWith("browser_");
}
