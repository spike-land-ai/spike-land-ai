interface AnthropicTool {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, { type: string; description: string }>;
    required?: string[];
  };
}

export const BROWSER_TOOLS: AnthropicTool[] = [
  {
    name: "browser_navigate",
    description:
      "Navigate the browser to a URL or spike.land app section. Use internal paths (e.g. /tools) for spike.land pages.",
    input_schema: {
      type: "object",
      properties: {
        url: { type: "string", description: "The URL or path to navigate to" },
      },
      required: ["url"],
    },
  },
  {
    name: "browser_click",
    description: "Click an element in the browser identified by a CSS selector.",
    input_schema: {
      type: "object",
      properties: {
        selector: { type: "string", description: "CSS selector of the element to click" },
      },
      required: ["selector"],
    },
  },
  {
    name: "browser_fill",
    description: "Fill an input field with a value.",
    input_schema: {
      type: "object",
      properties: {
        selector: { type: "string", description: "CSS selector of the input element" },
        value: { type: "string", description: "The value to fill in" },
      },
      required: ["selector", "value"],
    },
  },
  {
    name: "browser_screenshot",
    description:
      "Take a screenshot of the current browser viewport. Returns a description of what is visible.",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "browser_read_text",
    description:
      "Read text content from an element in the browser. Defaults to reading the full page body.",
    input_schema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "CSS selector of the element to read (defaults to body)",
        },
      },
    },
  },
  {
    name: "browser_scroll",
    description: "Scroll the browser to an element or to a specific vertical position.",
    input_schema: {
      type: "object",
      properties: {
        selector: { type: "string", description: "CSS selector of the element to scroll to" },
        y: { type: "number", description: "Vertical scroll position in pixels" },
      },
    },
  },
  {
    name: "browser_get_elements",
    description: "Get a list of interactive elements matching a CSS selector.",
    input_schema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "CSS selector to match elements (defaults to all interactive elements)",
        },
      },
    },
  },
];
