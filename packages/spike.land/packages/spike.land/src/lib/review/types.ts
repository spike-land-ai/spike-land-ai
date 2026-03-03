export interface ReviewFinding {
  path: string;
  line?: number;
  severity: "info" | "warning" | "error";
  message: string;
  ruleId: string;
  suggestion?: string;
}

export interface ReviewReport {
  id: string;
  userId: string;
  findings: ReviewFinding[];
  score: number; // 0-100
  summary: string;
  createdAt: string;
}

export interface ConventionRule {
  id: string;
  name: string;
  description: string;
  pattern: string; // Regex pattern
  severity: "info" | "warning" | "error";
  message: string;
}

export interface ConventionSet {
  id: string;
  name: string;
  rules: ConventionRule[];
}
