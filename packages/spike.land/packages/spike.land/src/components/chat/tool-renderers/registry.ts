/**
 * Registry mapping tool name patterns to specialized renderers.
 *
 * Falls back to DefaultToolRenderer for unknown tools.
 */

import type { ComponentType } from "react";
import type { ToolRendererProps } from "./DefaultToolRenderer";
import { DefaultToolRenderer } from "./DefaultToolRenderer";
import { CodeToolRenderer } from "./CodeToolRenderer";
import { SearchToolRenderer } from "./SearchToolRenderer";
import { FileToolRenderer } from "./FileToolRenderer";

export type ToolRenderer = ComponentType<ToolRendererProps>;

interface RendererRule {
  pattern: RegExp;
  renderer: ToolRenderer;
}

const rules: RendererRule[] = [
  // File operations
  {
    pattern: /file_read|file_write|fs_read|fs_write|read_file|write_file/i,
    renderer: FileToolRenderer,
  },
  // Search / query
  {
    pattern: /search|query|list|find|github_issue/i,
    renderer: SearchToolRenderer,
  },
  // Code / eval
  {
    pattern: /code|eval|execute|run_code|transpile/i,
    renderer: CodeToolRenderer,
  },
];

/** Get the best renderer for a tool name. */
export function getToolRenderer(toolName: string): ToolRenderer {
  // Strip namespace prefix for matching
  const stripped = toolName.includes("__")
    ? toolName.split("__").slice(1).join("__")
    : toolName;

  for (const rule of rules) {
    if (rule.pattern.test(stripped)) {
      return rule.renderer;
    }
  }

  return DefaultToolRenderer;
}
