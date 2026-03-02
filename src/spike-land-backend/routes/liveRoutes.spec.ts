import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Code } from "../chatRoom";
import { LiveRoutes } from "./liveRoutes";

vi.mock("@spike-land-ai/code", () => ({
  HTML: '<html><head>// IMPORTMAP</head><body><div id="embed"></div><!-- Inline LINK for initial theme --><script src="/start.mjs"></script></body></html>',
  importMap: { imports: { react: "https://esm.sh/react" } },
  importMapReplace: vi.fn().mockImplementation((code: string) => `replaced:${code}`),
  md5: vi.fn().mockImplementation(() => "abc123def456"),
}));

const mockHandleMessagesRoute = vi.fn().mockResolvedValue(
  new Response(JSON.stringify({ messages: [] }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  }),
);

vi.mock("./aiRoutes", () => {
  class AiRoutes {
    handleMessagesRoute = mockHandleMessagesRoute;
    constructor(_code: unknown) {}
  }
  return { AiRoutes };
});

describe("LiveRoutes", () => {
  let liveRoutes: LiveRoutes;
  let mockCode: Code;
  let mockVersion: {
    code: string;
    transpiled: string;
    css: string;
    html: string;
    codeSpace: string;
    versionNumber: number;
    createdAt: number;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockVersion = {
      code: "const App = () => <div>v1</div>;",
      transpiled: "const App = () => React.createElement('div', null, 'v1');",
      css: ".app { color: green; }",
      html: "<div>v1</div>",
      codeSpace: "test-space",
      versionNumber: 1,
      createdAt: Date.now(),
    };

    mockCode = {
      getSession: vi.fn().mockReturnValue({
        code: "const App = () => <div>Hello</div>;",
        html: "<div>Hello</div>",
        css: ".app { color: red; }",
        transpiled: "const App = () => React.createElement('div', null, 'Hello');",
        codeSpace: "test-space",
      }),
      getOrigin: vi.fn().mockReturnValue("https://test.spike.land"),
      getVersion: vi.fn().mockResolvedValue(mockVersion),
      getVersionsList: vi.fn().mockResolvedValue([mockVersion]),
      getVersionCount: vi.fn().mockReturnValue(1),
      getState: vi.fn().mockReturnValue({
        storage: {
          get: vi.fn().mockResolvedValue(null),
        },
      }),
    } as unknown as Code;

    liveRoutes = new LiveRoutes(mockCode);
  });

  describe("handleLiveRoute", () => {
    it("should delegate /live/space/messages to aiRoutes", async () => {
      const request = new Request("https://example.com/live/test-space/messages");
      const url = new URL("https://example.com/live/test-space/messages");
      const path = ["live", "test-space", "messages"];

      const response = await liveRoutes.handleLiveRoute(request, url, path);

      expect(response.status).toBe(200);
    });

    it("should return deprecated MCP error for /live/space/mcp", async () => {
      const request = new Request("https://example.com/live/test-space/mcp", {
        method: "POST",
      });
      const url = new URL("https://example.com/live/test-space/mcp");
      const path = ["live", "test-space", "mcp"];

      const response = await liveRoutes.handleLiveRoute(request, url, path);

      expect(response.status).toBe(400);
      const body = (await response.json()) as { error: { message: string } };
      expect(body.error.message).toContain("deprecated");
    });

    it("should handle /live/space/versions route", async () => {
      const request = new Request("https://example.com/live/test-space/versions");
      const url = new URL("https://example.com/live/test-space/versions");
      const path = ["live", "test-space", "versions"];

      const response = await liveRoutes.handleLiveRoute(request, url, path);

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        codeSpace: string;
        versionCount: number;
        versions: unknown[];
      };
      expect(body.codeSpace).toBe("test-space");
      expect(body.versionCount).toBe(1);
    });

    it("should handle /live/space/version/1 route (version info)", async () => {
      const request = new Request("https://example.com/live/test-space/version/1");
      const url = new URL("https://example.com/live/test-space/version/1");
      const path = ["live", "test-space", "version", "1"];

      const response = await liveRoutes.handleLiveRoute(request, url, path);

      expect(response.status).toBe(200);
      const body = (await response.json()) as { versionNumber: number };
      expect(body.versionNumber).toBe(1);
    });

    it("should return 400 for invalid version number in /live/space/version/bad", async () => {
      const request = new Request("https://example.com/live/test-space/version/bad");
      const url = new URL("https://example.com/live/test-space/version/bad");
      const path = ["live", "test-space", "version", "bad"];

      const response = await liveRoutes.handleLiveRoute(request, url, path);

      expect(response.status).toBe(400);
    });

    it("should handle /live/space/version/1/embed route", async () => {
      const request = new Request("https://example.com/live/test-space/version/1/embed");
      const url = new URL("https://example.com/live/test-space/version/1/embed");
      const path = ["live", "test-space", "version", "1", "embed"];

      const response = await liveRoutes.handleLiveRoute(request, url, path);

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toContain("text/html");
    });

    it("should handle /live/space/version/1/index.mjs route", async () => {
      const request = new Request("https://example.com/live/test-space/version/1/index.mjs");
      const url = new URL("https://example.com/live/test-space/version/1/index.mjs");
      const path = ["live", "test-space", "version", "1", "index.mjs"];

      const response = await liveRoutes.handleLiveRoute(request, url, path);

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toContain("application/javascript");
    });

    it("should handle /live/space/version/1/index.css route", async () => {
      const request = new Request("https://example.com/live/test-space/version/1/index.css");
      const url = new URL("https://example.com/live/test-space/version/1/index.css");
      const path = ["live", "test-space", "version", "1", "index.css"];

      const response = await liveRoutes.handleLiveRoute(request, url, path);

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toContain("text/css");
    });

    it("should handle /live/space/version/1/index.tsx route", async () => {
      const request = new Request("https://example.com/live/test-space/version/1/index.tsx");
      const url = new URL("https://example.com/live/test-space/version/1/index.tsx");
      const path = ["live", "test-space", "version", "1", "index.tsx"];

      const response = await liveRoutes.handleLiveRoute(request, url, path);

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toContain("application/javascript");
    });

    it("should handle /live/space/version/1/html route", async () => {
      const request = new Request("https://example.com/live/test-space/version/1/html");
      const url = new URL("https://example.com/live/test-space/version/1/html");
      const path = ["live", "test-space", "version", "1", "html"];

      const response = await liveRoutes.handleLiveRoute(request, url, path);

      expect(response.status).toBe(200);
    });

    it("should return 404 for invalid sub-route in versioned path", async () => {
      const request = new Request("https://example.com/live/test-space/version/1/unknown");
      const url = new URL("https://example.com/live/test-space/version/1/unknown");
      const path = ["live", "test-space", "version", "1", "unknown"];

      const response = await liveRoutes.handleLiveRoute(request, url, path);

      expect(response.status).toBe(404);
    });

    it("should return 404 for non-matching routes", async () => {
      const request = new Request("https://example.com/live/test-space");
      const url = new URL("https://example.com/live/test-space");
      const path = ["live", "test-space"];

      const response = await liveRoutes.handleLiveRoute(request, url, path);

      expect(response.status).toBe(404);
    });
  });

  describe("handleVersionRoute", () => {
    it("should return 400 when version string is missing", async () => {
      const request = new Request("https://example.com/version/");
      const url = new URL("https://example.com/version/");
      const path = ["version"];

      const response = await liveRoutes.handleVersionRoute(request, url, path);

      expect(response.status).toBe(400);
      const body = (await response.json()) as { error: string };
      expect(body.error).toBe("Version number required");
    });

    it("should return 400 for invalid version number", async () => {
      const request = new Request("https://example.com/version/abc");
      const url = new URL("https://example.com/version/abc");
      const path = ["version", "abc"];

      const response = await liveRoutes.handleVersionRoute(request, url, path);

      expect(response.status).toBe(400);
      const body = (await response.json()) as { error: string };
      expect(body.error).toBe("Invalid version number");
    });

    it("should return 400 for version number 0", async () => {
      const request = new Request("https://example.com/version/0");
      const url = new URL("https://example.com/version/0");
      const path = ["version", "0"];

      const response = await liveRoutes.handleVersionRoute(request, url, path);

      expect(response.status).toBe(400);
    });

    it("should return version info for /version/1", async () => {
      const request = new Request("https://example.com/version/1");
      const url = new URL("https://example.com/version/1");
      const path = ["version", "1"];

      const response = await liveRoutes.handleVersionRoute(request, url, path);

      expect(response.status).toBe(200);
      const body = (await response.json()) as { versionNumber: number };
      expect(body.versionNumber).toBe(1);
    });

    it("should handle /version/1/embed", async () => {
      const request = new Request("https://example.com/version/1/embed");
      const url = new URL("https://example.com/version/1/embed");
      const path = ["version", "1", "embed"];

      const response = await liveRoutes.handleVersionRoute(request, url, path);

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toContain("text/html");
    });

    it("should handle /version/1/iframe (alias for embed)", async () => {
      const request = new Request("https://example.com/version/1/iframe");
      const url = new URL("https://example.com/version/1/iframe");
      const path = ["version", "1", "iframe"];

      const response = await liveRoutes.handleVersionRoute(request, url, path);

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toContain("text/html");
    });

    it("should handle /version/1/index.js (alias for js)", async () => {
      const request = new Request("https://example.com/version/1/index.js");
      const url = new URL("https://example.com/version/1/index.js");
      const path = ["version", "1", "index.js"];

      const response = await liveRoutes.handleVersionRoute(request, url, path);

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toContain("application/javascript");
    });

    it("should handle /version/1/js", async () => {
      const request = new Request("https://example.com/version/1/js");
      const url = new URL("https://example.com/version/1/js");
      const path = ["version", "1", "js"];

      const response = await liveRoutes.handleVersionRoute(request, url, path);

      expect(response.status).toBe(200);
    });

    it("should handle /version/1/code", async () => {
      const request = new Request("https://example.com/version/1/code");
      const url = new URL("https://example.com/version/1/code");
      const path = ["version", "1", "code"];

      const response = await liveRoutes.handleVersionRoute(request, url, path);

      expect(response.status).toBe(200);
      const body = await response.text();
      expect(body).toBe(mockVersion.code);
    });

    it("should return 404 for unknown sub-route", async () => {
      const request = new Request("https://example.com/version/1/unknown");
      const url = new URL("https://example.com/version/1/unknown");
      const path = ["version", "1", "unknown"];

      const response = await liveRoutes.handleVersionRoute(request, url, path);

      expect(response.status).toBe(404);
    });

    it("should return 404 when version does not exist", async () => {
      mockCode.getVersion = vi.fn().mockResolvedValue(null);

      const request = new Request("https://example.com/version/99");
      const url = new URL("https://example.com/version/99");
      const path = ["version", "99"];

      const response = await liveRoutes.handleVersionRoute(request, url, path);

      expect(response.status).toBe(404);
    });
  });

  describe("handleVersionsRoute", () => {
    it("should return versions list", async () => {
      const request = new Request("https://example.com/versions");
      const url = new URL("https://example.com/versions");

      const response = await liveRoutes.handleVersionsRoute(request, url, ["versions"]);

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        codeSpace: string;
        versionCount: number;
      };
      expect(body.codeSpace).toBe("test-space");
      expect(body.versionCount).toBe(1);
    });
  });

  describe("handleVersionedContentRoute", () => {
    it("should return 404 when version not found", async () => {
      mockCode.getVersion = vi.fn().mockResolvedValue(null);

      const response = await liveRoutes.handleVersionedContentRoute(99, "code");

      expect(response.status).toBe(404);
      const body = await response.text();
      expect(body).toBe("Version not found");
    });

    it("should serve code content", async () => {
      const response = await liveRoutes.handleVersionedContentRoute(1, "code");

      expect(response.status).toBe(200);
      const body = await response.text();
      expect(body).toBe(mockVersion.code);
    });

    it("should serve js content with importMapReplace applied", async () => {
      const response = await liveRoutes.handleVersionedContentRoute(1, "js");

      expect(response.status).toBe(200);
      const body = await response.text();
      expect(body).toContain("replaced:");
    });

    it("should serve css content", async () => {
      const response = await liveRoutes.handleVersionedContentRoute(1, "css");

      expect(response.status).toBe(200);
      const body = await response.text();
      expect(body).toBe(mockVersion.css);
      expect(response.headers.get("Content-Type")).toContain("text/css");
    });

    it("should serve html embed content", async () => {
      const response = await liveRoutes.handleVersionedContentRoute(1, "html");

      expect(response.status).toBe(200);
    });

    it("should serve embed content with version CSS links injected", async () => {
      const response = await liveRoutes.handleVersionedContentRoute(1, "embed");

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toContain("text/html");
      const body = await response.text();
      expect(body).toContain("version/1/index.css");
    });

    it("should set immutable cache headers for versioned content", async () => {
      const response = await liveRoutes.handleVersionedContentRoute(1, "code");

      expect(response.headers.get("Cache-Control")).toContain("immutable");
    });
  });

  describe("handleLazyRoute", () => {
    it("should return JS that loads the room", async () => {
      const request = new Request("https://example.com/lazy?room=my-room");
      const url = new URL("https://example.com/lazy?room=my-room");

      const response = await liveRoutes.handleLazyRoute(request, url);

      expect(response.status).toBe(200);
      const body = await response.text();
      expect(body).toContain("my-room");
      expect(body).toContain("LoadRoom");
    });

    it("should sanitize the room param by stripping non-alphanumeric chars", async () => {
      // room = "my room!" - space and ! should be stripped, leaving "myroom"
      const request = new Request("https://example.com/lazy?room=my+room%21");
      const url = new URL("https://example.com/lazy?room=my+room%21");

      const response = await liveRoutes.handleLazyRoute(request, url);

      const body = await response.text();
      // The sanitized room string should appear without the space or !
      expect(body).toContain("myroom");
      expect(body).not.toContain("my room");
    });

    it("should use 'empty' when room param is missing", async () => {
      const request = new Request("https://example.com/lazy");
      const url = new URL("https://example.com/lazy");

      const response = await liveRoutes.handleLazyRoute(request, url);

      const body = await response.text();
      expect(body).toContain("empty");
    });
  });

  describe("handleWrapRoute", () => {
    it("should return JS that wraps the App component", async () => {
      const request = new Request("https://example.com/wrap?room=my-room");
      const url = new URL("https://example.com/wrap?room=my-room");

      const response = await liveRoutes.handleWrapRoute(request, url);

      expect(response.status).toBe(200);
      const body = await response.text();
      expect(body).toContain("my-room");
      expect(body).toContain("renderApp");
    });

    it("should set content_hash header", async () => {
      const request = new Request("https://example.com/wrap?room=test");
      const url = new URL("https://example.com/wrap?room=test");

      const response = await liveRoutes.handleWrapRoute(request, url);

      expect(response.headers.get("content_hash")).toBeTruthy();
    });
  });

  describe("handleWrapHTMLRoute", () => {
    it("should return full HTML page with session html embedded", async () => {
      const response = await liveRoutes.handleWrapHTMLRoute();

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toContain("text/html");
    });

    it("should include session codeSpace in JS url", async () => {
      const response = await liveRoutes.handleWrapHTMLRoute();

      const body = await response.text();
      expect(body).toContain("test-space");
    });
  });

  describe("handleRenderToStr", () => {
    it("should return JS code for server-side rendering", async () => {
      const request = new Request("https://example.com/render?room=my-room");
      const url = new URL("https://example.com/render?room=my-room");

      const response = await liveRoutes.handleRenderToStr(request, url);

      expect(response.status).toBe(200);
      const body = await response.text();
      expect(body).toContain("renderToString");
      expect(body).toContain("my-room");
    });
  });

  describe("handleScreenShotRoute", () => {
    it("should return 503 (deprecated service)", async () => {
      const request = new Request("https://example.com/screenshot");
      const url = new URL("https://example.com/screenshot");

      const response = await liveRoutes.handleScreenShotRoute(request, url);

      expect(response.status).toBe(503);
      const body = (await response.json()) as { error: string };
      expect(body.error).toContain("unavailable");
    });
  });
});
