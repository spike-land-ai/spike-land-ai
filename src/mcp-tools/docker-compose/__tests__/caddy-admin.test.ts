import { describe, it, expect, vi, beforeEach } from "vitest";
import { CaddyAdminClient } from "../core-logic/caddy-admin.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("CaddyAdminClient", () => {
  let client: CaddyAdminClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new CaddyAdminClient("http://localhost:2019");
  });

  describe("getConfig", () => {
    it("returns config on success", async () => {
      const config = { apps: { http: {} } };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(config),
      });

      const result = await client.getConfig();
      expect(result).toEqual(config);
      expect(mockFetch).toHaveBeenCalledWith("http://localhost:2019/config/");
    });

    it("throws on error response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Internal Server Error"),
      });

      await expect(client.getConfig()).rejects.toThrow("Caddy admin API error: 500");
    });
  });

  describe("addRoute", () => {
    it("sends correct route configuration", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await client.addRoute("api", "api-service", 8080);

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:2019/config/apps/http/servers/srv0/routes",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            match: [{ host: ["api.spike.local"] }],
            handle: [
              {
                handler: "reverse_proxy",
                upstreams: [{ dial: "api-service:8080" }],
              },
            ],
          }),
        },
      );
    });

    it("throws on failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve("Bad Request"),
      });

      await expect(client.addRoute("bad", "host", 80)).rejects.toThrow(
        "Failed to add Caddy route: 400",
      );
    });
  });

  describe("listRoutes", () => {
    it("parses routes into subdomain mappings", async () => {
      const routes = [
        {
          match: [{ host: ["api.spike.local"] }],
          handle: [
            {
              handler: "reverse_proxy",
              upstreams: [{ dial: "api-service:8080" }],
            },
          ],
        },
        {
          match: [{ host: ["app.spike.local"] }],
          handle: [
            {
              handler: "reverse_proxy",
              upstreams: [{ dial: "frontend:3000" }],
            },
          ],
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(routes),
      });

      const mappings = await client.listRoutes();
      expect(mappings).toEqual([
        { subdomain: "api", upstream: "api-service", port: 8080 },
        { subdomain: "app", upstream: "frontend", port: 3000 },
      ]);
    });

    it("returns empty array on 404", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: () => Promise.resolve("Not Found"),
      });

      const mappings = await client.listRoutes();
      expect(mappings).toEqual([]);
    });

    it("skips routes without host or dial", async () => {
      const routes = [
        { match: [{}], handle: [{ handler: "static_response" }] },
        {
          match: [{ host: ["valid.spike.local"] }],
          handle: [
            {
              handler: "reverse_proxy",
              upstreams: [{ dial: "svc:9000" }],
            },
          ],
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(routes),
      });

      const mappings = await client.listRoutes();
      expect(mappings).toHaveLength(1);
      expect(mappings[0]).toEqual({ subdomain: "valid", upstream: "svc", port: 9000 });
    });
  });
});
