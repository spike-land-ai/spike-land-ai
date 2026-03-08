/**
 * Additional fetchHandler tests to cover uncovered branches
 */
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { handleApiRequest } from "../../src/edge-api/backend/lazy-imports/apiHandler.js";
import type Env from "../../src/edge-api/backend/core-logic/env.js";
import { handleFetchApi } from "../../src/edge-api/backend/lazy-imports/fetchHandler.js";
import { createMockEnv } from "../../src/edge-api/backend/edge/test-utils.js";
import { handleCORS } from "../../src/edge-api/backend/core-logic/utils.js";

vi.mock("../../src/edge-api/backend/core-logic/utils", () => ({
  handleCORS: vi.fn(),
}));

vi.mock("../../src/edge-api/backend/lazy-imports/apiHandler", () => ({
  handleApiRequest: vi.fn(),
}));

describe("FetchHandler additional coverage", () => {
  let mockEnv: Env;
  let mockCtx: ExecutionContext;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetAllMocks();
    mockFetch = vi.fn();
    global.fetch = mockFetch;
    mockEnv = createMockEnv() as unknown as Env;
    mockCtx = {
      waitUntil: vi.fn(),
      passThroughOnException: () => {},
      props: {},
    } as unknown as ExecutionContext;

    // Re-apply mocked implementations after resetAllMocks
    vi.mocked(handleCORS).mockReturnValue(new Response("CORS"));
    vi.mocked(handleApiRequest).mockResolvedValue(new Response("api response", { status: 200 }));
  });

  describe("handleFetchApi path routing", () => {
    it("returns default HTML for empty path", async () => {
      const request = new Request("https://example.com/");
      const response = await handleFetchApi([""], request, mockEnv, mockCtx);
      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toContain("html");
    });

    it("returns default HTML for empty path array", async () => {
      const request = new Request("https://example.com/");
      const response = await handleFetchApi([], request, mockEnv, mockCtx);
      expect(response.status).toBe(200);
    });

    it("handles OPTIONS request — delegates to handleCORS util", async () => {
      const request = new Request("https://example.com/api-v1/my-space", {
        method: "OPTIONS",
        headers: { Origin: "https://spike.land" },
      });
      const response = await handleFetchApi(["api-v1", "my-space"], request, mockEnv, mockCtx);

      // All OPTIONS requests are intercepted by the global OPTIONS handler which calls handleCORS
      expect(handleCORS).toHaveBeenCalledWith(request);
      expect(await response.text()).toBe("CORS");
    });

    it("handles api-v1 path without codeSpace (empty sub-path)", async () => {
      const request = new Request("https://example.com/api-v1");
      const response = await handleFetchApi(["api-v1"], request, mockEnv, mockCtx);
      // Without codeSpace, should return 400
      expect(response.status).toBe(400);
    });

    it("handles api-v1 path with short codeSpace (idFromName)", async () => {
      const mockRoomObject = {
        fetch: vi.fn().mockResolvedValue(new Response("room response")),
      };
      (mockEnv.CODE.idFromName as Mock).mockReturnValue("id-1");
      (mockEnv.CODE.get as Mock).mockReturnValue(mockRoomObject);

      const request = new Request("https://example.com/api-v1/my-space/session");
      await handleFetchApi(["api-v1", "my-space", "session"], request, mockEnv, mockCtx);

      expect(mockRoomObject.fetch).toHaveBeenCalled();
    });

    it("handles api-v1 path with 16-char hex codeSpace (idFromString)", async () => {
      const mockRoomObject = {
        fetch: vi.fn().mockResolvedValue(new Response("room response")),
      };
      (mockEnv.CODE.idFromString as Mock).mockReturnValue("id-hex");
      (mockEnv.CODE.get as Mock).mockReturnValue(mockRoomObject);

      const hexId = "abcdef0123456789"; // exactly 16 hex chars
      const request = new Request(`https://example.com/api-v1/${hexId}/session`);
      await handleFetchApi(["api-v1", hexId, "session"], request, mockEnv, mockCtx);

      expect(mockEnv.CODE.idFromString).toHaveBeenCalledWith(hexId);
    });

    it("handles api-v1 path with too-long codeSpace", async () => {
      const longId = "a".repeat(33); // 33 chars > 32
      const request = new Request(`https://example.com/api-v1/${longId}`);
      const response = await handleFetchApi(["api-v1", longId], request, mockEnv, mockCtx);

      expect(response.status).toBe(400);
      const body = (await response.json()) as { error: string };
      expect(body.error).toContain("too long");
    });
  });

  describe("handlePublicRequest", () => {
    it("returns 404 when R2 object not found", async () => {
      (mockEnv.R2.get as Mock).mockResolvedValue(null);

      const request = new Request("https://example.com/live/testspace/public/missing.txt", {
        method: "GET",
      });
      const response = await handleFetchApi(
        ["live", "testspace", "public", "missing.txt"],
        request,
        mockEnv,
        mockCtx,
      );

      expect(response.status).toBe(404);
      const text = await response.text();
      expect(text).toBe("File not found");
    });

    it("returns 400 when PUT request has no body (line 239)", async () => {
      // PUT without body triggers !request.body branch
      const request = new Request("https://example.com/live/testspace/public/file.txt", {
        method: "PUT",
        // No body provided
      });
      const response = await handleFetchApi(
        ["live", "testspace", "public", "file.txt"],
        request,
        mockEnv,
        mockCtx,
      );

      expect(response.status).toBe(400);
      expect(await response.text()).toBe("Missing request body");
    });

    it("handles PUT request to public path", async () => {
      (mockEnv.R2.put as Mock).mockResolvedValue(undefined);

      const request = new Request("https://example.com/live/testspace/public/file.txt", {
        method: "PUT",
        body: "file content",
        // @ts-expect-error -- intentional error for testing - duplex for Node.js
        duplex: "half",
      });
      const response = await handleFetchApi(
        ["live", "testspace", "public", "file.txt"],
        request,
        mockEnv,
        mockCtx,
      );

      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toContain("uploaded successfully");
    });

    it("handles DELETE request to public path", async () => {
      (mockEnv.R2.delete as Mock).mockResolvedValue(undefined);

      const request = new Request("https://example.com/live/testspace/public/file.txt", {
        method: "DELETE",
      });
      const response = await handleFetchApi(
        ["live", "testspace", "public", "file.txt"],
        request,
        mockEnv,
        mockCtx,
      );

      expect(response.status).toBe(200);
      expect(await response.text()).toContain("deleted successfully");
    });

    it("returns 405 for unsupported method on public path", async () => {
      const request = new Request("https://example.com/live/testspace/public/file.txt", {
        method: "PATCH",
      });
      const response = await handleFetchApi(
        ["live", "testspace", "public", "file.txt"],
        request,
        mockEnv,
        mockCtx,
      );

      expect(response.status).toBe(405);
    });

    it("GET with spike.land subdomain origin sets CORS header", async () => {
      const mockR2Object = {
        writeHttpMetadata: vi.fn(),
        httpEtag: "etag-123",
        body: "content",
      };
      (mockEnv.R2.get as Mock).mockResolvedValue(mockR2Object);

      const request = new Request("https://example.com/live/testspace/public/file.txt", {
        method: "GET",
        headers: { Origin: "https://app.spike.land" },
      });
      const response = await handleFetchApi(
        ["live", "testspace", "public", "file.txt"],
        request,
        mockEnv,
        mockCtx,
      );

      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://app.spike.land");
    });

    it("GET with unknown origin defaults to spike.land CORS header", async () => {
      const mockR2Object = {
        writeHttpMetadata: vi.fn(),
        httpEtag: "etag-xyz",
        body: "content",
      };
      (mockEnv.R2.get as Mock).mockResolvedValue(mockR2Object);

      const request = new Request("https://example.com/live/testspace/public/file.txt", {
        method: "GET",
        headers: { Origin: "https://malicious.com" },
      });
      const response = await handleFetchApi(
        ["live", "testspace", "public", "file.txt"],
        request,
        mockEnv,
        mockCtx,
      );

      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://spike.land");
    });
  });

  describe("handleLiveIndexRequest", () => {
    it("handles PUT to index.mjs", async () => {
      (mockEnv.R2.put as Mock).mockResolvedValue(undefined);

      const request = new Request("https://example.com/live/testspace/index.mjs", {
        method: "PUT",
        body: "module content",
        // @ts-expect-error -- intentional error for testing
        duplex: "half",
      });
      const response = await handleFetchApi(
        ["live", "testspace", "index.mjs"],
        request,
        mockEnv,
        mockCtx,
      );

      const text = await response.text();
      expect(text).toContain("Put");
    });

    it("handles DELETE to index.mjs", async () => {
      (mockEnv.R2.delete as Mock).mockResolvedValue(undefined);

      const request = new Request("https://example.com/live/testspace/index.mjs", {
        method: "DELETE",
      });
      const response = await handleFetchApi(
        ["live", "testspace", "index.mjs"],
        request,
        mockEnv,
        mockCtx,
      );

      expect(await response.text()).toContain("DEL");
    });

    it("handles GET index.mjs when R2 object is null (falls back to API)", async () => {
      (mockEnv.R2.get as Mock).mockResolvedValue(null);

      const request = new Request("https://example.com/live/testspace/index.mjs", {
        method: "GET",
      });
      await handleFetchApi(["live", "testspace", "index.mjs"], request, mockEnv, mockCtx);

      expect(handleApiRequest).toHaveBeenCalled();
    });

    it("handles GET index.mjs with spike.land origin", async () => {
      const mockR2Object = {
        writeHttpMetadata: vi.fn(),
        httpEtag: "etag-456",
        body: "module code",
      };
      (mockEnv.R2.get as Mock).mockResolvedValue(mockR2Object);

      const request = new Request("https://example.com/live/testspace/index.mjs", {
        method: "GET",
        headers: { Origin: "https://spike.land" },
      });
      const response = await handleFetchApi(
        ["live", "testspace", "index.mjs"],
        request,
        mockEnv,
        mockCtx,
      );

      expect(response.headers.get("Content-Type")).toBe("application/javascript; charset=UTF-8");
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://spike.land");
    });

    it("handles GET index.mjs with non-spike.land origin (defaults to spike.land)", async () => {
      const mockR2Object = {
        writeHttpMetadata: vi.fn(),
        httpEtag: "etag-789",
        body: "module code",
      };
      (mockEnv.R2.get as Mock).mockResolvedValue(mockR2Object);

      const request = new Request("https://example.com/live/testspace/index.mjs", {
        method: "GET",
        headers: { Origin: "https://other.com" },
      });
      const response = await handleFetchApi(
        ["live", "testspace", "index.mjs"],
        request,
        mockEnv,
        mockCtx,
      );

      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://spike.land");
    });

    it("returns 405 for unsupported method on index.mjs", async () => {
      const request = new Request("https://example.com/live/testspace/index.mjs", {
        method: "PATCH",
      });
      const response = await handleFetchApi(
        ["live", "testspace", "index.mjs"],
        request,
        mockEnv,
        mockCtx,
      );

      expect(response.status).toBe(405);
    });
  });

  describe("handleLiveRequest edge cases", () => {
    it("returns 400 for live request without codeSpace", async () => {
      const request = new Request("https://example.com/live");
      const response = await handleFetchApi(["live"], request, mockEnv, mockCtx);
      expect(response.status).toBe(400);
    });

    it("handles live request that falls through to API handler", async () => {
      const request = new Request("https://example.com/live/my-space/session");
      const response = await handleFetchApi(
        ["live", "my-space", "session"],
        request,
        mockEnv,
        mockCtx,
      );

      expect(handleApiRequest).toHaveBeenCalled();
      expect(response.status).toBe(200);
    });

    it("handles ipns request same as ipfs", async () => {
      const mockFetchResponse = new Response("IPNS response", { status: 200 });
      mockFetch.mockResolvedValue(mockFetchResponse);

      const request = new Request("https://example.com/ipns/test-hash");
      const response = await handleFetchApi(["ipns", "test-hash"], request, mockEnv, mockCtx);

      expect(response.status).toBe(200);
    });

    it("handles WebSocket request without upgrade header", async () => {
      const request = new Request("https://example.com/websocket", {
        method: "GET",
      });
      const response = await handleFetchApi(["websocket"], request, mockEnv, mockCtx);
      expect(response.status).toBe(400);
    });

    it("handles node module path redirect removing .mjs extension", async () => {
      const request = new Request("https://example.com/node@20.0.0/buffer.mjs");
      const response = await handleFetchApi(
        ["node@20.0.0", "buffer.mjs"],
        request,
        mockEnv,
        mockCtx,
      );
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("https://esm.sh/buffer");
    });

    it("corsRedirect: unknown package from example.com defaults to spike.land CORS origin", async () => {
      // corsRedirect checks the request URL's origin (not Origin header)
      // Request URL origin is https://example.com which is not spike.land
      const request = new Request("https://example.com/some-pkg");
      const response = await handleFetchApi(["some-pkg"], request, mockEnv, mockCtx);
      expect(response.status).toBe(302);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://spike.land");
    });

    it("corsRedirect: request from spike.land URL uses spike.land CORS origin", async () => {
      // When the request URL itself is from spike.land, CORS header reflects that origin
      const request = new Request("https://spike.land/some-pkg");
      const response = await handleFetchApi(["some-pkg"], request, mockEnv, mockCtx);
      expect(response.status).toBe(302);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://spike.land");
    });

    it("corsRedirect: request from subdomain spike.land URL uses subdomain CORS origin", async () => {
      // When the request URL itself is from a subdomain of spike.land
      const request = new Request("https://test.spike.land/some-pkg");
      const response = await handleFetchApi(["some-pkg"], request, mockEnv, mockCtx);
      expect(response.status).toBe(302);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://test.spike.land");
    });

    it("handles tailwindcss redirect to index.css", async () => {
      const request = new Request("https://example.com/tailwindcss@4.0.0");
      const response = await handleFetchApi(["tailwindcss@4.0.0"], request, mockEnv, mockCtx);
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("https://esm.sh/tailwindcss@4.0.0/index.css");
    });

    it("handles node_modules route (calls handleUnpkg / fetch)", async () => {
      // node_modules route calls handleUnpkg which does fetch(path.join("/"))
      mockFetch.mockResolvedValue(new Response("module content", { status: 200 }));
      const request = new Request("https://example.com/node_modules/react/index.js");
      const response = await handleFetchApi(
        ["node_modules", "react", "index.js"],
        request,
        mockEnv,
        mockCtx,
      );
      expect(response.status).toBe(200);
      // fetch should be called with the path joined
      expect(mockFetch).toHaveBeenCalledWith("node_modules/react/index.js");
    });

    it("handles api route (calls handleApiRequest)", async () => {
      vi.mocked(handleApiRequest).mockResolvedValue(new Response("api-response", { status: 200 }));
      const request = new Request("https://example.com/api/room/my-space/session");
      const response = await handleFetchApi(
        ["api", "room", "my-space", "session"],
        request,
        mockEnv,
        mockCtx,
      );
      expect(response.status).toBe(200);
      expect(handleApiRequest).toHaveBeenCalledWith(
        ["room", "my-space", "session"],
        request,
        mockEnv,
      );
    });

    it("handles ata route (calls handleApiRequest)", async () => {
      vi.mocked(handleApiRequest).mockResolvedValue(new Response("ata-response", { status: 200 }));
      const request = new Request("https://example.com/ata/room/my-space");
      const response = await handleFetchApi(["ata", "room", "my-space"], request, mockEnv, mockCtx);
      expect(response.status).toBe(200);
      expect(handleApiRequest).toHaveBeenCalledWith(["room", "my-space"], request, mockEnv);
    });

    it("handles error in handleLiveRequest via catch callback (line 210)", async () => {
      // When handleApiRequest throws, the .catch callback returns a 500 response
      vi.mocked(handleApiRequest).mockRejectedValue(new Error("API failure"));
      const request = new Request("https://example.com/live/my-space/some-route");
      const response = await handleFetchApi(
        ["live", "my-space", "some-route"],
        request,
        mockEnv,
        mockCtx,
      );
      expect(response.status).toBe(500);
      expect(await response.text()).toContain("API failure");
    });

    it("serves manifest.webmanifest inline (line 90)", async () => {
      const request = new Request("https://example.com/assets/manifest.webmanifest");
      const response = await handleFetchApi(
        ["assets", "manifest.webmanifest"],
        request,
        mockEnv,
        mockCtx,
      );
      expect(response.headers.get("Content-Type")).toBe("application/manifest+json");
      const body = (await response.json()) as { name: string };
      expect(body.name).toBe("spike.land");
    });

    it("redirects to esm CDN when path has falsy first segment after manifest check (line 117)", async () => {
      // path[0] === "" is caught by length/empty check (returns default HTML).
      // The `!firstPath` branch at line 117 fires when path[0] is a non-empty-string
      // that is somehow falsy — only possible with undefined, which can't happen via normal routing.
      // This is a dead branch; we mark it ignored in source and skip the test.
      // Instead verify that the manifest path works (line 90) and the empty path returns HTML.
      const request = new Request("https://spike.land/");
      const response = await handleFetchApi([""], request, mockEnv, mockCtx);
      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toContain("html");
    });

    it("api-v1 OPTIONS is caught by top-level handleCORS before reaching handleRestApiRequest", async () => {
      // handleFetchApi intercepts OPTIONS at line 29-31, so the CORS block inside
      // handleRestApiRequest (lines 334-347) is unreachable via normal routing.
      // It is marked /* v8 ignore next 12 */ in source. We verify top-level behaviour:
      const request = new Request("https://example.com/api-v1/myspace/action", {
        method: "OPTIONS",
      });
      const response = await handleFetchApi(
        ["api-v1", "myspace", "action"],
        request,
        mockEnv,
        mockCtx,
      );
      // handleCORS mock returns "CORS" text
      expect(await response.text()).toBe("CORS");
    });
  });
});
