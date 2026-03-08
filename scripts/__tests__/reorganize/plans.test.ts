import { describe, expect, it } from "vitest";
import { computeMovePlans } from "../../reorganize/planning.js";
import type { FileNode } from "../../reorganize/types.js";

describe("computeMovePlans", () => {
  const mockNodes: FileNode[] = [
    {
      absPath: "/src/pkg1/file1.ts",
      relPath: "pkg1/file1.ts",
      packageName: "pkg1",
      externalDeps: new Set(["react"]),
      relativeImports: new Set(),
    },
    {
      absPath: "/src/pkg1/file1.test.ts",
      relPath: "pkg1/file1.test.ts",
      packageName: "pkg1",
      externalDeps: new Set(["vitest"]),
      relativeImports: new Set(),
    },
  ];

  const mockCategories = new Map([["pkg1", "frontend"]]);

  it("assigns correct target directory and filename", () => {
    const plans = computeMovePlans(mockNodes, mockCategories);
    expect(plans[0].targetRelPath).toBe("frontend/pkg1/ui/file1.ts");
  });

  it("co-locates tests in __tests__ subfolder", () => {
    const plans = computeMovePlans(mockNodes, mockCategories);
    expect(plans[1].targetRelPath).toBe("frontend/pkg1/testing/__tests__/file1.test.ts");
  });

  it("splits oversized buckets by original subdirectory", () => {
    // Create 25 files in the same bucket
    const manyNodes: FileNode[] = Array.from({ length: 25 }, (_, i) => ({
      absPath: `/src/pkg1/sub${i % 2}/file${i}.ts`,
      relPath: `pkg1/sub${i % 2}/file${i}.ts`,
      packageName: "pkg1",
      externalDeps: new Set(["react"]),
      relativeImports: new Set(),
    }));

    const plans = computeMovePlans(manyNodes, mockCategories, 20);

    // Should have sub-split by original subdir (sub0 or sub1)
    expect(plans[0].targetDir).toContain("sub0");
    expect(plans[1].targetDir).toContain("sub1");
  });

  it("disambiguates duplicate filenames with package name", () => {
    const dupNodes: FileNode[] = [
      {
        absPath: "/src/pkg1/utils.ts",
        relPath: "pkg1/utils.ts",
        packageName: "pkg1",
        externalDeps: new Set(),
        relativeImports: new Set(),
      },
      {
        absPath: "/src/pkg2/utils.ts",
        relPath: "pkg2/utils.ts",
        packageName: "pkg2",
        externalDeps: new Set(),
        relativeImports: new Set(),
      },
    ];
    const categories = new Map([
      ["pkg1", "core"],
      ["pkg2", "core"],
    ]);

    computeMovePlans(dupNodes, categories);

    // Since they are in core/pkg1/core-logic and core/pkg2/core-logic,
    // they don't actually collide in the targetDir.
    // Let's force a collision by making them same appName and depGroup.

    const sameBucketNodes: FileNode[] = [
      {
        absPath: "/src/pkg1/utils.ts",
        relPath: "pkg1/utils.ts",
        packageName: "pkg1",
        externalDeps: new Set(),
        relativeImports: new Set(),
      },
      {
        absPath: "/src/pkg1/deep/utils.ts",
        relPath: "pkg1/deep/utils.ts",
        packageName: "pkg1",
        externalDeps: new Set(),
        relativeImports: new Set(),
      },
    ];

    const plans2 = computeMovePlans(sameBucketNodes, mockCategories);
    expect(plans2[0].targetFileName).toBe("utils.ts");
    expect(plans2[1].targetFileName).toBe("utils-pkg1.ts");
  });
});
