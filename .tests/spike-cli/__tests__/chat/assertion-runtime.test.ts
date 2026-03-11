import { describe, expect, it } from "vitest";
import {
  ASSERTION_METADATA_FIELD,
  AssertionRuntime,
  extractAssertionsFromCore,
  stripAssertionMetadata,
} from "../../../../src/cli/spike-cli/core-logic/chat/assertion-runtime.js";

describe("extractAssertionsFromCore", () => {
  it("extracts anchored assertions from canonical core text", () => {
    const assertions = extractAssertionsFromCore(`
## Rules
- no new logic during decomposition
- every step must link to source assertion
task completion != truth
`);

    expect(assertions).toHaveLength(3);
    expect(assertions[0]?.sourceAnchor).toBe("Rules:line 2");
    expect(assertions[1]?.text).toContain("every step must link");
    expect(assertions[2]?.text).toBe("task completion != truth");
  });

  it("falls back to a single assertion when no normative markers are found", () => {
    const assertions = extractAssertionsFromCore("Canonical core");
    expect(assertions).toHaveLength(1);
    expect(assertions[0]?.text).toBe("Canonical core");
  });
});

describe("AssertionRuntime", () => {
  it("records supportive evidence and marks assertions satisfied", () => {
    const runtime = new AssertionRuntime();
    runtime.setCanonicalCore("- assertion is satisfied only with enough evidence");
    const assertionId = runtime.getAssertions()[0]?.id;

    runtime.recordToolEvidence({
      toolName: "vitest__run_tests",
      result: "success: all checks passed",
      isError: false,
      assertionIds: assertionId ? [assertionId] : [],
    });

    expect(runtime.getAssertions()[0]?.status).toBe("satisfied");
    expect(runtime.getEvidence(assertionId).length).toBe(1);
  });

  it("keeps assertion unresolved when evidence conflicts", () => {
    const runtime = new AssertionRuntime();
    runtime.setCanonicalCore("- workflow result is valid only if supported by sufficient evidence");
    const assertionId = runtime.getAssertions()[0]?.id;

    if (!assertionId) {
      throw new Error("Expected extracted assertion");
    }

    runtime.recordToolEvidence({
      toolName: "vitest__run_tests",
      result: "success: verification passed",
      isError: false,
      assertionIds: [assertionId],
    });
    runtime.recordToolEvidence({
      toolName: "vitest__run_tests",
      result: "error: verification failed",
      isError: false,
      assertionIds: [assertionId],
    });

    expect(runtime.getAssertions()[0]?.status).toBe("unresolved");
  });
});

describe("stripAssertionMetadata", () => {
  it("removes reserved assertion metadata from tool inputs", () => {
    const { cleanInput, assertionIds } = stripAssertionMetadata({
      [ASSERTION_METADATA_FIELD]: ["a1", "a2"],
      filter: "*.ts",
    });

    expect(cleanInput).toEqual({ filter: "*.ts" });
    expect(assertionIds).toEqual(["a1", "a2"]);
  });
});
