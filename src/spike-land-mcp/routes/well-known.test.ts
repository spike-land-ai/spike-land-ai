/**
 * Tests for routes/well-known.ts
 *
 * Covers the /.well-known/oauth-authorization-server and
 * /.well-known/oauth-protected-resource/mcp endpoints.
 */

import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { wellKnownRoute } from "./well-known";
import type { Env } from "../env";

function makeApp() {
  const app = new Hono<{ Bindings: Env }>();
  app.route("/.well-known", wellKnownRoute);
  return app;
}

const mockEnvObj = {
  DB: {} as D1Database,
  KV: {} as KVNamespace,
  MCP_JWT_SECRET: "test-secret",
  MCP_INTERNAL_SECRET: "test-internal",
  ANTHROPIC_API_KEY: "sk-ant-test",
  OPENAI_API_KEY: "sk-test",
  GEMINI_API_KEY: "gemini-test",
  ELEVENLABS_API_KEY: "el-test",
  APP_ENV: "test",
  SPIKE_LAND_URL: "https://spike.land",
};

describe("GET /.well-known/oauth-authorization-server", () => {
  it("returns 200 with correct content-type", async () => {
    const app = makeApp();
    const res = await app.fetch(
      new Request("http://localhost/.well-known/oauth-authorization-server"),
      mockEnvObj,
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/json");
  });

  it("contains required OAuth 2.0 discovery fields", async () => {
    const app = makeApp();
    const res = await app.fetch(
      new Request("http://localhost/.well-known/oauth-authorization-server"),
      mockEnvObj,
    );

    const body = (await res.json()) as Record<string, unknown>;
    expect(body.issuer).toBe("https://mcp.spike.land");
    expect(body.authorization_endpoint).toBeDefined();
    expect(body.token_endpoint).toBeDefined();
    expect(body.device_authorization_endpoint).toBeDefined();
    expect(body.response_types_supported).toBeInstanceOf(Array);
    expect(body.grant_types_supported).toBeInstanceOf(Array);
  });

  it("supports device_code grant type", async () => {
    const app = makeApp();
    const res = await app.fetch(
      new Request("http://localhost/.well-known/oauth-authorization-server"),
      mockEnvObj,
    );

    const body = (await res.json()) as { grant_types_supported: string[] };
    expect(body.grant_types_supported).toContain("urn:ietf:params:oauth:grant-type:device_code");
  });

  it("token_endpoint points to mcp.spike.land", async () => {
    const app = makeApp();
    const res = await app.fetch(
      new Request("http://localhost/.well-known/oauth-authorization-server"),
      mockEnvObj,
    );

    const body = (await res.json()) as { token_endpoint: string };
    expect(body.token_endpoint).toContain("mcp.spike.land");
  });

  it("code_challenge_methods_supported includes S256", async () => {
    const app = makeApp();
    const res = await app.fetch(
      new Request("http://localhost/.well-known/oauth-authorization-server"),
      mockEnvObj,
    );

    const body = (await res.json()) as { code_challenge_methods_supported: string[] };
    expect(body.code_challenge_methods_supported).toContain("S256");
  });
});

describe("GET /.well-known/oauth-protected-resource/mcp", () => {
  it("returns 200", async () => {
    const app = makeApp();
    const res = await app.fetch(
      new Request("http://localhost/.well-known/oauth-protected-resource/mcp"),
      mockEnvObj,
    );

    expect(res.status).toBe(200);
  });

  it("contains resource, authorization_servers, bearer_methods_supported", async () => {
    const app = makeApp();
    const res = await app.fetch(
      new Request("http://localhost/.well-known/oauth-protected-resource/mcp"),
      mockEnvObj,
    );

    const body = (await res.json()) as Record<string, unknown>;
    expect(body.resource).toContain("mcp.spike.land");
    expect(body.authorization_servers).toBeInstanceOf(Array);
    expect(body.bearer_methods_supported).toBeInstanceOf(Array);
  });

  it("includes resource_documentation link", async () => {
    const app = makeApp();
    const res = await app.fetch(
      new Request("http://localhost/.well-known/oauth-protected-resource/mcp"),
      mockEnvObj,
    );

    const body = (await res.json()) as { resource_documentation: string };
    expect(body.resource_documentation).toContain("spike.land");
  });

  it("authorization_servers includes mcp.spike.land", async () => {
    const app = makeApp();
    const res = await app.fetch(
      new Request("http://localhost/.well-known/oauth-protected-resource/mcp"),
      mockEnvObj,
    );

    const body = (await res.json()) as { authorization_servers: string[] };
    expect(body.authorization_servers.some((s) => s.includes("mcp.spike.land"))).toBe(true);
  });
});

describe("well-known route — non-existent paths", () => {
  it("returns 404 for unknown well-known path", async () => {
    const app = makeApp();
    const res = await app.fetch(
      new Request("http://localhost/.well-known/something-unknown"),
      mockEnvObj,
    );

    expect(res.status).toBe(404);
  });
});
