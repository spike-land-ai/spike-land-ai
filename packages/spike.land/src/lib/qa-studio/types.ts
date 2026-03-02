export interface QaActionError {
  error: string;
}

export interface QaNavigateResult {
  url: string;
  title: string;
}

export interface QaScreenshotResult {
  base64: string;
  url: string;
  fullPage: boolean;
}

export interface QaAccessibilityResult {
  score: number;
  violations: Array<{ issue: string; impact: string }>;
  standard: string;
}

export interface QaConsoleMessage {
  type: string;
  text: string;
  url: string;
  line: number;
}

export interface QaNetworkRequest {
  url: string;
  method: string;
  resourceType: string;
  status: number;
  contentLength: string;
}

export interface QaNetworkResult {
  requests: QaNetworkRequest[];
  totalSize: number;
  errorCount: number;
}

export interface QaViewportResult {
  width: number;
  height: number;
  preset: string;
}

export interface QaEvaluateResult {
  output: string;
  expression: string;
}

export interface QaTabInfo {
  index: number;
  url: string;
  title: string;
}

export interface QaTestResult {
  passed: boolean;
  output: string;
  target: string;
}

export interface QaCoverageResult {
  target: string;
  statements?: number;
  branches?: number;
  functions?: number;
  lines?: number;
  raw: string;
}

export function isActionError(result: unknown): result is QaActionError {
  return typeof result === "object" && result !== null && "error" in result;
}
