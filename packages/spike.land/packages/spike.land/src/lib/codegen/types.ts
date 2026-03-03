export interface ContextBundle {
  id: string;
  userId: string;
  sessionId?: string;
  subtaskId?: string;
  spec: string;
  fileContents: Array<{ path: string; content: string; }>;
  conventions: string[];
  constraints: string[];
  examples: Array<{ description: string; code: string; }>;
  dependencyOutputs: Array<{ subtaskId: string; output: string; }>;
}

export interface CodeGenResult {
  id: string;
  userId: string;
  bundleId: string;
  provider: string;
  model: string;
  prompt: string;
  generatedCode: string; // Raw output from AI
  files: Array<{ path: string; content: string; }>;
  tokensIn: number;
  tokensOut: number;
  durationMs: number;
  status: "success" | "error" | "needs_revision";
  iteration: number;
}
