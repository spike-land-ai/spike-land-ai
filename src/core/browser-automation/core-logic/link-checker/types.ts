// All types for the link checker module

export type LinkCategory =
  | "relative_file"
  | "anchor"
  | "file_with_anchor"
  | "github_repo"
  | "github_file"
  | "github_tree"
  | "github_raw"
  | "github_badge"
  | "external_url"
  | "skipped";

export type LinkStatus = "ok" | "broken" | "warning" | "skipped" | "error";

export interface ExtractedLink {
  target: string;
  text: string;
  line: number;
  column: number;
  category: LinkCategory;
  inCodeBlock: boolean;
  inComment: boolean;
}

export interface LinkValidationResult {
  link: ExtractedLink;
  status: LinkStatus;
  httpStatus?: number;
  reason: string;
  suggestion?: string;
  durationMs: number;
}

export interface FileReport {
  filePath: string;
  totalLinks: number;
  broken: LinkValidationResult[];
  warnings: LinkValidationResult[];
  ok: LinkValidationResult[];
  skipped: LinkValidationResult[];
  errors: LinkValidationResult[];
}

export interface ScanReport {
  rootDir: string;
  filePattern: string;
  filesScanned: number;
  summary: {
    totalLinks: number;
    broken: number;
    warnings: number;
    ok: number;
    skipped: number;
    errors: number;
  };
  files: FileReport[];
  durationMs: number;
}

export interface CheckerOptions {
  rootDir: string;
  filePattern?: string;
  files?: string[];
  checkExternal?: boolean;
  checkGithub?: boolean;
  skipCodeBlocks?: boolean;
  skipComments?: boolean;
  githubToken?: string;
  concurrency?: number;
  timeout?: number;
  verbose?: boolean;
  excludePatterns?: string[];
}

export interface ParsedGitHubUrl {
  org: string;
  repo: string;
  type: "repo" | "file" | "tree" | "raw" | "actions" | "badge";
  branch?: string;
  path?: string;
  workflow?: string;
  url: string;
}
