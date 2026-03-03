/**
 * MCP Tool Definitions
 *
 * Declarative tool schemas for the codespace MCP server.
 */

import type { McpTool } from "./types";

// ---------------------------------------------------------------------------
// Read Tools
// ---------------------------------------------------------------------------

const readCodeTool: McpTool = {
  name: "read_code",
  description: "Read current code only. Use before making changes to understand the codebase.",
  inputSchema: {
    type: "object",
    properties: {
      codeSpace: {
        type: "string",
        description: "The codeSpace identifier to read code from",
      },
    },
    required: ["codeSpace"],
  },
};

const readHtmlTool: McpTool = {
  name: "read_html",
  description: "Read current HTML output only. Lightweight way to check rendering results.",
  inputSchema: {
    type: "object",
    properties: {
      codeSpace: {
        type: "string",
        description: "The codeSpace identifier to read HTML from",
      },
    },
    required: ["codeSpace"],
  },
};

const readSessionTool: McpTool = {
  name: "read_session",
  description: "Read ALL session data (code+html+css). Use sparingly - prefer specific read tools.",
  inputSchema: {
    type: "object",
    properties: {
      codeSpace: {
        type: "string",
        description: "The codeSpace identifier to read session from",
      },
    },
    required: ["codeSpace"],
  },
};

// ---------------------------------------------------------------------------
// Write Tools
// ---------------------------------------------------------------------------

const updateCodeTool: McpTool = {
  name: "update_code",
  description:
    "Replace ALL code with new content. For smaller changes, use edit_code or search_and_replace instead.",
  inputSchema: {
    type: "object",
    properties: {
      codeSpace: {
        type: "string",
        description: "The codeSpace identifier to update code in",
      },
      code: {
        type: "string",
        description: "The complete new code to replace ALL existing code",
      },
    },
    required: ["codeSpace", "code"],
  },
};

const editCodeTool: McpTool = {
  name: "edit_code",
  description:
    "Make precise line-based edits. More efficient than update_code for targeted changes.",
  inputSchema: {
    type: "object",
    properties: {
      codeSpace: {
        type: "string",
        description: "The codeSpace identifier to edit code in",
      },
      edits: {
        type: "array",
        description: "Array of line edits to apply",
        items: {
          type: "object",
          properties: {
            startLine: {
              type: "number",
              description: "Starting line number (1-based)",
            },
            endLine: {
              type: "number",
              description: "Ending line number (1-based)",
            },
            newContent: {
              type: "string",
              description: "New content for the specified lines",
            },
          },
          required: ["startLine", "endLine", "newContent"],
        },
      },
    },
    required: ["codeSpace", "edits"],
  },
};

const searchAndReplaceTool: McpTool = {
  name: "search_and_replace",
  description:
    "MOST EFFICIENT: Replace patterns without needing line numbers. Best for simple text replacements.",
  inputSchema: {
    type: "object",
    properties: {
      codeSpace: {
        type: "string",
        description: "The codeSpace identifier to perform search and replace in",
      },
      search: {
        type: "string",
        description: "Text or pattern to search for",
      },
      replace: {
        type: "string",
        description: "Replacement text",
      },
      isRegex: {
        type: "boolean",
        description: "Whether search is a regular expression (default: false)",
      },
      global: {
        type: "boolean",
        description: "Replace all occurrences (default: true)",
      },
    },
    required: ["codeSpace", "search", "replace"],
  },
};

// ---------------------------------------------------------------------------
// Search Tools
// ---------------------------------------------------------------------------

const findLinesTool: McpTool = {
  name: "find_lines",
  description:
    "Find line numbers containing a search pattern. Use before edit_code to locate target lines.",
  inputSchema: {
    type: "object",
    properties: {
      codeSpace: {
        type: "string",
        description: "The codeSpace identifier to search in",
      },
      pattern: {
        type: "string",
        description: "Pattern to search for",
      },
      isRegex: {
        type: "boolean",
        description: "Whether pattern is a regular expression (default: false)",
      },
    },
    required: ["codeSpace", "pattern"],
  },
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

/** Tool names that mutate codespace state and require authentication */
export const WRITE_TOOL_NAMES = new Set([
  "update_code",
  "edit_code",
  "search_and_replace",
]);

/** All 7 MCP tool definitions */
export const allTools: McpTool[] = [
  readCodeTool,
  readHtmlTool,
  readSessionTool,
  updateCodeTool,
  editCodeTool,
  searchAndReplaceTool,
  findLinesTool,
];
