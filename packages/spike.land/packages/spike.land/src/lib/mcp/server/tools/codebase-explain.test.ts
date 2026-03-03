import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockRegistry, getText, isError } from "../__test-utils__";
import { registerCodebaseExplainTools } from "./codebase-explain";

describe("codebase-explain tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerCodebaseExplainTools(registry, userId);
  });

  it("should register 3 codebase-explain tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(3);
    expect(registry.handlers.has("explain_overview")).toBe(true);
    expect(registry.handlers.has("explain_module")).toBe(true);
    expect(registry.handlers.has("explain_flow")).toBe(true);
  });

  it("should register all tools in orchestration category", () => {
    const mockRegister = registry.register as ReturnType<typeof vi.fn>;
    for (const call of mockRegister.mock.calls) {
      const def = call[0] as { category: string; tier: string; };
      expect(def.category).toBe("orchestration");
      expect(def.tier).toBe("free");
    }
  });

  // ── explain_overview ─────────────────────────────────────────

  describe("explain_overview", () => {
    it("should detect Next.js tech stack from package.json", async () => {
      const handler = registry.handlers.get("explain_overview")!;
      const files = [
        "src/app/page.tsx",
        "src/app/layout.tsx",
        "src/components/Header.tsx",
        "package.json",
        "next.config.ts",
        "tsconfig.json",
      ];
      const packageJson = JSON.stringify({
        dependencies: { next: "16.0.0", react: "19.0.0" },
        devDependencies: { typescript: "5.5.0", vitest: "3.0.0" },
      });
      const result = await handler({ files, package_json: packageJson });
      const text = getText(result);
      expect(text).toContain("Next.js");
      expect(text).toContain("React");
      expect(text).toContain("TypeScript");
      expect(text).toContain("Vitest");
      expect(isError(result)).toBe(false);
    });

    it("should detect tech from files when no package.json", async () => {
      const handler = registry.handlers.get("explain_overview")!;
      const files = [
        "next.config.ts",
        "tsconfig.json",
        "vitest.config.ts",
        "src/app/page.tsx",
      ];
      const result = await handler({ files });
      const text = getText(result);
      expect(text).toContain("Next.js");
      expect(text).toContain("TypeScript");
      expect(text).toContain("Vitest");
    });

    it("should not duplicate tech detected from both sources", async () => {
      const handler = registry.handlers.get("explain_overview")!;
      const files = ["next.config.ts", "tsconfig.json"];
      const packageJson = JSON.stringify({
        dependencies: { next: "16.0.0" },
        devDependencies: { typescript: "5.5.0" },
      });
      const result = await handler({ files, package_json: packageJson });
      const text = getText(result);
      // Should contain each tech only once (version from package.json)
      const nextMatches = text.match(/Next\.js/g);
      expect(nextMatches).toHaveLength(1);
    });

    it("should analyze directory structure", async () => {
      const handler = registry.handlers.get("explain_overview")!;
      const files = [
        "src/lib/utils.ts",
        "src/lib/api.ts",
        "src/components/Button.tsx",
        "tests/unit.test.ts",
      ];
      const result = await handler({ files });
      const text = getText(result);
      expect(text).toContain("src/lib");
      expect(text).toContain("src/components");
      expect(text).toContain("tests");
    });

    it("should show file count statistics", async () => {
      const handler = registry.handlers.get("explain_overview")!;
      const files = [
        "src/a.ts",
        "src/b.ts",
        "src/c.tsx",
        "README.md",
      ];
      const result = await handler({ files });
      const text = getText(result);
      expect(text).toContain("**Total files:** 4");
      expect(text).toContain(".ts");
      expect(text).toContain(".tsx");
    });

    it("should show file extension breakdown", async () => {
      const handler = registry.handlers.get("explain_overview")!;
      const files = [
        "src/a.ts",
        "src/b.ts",
        "src/c.tsx",
        "src/d.css",
        "src/e.json",
      ];
      const result = await handler({ files });
      const text = getText(result);
      expect(text).toContain("Files by Extension");
      expect(text).toContain(".ts");
      expect(text).toContain("2"); // 2 .ts files
    });

    it("should handle invalid package.json gracefully", async () => {
      const handler = registry.handlers.get("explain_overview")!;
      const files = ["src/index.ts"];
      const result = await handler({
        files,
        package_json: "not valid json {{{",
      });
      const text = getText(result);
      expect(text).toContain("Codebase Overview");
      expect(isError(result)).toBe(false);
    });

    it("should detect Docker from files", async () => {
      const handler = registry.handlers.get("explain_overview")!;
      const files = ["dockerfile", "docker-compose.yml", "src/index.ts"];
      const result = await handler({ files });
      const text = getText(result);
      expect(text).toContain("Docker");
    });

    it("should detect GitHub Actions from files", async () => {
      const handler = registry.handlers.get("explain_overview")!;
      const files = [".github/workflows/ci.yml", "src/index.ts"];
      const result = await handler({ files });
      const text = getText(result);
      expect(text).toContain("GitHub Actions");
    });

    it("should detect multiple frameworks", async () => {
      const handler = registry.handlers.get("explain_overview")!;
      const packageJson = JSON.stringify({
        dependencies: {
          express: "4.18.0",
          prisma: "5.0.0",
          zod: "3.22.0",
        },
        devDependencies: {
          jest: "29.0.0",
        },
      });
      const result = await handler({
        files: ["src/index.ts"],
        package_json: packageJson,
      });
      const text = getText(result);
      expect(text).toContain("Express");
      expect(text).toContain("Prisma");
      expect(text).toContain("Zod");
      expect(text).toContain("Jest");
    });

    it("should show 'No tech stack detected' when nothing found", async () => {
      const handler = registry.handlers.get("explain_overview")!;
      const result = await handler({ files: ["readme.txt"] });
      const text = getText(result);
      expect(text).toContain("No tech stack detected");
    });
  });

  // ── explain_module ───────────────────────────────────────────

  describe("explain_module", () => {
    it("should identify module purpose from directory name", async () => {
      const handler = registry.handlers.get("explain_module")!;
      const result = await handler({
        module_path: "src/components",
        files: ["src/components/Button.tsx", "src/components/Card.tsx"],
      });
      const text = getText(result);
      expect(text).toContain("Module: components");
      expect(text).toContain("UI components library");
    });

    it("should identify test and entry files", async () => {
      const handler = registry.handlers.get("explain_module")!;
      const result = await handler({
        module_path: "src/lib",
        files: [
          "src/lib/index.ts",
          "src/lib/utils.ts",
          "src/lib/utils.test.ts",
        ],
      });
      const text = getText(result);
      expect(text).toContain("(entry)");
      expect(text).toContain("(test)");
    });

    it("should analyze exports from entry content", async () => {
      const handler = registry.handlers.get("explain_module")!;
      const entryContent = `
export function formatDate(date: Date): string {
  return date.toISOString();
}

export const MAX_ITEMS = 100;

export default class ApiClient {}
`;
      const result = await handler({
        module_path: "src/utils",
        files: ["src/utils/index.ts"],
        entry_content: entryContent,
      });
      const text = getText(result);
      expect(text).toContain("formatDate");
      expect(text).toContain("MAX_ITEMS");
      expect(text).toContain("ApiClient");
      expect(text).toContain("default");
    });

    it("should analyze dependencies from entry content", async () => {
      const handler = registry.handlers.get("explain_module")!;
      const entryContent = `
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { helper } from "./helper";
`;
      const result = await handler({
        module_path: "src/services",
        files: ["src/services/index.ts"],
        entry_content: entryContent,
      });
      const text = getText(result);
      expect(text).toContain("**External:**");
      expect(text).toContain("zod");
      expect(text).toContain("**Internal:**");
      expect(text).toContain("@/lib/prisma");
      expect(text).toContain("./helper");
    });

    it("should detect patterns in module", async () => {
      const handler = registry.handlers.get("explain_module")!;
      const entryContent = `
import { z } from "zod";
export const schema = z.object({ name: z.string() });
export function validate() {}
`;
      const result = await handler({
        module_path: "src/validators",
        files: [
          "src/validators/index.ts",
          "src/validators/auth.test.ts",
          "src/validators/types.ts",
        ],
        entry_content: entryContent,
      });
      const text = getText(result);
      expect(text).toContain("Has test coverage");
      expect(text).toContain("Uses barrel exports (index file)");
      expect(text).toContain("Has dedicated type definitions");
      expect(text).toContain("Uses Zod schema validation");
      expect(text).toContain("Uses named exports");
    });

    it("should handle module without entry content", async () => {
      const handler = registry.handlers.get("explain_module")!;
      const result = await handler({
        module_path: "src/hooks",
        files: ["src/hooks/useAuth.ts", "src/hooks/useTheme.ts"],
      });
      const text = getText(result);
      expect(text).toContain("Module: hooks");
      expect(text).toContain("Custom React hooks");
      // Should not have Exports or Dependencies sections
      expect(text).not.toContain("## Exports");
      expect(text).not.toContain("## Dependencies");
    });

    it("should infer purpose for known directories", async () => {
      const handler = registry.handlers.get("explain_module")!;
      const knownDirs: Record<string, string> = {
        api: "API routes and handlers",
        middleware: "Request/response middleware",
        workers: "Web Workers / background tasks",
        mcp: "Model Context Protocol implementation",
      };
      for (const [dir, expected] of Object.entries(knownDirs)) {
        const result = await handler({
          module_path: `src/${dir}`,
          files: [`src/${dir}/index.ts`],
        });
        expect(getText(result)).toContain(expected);
      }
    });

    it("should handle unknown directory names", async () => {
      const handler = registry.handlers.get("explain_module")!;
      const result = await handler({
        module_path: "src/foobar",
        files: ["src/foobar/main.ts"],
      });
      const text = getText(result);
      expect(text).toContain("foobar");
    });

    it("should detect React Context pattern", async () => {
      const handler = registry.handlers.get("explain_module")!;
      const entryContent = `
import { createContext, useContext } from "react";
export const ThemeContext = createContext({});
`;
      const result = await handler({
        module_path: "src/providers",
        files: ["src/providers/index.tsx"],
        entry_content: entryContent,
      });
      const text = getText(result);
      expect(text).toContain("Provides React Context");
    });
  });

  // ── explain_flow ─────────────────────────────────────────────

  describe("explain_flow", () => {
    it("should extract ES6 imports", async () => {
      const handler = registry.handlers.get("explain_flow")!;
      const content = `
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "./helpers";
`;
      const result = await handler({
        file_content: content,
        file_path: "src/components/MyComponent.tsx",
      });
      const text = getText(result);
      expect(text).toContain("react");
      expect(text).toContain("@/components/ui/button");
      expect(text).toContain("./helpers");
    });

    it("should extract dynamic imports", async () => {
      const handler = registry.handlers.get("explain_flow")!;
      const content = `
const prisma = (await import("@/lib/prisma")).default;
const mod = await import("./heavy-module");
`;
      const result = await handler({
        file_content: content,
        file_path: "src/services/loader.ts",
      });
      const text = getText(result);
      expect(text).toContain("@/lib/prisma");
      expect(text).toContain("./heavy-module");
    });

    it("should extract require statements", async () => {
      const handler = registry.handlers.get("explain_flow")!;
      const content = `
const fs = require("node:fs");
const path = require("node:path");
`;
      const result = await handler({
        file_content: content,
        file_path: "scripts/build.js",
      });
      const text = getText(result);
      expect(text).toContain("node:fs");
      expect(text).toContain("node:path");
    });

    it("should extract exports", async () => {
      const handler = registry.handlers.get("explain_flow")!;
      const content = `
export function MyComponent() {
  return <div>Hello</div>;
}

export const CONSTANT = 42;
export type MyType = { name: string };
export interface MyInterface { id: number; }
export class MyClass {}
export default MyComponent;
`;
      const result = await handler({
        file_content: content,
        file_path: "src/components/MyComponent.tsx",
      });
      const text = getText(result);
      expect(text).toContain("MyComponent");
      expect(text).toContain("CONSTANT");
      expect(text).toContain("MyType");
      expect(text).toContain("MyInterface");
      expect(text).toContain("MyClass");
      expect(text).toContain("default");
    });

    it("should extract re-exports", async () => {
      const handler = registry.handlers.get("explain_flow")!;
      const content = `
export { getText, isError } from "./assertions";
export { createMockRegistry } from "./mock-registry";
`;
      const result = await handler({
        file_content: content,
        file_path: "src/test-utils/index.ts",
      });
      const text = getText(result);
      expect(text).toContain("getText");
      expect(text).toContain("isError");
      expect(text).toContain("createMockRegistry");
    });

    it("should extract function definitions", async () => {
      const handler = registry.handlers.get("explain_flow")!;
      const content = `
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "./helpers";

export function MyComponent() {
  const [state, setState] = useState(0);
  return <Button onClick={() => setState(s => s + 1)}>{state}</Button>;
}

function helperFn() {
  return true;
}

export default MyComponent;
`;
      const result = await handler({
        file_content: content,
        file_path: "src/components/MyComponent.tsx",
      });
      const text = getText(result);
      expect(text).toContain("MyComponent");
      expect(text).toContain("helperFn");
    });

    it("should build dependency chain", async () => {
      const handler = registry.handlers.get("explain_flow")!;
      const content = `
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { validate } from "./validate";

export function createUser() {}
export function deleteUser() {}
`;
      const result = await handler({
        file_content: content,
        file_path: "src/services/user.ts",
      });
      const text = getText(result);
      expect(text).toContain("Dependency Chain");
      expect(text).toContain("External:");
      expect(text).toContain("<- zod");
      expect(text).toContain("Internal:");
      expect(text).toContain("<- @/lib/prisma");
      expect(text).toContain("<- ./validate");
      expect(text).toContain("Exports:");
      expect(text).toContain("-> createUser");
      expect(text).toContain("-> deleteUser");
    });

    it("should handle file with no imports", async () => {
      const handler = registry.handlers.get("explain_flow")!;
      const content = `
export const PI = 3.14159;
export const E = 2.71828;
`;
      const result = await handler({
        file_content: content,
        file_path: "src/constants.ts",
      });
      const text = getText(result);
      expect(text).toContain("No imports detected");
      expect(text).toContain("No dependency chain (standalone file)");
    });

    it("should handle file with no exports", async () => {
      const handler = registry.handlers.get("explain_flow")!;
      const content = `
import { init } from "./setup";
init();
`;
      const result = await handler({
        file_content: content,
        file_path: "src/bootstrap.ts",
      });
      const text = getText(result);
      expect(text).toContain("No exports detected");
    });

    it("should handle file with no functions", async () => {
      const handler = registry.handlers.get("explain_flow")!;
      const content = `
export const CONFIG = { port: 3000 };
export type AppConfig = typeof CONFIG;
`;
      const result = await handler({
        file_content: content,
        file_path: "src/config.ts",
      });
      const text = getText(result);
      expect(text).toContain("No function definitions detected");
    });

    it("should deduplicate imports from different patterns", async () => {
      const handler = registry.handlers.get("explain_flow")!;
      const content = `
import { something } from "react";
const lazy = await import("react");
`;
      const result = await handler({
        file_content: content,
        file_path: "src/app.tsx",
      });
      const text = getText(result);
      // Should have "react" only once in Imports section
      const importsSection = text.split("## Imports")[1]!.split(
        "## Exports",
      )[0]!;
      const reactMatches = importsSection.match(/`react`/g);
      expect(reactMatches).toHaveLength(1);
    });

    it("should extract async function definitions", async () => {
      const handler = registry.handlers.get("explain_flow")!;
      const content = `
export async function fetchData() {
  return await fetch("/api");
}
`;
      const result = await handler({
        file_content: content,
        file_path: "src/api.ts",
      });
      const text = getText(result);
      expect(text).toContain("fetchData");
    });

    it("should show file path in output", async () => {
      const handler = registry.handlers.get("explain_flow")!;
      const result = await handler({
        file_content: "const x = 1;",
        file_path: "src/deep/nested/file.ts",
      });
      const text = getText(result);
      expect(text).toContain("src/deep/nested/file.ts");
      expect(text).toContain("file.ts");
    });

    it("should handle export { x as y } renaming", async () => {
      const handler = registry.handlers.get("explain_flow")!;
      const content = `
const internal = () => {};
export { internal as publicApi };
`;
      const result = await handler({
        file_content: content,
        file_path: "src/mod.ts",
      });
      const text = getText(result);
      expect(text).toContain("publicApi");
    });

    it("should extract arrow function definitions", async () => {
      const handler = registry.handlers.get("explain_flow")!;
      const content = `
export const fetchUser = async (id: string): Promise<User> => {
  return db.find(id);
};
const processItem = (item: Item) => item.value;
`;
      const result = await handler({
        file_content: content,
        file_path: "src/helpers.ts",
      });
      const text = getText(result);
      expect(text).toContain("fetchUser");
    });

    it("should handle file with only internal imports (no external)", async () => {
      const handler = registry.handlers.get("explain_flow")!;
      const content = `
import { helper } from "./helper";
import { utils } from "../utils";
import { config } from "@/lib/config";

export function main() {}
`;
      const result = await handler({
        file_content: content,
        file_path: "src/main.ts",
      });
      const text = getText(result);
      expect(text).toContain("Internal:");
      expect(text).toContain("Exports:");
      // Should not have External section
      expect(text).not.toContain("External:");
    });

    it("should not duplicate exports across patterns", async () => {
      const handler = registry.handlers.get("explain_flow")!;
      const content = `
export function myFunc() {}
export function myFunc() {} // duplicate
export const myConst = 1;
export const myConst = 2; // duplicate
`;
      const result = await handler({
        file_content: content,
        file_path: "src/dedup.ts",
      });
      const text = getText(result);
      const exportsSection = text.split("## Exports")[1]!.split(
        "## Functions",
      )[0]!;
      const myFuncMatches = exportsSection.match(/`myFunc`/g);
      expect(myFuncMatches).toHaveLength(1);
    });

    it("should not duplicate functions across patterns", async () => {
      const handler = registry.handlers.get("explain_flow")!;
      const content = `
export function doWork() {}
`;
      const result = await handler({
        file_content: content,
        file_path: "src/work.ts",
      });
      const text = getText(result);
      const functionsSection = text.split("## Functions")[1]!.split(
        "## Dependency",
      )[0]!;
      const doWorkMatches = functionsSection.match(/`doWork`/g);
      expect(doWorkMatches).toHaveLength(1);
    });
  });

  // ── detectTechFromFiles additional branches ─────────────────────

  describe("explain_overview - additional file detection", () => {
    it("should detect Jest config from files", async () => {
      const handler = registry.handlers.get("explain_overview")!;
      const files = ["jest.config.ts", "src/index.ts"];
      const result = await handler({ files });
      expect(getText(result)).toContain("Jest");
    });

    it("should detect Jest config .js variant", async () => {
      const handler = registry.handlers.get("explain_overview")!;
      const files = ["jest.config.js", "src/index.ts"];
      const result = await handler({ files });
      expect(getText(result)).toContain("Jest");
    });

    it("should detect Vite config from files", async () => {
      const handler = registry.handlers.get("explain_overview")!;
      const files = ["vite.config.ts", "src/index.ts"];
      const result = await handler({ files });
      expect(getText(result)).toContain("Vite");
    });

    it("should detect Vite config .js variant", async () => {
      const handler = registry.handlers.get("explain_overview")!;
      const files = ["vite.config.js", "src/index.ts"];
      const result = await handler({ files });
      expect(getText(result)).toContain("Vite");
    });

    it("should detect webpack config from files", async () => {
      const handler = registry.handlers.get("explain_overview")!;
      const files = ["webpack.config.js", "src/index.ts"];
      const result = await handler({ files });
      expect(getText(result)).toContain("webpack");
    });

    it("should detect webpack config .ts variant", async () => {
      const handler = registry.handlers.get("explain_overview")!;
      const files = ["webpack.config.ts", "src/index.ts"];
      const result = await handler({ files });
      expect(getText(result)).toContain("webpack");
    });

    it("should detect Tailwind CSS config from files", async () => {
      const handler = registry.handlers.get("explain_overview")!;
      const files = ["tailwind.config.ts", "src/index.ts"];
      const result = await handler({ files });
      expect(getText(result)).toContain("Tailwind CSS");
    });

    it("should detect Tailwind CSS config .js variant", async () => {
      const handler = registry.handlers.get("explain_overview")!;
      const files = ["tailwind.config.js", "src/index.ts"];
      const result = await handler({ files });
      expect(getText(result)).toContain("Tailwind CSS");
    });

    it("should detect Docker from docker-compose.yaml", async () => {
      const handler = registry.handlers.get("explain_overview")!;
      const files = ["docker-compose.yaml", "src/index.ts"];
      const result = await handler({ files });
      expect(getText(result)).toContain("Docker");
    });

    it("should detect Turborepo from turbo.json", async () => {
      const handler = registry.handlers.get("explain_overview")!;
      const files = ["turbo.json", "src/index.ts"];
      const result = await handler({ files });
      expect(getText(result)).toContain("Turborepo");
    });

    it("should detect Prisma from prisma/schema.prisma", async () => {
      const handler = registry.handlers.get("explain_overview")!;
      const files = ["prisma/schema.prisma", "src/index.ts"];
      const result = await handler({ files });
      expect(getText(result)).toContain("Prisma");
    });

    it("should detect Storybook from .storybook directory", async () => {
      const handler = registry.handlers.get("explain_overview")!;
      const files = [".storybook/main.ts", "src/index.ts"];
      const result = await handler({ files });
      expect(getText(result)).toContain("Storybook");
    });

    it("should handle files with no extension", async () => {
      const handler = registry.handlers.get("explain_overview")!;
      const files = ["Makefile", "Dockerfile"];
      const result = await handler({ files });
      const text = getText(result);
      expect(text).toContain("**Total files:** 2");
    });

    it("should handle files without directories", async () => {
      const handler = registry.handlers.get("explain_overview")!;
      const files = ["README.md", "LICENSE"];
      const result = await handler({ files });
      const text = getText(result);
      expect(text).toContain("**Total files:** 2");
    });

    it("should handle second-level child dir with 0 files below it", async () => {
      const handler = registry.handlers.get("explain_overview")!;
      const files = ["src/lib/index.ts"];
      const result = await handler({ files });
      const text = getText(result);
      // src/lib is a second-level dir; the file is at that level, not below it
      expect(text).toContain("src/");
    });
  });

  // ── explain_module - additional edge cases ──────────────────────

  describe("explain_module - additional patterns", () => {
    it("should handle module with no exports in entry content", async () => {
      const handler = registry.handlers.get("explain_module")!;
      const entryContent = `
import { something } from "lib";
const internal = something();
`;
      const result = await handler({
        module_path: "src/bootstrap",
        files: ["src/bootstrap/index.ts"],
        entry_content: entryContent,
      });
      const text = getText(result);
      expect(text).toContain("No named exports detected");
    });

    it("should handle module with no dependencies in entry content", async () => {
      const handler = registry.handlers.get("explain_module")!;
      const entryContent = `
export const VALUE = 42;
`;
      const result = await handler({
        module_path: "src/constants",
        files: ["src/constants/index.ts"],
        entry_content: entryContent,
      });
      const text = getText(result);
      expect(text).toContain("No dependencies detected");
    });

    it("should handle module with only external dependencies", async () => {
      const handler = registry.handlers.get("explain_module")!;
      const entryContent = `
import { z } from "zod";
export const schema = z.string();
`;
      const result = await handler({
        module_path: "src/schemas",
        files: ["src/schemas/index.ts"],
        entry_content: entryContent,
      });
      const text = getText(result);
      expect(text).toContain("**External:**");
      expect(text).not.toContain("**Internal:**");
    });

    it("should detect .spec. files as tests", async () => {
      const handler = registry.handlers.get("explain_module")!;
      const result = await handler({
        module_path: "src/lib",
        files: ["src/lib/utils.spec.ts"],
      });
      const text = getText(result);
      expect(text).toContain("(test)");
    });

    it("should detect main.ts as entry file", async () => {
      const handler = registry.handlers.get("explain_module")!;
      const result = await handler({
        module_path: "src/app",
        files: ["src/app/main.ts"],
      });
      const text = getText(result);
      expect(text).toContain("(entry)");
    });

    it("should detect no patterns when module has no tests/index/types/entry", async () => {
      const handler = registry.handlers.get("explain_module")!;
      const result = await handler({
        module_path: "src/misc",
        files: ["src/misc/helper.ts"],
      });
      const text = getText(result);
      expect(text).toContain("No notable patterns detected");
    });

    it("should use modulePath as moduleName when no slash present", async () => {
      const handler = registry.handlers.get("explain_module")!;
      const result = await handler({
        module_path: "standalone",
        files: ["standalone/file.ts"],
      });
      const text = getText(result);
      expect(text).toContain("Module: standalone");
    });

    it("should handle export default pattern detection", async () => {
      const handler = registry.handlers.get("explain_module")!;
      const entryContent = `export default function App() {}`;
      const result = await handler({
        module_path: "src/app",
        files: ["src/app/index.ts"],
        entry_content: entryContent,
      });
      const text = getText(result);
      expect(text).toContain("Uses default export");
    });
  });

  // ── Dedup / fallback branches in extraction functions ───────────

  describe("explain_flow - dedup and fallback branches", () => {
    it("should deduplicate ES6 static imports of same module", async () => {
      const handler = registry.handlers.get("explain_flow")!;
      const content = `
import { a } from "shared";
import { b } from "shared";
`;
      const result = await handler({
        file_content: content,
        file_path: "src/dup.ts",
      });
      const text = getText(result);
      const importsSection = text.split("## Imports")[1]!.split(
        "## Exports",
      )[0]!;
      const sharedMatches = importsSection.match(/`shared`/g);
      expect(sharedMatches).toHaveLength(1);
    });

    it("should deduplicate require of same module already imported via ES6", async () => {
      const handler = registry.handlers.get("explain_flow")!;
      const content = `
import { something } from "lodash";
const _ = require("lodash");
`;
      const result = await handler({
        file_content: content,
        file_path: "src/mixed.ts",
      });
      const text = getText(result);
      const importsSection = text.split("## Imports")[1]!.split(
        "## Exports",
      )[0]!;
      const lodashMatches = importsSection.match(/`lodash`/g);
      expect(lodashMatches).toHaveLength(1);
    });

    it("should deduplicate export function appearing twice", async () => {
      const handler = registry.handlers.get("explain_flow")!;
      // This triggers the seen.has() branch in extractExports for fnPattern
      const content = `
export function doStuff() {}
// overload signature
export function doStuff(arg: string) {}
`;
      const result = await handler({
        file_content: content,
        file_path: "src/overload.ts",
      });
      const text = getText(result);
      const exportsSection = text.split("## Exports")[1]!.split(
        "## Functions",
      )[0]!;
      const matches = exportsSection.match(/`doStuff`/g);
      expect(matches).toHaveLength(1);
    });

    it("should deduplicate export const appearing in both varPattern and namedPattern", async () => {
      const handler = registry.handlers.get("explain_flow")!;
      const content = `
export const VALUE = 1;
export { VALUE };
`;
      const result = await handler({
        file_content: content,
        file_path: "src/reexport.ts",
      });
      const text = getText(result);
      const exportsSection = text.split("## Exports")[1]!.split(
        "## Functions",
      )[0]!;
      const matches = exportsSection.match(/`VALUE`/g);
      expect(matches).toHaveLength(1);
    });

    it("should deduplicate export class with same name", async () => {
      const handler = registry.handlers.get("explain_flow")!;
      const content = `
export class MyService {}
export { MyService };
`;
      const result = await handler({
        file_content: content,
        file_path: "src/svc.ts",
      });
      const text = getText(result);
      const exportsSection = text.split("## Exports")[1]!.split(
        "## Functions",
      )[0]!;
      const matches = exportsSection.match(/`MyService`/g);
      expect(matches).toHaveLength(1);
    });

    it("should deduplicate export interface/type with same name", async () => {
      const handler = registry.handlers.get("explain_flow")!;
      const content = `
export interface Config {}
export { Config };
`;
      const result = await handler({
        file_content: content,
        file_path: "src/types.ts",
      });
      const text = getText(result);
      const exportsSection = text.split("## Exports")[1]!.split(
        "## Functions",
      )[0]!;
      const configMatches = exportsSection.match(/`Config`/g);
      expect(configMatches).toHaveLength(1);
    });

    it("should deduplicate default export when already seen via export default class", async () => {
      const handler = registry.handlers.get("explain_flow")!;
      const content = `
export default class App {}
export default App;
`;
      const result = await handler({
        file_content: content,
        file_path: "src/app.ts",
      });
      const text = getText(result);
      const exportsSection = text.split("## Exports")[1]!.split(
        "## Functions",
      )[0]!;
      const defaultMatches = exportsSection.match(/`default`/g);
      expect(defaultMatches).toHaveLength(1);
    });

    it("should deduplicate named export { } items already seen", async () => {
      const handler = registry.handlers.get("explain_flow")!;
      const content = `
export function foo() {}
export const bar = 1;
export { foo, bar };
`;
      const result = await handler({
        file_content: content,
        file_path: "src/barrel.ts",
      });
      const text = getText(result);
      const exportsSection = text.split("## Exports")[1]!.split(
        "## Functions",
      )[0]!;
      const fooMatches = exportsSection.match(/`foo`/g);
      expect(fooMatches).toHaveLength(1);
    });

    it("should deduplicate arrow function that also appears as function declaration", async () => {
      const handler = registry.handlers.get("explain_flow")!;
      const content = `
function helper() {}
const helper = () => {};
`;
      const result = await handler({
        file_content: content,
        file_path: "src/fns.ts",
      });
      const text = getText(result);
      const functionsSection = text.split("## Functions")[1]!.split(
        "## Dependency",
      )[0]!;
      const helperMatches = functionsSection.match(/`helper`/g);
      expect(helperMatches).toHaveLength(1);
    });

    it("should handle tech stack entry without version (undefined)", async () => {
      const handler = registry.handlers.get("explain_overview")!;
      // Package with deps missing version
      const packageJson = JSON.stringify({
        dependencies: { react: "18.0.0" },
      });
      const result = await handler({
        files: ["src/index.ts"],
        package_json: packageJson,
      });
      const text = getText(result);
      expect(text).toContain("React");
    });

    it("should handle file path without slash in modulePath fallback", async () => {
      const handler = registry.handlers.get("explain_module")!;
      const result = await handler({
        module_path: "root",
        files: ["root"],
      });
      const text = getText(result);
      expect(text).toContain("Module: root");
    });

    it("should handle file basename fallback when no slash in path", async () => {
      const handler = registry.handlers.get("explain_module")!;
      const result = await handler({
        module_path: "src/lib",
        files: ["noSlashFile"],
      });
      const text = getText(result);
      expect(text).toContain("noSlashFile");
    });

    it("should handle file path in detectPatterns when no slash in basename", async () => {
      const handler = registry.handlers.get("explain_module")!;
      const result = await handler({
        module_path: "src/mod",
        files: ["indexfile"],
      });
      const text = getText(result);
      // "indexfile" doesn't start with "index.", so no barrel pattern
      expect(text).toContain("No notable patterns detected");
    });
  });

  // ── extractExports dedup and fallback branches ───────────────────

  describe("explain_flow - extractExports uncovered branches", () => {
    it("should deduplicate class export already seen from named export", async () => {
      const handler = registry.handlers.get("explain_flow")!;
      // export { MyClass } appears first (namedPattern won't help since classPattern runs first),
      // so we need a class name that also appears via another pattern before classPattern.
      // export const MyWidget = ... then export default class MyWidget — const pattern sees it first
      const content = `
export const MyWidget = 1;
export default class MyWidget {}
`;
      const result = await handler({
        file_content: content,
        file_path: "src/widget.ts",
      });
      const text = getText(result);
      const exportsSection = text.split("## Exports")[1]!.split(
        "## Functions",
      )[0]!;
      const widgetMatches = exportsSection.match(/`MyWidget`/g);
      expect(widgetMatches).toHaveLength(1);
    });

    it("should deduplicate type/interface export already seen from another pattern", async () => {
      const handler = registry.handlers.get("explain_flow")!;
      // export const Config = ... then export interface Config — const pattern sees it first
      const content = `
export const Config = {};
export interface Config {}
`;
      const result = await handler({
        file_content: content,
        file_path: "src/cfg.ts",
      });
      const text = getText(result);
      const exportsSection = text.split("## Exports")[1]!.split(
        "## Functions",
      )[0]!;
      const configMatches = exportsSection.match(/`Config`/g);
      expect(configMatches).toHaveLength(1);
    });

    it("should not include 'default' export when content has no export default", async () => {
      const handler = registry.handlers.get("explain_flow")!;
      const content = `
export function helper() {}
export const VALUE = 42;
`;
      const result = await handler({
        file_content: content,
        file_path: "src/nodefault.ts",
      });
      const text = getText(result);
      const exportsSection = text.split("## Exports")[1]!.split(
        "## Functions",
      )[0]!;
      expect(exportsSection).not.toContain("`default`");
      expect(exportsSection).toContain("`helper`");
      expect(exportsSection).toContain("`VALUE`");
    });

    it("should deduplicate 'default' when already captured by earlier pattern", async () => {
      const handler = registry.handlers.get("explain_flow")!;
      // "export default class default" — classPattern captures "default" as (\w+),
      // adding it to seen before the export default check at line 636 runs
      const content = `export default class default {}`;
      const result = await handler({
        file_content: content,
        file_path: "src/dedup-default.ts",
      });
      const text = getText(result);
      const exportsSection = text.split("## Exports")[1]!.split(
        "## Functions",
      )[0]!;
      const defaultMatches = exportsSection.match(/`default`/g);
      expect(defaultMatches).toHaveLength(1);
    });
  });
});
