import { describe, expect, it } from "vitest";
import { checkBazdmegGates } from "./check-gates.js";

describe("checkBazdmegGates", () => {
  it("returns formatted gate results for clean diff", () => {
    const diff = `--- a/src/foo.ts
+++ b/src/foo.ts
@@ -1,3 +1,4 @@
 const x = 1;
+const y = 2;
 export { x };
--- a/src/foo.test.ts
+++ b/src/foo.test.ts
@@ -1,2 +1,3 @@
 import { x } from './foo';
+test('y exists', () => expect(y).toBe(2));`;

    const result = checkBazdmegGates({ diff });
    expect(result).toContain("BAZDMEG Quality Gates");
    expect(result).toContain("Unit Tests Present");
  });

  it("detects missing tests", () => {
    const diff = `--- a/src/foo.ts
+++ b/src/foo.ts
@@ -1,2 +1,3 @@
 const x = 1;
+const y = 2;`;

    const result = checkBazdmegGates({ diff });
    expect(result).toContain("no test files");
  });

  it("accepts CLAUDE.md content for extra rules", () => {
    const diff = `+++ b/docs/readme.md
@@ -0,0 +1 @@
+# Hello`;

    const result = checkBazdmegGates({
      diff,
      claudeMdContent: "# Code Quality Rules\n- No globals",
    });
    expect(result).toContain("BAZDMEG Quality Gates");
  });

  it("detects security issues in diff", () => {
    const diff = `+++ b/src/config.ts
@@ -0,0 +1 @@
+const password = "hunter2";`;

    const result = checkBazdmegGates({ diff });
    expect(result).toContain("Hardcoded password");
  });
});
