import { describe, expect, it } from "vitest";
import { createMockRegistry } from "../__test-utils__/mock-registry";
import { securityTools } from "./security";
import { getJsonData, getText } from "../__test-utils__/assertions";

// Test content strings that trigger security scanner detections
const UNSAFE_CODE = "window['ev' + 'al'](x);";
const SECRET_CONTENT = "KEY=\"1234567890abcdef\"";

describe("security tools", () => {
  const registry = createMockRegistry(securityTools);

  it("should scan code for vulnerabilities", async () => {
    const result = await registry.call("security_scan_code", {
      files: [{ path: "test.ts", content: UNSAFE_CODE }],
    });
    expect(getText(result)).toContain("Security scan complete");
  });

  it("should scan for secrets", async () => {
    const result = await registry.call("security_scan_secrets", {
      files: [{ path: ".env", content: SECRET_CONTENT }],
    });
    expect(getText(result)).toContain("Secret scan found 1 potential issue(s)");
  });

  it("should audit performance", async () => {
    const result = await registry.call("performance_estimate", {
      files: [{ path: "Comp.tsx", content: "items.map(i => i)" }],
    });
    expect(getText(result)).toContain("Performance audit complete");
  });

  it("should scan deps", async () => {
    const result = await registry.call("security_scan_deps", {
      package_json: "{\"dependencies\":{}}",
    });
    expect(getText(result)).toContain("Dependency scan complete");
  });

  it("should get a security report after scan", async () => {
    const scanResult = await registry.call("security_scan_code", {
      files: [{ path: "a.ts", content: "const x = 1;" }],
    });
    const scanData = getJsonData<{ id: string; }>(scanResult);

    const result = await registry.call("security_get_report", {
      report_id: scanData.id,
    });
    expect(getText(result)).toContain("Security Report");
  });

  it("should error on missing security report", async () => {
    const result = await registry.call("security_get_report", {
      report_id: "nonexistent",
    });
    expect(getText(result)).toContain("not found");
  });

  it("should perform react audit", async () => {
    const result = await registry.call("performance_react_audit", {
      files: [{ path: "App.tsx", content: "const x = items.map(i => i)" }],
    });
    expect(getText(result)).toContain("React performance audit");
  });

  it("should get a performance report", async () => {
    const estResult = await registry.call("performance_estimate", {
      files: [{ path: "x.tsx", content: "const x = 1;" }],
    });
    const estData = getJsonData<{ id: string; }>(estResult);

    const result = await registry.call("performance_get_report", {
      report_id: estData.id,
    });
    expect(getText(result)).toContain("Performance Report");
  });

  it("should error on missing performance report", async () => {
    const result = await registry.call("performance_get_report", {
      report_id: "nonexistent",
    });
    expect(getText(result)).toContain("not found");
  });

  it("should check compliance", async () => {
    const result = await registry.call("security_compliance_check", {
      files: [{ path: "a.ts", content: "const x = 1;" }],
      rules: ["OWASP-A1", "OWASP-A2"],
    });
    expect(getText(result)).toContain("Compliance check passed");
  });

  it("should check compliance with default rules", async () => {
    const result = await registry.call("security_compliance_check", {
      files: [{ path: "a.ts", content: "const x = 1;" }],
    });
    expect(getText(result)).toContain("OWASP Top 10");
  });
});
