import { beforeEach, describe, expect, it, vi } from "vitest";

// vi.hoisted() for variables used inside vi.mock() factories
const mockGetSession = vi.hoisted(() => vi.fn());
const mockGetOrCreateSession = vi.hoisted(() => vi.fn());
const mockUpsertSession = vi.hoisted(() => vi.fn());

vi.mock("@/lib/codespace/session-service", () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
  getOrCreateSession: (...args: unknown[]) => mockGetOrCreateSession(...args),
  upsertSession: (...args: unknown[]) => mockUpsertSession(...args),
}));

import { createMockRegistry, getText, isError } from "../__test-utils__";
import { registerCodespaceTemplateTools } from "./codespace-templates";

describe("codespace-template tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.resetAllMocks();
    registry = createMockRegistry();
    registerCodespaceTemplateTools(registry, userId);
  });

  // ── Registration ────────────────────────────────────────────────────

  it("should register 4 codespace-template tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(4);
    expect(registry.handlers.has("codespace_list_templates")).toBe(true);
    expect(registry.handlers.has("codespace_create_from_template")).toBe(true);
    expect(registry.handlers.has("codespace_get_dependencies")).toBe(true);
    expect(registry.handlers.has("codespace_add_dependency")).toBe(true);
  });

  // ── codespace_list_templates ────────────────────────────────────────

  describe("codespace_list_templates", () => {
    it("should list all templates when no category filter provided", async () => {
      const handler = registry.handlers.get("codespace_list_templates")!;
      const result = await handler({});
      expect(isError(result)).toBe(false);
      const text = getText(result);
      expect(text).toContain("Available Templates");
      // All categories should appear
      expect(text).toContain("blank");
      expect(text).toContain("react");
      expect(text).toContain("dashboard");
      expect(text).toContain("game");
    });

    it("should filter templates by category 'react'", async () => {
      const handler = registry.handlers.get("codespace_list_templates")!;
      const result = await handler({ category: "react" });
      expect(isError(result)).toBe(false);
      const text = getText(result);
      expect(text).toContain("react");
      expect(text).not.toContain("game");
    });

    it("should filter templates by category 'blank'", async () => {
      const handler = registry.handlers.get("codespace_list_templates")!;
      const result = await handler({ category: "blank" });
      expect(isError(result)).toBe(false);
      const text = getText(result);
      expect(text).toContain("Blank");
      expect(text).toContain("Available Templates (1)");
    });

    it("should filter templates by category 'game'", async () => {
      const handler = registry.handlers.get("codespace_list_templates")!;
      const result = await handler({ category: "game" });
      expect(isError(result)).toBe(false);
      const text = getText(result);
      expect(text).toContain("game");
    });

    it("should filter templates by category 'dashboard'", async () => {
      const handler = registry.handlers.get("codespace_list_templates")!;
      const result = await handler({ category: "dashboard" });
      expect(isError(result)).toBe(false);
      const text = getText(result);
      expect(text).toContain("dashboard");
    });

    it("should include dependency information in template listing", async () => {
      const handler = registry.handlers.get("codespace_list_templates")!;
      const result = await handler({ category: "next" });
      expect(isError(result)).toBe(false);
      const text = getText(result);
      // next-api-route template has next and @types/node deps
      expect(text).toContain("next");
    });

    it("should show 'none' for templates with no dependencies", async () => {
      const handler = registry.handlers.get("codespace_list_templates")!;
      const result = await handler({ category: "blank" });
      expect(isError(result)).toBe(false);
      expect(getText(result)).toContain("none");
    });
  });

  // ── codespace_create_from_template ──────────────────────────────────

  describe("codespace_create_from_template", () => {
    it("should create a codespace from a known template", async () => {
      mockGetOrCreateSession.mockResolvedValue({
        codeSpace: "my-app",
        code: "",
        transpiled: "",
        html: "",
        css: "",
        messages: [],
        hash: "hash1",
      });
      mockUpsertSession.mockResolvedValue({
        codeSpace: "my-app",
        hash: "hash2",
        code: "new",
        transpiled: "",
        html: "",
        css: "",
        messages: [],
      });

      const handler = registry.handlers.get("codespace_create_from_template")!;
      const result = await handler({
        template_id: "blank",
        name: "my-app",
      });

      expect(isError(result)).toBe(false);
      const text = getText(result);
      expect(text).toContain("Codespace Created from Template");
      expect(text).toContain("my-app");
      expect(text).toContain("blank");
      expect(mockGetOrCreateSession).toHaveBeenCalledWith("my-app");
      expect(mockUpsertSession).toHaveBeenCalled();
    });

    it("should return error for unknown template_id", async () => {
      const handler = registry.handlers.get("codespace_create_from_template")!;
      const result = await handler({
        template_id: "nonexistent-template",
        name: "my-app",
      });

      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("not found");
      expect(getText(result)).toContain("nonexistent-template");
    });

    it("should use provided description over template default", async () => {
      mockGetOrCreateSession.mockResolvedValue({
        codeSpace: "my-counter",
        code: "",
        transpiled: "",
        html: "",
        css: "",
        messages: [],
        hash: "h",
      });
      mockUpsertSession.mockResolvedValue({
        codeSpace: "my-counter",
        hash: "h2",
        code: "x",
        transpiled: "",
        html: "",
        css: "",
        messages: [],
      });

      const handler = registry.handlers.get("codespace_create_from_template")!;
      const result = await handler({
        template_id: "react-counter",
        name: "my-counter",
        description: "Custom project description",
      });

      expect(isError(result)).toBe(false);
      expect(getText(result)).toContain("Custom project description");
    });

    it("should return error when session service throws", async () => {
      mockGetOrCreateSession.mockRejectedValue(new Error("DB unavailable"));

      const handler = registry.handlers.get("codespace_create_from_template")!;
      const result = await handler({
        template_id: "blank",
        name: "my-app",
      });

      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("Error creating codespace");
      expect(getText(result)).toContain("DB unavailable");
    });

    it("should list file paths created by the template", async () => {
      mockGetOrCreateSession.mockResolvedValue({
        codeSpace: "stats-app",
        code: "",
        transpiled: "",
        html: "",
        css: "",
        messages: [],
        hash: "h",
      });
      mockUpsertSession.mockResolvedValue({
        codeSpace: "stats-app",
        hash: "h2",
        code: "x",
        transpiled: "",
        html: "",
        css: "",
        messages: [],
      });

      const handler = registry.handlers.get("codespace_create_from_template")!;
      // dashboard-stats has 2 files
      const result = await handler({
        template_id: "dashboard-stats",
        name: "stats-app",
      });

      expect(isError(result)).toBe(false);
      const text = getText(result);
      expect(text).toContain("Files created (2)");
      expect(text).toContain("/src/App.tsx");
      expect(text).toContain("/src/StatCard.tsx");
    });

    it("should mention suggested dependencies when template has them", async () => {
      mockGetOrCreateSession.mockResolvedValue({
        codeSpace: "dash-app",
        code: "",
        transpiled: "",
        html: "",
        css: "",
        messages: [],
        hash: "h",
      });
      mockUpsertSession.mockResolvedValue({
        codeSpace: "dash-app",
        hash: "h2",
        code: "x",
        transpiled: "",
        html: "",
        css: "",
        messages: [],
      });

      const handler = registry.handlers.get("codespace_create_from_template")!;
      const result = await handler({
        template_id: "dashboard-stats",
        name: "dash-app",
      });

      expect(isError(result)).toBe(false);
      expect(getText(result)).toContain("recharts");
    });
  });

  // ── codespace_get_dependencies ───────────────────────────────────────

  describe("codespace_get_dependencies", () => {
    it("should detect external imports from codespace code", async () => {
      mockGetSession.mockResolvedValue({
        codeSpace: "my-app",
        code:
          `import { motion } from "framer-motion";\nimport axios from "axios";\nexport default function App() { return null; }\n`,
        transpiled: "",
        html: "",
        css: "",
        messages: [],
        hash: "h",
      });

      const handler = registry.handlers.get("codespace_get_dependencies")!;
      const result = await handler({ codespace_id: "my-app" });

      expect(isError(result)).toBe(false);
      const text = getText(result);
      expect(text).toContain("framer-motion");
      expect(text).toContain("axios");
    });

    it("should exclude built-in react and react-dom from package list", async () => {
      mockGetSession.mockResolvedValue({
        codeSpace: "my-app",
        code:
          `import React from "react";\nimport { createRoot } from "react-dom/client";\nexport default function App() { return null; }\n`,
        transpiled: "",
        html: "",
        css: "",
        messages: [],
        hash: "h",
      });

      const handler = registry.handlers.get("codespace_get_dependencies")!;
      const result = await handler({ codespace_id: "my-app" });

      expect(isError(result)).toBe(false);
      const text = getText(result);
      // Should report no external dependencies (react/react-dom are excluded)
      expect(text).toContain("No external npm dependencies detected");
      // Should NOT list them as package entries (lines starting with "- **")
      expect(text).not.toMatch(/^- \*\*react/m);
      expect(text).not.toMatch(/^- \*\*react-dom/m);
    });

    it("should return error when codespace not found", async () => {
      mockGetSession.mockResolvedValue(null);

      const handler = registry.handlers.get("codespace_get_dependencies")!;
      const result = await handler({ codespace_id: "missing-cs" });

      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("not found");
      expect(getText(result)).toContain("missing-cs");
    });

    it("should return error when session service throws", async () => {
      mockGetSession.mockRejectedValue(new Error("DB error"));

      const handler = registry.handlers.get("codespace_get_dependencies")!;
      const result = await handler({ codespace_id: "my-app" });

      expect(isError(result)).toBe(true);
    });

    it("should handle codespace with no imports", async () => {
      mockGetSession.mockResolvedValue({
        codeSpace: "pure-app",
        code: "export default function App() { return null; }\n",
        transpiled: "",
        html: "",
        css: "",
        messages: [],
        hash: "h",
      });

      const handler = registry.handlers.get("codespace_get_dependencies")!;
      const result = await handler({ codespace_id: "pure-app" });

      expect(isError(result)).toBe(false);
      expect(getText(result)).toContain("No external npm dependencies detected");
    });

    it("should detect scoped package names correctly", async () => {
      mockGetSession.mockResolvedValue({
        codeSpace: "my-app",
        code:
          `import { Button } from "@shadcn/ui";\nexport default function App() { return null; }\n`,
        transpiled: "",
        html: "",
        css: "",
        messages: [],
        hash: "h",
      });

      const handler = registry.handlers.get("codespace_get_dependencies")!;
      const result = await handler({ codespace_id: "my-app" });

      expect(isError(result)).toBe(false);
      expect(getText(result)).toContain("@shadcn/ui");
    });
  });

  // ── codespace_add_dependency ─────────────────────────────────────────

  describe("codespace_add_dependency", () => {
    it("should add a production dependency and confirm addition", async () => {
      mockGetSession.mockResolvedValue({
        codeSpace: "my-app",
        code: "export default function App() { return null; }\n",
        transpiled: "",
        html: "",
        css: "",
        messages: [],
        hash: "h",
      });
      mockUpsertSession.mockResolvedValue({
        codeSpace: "my-app",
        hash: "h2",
        code:
          "// dependency: lodash@^4.17.21 (dependency)\nexport default function App() { return null; }\n",
        transpiled: "",
        html: "",
        css: "",
        messages: [],
      });

      const handler = registry.handlers.get("codespace_add_dependency")!;
      const result = await handler({
        codespace_id: "my-app",
        package_name: "lodash",
        version: "^4.17.21",
        dev: false,
      });

      expect(isError(result)).toBe(false);
      const text = getText(result);
      expect(text).toContain("lodash");
      expect(text).toContain("^4.17.21");
      expect(text).toContain("dependency");
      expect(mockUpsertSession).toHaveBeenCalled();
    });

    it("should add a dev dependency with correct type label", async () => {
      mockGetSession.mockResolvedValue({
        codeSpace: "my-app",
        code: "export default function App() { return null; }\n",
        transpiled: "",
        html: "",
        css: "",
        messages: [],
        hash: "h",
      });
      mockUpsertSession.mockResolvedValue({
        codeSpace: "my-app",
        hash: "h2",
        code: "updated",
        transpiled: "",
        html: "",
        css: "",
        messages: [],
      });

      const handler = registry.handlers.get("codespace_add_dependency")!;
      const result = await handler({
        codespace_id: "my-app",
        package_name: "@types/lodash",
        dev: true,
      });

      expect(isError(result)).toBe(false);
      const text = getText(result);
      expect(text).toContain("@types/lodash");
      expect(text).toContain("devDependency");
    });

    it("should default version to 'latest' when not provided", async () => {
      mockGetSession.mockResolvedValue({
        codeSpace: "my-app",
        code: "export default function App() { return null; }\n",
        transpiled: "",
        html: "",
        css: "",
        messages: [],
        hash: "h",
      });
      mockUpsertSession.mockResolvedValue({
        codeSpace: "my-app",
        hash: "h2",
        code: "updated",
        transpiled: "",
        html: "",
        css: "",
        messages: [],
      });

      const handler = registry.handlers.get("codespace_add_dependency")!;
      const result = await handler({
        codespace_id: "my-app",
        package_name: "date-fns",
      });

      expect(isError(result)).toBe(false);
      expect(getText(result)).toContain("latest");
    });

    it("should not call upsert when package is already present", async () => {
      const existingCode =
        "// dependency: lodash@^4 (dependency)\nexport default function App() { return null; }\n";
      mockGetSession.mockResolvedValue({
        codeSpace: "my-app",
        code: existingCode,
        transpiled: "",
        html: "",
        css: "",
        messages: [],
        hash: "h",
      });

      const handler = registry.handlers.get("codespace_add_dependency")!;
      const result = await handler({
        codespace_id: "my-app",
        package_name: "lodash",
        version: "^4",
      });

      expect(isError(result)).toBe(false);
      expect(getText(result)).toContain("already present");
      expect(mockUpsertSession).not.toHaveBeenCalled();
    });

    it("should return error when codespace not found", async () => {
      mockGetSession.mockResolvedValue(null);

      const handler = registry.handlers.get("codespace_add_dependency")!;
      const result = await handler({
        codespace_id: "missing-cs",
        package_name: "lodash",
      });

      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("not found");
    });

    it("should return error when session service throws", async () => {
      mockGetSession.mockRejectedValue(new Error("DB failure"));

      const handler = registry.handlers.get("codespace_add_dependency")!;
      const result = await handler({
        codespace_id: "my-app",
        package_name: "lodash",
      });

      expect(isError(result)).toBe(true);
    });
  });
});
