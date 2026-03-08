/// <reference types="@cloudflare/workers-types" />
import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { cachePurge } from "../routes/cache-purge.js";
import type { Env } from "../../core-logic/env.js";

function createApp() {
  const app = new Hono<{ Bindings: Env }>();
  app.route("/", cachePurge);
  return app;
}

function makeEnv(): Env {
  return {
    CF_ZONE_ID: "zone-id",
    CF_CACHE_PURGE_TOKEN: "purge-token",
  } as Env;
}

describe("cache purge route", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("purges everything when the request body is empty", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const app = createApp();
    const res = await app.request(
      "/api/cache/purge",
      {
        method: "POST",
      },
      makeEnv(),
    );

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.cloudflare.com/client/v4/zones/zone-id/purge_cache",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ purge_everything: true }),
      }),
    );
  });

  it("purges only the provided files when a file list is supplied", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const app = createApp();
    const res = await app.request(
      "/api/cache/purge",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: ["https://spike.land/assets/app.js"] }),
      },
      makeEnv(),
    );

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.cloudflare.com/client/v4/zones/zone-id/purge_cache",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ files: ["https://spike.land/assets/app.js"] }),
      }),
    );
  });

  it("returns 400 for malformed JSON", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const app = createApp();
    const res = await app.request(
      "/api/cache/purge",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      },
      makeEnv(),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Invalid JSON body" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
