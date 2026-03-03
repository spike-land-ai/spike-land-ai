export interface SecurityFinding {
  path: string;
  line?: number;
  type: "vulnerability" | "secret" | "insecure-pattern";
  severity: "critical" | "high" | "medium" | "low";
  message: string;
}

export interface SecurityReport {
  id: string;
  findings: SecurityFinding[];
  score: number;
  createdAt: string;
}

export interface PerformanceFinding {
  path: string;
  type: "complexity" | "render-cycle" | "memory-leak" | "network";
  impact: "high" | "medium" | "low";
  message: string;
  suggestion?: string;
}

export interface PerformanceReport {
  id: string;
  findings: PerformanceFinding[];
  estimatedTtfbMs?: number;
  createdAt: string;
}
