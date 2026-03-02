import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Code } from "../chatRoom";
import { DefaultRoutes } from "./defaultRoutes";

vi.mock("@spike-land-ai/code", () => ({
  HTML: "<html><head>// IMPORTMAP</head><body>${html}<style>/* criticalCss */</style></body></html>".replace(
    "${codeSpace}",
    "${codeSpace}",
  ),
  importMap: { imports: { react: "https://esm.sh/react" } },
  md5: (str: string) => `md5-${str.length}`,
}));

describe("DefaultRoutes", () => {
  let defaultRoutes: DefaultRoutes;
  let mockCode: Code;

  beforeEach(() => {
    mockCode = {
      getSession: vi.fn().mockReturnValue({
        html: "<div>Hello World</div>",
        codeSpace: "test-space",
        css: "body { margin: 0; }",
      }),
    } as unknown as Code;

    defaultRoutes = new DefaultRoutes(mockCode);
  });

  describe("handleDefaultRoute", () => {
    it("should return HTML response with 200 status", async () => {
      const response = await defaultRoutes.handleDefaultRoute();

      expect(response.status).toBe(200);
    });

    it("should set HTML content type", async () => {
      const response = await defaultRoutes.handleDefaultRoute();

      expect(response.headers.get("Content-Type")).toBe("text/html; charset=UTF-8");
    });

    it("should include CORS headers", async () => {
      const response = await defaultRoutes.handleDefaultRoute();

      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });

    it("should set content hash header", async () => {
      const response = await defaultRoutes.handleDefaultRoute();

      expect(response.headers.get("content_hash")).toBeTruthy();
    });

    it("should call getSession to get current code space data", async () => {
      await defaultRoutes.handleDefaultRoute();

      expect(mockCode.getSession).toHaveBeenCalled();
    });
  });

  describe("handleHtmlRoute", () => {
    it("should return HTML content", async () => {
      const response = await defaultRoutes.handleHtmlRoute();

      const body = await response.text();
      expect(body).toBe("<div>Hello World</div>");
    });

    it("should include CORS headers", async () => {
      const response = await defaultRoutes.handleHtmlRoute();

      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });

    it("should set content hash", async () => {
      const response = await defaultRoutes.handleHtmlRoute();

      expect(response.headers.get("content_hash")).toBeTruthy();
    });
  });
});
