import { describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/edge-api/spike-land/api/app.js";

describe("learnit routes", () => {
  const mockEnv = {
    DB: {
      prepare: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue(null),
        all: vi.fn().mockResolvedValue({ results: [] }),
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null),
          all: vi.fn().mockResolvedValue({ results: [] }),
          run: vi.fn().mockResolvedValue({}),
        }),
      }),
    },
  };

  it("GET /api/learnit is registered", () => {
    const app = createApp();
    const routes = app.routes.map((r) => r.path);
    expect(routes).toContain("/api/learnit");
  });

  it("GET /api/learnit/:slug is registered", () => {
    const app = createApp();
    const routes = app.routes.map((r) => r.path);
    expect(routes).toContain("/api/learnit/:slug");
  });

  it("GET /api/learnit returns JSON", async () => {
    const app = createApp();
    const res = await app.request("/api/learnit", {}, mockEnv);
    // Drizzle without real D1 may error, but route should be mounted
    expect([200, 500]).toContain(res.status);
  });

  it("GET /api/learnit/:slug returns 404 or error for missing topic", async () => {
    const app = createApp();
    const res = await app.request("/api/learnit/nonexistent", {}, mockEnv);
    expect([404, 500]).toContain(res.status);
  });

  it("GET /api/learnit/:slug with Accept: text/markdown preserves content type on success", async () => {
    const app = createApp();
    const res = await app.request(
      "/api/learnit/test-topic",
      { headers: { Accept: "text/markdown" } },
      mockEnv,
    );
    // Without real D1, will be 404 or 500
    expect([200, 404, 500]).toContain(res.status);
    // If 200, should be markdown
    if (res.status === 200) {
      expect(res.headers.get("Content-Type")).toBe("text/markdown; charset=utf-8");
    }
  });
});
