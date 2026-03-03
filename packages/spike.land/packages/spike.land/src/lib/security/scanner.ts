import type { PerformanceFinding, SecurityFinding } from "./types";

export function scanForVulnerabilities(
  files: Array<{ path: string; content: string; }>,
): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const patterns = [
    {
      regex: /eval\s*\(/g,
      type: "vulnerability" as const,
      severity: "high" as const,
      message: "Use of eval() detected, which is insecure.",
    },
    {
      regex: /innerHTML\s*=/g,
      type: "vulnerability" as const,
      severity: "medium" as const,
      message: "Potential XSS via innerHTML assignment.",
    },
    {
      regex: / dangerouslySetInnerHTML/g,
      type: "vulnerability" as const,
      severity: "high" as const,
      message: "Use of dangerouslySetInnerHTML detected.",
    },
  ];

  for (const file of files) {
    for (const p of patterns) {
      if (p.regex.test(file.content)) {
        findings.push({
          path: file.path,
          type: p.type,
          severity: p.severity,
          message: p.message,
        });
      }
    }
  }
  return findings;
}

export function scanForSecrets(
  files: Array<{ path: string; content: string; }>,
): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const patterns = [
    {
      regex: /(?:key|password|secret|token|api_key)\s*[:=]\s*['"][a-zA-Z0-9_-]{16,}['"]/gi,
      message: "Potential hardcoded secret or API key detected.",
    },
  ];

  for (const file of files) {
    for (const p of patterns) {
      if (p.regex.test(file.content)) {
        findings.push({
          path: file.path,
          type: "secret",
          severity: "critical",
          message: p.message,
        });
      }
    }
  }
  return findings;
}

export function auditPerformance(
  files: Array<{ path: string; content: string; }>,
): PerformanceFinding[] {
  const findings: PerformanceFinding[] = [];

  for (const file of files) {
    if (
      file.content.includes("useMemo") === false
      && file.content.includes("map(")
    ) {
      findings.push({
        path: file.path,
        type: "render-cycle",
        impact: "medium",
        message: "Missing useMemo for mapped data might lead to unnecessary re-renders.",
      });
    }
  }
  return findings;
}
