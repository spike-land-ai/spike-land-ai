import { describe, expect, it } from "vitest";
import type { ICodeSession } from "@spike-land-ai/code";
import {
  executeReadCode,
  executeReadHtml,
  executeReadSession,
  readCodeTool,
  readHtmlTool,
  readSessionTool,
  readTools,
} from "./read-tools";

const createMockSession = (overrides: Partial<ICodeSession> = {}): ICodeSession =>
  ({
    code: "const App = () => <div>Hello</div>;",
    html: "<div>Hello</div>",
    css: "div { color: red; }",
    codeSpace: "test-space",
    ...overrides,
  }) as unknown as ICodeSession;

describe("read-tools", () => {
  describe("tool definitions", () => {
    it("readCodeTool should have correct name", () => {
      expect(readCodeTool.name).toBe("read_code");
    });

    it("readHtmlTool should have correct name", () => {
      expect(readHtmlTool.name).toBe("read_html");
    });

    it("readSessionTool should have correct name", () => {
      expect(readSessionTool.name).toBe("read_session");
    });

    it("readTools array should contain all three tools", () => {
      expect(readTools).toHaveLength(3);
      expect(readTools).toContain(readCodeTool);
      expect(readTools).toContain(readHtmlTool);
      expect(readTools).toContain(readSessionTool);
    });

    it("all tools should have codeSpace as required field", () => {
      for (const tool of readTools) {
        expect(tool.inputSchema.required).toContain("codeSpace");
      }
    });

    it("all tools should have descriptions", () => {
      for (const tool of readTools) {
        expect(tool.description).toBeTruthy();
      }
    });
  });

  describe("executeReadCode", () => {
    it("should return code and codeSpace from session", () => {
      const session = createMockSession({ code: "const x = 42;" });

      const result = executeReadCode(session, "my-space");

      expect(result.code).toBe("const x = 42;");
      expect(result.codeSpace).toBe("my-space");
    });

    it("should use the provided codeSpace, not the one in session", () => {
      const session = createMockSession({ codeSpace: "session-space" });

      const result = executeReadCode(session, "override-space");

      expect(result.codeSpace).toBe("override-space");
    });
  });

  describe("executeReadHtml", () => {
    it("should return html and codeSpace from session", () => {
      const session = createMockSession({ html: "<h1>Title</h1>" });

      const result = executeReadHtml(session, "html-space");

      expect(result.html).toBe("<h1>Title</h1>");
      expect(result.codeSpace).toBe("html-space");
    });

    it("should handle empty html", () => {
      const session = createMockSession({ html: "" });

      const result = executeReadHtml(session, "empty-space");

      expect(result.html).toBe("");
      expect(result.codeSpace).toBe("empty-space");
    });
  });

  describe("executeReadSession", () => {
    it("should return code, html, css and codeSpace from session", () => {
      const session = createMockSession({
        code: "const App = () => null;",
        html: "<div></div>",
        css: "body { margin: 0; }",
      });

      const result = executeReadSession(session, "full-space");

      expect(result.code).toBe("const App = () => null;");
      expect(result.html).toBe("<div></div>");
      expect(result.css).toBe("body { margin: 0; }");
      expect(result.codeSpace).toBe("full-space");
    });

    it("should include all session data fields", () => {
      const session = createMockSession();

      const result = executeReadSession(session, "test-space");

      expect(result).toHaveProperty("code");
      expect(result).toHaveProperty("html");
      expect(result).toHaveProperty("css");
      expect(result).toHaveProperty("codeSpace");
    });
  });
});
