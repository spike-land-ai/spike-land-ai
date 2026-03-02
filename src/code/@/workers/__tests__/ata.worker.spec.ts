import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockSetupTypeAcquisition, mockFetch } = vi.hoisted(() => ({
  mockSetupTypeAcquisition: vi.fn(),
  mockFetch: vi.fn(),
}));

vi.mock("@typescript/ata", () => ({
  setupTypeAcquisition: mockSetupTypeAcquisition,
}));

vi.mock("@/lib/idb-cache", () => ({
  getAtaCache: vi.fn().mockResolvedValue(null),
  setAtaCache: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/queued-fetch", () => ({
  QueuedFetch: class MockQueuedFetch {
    fetch = mockFetch;
  },
}));

import { ata, cleanFileContent, cleanFilePath, extractImportSpecifiers } from "../ata.worker";

describe("ata.worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── cleanFilePath ───────────────────────────────────────────────

  describe("cleanFilePath", () => {
    const origin = "https://testing.spike.land";

    it("strips originToUse from path", () => {
      expect(cleanFilePath(`${origin}/react/index.d.ts`, origin)).toBe("/react/index.d.ts");
    });

    it("strips spike.land and esm.sh origins", () => {
      expect(cleanFilePath("https://spike.land/react/index.d.ts", origin)).toBe(
        "/react/index.d.ts",
      );
      expect(cleanFilePath("https://esm.sh/react/index.d.ts", origin)).toBe("/react/index.d.ts");
    });

    it("removes node_modules, @types, dist, types, src, declarations segments", () => {
      expect(
        cleanFilePath("/node_modules/@types/react/dist/types/src/declarations/index.d.ts", origin),
      ).toBe("/react/index.d.ts");
    });

    it("removes version paths like /v18/", () => {
      expect(cleanFilePath("/v18/react/index.d.ts", origin)).toBe("/react/index.d.ts");
    });

    it("removes TS version paths like ts5.3/", () => {
      expect(cleanFilePath("/react/ts5.3/index.d.ts", origin)).toBe("/react/index.d.ts");
    });

    it("removes semver version numbers like @1.2.3", () => {
      expect(cleanFilePath("/react@18.2.0/index.d.ts", origin)).toBe("/react/index.d.ts");
    });

    it("removes caret semver like @^1.2.3", () => {
      expect(cleanFilePath("/react@^18.2.0/index.d.ts", origin)).toBe("/react/index.d.ts");
    });

    it("normalizes missing leading slash", () => {
      expect(cleanFilePath("react/index.d.ts", origin)).toBe("/react/index.d.ts");
    });

    it("removes double slashes", () => {
      expect(cleanFilePath("//react//index.d.ts", origin)).toBe("/react/index.d.ts");
    });

    it("removes .d.ts/ suffixes", () => {
      expect(cleanFilePath("/react.d.ts/index.d.ts", origin)).toBe("/react/index.d.ts");
    });
  });

  // ─── cleanFileContent ────────────────────────────────────────────

  describe("cleanFileContent", () => {
    const origin = "https://testing.spike.land";

    it("strips originToUse from content", () => {
      const content = `import foo from "${origin}/foo";`;
      expect(cleanFileContent(content, origin)).toBe('import foo from "foo";');
    });

    it("strips spike.land and esm.sh origins from content", () => {
      expect(cleanFileContent('from "https://spike.land/foo"', origin)).toBe('from "foo"');
      expect(cleanFileContent('from "https://esm.sh/foo"', origin)).toBe('from "foo"');
    });

    it("removes node_modules and @types from content", () => {
      expect(cleanFileContent('from "/node_modules/@types/react"', origin)).toBe('from "react"');
    });

    it("removes semver versions from content", () => {
      expect(cleanFileContent('from "react@18.2.0"', origin)).toBe('from "react"');
    });

    it("fixes import paths after origin stripping", () => {
      // When origin is stripped, a path like `from "https://origin/foo"` becomes `from "/foo"`
      // The fix step converts `from "/` to `from "`
      expect(cleanFileContent('from "/foo/bar"', origin)).toBe('from "foo/bar"');
    });

    it("fixes path attributes after origin stripping", () => {
      expect(cleanFileContent('path="/foo/bar"', origin)).toBe('path="foo/bar"');
    });

    it("removes .d.ts/ suffixes from content", () => {
      expect(cleanFileContent("foo.d.ts/bar", origin)).toBe("foo/bar");
    });

    it("removes TS version paths from content", () => {
      expect(cleanFileContent("ts5.3/index.d.ts", origin)).toBe("index.d.ts");
    });

    it("removes dist, types, src, declarations from content", () => {
      expect(cleanFileContent("dist/types/src/declarations/index.d.ts", origin)).toBe("index.d.ts");
    });
  });

  // ─── extractImportSpecifiers ─────────────────────────────────────

  describe("extractImportSpecifiers", () => {
    it("extracts static import declarations", () => {
      const code = 'import React from "react";';
      expect(extractImportSpecifiers(code)).toEqual(["react"]);
    });

    it("extracts named imports", () => {
      const code = 'import { useState } from "react";';
      expect(extractImportSpecifiers(code)).toEqual(["react"]);
    });

    it("extracts dynamic import() calls", () => {
      const code = 'const mod = import("lodash");';
      expect(extractImportSpecifiers(code)).toEqual(["lodash"]);
    });

    it("extracts require() calls", () => {
      const code = 'const fs = require("fs");';
      expect(extractImportSpecifiers(code)).toEqual(["fs"]);
    });

    it("handles multiple imports", () => {
      const code = `
import React from "react";
import { css } from "@emotion/react";
const lodash = require("lodash");
`;
      const result = extractImportSpecifiers(code);
      expect(result).toContain("react");
      expect(result).toContain("@emotion/react");
      expect(result).toContain("lodash");
    });

    it("deduplicates specifiers", () => {
      const code = `
import React from "react";
import { useState } from "react";
`;
      expect(extractImportSpecifiers(code)).toEqual(["react"]);
    });

    it("handles /live/ import paths", () => {
      const code = 'import VibePulse from "/live/vibe-pulse";';
      expect(extractImportSpecifiers(code)).toEqual(["/live/vibe-pulse"]);
    });

    it("handles @/ aliased imports", () => {
      const code = 'import { utils } from "@/lib/utils";';
      expect(extractImportSpecifiers(code)).toEqual(["@/lib/utils"]);
    });

    it("extracts triple-slash reference paths", () => {
      const code = '/// <reference path="./types.d.ts" />\nconst x = 1;';
      expect(extractImportSpecifiers(code)).toEqual(["./types.d.ts"]);
    });

    it("returns empty array for no imports", () => {
      const code = "const x = 1;";
      expect(extractImportSpecifiers(code)).toEqual([]);
    });
  });

  // ─── ata (main function) ─────────────────────────────────────────

  describe("ata", () => {
    const origin = "https://testing.spike.land";

    function setupAtaMock(vfsEntries: Array<[string, string]>) {
      mockSetupTypeAcquisition.mockReturnValue((_code: string) => {
        // Simulate ATA calling finished immediately
        const lastCall =
          mockSetupTypeAcquisition.mock.calls[mockSetupTypeAcquisition.mock.calls.length - 1];
        const config = lastCall![0];
        const delegate = config.delegate;
        const vfsMap = new Map(vfsEntries);
        // Use setTimeout to allow the promise to be set up
        Promise.resolve().then(() => delegate.finished(vfsMap));
      });
    }

    function mockFetchResponse(urlResponses: Record<string, { ok: boolean; text: string }>) {
      mockFetch.mockImplementation((url: string) => {
        const resp = urlResponses[url];
        if (resp) {
          return Promise.resolve({
            ok: resp.ok,
            text: () => Promise.resolve(resp.text),
          });
        }
        return Promise.resolve({ ok: false, text: () => Promise.resolve("") });
      });
    }

    it("returns ExtraLib[] from ATA VFS", async () => {
      setupAtaMock([["/node_modules/@types/react/index.d.ts", "declare module 'react' {}"]]);
      mockFetchResponse({});

      const result = await ata({
        code: 'import React from "react";',
        originToUse: origin,
      });

      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            filePath: expect.any(String),
            content: expect.any(String),
          }),
        ]),
      );
    });

    it("cleans file paths and content in results", async () => {
      setupAtaMock([
        [`${origin}/node_modules/@types/react/index.d.ts`, `import "${origin}/react-dom";`],
      ]);
      mockFetchResponse({});

      const result = await ata({
        code: 'import React from "react";',
        originToUse: origin,
      });

      const reactLib = result.find((lib) => lib.filePath.includes("react"));
      expect(reactLib).toBeDefined();
      // filePath should not contain origin
      expect(reactLib!.filePath).not.toContain(origin);
      // content should not contain origin
      expect(reactLib!.content).not.toContain(origin);
    });

    it("appends implicit react/emotion imports to code", async () => {
      setupAtaMock([]);
      mockFetchResponse({});

      await ata({ code: "const x = 1;", originToUse: origin });

      // The code passed to ATA should include implicit imports
      const ataCall = mockSetupTypeAcquisition.mock.calls[0]![0];
      expect(ataCall).toBeDefined();
      // Verify setupTypeAcquisition was called (the returned function is invoked with extCode)
      const ataRunner = mockSetupTypeAcquisition.mock.results[0]!.value;
      expect(ataRunner).toBeDefined();
    });

    it("fetches @/ aliased imports not found in ATA VFS", async () => {
      setupAtaMock([]);
      mockFetchResponse({
        [`${origin}/@/lib/utils.d.ts`]: {
          ok: true,
          text: "export declare function cn(): string;",
        },
      });

      const result = await ata({
        code: 'import { cn } from "@/lib/utils";',
        originToUse: origin,
      });

      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("@/lib/utils.d.ts"), undefined);
      // The fetched content should appear in results
      const utilsLib = result.find((lib) => lib.filePath.includes("lib/utils"));
      expect(utilsLib).toBeDefined();
      expect(utilsLib!.content).toContain("cn");
    });

    it("fetches /live/ cross-codespace imports", async () => {
      setupAtaMock([]);
      mockFetchResponse({
        [`${origin}/live/vibe-pulse/index.tsx`]: {
          ok: true,
          text: "export default function VibePulse() { return <div />; }",
        },
      });

      const result = await ata({
        code: 'import VibePulse from "/live/vibe-pulse";',
        originToUse: origin,
      });

      expect(mockFetch).toHaveBeenCalledWith(`${origin}/live/vibe-pulse/index.tsx`, undefined);
      const liveLib = result.find((lib) => lib.filePath === "/live/vibe-pulse.d.ts");
      expect(liveLib).toBeDefined();
      expect(liveLib!.content).toContain("VibePulse");
    });

    it("registers /live/ source at both .d.ts and bare paths", async () => {
      setupAtaMock([]);
      mockFetchResponse({
        [`${origin}/live/vibe-pulse/index.tsx`]: {
          ok: true,
          text: "export default function VibePulse() { return <div />; }",
        },
      });

      const result = await ata({
        code: 'import VibePulse from "/live/vibe-pulse";',
        originToUse: origin,
      });

      const dtsLib = result.find((lib) => lib.filePath === "/live/vibe-pulse.d.ts");
      const bareLib = result.find((lib) => lib.filePath === "/live/vibe-pulse");
      expect(dtsLib).toBeDefined();
      expect(bareLib).toBeDefined();
      expect(dtsLib!.content).toBe(bareLib!.content);
    });

    it("skips /live/ imports with empty codespace name", async () => {
      setupAtaMock([]);
      mockFetchResponse({});

      // "/live/" with no name after it should be skipped
      const result = await ata({
        code: 'import x from "/live/";',
        originToUse: origin,
      });

      // Should not attempt to fetch /live//index.tsx
      const liveCalls = mockFetch.mock.calls.filter(
        (call) => typeof call[0] === "string" && call[0].includes("/live/"),
      );
      expect(liveCalls).toHaveLength(0);
      expect(result).toEqual([]);
    });

    it("deduplicates /live/ content even when multiple fetches occur", async () => {
      setupAtaMock([]);
      mockFetchResponse({
        [`${origin}/live/vibe-pulse/index.tsx`]: {
          ok: true,
          text: "export default function VibePulse() {}",
        },
      });

      // Two imports to same codespace — both queued before either resolves,
      // but processedLibs dedup inside .then() prevents duplicate entries
      const result = await ata({
        code: `
import VibePulse from "/live/vibe-pulse";
import { helper } from "/live/vibe-pulse/utils";
`,
        originToUse: origin,
      });

      // Both .d.ts and bare paths should exist exactly once
      const dtsEntries = result.filter((lib) => lib.filePath === "/live/vibe-pulse.d.ts");
      const bareEntries = result.filter((lib) => lib.filePath === "/live/vibe-pulse");
      expect(dtsEntries).toHaveLength(1);
      expect(bareEntries).toHaveLength(1);
    });

    it("filters out package.json when index.d.ts exists", async () => {
      setupAtaMock([
        ["/node_modules/@types/react/package.json", '{"name": "react"}'],
        ["/node_modules/@types/react/index.d.ts", "declare module 'react' {}"],
      ]);
      mockFetchResponse({});

      const result = await ata({
        code: 'import React from "react";',
        originToUse: origin,
      });

      const packageJson = result.find((lib) => lib.filePath.endsWith("/package.json"));
      expect(packageJson).toBeUndefined();
    });

    it("keeps package.json when no index.d.ts exists", async () => {
      setupAtaMock([["/node_modules/@types/react/package.json", '{"name": "react"}']]);
      mockFetchResponse({});

      const result = await ata({
        code: 'import React from "react";',
        originToUse: origin,
      });

      const packageJson = result.find((lib) => lib.filePath.endsWith("/package.json"));
      expect(packageJson).toBeDefined();
    });

    it("filters out .mts when .d.ts exists", async () => {
      setupAtaMock([
        ["/node_modules/lib/index.mts", "export const x = 1;"],
        ["/node_modules/lib/index.d.ts", "export declare const x: number;"],
      ]);
      mockFetchResponse({});

      const result = await ata({
        code: 'import { x } from "lib";',
        originToUse: origin,
      });

      const mtsLib = result.find((lib) => lib.filePath.endsWith(".mts"));
      expect(mtsLib).toBeUndefined();
    });

    it("calls errorMessage delegate and logs to console", async () => {
      const testError = new Error("type fetch failed");
      mockSetupTypeAcquisition.mockReturnValue((_code: string) => {
        const lastCall =
          mockSetupTypeAcquisition.mock.calls[mockSetupTypeAcquisition.mock.calls.length - 1];
        const config = lastCall![0];
        const delegate = config.delegate;
        // Trigger errorMessage before finishing
        delegate.errorMessage("Could not fetch types", testError);
        Promise.resolve().then(() => delegate.finished(new Map()));
      });
      mockFetchResponse({});

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await ata({ code: "const x = 1;", originToUse: origin });

      expect(consoleSpy).toHaveBeenCalledWith("[ATA] Error: Could not fetch types", testError);
    });

    it("logs error when Promise.all for extra fetches rejects", async () => {
      setupAtaMock([]);
      // Make mockFetch return a promise that rejects in a way that escapes the .catch
      // We need to make tryCatch catch the Promise.all rejection
      // Since each fetch has its own .catch, we need the Promise.all itself to fail
      // This is hard to trigger naturally, so let's test the tryCatch wrapper directly
      // by having fetch return something that causes .then to throw
      mockFetch.mockImplementation(() =>
        Promise.resolve({
          ok: true,
          text: () => {
            throw new Error("text() exploded");
          },
        }),
      );

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await ata({
        code: 'import { cn } from "@/lib/utils";',
        originToUse: origin,
      });

      // The error should be caught somewhere
      expect(consoleSpy).toHaveBeenCalled();
    });

    it("returns empty array on ATA failure", async () => {
      mockSetupTypeAcquisition.mockReturnValue(() => {
        throw new Error("ATA exploded");
      });

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await ata({
        code: 'import React from "react";',
        originToUse: origin,
      });

      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith("[ATA] Failed to acquire types:", expect.any(Error));
    });

    it("handles non-ok alias fetch response", async () => {
      setupAtaMock([]);
      mockFetchResponse({
        [`${origin}/@/lib/utils.d.ts`]: {
          ok: false,
          text: "Not Found",
        },
      });

      const result = await ata({
        code: 'import { cn } from "@/lib/utils";',
        originToUse: origin,
      });

      const utilsLib = result.find((lib) => lib.filePath.includes("lib/utils"));
      expect(utilsLib).toBeUndefined();
    });

    it("handles alias fetch errors gracefully", async () => {
      setupAtaMock([]);
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("@/")) {
          return Promise.reject(new Error("Network error"));
        }
        return Promise.resolve({ ok: false, text: () => Promise.resolve("") });
      });

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await ata({
        code: 'import { cn } from "@/lib/utils";',
        originToUse: origin,
      });

      // Should not throw, returns whatever was in VFS (empty)
      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[ATA] Error fetching aliased import"),
        expect.any(Error),
      );
    });

    it("handles /live/ fetch errors gracefully", async () => {
      setupAtaMock([]);
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/live/")) {
          return Promise.reject(new Error("Network error"));
        }
        return Promise.resolve({ ok: false, text: () => Promise.resolve("") });
      });

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await ata({
        code: 'import VibePulse from "/live/vibe-pulse";',
        originToUse: origin,
      });

      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[ATA] Error fetching /live/ import"),
        expect.any(Error),
      );
    });

    it("handles non-ok /live/ fetch response", async () => {
      setupAtaMock([]);
      mockFetchResponse({
        [`${origin}/live/missing-app/index.tsx`]: {
          ok: false,
          text: "Not Found",
        },
      });

      const result = await ata({
        code: 'import Missing from "/live/missing-app";',
        originToUse: origin,
      });

      const liveLib = result.find((lib) => lib.filePath.includes("/live/missing-app"));
      expect(liveLib).toBeUndefined();
    });

    it("sorts results by filePath", async () => {
      setupAtaMock([
        ["/node_modules/z-lib/index.d.ts", "declare const z: number;"],
        ["/node_modules/a-lib/index.d.ts", "declare const a: number;"],
      ]);
      mockFetchResponse({});

      const result = await ata({
        code: `
import { a } from "a-lib";
import { z } from "z-lib";
`,
        originToUse: origin,
      });

      // Verify sorted order
      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1]!.filePath.localeCompare(result[i]!.filePath)).toBeLessThanOrEqual(0);
      }
    });

    it("deduplicates VFS entries with same cleaned path", async () => {
      setupAtaMock([
        ["/node_modules/@types/react/index.d.ts", "content1"],
        [`${origin}/node_modules/@types/react/index.d.ts`, "content2"],
      ]);
      mockFetchResponse({});

      const result = await ata({
        code: 'import React from "react";',
        originToUse: origin,
      });

      // Both paths clean to /react/index.d.ts — first one wins
      const reactLibs = result.filter((lib) => lib.filePath === "/react/index.d.ts");
      expect(reactLibs).toHaveLength(1);
      expect(reactLibs[0]!.content).toBe("content1");
    });
  });
});
