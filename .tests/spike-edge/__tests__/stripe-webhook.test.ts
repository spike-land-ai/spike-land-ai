import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { stripeWebhook } from "../../../src/edge-api/main/api/routes/stripe-webhook.js";
import type { Env } from "../../../src/edge-api/main/core-logic/env.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const WEBHOOK_SECRET = "whsec_test_secret_key";

// ── Stripe Signature Helpers ──────────────────────────────────────────────────

async function buildStripeSignature(
  payload: string,
  secret: string,
  timestamp?: number,
): Promise<string> {
  const ts = timestamp ?? Math.floor(Date.now() / 1000);
  const signed = `${ts}.${payload}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(signed));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `t=${ts},v1=${hex}`;
}

// ── Mock D1 Database ──────────────────────────────────────────────────────────

function createMockDb(firstResultOverride?: Record<string, unknown> | null) {
  const mockRun = vi.fn().mockResolvedValue({ success: true });
  const mockFirst = vi.fn().mockResolvedValue(firstResultOverride ?? null);

  const mockPrepare = vi.fn().mockImplementation((_sql: string) => ({
    bind: (..._args: unknown[]) => ({
      first: mockFirst,
      run: mockRun,
    }),
    first: mockFirst,
    run: mockRun,
  }));

  return {
    db: { prepare: mockPrepare } as unknown as D1Database,
    mockPrepare,
    mockRun,
    mockFirst,
  };
}

// ── App Factory ───────────────────────────────────────────────────────────────

function createApp(envOverrides: Partial<Env> = {}) {
  const app = new Hono<{ Bindings: Env }>();

  app.use("*", async (c, next) => {
    Object.assign(c.env, envOverrides);
    await next();
  });

  app.route("/", stripeWebhook);
  return app;
}

async function postWebhook(
  app: Hono<{ Bindings: Env }>,
  event: Record<string, unknown>,
  options: {
    secret?: string;
    signatureOverride?: string;
    env?: Partial<Env>;
  } = {},
) {
  const payload = JSON.stringify(event);
  const secret = options.secret ?? WEBHOOK_SECRET;
  const signature = options.signatureOverride ?? (await buildStripeSignature(payload, secret));
  const env = options.env ?? {};

  return app.request(
    "/stripe/webhook",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": signature,
      },
      body: payload,
    },
    {
      STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
      ...env,
    } as unknown as Env,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /stripe/webhook", () => {
  describe("signature verification", () => {
    it("returns 400 when stripe-signature header is missing", async () => {
      const { db } = createMockDb();
      const app = createApp({ STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET, DB: db });

      const res = await app.request("/stripe/webhook", { method: "POST", body: "{}" }, {
        STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
        DB: db,
      } as unknown as Env);

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("Missing stripe-signature");
    });

    it("returns 503 when STRIPE_WEBHOOK_SECRET is not configured", async () => {
      const { db } = createMockDb();
      const app = createApp({ DB: db });
      const payload = JSON.stringify({ id: "evt_1", type: "test" });

      const res = await app.request(
        "/stripe/webhook",
        {
          method: "POST",
          headers: { "stripe-signature": "t=1,v1=abc" },
          body: payload,
        },
        { DB: db } as unknown as Env,
      );

      expect(res.status).toBe(503);
    });

    it("returns 400 for invalid signature", async () => {
      const { db } = createMockDb();
      const app = createApp({ STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET, DB: db });
      const payload = JSON.stringify({ id: "evt_1", type: "test" });
      const ts = Math.floor(Date.now() / 1000);

      const res = await app.request(
        "/stripe/webhook",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "stripe-signature": `t=${ts},v1=invalidhexsig0000000000000000000000000000000000000000000000000000`,
          },
          body: payload,
        },
        { STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET, DB: db } as unknown as Env,
      );

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("Invalid signature");
    });

    it("returns 400 for expired timestamp (older than 5 minutes)", async () => {
      const { db } = createMockDb();
      const app = createApp({ STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET, DB: db });
      const payload = JSON.stringify({ id: "evt_old", type: "test" });
      const oldTimestamp = Math.floor(Date.now() / 1000) - 400; // 400 seconds ago
      const signature = await buildStripeSignature(payload, WEBHOOK_SECRET, oldTimestamp);

      const res = await app.request(
        "/stripe/webhook",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "stripe-signature": signature,
          },
          body: payload,
        },
        { STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET, DB: db } as unknown as Env,
      );

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("Invalid signature");
    });

    it("accepts valid signature with recent timestamp", async () => {
      const { db } = createMockDb();
      const app = createApp({ STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET, DB: db });
      const event = { id: "evt_valid", type: "unknown.event", data: { object: {} } };

      const res = await postWebhook(app, event, { env: { DB: db } });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.received).toBe(true);
    });
  });

  describe("idempotency", () => {
    it("skips duplicate event IDs and returns duplicate:true", async () => {
      const { db } = createMockDb();
      const app = createApp({ STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET, DB: db });

      // Make the first() call return an existing event record
      const { mockPrepare } = createMockDb({ id: "evt_dup" });
      const idempotentDb = { prepare: mockPrepare } as unknown as D1Database;
      const idApp = createApp({ STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET, DB: idempotentDb });

      const event = {
        id: "evt_dup",
        type: "customer.subscription.updated",
        data: {
          object: {
            id: "sub_123",
            customer: "cus_123",
            status: "active",
            items: { data: [{ price: { lookup_key: "pro_monthly" } }] },
          },
        },
      };

      const res = await postWebhook(idApp, event, { env: { DB: idempotentDb } });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.received).toBe(true);
      expect(body.duplicate).toBe(true);
    });

    it("processes non-duplicate events normally", async () => {
      const { db } = createMockDb(null); // no existing event
      const app = createApp({ STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET, DB: db });

      const event = {
        id: "evt_new",
        type: "unknown.event",
        data: { object: {} },
      };

      const res = await postWebhook(app, event, { env: { DB: db } });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.received).toBe(true);
      expect(body.duplicate).toBeUndefined();
    });
  });

  describe("checkout.session.completed", () => {
    it("inserts new subscription record for new user", async () => {
      const prepareCalls: string[] = [];
      const mockRun = vi.fn().mockResolvedValue({ success: true });
      const mockPrepare = vi.fn().mockImplementation((sql: string) => {
        prepareCalls.push(sql);
        return {
          bind: (..._args: unknown[]) => ({
            first: vi.fn().mockResolvedValue(null),
            run: mockRun,
          }),
          first: vi.fn().mockResolvedValue(null),
          run: mockRun,
        };
      });
      const db = { prepare: mockPrepare } as unknown as D1Database;
      const app = createApp({ STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET, DB: db });

      const event = {
        id: "evt_checkout_new",
        type: "checkout.session.completed",
        data: {
          object: {
            customer: "cus_abc",
            subscription: "sub_abc",
            customer_email: "user@example.com",
            metadata: { userId: "user-456", tier: "pro" },
          },
        },
      };

      const res = await postWebhook(app, event, { env: { DB: db } });

      expect(res.status).toBe(200);
      expect(prepareCalls.some((s) => s.includes("INSERT INTO subscriptions"))).toBe(true);
    });

    it("updates existing subscription for returning user", async () => {
      const prepareCalls: string[] = [];
      const mockRun = vi.fn().mockResolvedValue({ success: true });
      const mockPrepare = vi.fn().mockImplementation((sql: string) => {
        prepareCalls.push(sql);
        return {
          bind: (..._args: unknown[]) => ({
            first: vi
              .fn()
              .mockResolvedValue(
                sql.includes("subscriptions WHERE user_id") ? { id: "existing-sub-id" } : null,
              ),
            run: mockRun,
          }),
          first: vi.fn().mockResolvedValue(null),
          run: mockRun,
        };
      });
      const db = { prepare: mockPrepare } as unknown as D1Database;
      const app = createApp({ STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET, DB: db });

      const event = {
        id: "evt_checkout_existing",
        type: "checkout.session.completed",
        data: {
          object: {
            customer: "cus_existing",
            subscription: "sub_new",
            metadata: { userId: "user-existing", tier: "business" },
          },
        },
      };

      const res = await postWebhook(app, event, { env: { DB: db } });

      expect(res.status).toBe(200);
      expect(prepareCalls.some((s) => s.includes("UPDATE subscriptions"))).toBe(true);
    });

    it("derives plan=business from session metadata tier field", async () => {
      const insertArgs: unknown[] = [];
      const mockPrepare = vi.fn().mockImplementation((sql: string) => ({
        bind: (...args: unknown[]) => ({
          first: vi.fn().mockResolvedValue(null),
          run: vi.fn().mockImplementation(async () => {
            if (sql.includes("INSERT INTO subscriptions")) insertArgs.push(...args);
            return { success: true };
          }),
        }),
        first: vi.fn().mockResolvedValue(null),
        run: vi.fn().mockResolvedValue({ success: true }),
      }));
      const db = { prepare: mockPrepare } as unknown as D1Database;
      const app = createApp({ STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET, DB: db });

      const event = {
        id: "evt_checkout_biz",
        type: "checkout.session.completed",
        data: {
          object: {
            customer: "cus_biz",
            subscription: "sub_biz",
            metadata: { userId: "user-biz", tier: "business" },
          },
        },
      };

      await postWebhook(app, event, { env: { DB: db } });

      expect(insertArgs).toContain("business");
    });

    it("defaults plan to pro when metadata tier is unrecognized", async () => {
      const insertArgs: unknown[] = [];
      const mockPrepare = vi.fn().mockImplementation((sql: string) => ({
        bind: (...args: unknown[]) => ({
          first: vi.fn().mockResolvedValue(null),
          run: vi.fn().mockImplementation(async () => {
            if (sql.includes("INSERT INTO subscriptions")) insertArgs.push(...args);
            return { success: true };
          }),
        }),
        first: vi.fn().mockResolvedValue(null),
        run: vi.fn().mockResolvedValue({ success: true }),
      }));
      const db = { prepare: mockPrepare } as unknown as D1Database;
      const app = createApp({ STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET, DB: db });

      const event = {
        id: "evt_checkout_unknown_tier",
        type: "checkout.session.completed",
        data: {
          object: {
            customer: "cus_unk",
            subscription: "sub_unk",
            metadata: { userId: "user-unk", tier: "elite" },
          },
        },
      };

      await postWebhook(app, event, { env: { DB: db } });

      expect(insertArgs).toContain("pro");
      expect(insertArgs).not.toContain("elite");
    });

    it("syncs customer_email to users table when present", async () => {
      const prepareCalls: string[] = [];
      const mockRun = vi.fn().mockResolvedValue({ success: true });
      const mockPrepare = vi.fn().mockImplementation((sql: string) => {
        prepareCalls.push(sql);
        return {
          bind: (..._args: unknown[]) => ({
            first: vi.fn().mockResolvedValue(null),
            run: mockRun,
          }),
          first: vi.fn().mockResolvedValue(null),
          run: mockRun,
        };
      });
      const db = { prepare: mockPrepare } as unknown as D1Database;
      const app = createApp({ STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET, DB: db });

      const event = {
        id: "evt_checkout_email",
        type: "checkout.session.completed",
        data: {
          object: {
            customer_email: "newuser@example.com",
            customer: "cus_email",
            subscription: "sub_email",
            metadata: { userId: "user-email", tier: "pro" },
          },
        },
      };

      await postWebhook(app, event, { env: { DB: db } });

      expect(prepareCalls.some((s) => s.includes("UPDATE users SET email"))).toBe(true);
    });

    it("skips email sync when customer_email is absent", async () => {
      const prepareCalls: string[] = [];
      const mockRun = vi.fn().mockResolvedValue({ success: true });
      const mockPrepare = vi.fn().mockImplementation((sql: string) => {
        prepareCalls.push(sql);
        return {
          bind: (..._args: unknown[]) => ({
            first: vi.fn().mockResolvedValue(null),
            run: mockRun,
          }),
          first: vi.fn().mockResolvedValue(null),
          run: mockRun,
        };
      });
      const db = { prepare: mockPrepare } as unknown as D1Database;
      const app = createApp({ STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET, DB: db });

      const event = {
        id: "evt_checkout_noemail",
        type: "checkout.session.completed",
        data: {
          object: {
            customer: "cus_noemail",
            subscription: "sub_noemail",
            metadata: { userId: "user-noemail", tier: "pro" },
          },
        },
      };

      await postWebhook(app, event, { env: { DB: db } });

      expect(prepareCalls.some((s) => s.includes("UPDATE users SET email"))).toBe(false);
    });

    it("returns 200 and skips subscription write when userId missing in metadata", async () => {
      const prepareCalls: string[] = [];
      const mockRun = vi.fn().mockResolvedValue({ success: true });
      const mockPrepare = vi.fn().mockImplementation((sql: string) => {
        prepareCalls.push(sql);
        return {
          bind: (..._args: unknown[]) => ({
            first: vi.fn().mockResolvedValue(null),
            run: mockRun,
          }),
          first: vi.fn().mockResolvedValue(null),
          run: mockRun,
        };
      });
      const db = { prepare: mockPrepare } as unknown as D1Database;
      const app = createApp({ STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET, DB: db });

      const event = {
        id: "evt_checkout_nouserid",
        type: "checkout.session.completed",
        data: {
          object: {
            customer: "cus_nouserid",
            subscription: "sub_nouserid",
            metadata: {},
          },
        },
      };

      const res = await postWebhook(app, event, { env: { DB: db } });

      expect(res.status).toBe(200);
      expect(prepareCalls.some((s) => s.includes("INSERT INTO subscriptions"))).toBe(false);
      expect(prepareCalls.some((s) => s.includes("UPDATE subscriptions"))).toBe(false);
    });
  });

  describe("customer.subscription.updated", () => {
    it("updates plan and status from lookup_key containing business", async () => {
      const updateArgs: Array<{ sql: string; args: unknown[] }> = [];
      const mockPrepare = vi.fn().mockImplementation((sql: string) => ({
        bind: (...args: unknown[]) => ({
          first: vi.fn().mockResolvedValue(null),
          run: vi.fn().mockImplementation(async () => {
            if (sql.includes("UPDATE subscriptions")) updateArgs.push({ sql, args });
            return { success: true };
          }),
        }),
        first: vi.fn().mockResolvedValue(null),
        run: vi.fn().mockResolvedValue({ success: true }),
      }));
      const db = { prepare: mockPrepare } as unknown as D1Database;
      const app = createApp({ STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET, DB: db });

      const event = {
        id: "evt_sub_updated",
        type: "customer.subscription.updated",
        data: {
          object: {
            id: "sub_xyz",
            customer: "cus_xyz",
            status: "active",
            items: { data: [{ price: { lookup_key: "business_monthly" } }] },
            current_period_end: Math.floor(Date.now() / 1000) + 3600,
          },
        },
      };

      const res = await postWebhook(app, event, { env: { DB: db } });

      expect(res.status).toBe(200);
      expect(updateArgs.length).toBeGreaterThan(0);
      expect(updateArgs[0]!.args).toContain("active");
      expect(updateArgs[0]!.args).toContain("business");
    });

    it("sets status to past_due when subscription is past_due", async () => {
      const updateArgs: unknown[][] = [];
      const mockPrepare = vi.fn().mockImplementation((sql: string) => ({
        bind: (...args: unknown[]) => ({
          first: vi.fn().mockResolvedValue(null),
          run: vi.fn().mockImplementation(async () => {
            if (sql.includes("UPDATE subscriptions")) updateArgs.push(args);
            return { success: true };
          }),
        }),
        first: vi.fn().mockResolvedValue(null),
        run: vi.fn().mockResolvedValue({ success: true }),
      }));
      const db = { prepare: mockPrepare } as unknown as D1Database;
      const app = createApp({ STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET, DB: db });

      const event = {
        id: "evt_past_due",
        type: "customer.subscription.updated",
        data: {
          object: {
            id: "sub_pastdue",
            customer: "cus_pastdue",
            status: "past_due",
            items: { data: [{ price: { lookup_key: "pro_monthly" } }] },
          },
        },
      };

      const res = await postWebhook(app, event, { env: { DB: db } });

      expect(res.status).toBe(200);
      expect(updateArgs[0]).toContain("past_due");
    });
  });

  describe("customer.subscription.deleted", () => {
    it("sets status=canceled and plan=free", async () => {
      const updateSqls: string[] = [];
      const updateArgsList: unknown[][] = [];
      const mockPrepare = vi.fn().mockImplementation((sql: string) => ({
        bind: (...args: unknown[]) => ({
          first: vi.fn().mockResolvedValue(null),
          run: vi.fn().mockImplementation(async () => {
            if (sql.includes("UPDATE subscriptions")) {
              updateSqls.push(sql);
              updateArgsList.push(args);
            }
            return { success: true };
          }),
        }),
        first: vi.fn().mockResolvedValue(null),
        run: vi.fn().mockResolvedValue({ success: true }),
      }));
      const db = { prepare: mockPrepare } as unknown as D1Database;
      const app = createApp({ STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET, DB: db });

      const event = {
        id: "evt_sub_deleted",
        type: "customer.subscription.deleted",
        data: {
          object: {
            id: "sub_canceled",
            customer: "cus_canceled",
            status: "canceled",
          },
        },
      };

      const res = await postWebhook(app, event, { env: { DB: db } });

      expect(res.status).toBe(200);
      expect(updateSqls.some((s) => s.includes("status = 'canceled'"))).toBe(true);
      expect(updateSqls.some((s) => s.includes("plan = 'free'"))).toBe(true);
    });
  });

  describe("invoice.payment_failed", () => {
    it("sets subscription status to past_due", async () => {
      const updateSqls: string[] = [];
      const updateArgs: unknown[][] = [];
      const mockPrepare = vi.fn().mockImplementation((sql: string) => ({
        bind: (...args: unknown[]) => ({
          first: vi.fn().mockResolvedValue(null),
          run: vi.fn().mockImplementation(async () => {
            if (sql.includes("UPDATE subscriptions")) {
              updateSqls.push(sql);
              updateArgs.push(args);
            }
            return { success: true };
          }),
        }),
        first: vi.fn().mockResolvedValue(null),
        run: vi.fn().mockResolvedValue({ success: true }),
      }));
      const db = { prepare: mockPrepare } as unknown as D1Database;
      const app = createApp({ STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET, DB: db });

      const event = {
        id: "evt_invoice_failed",
        type: "invoice.payment_failed",
        data: {
          object: {
            customer: "cus_failed",
            subscription: "sub_failed_payment",
          },
        },
      };

      const res = await postWebhook(app, event, { env: { DB: db } });

      expect(res.status).toBe(200);
      expect(updateSqls.some((s) => s.includes("status = 'past_due'"))).toBe(true);
      expect(updateArgs[0]).toContain("sub_failed_payment");
    });

    it("skips DB update when invoice has no subscription", async () => {
      const updateCalls: string[] = [];
      const mockPrepare = vi.fn().mockImplementation((sql: string) => ({
        bind: (..._args: unknown[]) => ({
          first: vi.fn().mockResolvedValue(null),
          run: vi.fn().mockImplementation(async () => {
            if (sql.includes("UPDATE subscriptions")) updateCalls.push(sql);
            return { success: true };
          }),
        }),
        first: vi.fn().mockResolvedValue(null),
        run: vi.fn().mockResolvedValue({ success: true }),
      }));
      const db = { prepare: mockPrepare } as unknown as D1Database;
      const app = createApp({ STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET, DB: db });

      const event = {
        id: "evt_invoice_no_sub",
        type: "invoice.payment_failed",
        data: {
          object: {
            customer: "cus_nosub",
            // no subscription field
          },
        },
      };

      const res = await postWebhook(app, event, { env: { DB: db } });

      expect(res.status).toBe(200);
      expect(updateCalls.filter((s) => s.includes("past_due"))).toHaveLength(0);
    });
  });

  describe("invoice.paid", () => {
    it("updates current_period_end (ms) and sets status active", async () => {
      const updateSqls: string[] = [];
      const updateArgs: unknown[][] = [];
      const futureTimestamp = Math.floor(Date.now() / 1000) + 86400;
      const mockPrepare = vi.fn().mockImplementation((sql: string) => ({
        bind: (...args: unknown[]) => ({
          first: vi.fn().mockResolvedValue(null),
          run: vi.fn().mockImplementation(async () => {
            if (sql.includes("UPDATE subscriptions")) {
              updateSqls.push(sql);
              updateArgs.push(args);
            }
            return { success: true };
          }),
        }),
        first: vi.fn().mockResolvedValue(null),
        run: vi.fn().mockResolvedValue({ success: true }),
      }));
      const db = { prepare: mockPrepare } as unknown as D1Database;
      const app = createApp({ STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET, DB: db });

      const event = {
        id: "evt_invoice_paid",
        type: "invoice.paid",
        data: {
          object: {
            customer: "cus_paid",
            subscription: "sub_paid",
            period_end: futureTimestamp,
          },
        },
      };

      const res = await postWebhook(app, event, { env: { DB: db } });

      expect(res.status).toBe(200);
      expect(updateSqls.some((s) => s.includes("status = 'active'"))).toBe(true);
      // period_end is converted from seconds to ms
      expect(updateArgs[0]).toContain(futureTimestamp * 1000);
    });
  });

  describe("unhandled event types", () => {
    it("returns 200 received:true for unknown event types", async () => {
      const { db } = createMockDb();
      const app = createApp({ STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET, DB: db });

      const event = {
        id: "evt_unknown",
        type: "some.unknown.event",
        data: { object: {} },
      };

      const res = await postWebhook(app, event, { env: { DB: db } });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.received).toBe(true);
    });
  });

  describe("checkout.session.completed — blog_support donation", () => {
    it("updates pending donation record when stripe_session_id matches", async () => {
      const prepareCalls: string[] = [];
      const runMock = vi.fn().mockResolvedValue({ success: true, meta: { changes: 1 } });
      const mockPrepare = vi.fn().mockImplementation((sql: string) => {
        prepareCalls.push(sql);
        return {
          bind: (..._args: unknown[]) => ({
            first: vi.fn().mockResolvedValue(null),
            run: runMock,
            all: vi.fn().mockResolvedValue({ results: [] }),
          }),
          first: vi.fn().mockResolvedValue(null),
          run: runMock,
          all: vi.fn().mockResolvedValue({ results: [] }),
        };
      });
      const db = {
        prepare: mockPrepare,
        batch: vi.fn().mockResolvedValue([]),
      } as unknown as D1Database;
      const app = createApp({ STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET, DB: db });

      const event = {
        id: "evt_blog_support",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_test_session_1",
            customer_email: "donor@example.com",
            metadata: {
              type: "blog_support",
              slug: "my-post",
              amount: "5.00",
              client_id: "client-123",
            },
          },
        },
      };

      const res = await postWebhook(app, event, { env: { DB: db } });
      expect(res.status).toBe(200);
      expect(prepareCalls.some((s) => s.includes("UPDATE support_donations"))).toBe(true);
    });

    it("inserts donation record when no existing pending record", async () => {
      const prepareCalls: string[] = [];
      const runMock = vi.fn().mockResolvedValue({ success: true, meta: { changes: 0 } });
      const mockPrepare = vi.fn().mockImplementation((sql: string) => {
        prepareCalls.push(sql);
        return {
          bind: (..._args: unknown[]) => ({
            first: vi.fn().mockResolvedValue(null),
            run: runMock,
            all: vi.fn().mockResolvedValue({ results: [] }),
          }),
          first: vi.fn().mockResolvedValue(null),
          run: runMock,
          all: vi.fn().mockResolvedValue({ results: [] }),
        };
      });
      const db = {
        prepare: mockPrepare,
        batch: vi.fn().mockResolvedValue([]),
      } as unknown as D1Database;
      const app = createApp({ STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET, DB: db });

      const event = {
        id: "evt_blog_support_insert",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_test_no_pending",
            metadata: {
              type: "blog_support",
              slug: "another-post",
              amount: "10.00",
            },
          },
        },
      };

      const res = await postWebhook(app, event, { env: { DB: db } });
      expect(res.status).toBe(200);
      expect(prepareCalls.some((s) => s.includes("INSERT INTO support_donations"))).toBe(true);
    });

    it("tracks experiment assignment when client_id and amount present", async () => {
      const batchMock = vi.fn().mockResolvedValue([]);
      const mockPrepare = vi.fn().mockImplementation((sql: string) => ({
        bind: (..._args: unknown[]) => ({
          first: vi.fn().mockResolvedValue(null),
          run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 1 } }),
          all: vi.fn().mockResolvedValue({
            results: sql.includes("experiment_assignments")
              ? [{ experiment_id: "exp-1", variant_id: "control" }]
              : [],
          }),
        }),
        first: vi.fn().mockResolvedValue(null),
        run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 1 } }),
        all: vi.fn().mockResolvedValue({
          results: sql.includes("experiment_assignments")
            ? [{ experiment_id: "exp-1", variant_id: "control" }]
            : [],
        }),
      }));
      const db = { prepare: mockPrepare, batch: batchMock } as unknown as D1Database;
      const app = createApp({ STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET, DB: db });

      const event = {
        id: "evt_blog_exp_track",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_with_client",
            metadata: {
              type: "blog_support",
              slug: "tracked-post",
              amount: "25.00",
              client_id: "client-with-exp",
            },
          },
        },
      };

      const res = await postWebhook(app, event, { env: { DB: db } });
      expect(res.status).toBe(200);
      // batch should be called for experiment tracking metrics
      expect(batchMock).toHaveBeenCalled();
    });
  });

  describe("invoice.paid — error handling", () => {
    it("handles invoice.paid when period_end is not a number", async () => {
      const prepareCalls: string[] = [];
      const runMock = vi.fn().mockResolvedValue({ success: true });
      const mockPrepare = vi.fn().mockImplementation((sql: string) => {
        prepareCalls.push(sql);
        return {
          bind: (..._args: unknown[]) => ({ first: vi.fn().mockResolvedValue(null), run: runMock }),
          first: vi.fn().mockResolvedValue(null),
          run: runMock,
        };
      });
      const db = { prepare: mockPrepare } as unknown as D1Database;
      const app = createApp({ STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET, DB: db });

      const event = {
        id: "evt_invoice_no_period",
        type: "invoice.paid",
        data: {
          object: {
            customer: "cus_test",
            subscription: "sub_test",
            // period_end is missing/not a number
            period_end: "not-a-number",
          },
        },
      };

      const res = await postWebhook(app, event, { env: { DB: db } });
      expect(res.status).toBe(200);
      // Should still update but period_end becomes null
      expect(prepareCalls.some((s) => s.includes("UPDATE subscriptions"))).toBe(true);
    });
  });

  describe("signature format edge cases", () => {
    it("returns 400 when stripe-signature has no timestamp (t= missing)", async () => {
      const { db } = createMockDb();
      const app = createApp({ STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET, DB: db });
      const res = await app.request(
        "/stripe/webhook",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "stripe-signature": "v1=abc123", // missing t=
          },
          body: "{}",
        },
        { STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET, DB: db } as unknown as Env,
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 when signature length mismatch (covers constant-time compare)", async () => {
      const { db } = createMockDb();
      const app = createApp({ STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET, DB: db });
      const ts = Math.floor(Date.now() / 1000);
      const res = await app.request(
        "/stripe/webhook",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "stripe-signature": `t=${ts},v1=abc`, // too short, different length
          },
          body: "{}",
        },
        { STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET, DB: db } as unknown as Env,
      );
      expect(res.status).toBe(400);
    });
  });
});
