import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import type { Env } from "../env.js";
import { quizBadge, escapeHtml } from "../routes/quiz-badge.js";

const TEST_SECRET = "test-badge-secret";

interface BadgePayload {
  sid: string;
  topic: string;
  score: number;
  ts: number;
}

function createMockEnv(overrides: Partial<Env> = {}): Env {
  return {
    R2: {} as R2Bucket,
    SPA_ASSETS: {} as R2Bucket,
    LIMITERS: {} as DurableObjectNamespace,
    STRIPE_SECRET_KEY: "",
    AI_API_KEY: "",
    GITHUB_TOKEN: "",
    SPACETIMEDB_URI: "",
    ALLOWED_ORIGINS: "",
    QUIZ_BADGE_SECRET: TEST_SECRET,
    ...overrides,
  };
}

function signPayload(payload: BadgePayload, secret: string): string {
  let hash = 0;
  const signInput = JSON.stringify(payload) + secret;
  for (let i = 0; i < signInput.length; i++) {
    const char = signInput.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return btoa(String(Math.abs(hash)));
}

function createBadgeToken(payload: BadgePayload, secret: string = TEST_SECRET): string {
  const payloadB64 = btoa(JSON.stringify(payload));
  const sig = signPayload(payload, secret);
  return `${payloadB64}.${sig}`;
}

const samplePayload: BadgePayload = {
  sid: "session-123",
  topic: "TypeScript Fundamentals",
  score: 85,
  ts: new Date("2026-01-15T12:00:00Z").getTime(),
};

// ─── quiz badge route ────────────────────────────────────────────────────────

describe("quiz badge route", () => {
  it("renders HTML with og: meta tags for a valid badge token", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", quizBadge);

    const env = createMockEnv();
    const token = createBadgeToken(samplePayload);
    const res = await app.request(`/quiz/badge/${token}`, {}, env);

    expect(res.status).toBe(200);
    const html = await res.text();
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(html).toContain('og:title');
    expect(html).toContain('og:description');
    expect(html).toContain('og:url');
    expect(html).toContain('twitter:card');
  });

  it("HTML contains the topic, score, and date", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", quizBadge);

    const env = createMockEnv();
    const token = createBadgeToken(samplePayload);
    const res = await app.request(`/quiz/badge/${token}`, {}, env);

    const html = await res.text();
    expect(html).toContain("TypeScript Fundamentals");
    expect(html).toContain("85%");
    expect(html).toContain("Excellent");
    expect(html).toContain("January 15, 2026");
  });

  it("shows 'Good' label for scores between 60 and 79", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", quizBadge);

    const env = createMockEnv();
    const payload = { ...samplePayload, score: 70 };
    const token = createBadgeToken(payload);
    const res = await app.request(`/quiz/badge/${token}`, {}, env);

    const html = await res.text();
    expect(html).toContain("Good");
    expect(html).toContain("70%");
    expect(html).toContain("#f59e0b");
  });

  it("shows 'Passing' label for scores below 60", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", quizBadge);

    const env = createMockEnv();
    const payload = { ...samplePayload, score: 45 };
    const token = createBadgeToken(payload);
    const res = await app.request(`/quiz/badge/${token}`, {}, env);

    const html = await res.text();
    expect(html).toContain("Passing");
    expect(html).toContain("45%");
    expect(html).toContain("#ef4444");
  });

  it("returns 400 for token without a dot separator", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", quizBadge);

    const env = createMockEnv();
    const res = await app.request("/quiz/badge/invalidtokenwithoutdot", {}, env);

    expect(res.status).toBe(400);
    const body = await res.json<{ error: string }>();
    expect(body.error).toBe("Invalid badge token");
  });

  it("returns 400 for token with too many dot segments", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", quizBadge);

    const env = createMockEnv();
    const res = await app.request("/quiz/badge/a.b.c", {}, env);

    expect(res.status).toBe(400);
    const body = await res.json<{ error: string }>();
    expect(body.error).toBe("Invalid badge token");
  });

  it("returns 400 for invalid base64 payload", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", quizBadge);

    const env = createMockEnv();
    const res = await app.request("/quiz/badge/!!!invalid!!!.sig", {}, env);

    expect(res.status).toBe(400);
    const body = await res.json<{ error: string }>();
    expect(body.error).toBe("Invalid badge payload");
  });

  it("returns 400 for valid base64 but invalid JSON payload", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", quizBadge);

    const env = createMockEnv();
    const badPayload = btoa("not json at all");
    const res = await app.request(`/quiz/badge/${badPayload}.somesig`, {}, env);

    expect(res.status).toBe(400);
    const body = await res.json<{ error: string }>();
    expect(body.error).toBe("Invalid badge payload");
  });

  it("returns 403 for wrong signature", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", quizBadge);

    const env = createMockEnv();
    const payloadB64 = btoa(JSON.stringify(samplePayload));
    const wrongSig = btoa("wrongsignature");
    const res = await app.request(`/quiz/badge/${payloadB64}.${wrongSig}`, {}, env);

    expect(res.status).toBe(403);
    const body = await res.json<{ error: string }>();
    expect(body.error).toBe("Invalid badge signature");
  });

  it("returns 403 when token was signed with a different secret", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", quizBadge);

    const env = createMockEnv();
    const token = createBadgeToken(samplePayload, "different-secret");
    const res = await app.request(`/quiz/badge/${token}`, {}, env);

    expect(res.status).toBe(403);
    const body = await res.json<{ error: string }>();
    expect(body.error).toBe("Invalid badge signature");
  });

  it("returns 500 when QUIZ_BADGE_SECRET is not configured", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", quizBadge);

    const env = createMockEnv({ QUIZ_BADGE_SECRET: "" });
    const token = createBadgeToken(samplePayload);
    const res = await app.request(`/quiz/badge/${token}`, {}, env);

    expect(res.status).toBe(500);
    const body = await res.json<{ error: string }>();
    expect(body.error).toBe("Badge service not configured");
  });

  it("includes badge URL in og:url meta tag", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", quizBadge);

    const env = createMockEnv();
    const token = createBadgeToken(samplePayload);
    const res = await app.request(`/quiz/badge/${token}`, {}, env);

    const html = await res.text();
    expect(html).toContain(`https://spike.land/quiz/badge/${token}`);
  });
});

// ─── escapeHtml ──────────────────────────────────────────────────────────────

describe("escapeHtml", () => {
  it("escapes ampersands", () => {
    expect(escapeHtml("foo & bar")).toBe("foo &amp; bar");
  });

  it("escapes less-than signs", () => {
    expect(escapeHtml("<script>")).toBe("&lt;script&gt;");
  });

  it("escapes double quotes", () => {
    expect(escapeHtml('a "b" c')).toBe("a &quot;b&quot; c");
  });

  it("escapes single quotes", () => {
    expect(escapeHtml("it's")).toBe("it&#x27;s");
  });

  it("escapes all special characters in a single string", () => {
    expect(escapeHtml(`<img src="x" onerror='alert(1)' />&`)).toBe(
      "&lt;img src=&quot;x&quot; onerror=&#x27;alert(1)&#x27; /&gt;&amp;",
    );
  });

  it("returns plain text unchanged", () => {
    expect(escapeHtml("Hello World 123")).toBe("Hello World 123");
  });

  it("prevents XSS in topic field via badge rendering", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", quizBadge);

    const env = createMockEnv();
    const xssPayload = {
      ...samplePayload,
      topic: '<script>alert("xss")</script>',
    };
    const token = createBadgeToken(xssPayload);
    const res = await app.request(`/quiz/badge/${token}`, {}, env);

    const html = await res.text();
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;");
  });
});
