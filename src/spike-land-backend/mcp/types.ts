import type { ICodeSession } from "@spike-land-ai/code";

// Re-export SDK types used across the MCP module
export type {
  CallToolResult,
  Resource,
  ResourceContents,
  ResourceTemplate,
  TextContent,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";

// Backward-compatible alias for consumers still importing McpTool
export type { Tool as McpTool } from "@modelcontextprotocol/sdk/types.js";

// JSON-RPC types for manual protocol handling (Cloudflare Workers can't use SDK transports)
export interface McpRequest {
  jsonrpc: string;
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export interface McpResponse {
  jsonrpc: string;
  id: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

// Codebase-specific types
export interface LineEdit {
  startLine: number;
  endLine: number;
  newContent: string;
}

export interface LineMatch {
  lineNumber: number;
  content: string;
  matchText: string;
}

export interface ToolExecutionContext {
  session: ICodeSession;
  codeSpace: string;
  updateSession: (session: ICodeSession) => Promise<void>;
}

export interface ReadCodeResult extends Record<string, unknown> {
  code: string;
  codeSpace: string;
}

export interface ReadHtmlResult extends Record<string, unknown> {
  html: string;
  codeSpace: string;
}

export interface ReadSessionResult extends Record<string, unknown> {
  code: string;
  html: string;
  css: string;
  codeSpace: string;
}

export interface UpdateCodeResult extends Record<string, unknown> {
  success: boolean;
  message: string;
  codeSpace: string;
  requiresTranspilation: boolean;
}

export interface EditCodeResult extends Record<string, unknown> {
  success: boolean;
  message: string;
  codeSpace: string;
  diff: string;
  linesChanged: number;
  requiresTranspilation: boolean;
}

export interface FindLinesResult extends Record<string, unknown> {
  pattern: string;
  isRegex: boolean;
  matches: LineMatch[];
  totalMatches: number;
  codeSpace: string;
}

export interface SearchReplaceResult extends Record<string, unknown> {
  success: boolean;
  message: string;
  replacements: number;
  search: string;
  replace: string;
  isRegex: boolean;
  global: boolean;
  codeSpace: string;
  requiresTranspilation: boolean;
}

// Filesystem tool result types

export interface FileEntry {
  path: string;
  size: number;
}

export interface ListFilesResult extends Record<string, unknown> {
  files: FileEntry[];
  totalFiles: number;
  codeSpace: string;
}

export interface ReadFileResult extends Record<string, unknown> {
  path: string;
  content: string;
  size: number;
  codeSpace: string;
}

export interface WriteFileResult extends Record<string, unknown> {
  success: boolean;
  message: string;
  path: string;
  size: number;
  codeSpace: string;
}

export interface DeleteFileResult extends Record<string, unknown> {
  success: boolean;
  message: string;
  path: string;
  codeSpace: string;
}
