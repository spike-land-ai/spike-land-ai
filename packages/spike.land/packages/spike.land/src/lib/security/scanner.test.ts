import { describe, expect, it } from "vitest";
import {
  auditPerformance,
  scanForSecrets,
  scanForVulnerabilities,
} from "./scanner";

describe("security scanner", () => {
  it("should detect vulnerabilities", () => {
    const files = [{ path: "vuln.ts", content: "eval(userInput);" }];
    const findings = scanForVulnerabilities(files);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.type).toBe("vulnerability");
    expect(findings[0]!.severity).toBe("high");
  });

  it("should detect potential secrets", () => {
    const files = [{
      path: ".env",
      content: "API_KEY = 'v1-safe-key-long-enough-12345'",
    }];
    const findings = scanForSecrets(files);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.type).toBe("secret");
  });

  it("should audit performance", () => {
    const files = [{
      path: "Slow.tsx",
      content: "items.map(i => <div>{i}</div>)",
    }];
    const findings = auditPerformance(files);
    expect(findings.some(f => f.type === "render-cycle")).toBe(true);
  });
});
