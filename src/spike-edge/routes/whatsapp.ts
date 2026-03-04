import { Hono } from "hono";
import type { Env } from "../env.js";
import { resolveEffectiveTier } from "../lib/tier-service.js";
import { recordEloEvent } from "../lib/elo-service.js";
import { parseCommand, dispatchCommand } from "../lib/whatsapp-commands.js";
import type { Tier } from "../lib/whatsapp-commands.js";

const whatsapp = new Hono<{ Bindings: Env }>();

// --- Helpers ---

async function hashPhone(phone: string): Promise<string> {
  const data = new TextEncoder().encode(phone);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function verifyHmac(
  body: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const expected = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return expected === signature;
}

function generateOtp(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return String((array[0] ?? 0) % 1000000).padStart(6, "0");
}

const RATE_LIMITS: Record<Tier, number> = {
  free: 50,
  pro: 500,
  business: 5000,
};

async function checkRateLimit(
  env: Env,
  phoneHash: string,
  tier: Tier,
): Promise<{ allowed: boolean; remaining: number }> {
  const key = `wa:${phoneHash}`;
  const id = env.LIMITERS.idFromName(key);
  const stub = env.LIMITERS.get(id);

  const resp = await stub.fetch(
    new Request("https://limiter.internal/", { method: "POST" }),
  );
  const cooldown = Number(await resp.text());

  const limit = RATE_LIMITS[tier];
  if (cooldown > 0) {
    return { allowed: false, remaining: 0 };
  }

  // Also check daily count from message log
  const today = new Date().toISOString().split("T")[0];
  const count = await env.DB.prepare(
    "SELECT COUNT(*) as cnt FROM whatsapp_message_log WHERE phone_hash = ? AND created_at > ?",
  )
    .bind(phoneHash, new Date(`${today}T00:00:00Z`).getTime())
    .first<{ cnt: number }>();

  const used = count?.cnt ?? 0;
  if (used >= limit) {
    return { allowed: false, remaining: 0 };
  }

  return { allowed: true, remaining: limit - used };
}

async function sendWhatsAppReply(
  env: Env,
  phone: string,
  message: string,
): Promise<void> {
  await fetch(
    `https://graph.facebook.com/v21.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phone,
        type: "text",
        text: { body: message },
      }),
    },
  );
}

// --- Linking API (requires authMiddleware applied in index.ts) ---

whatsapp.post("/whatsapp/link/initiate", async (c) => {
  const userId = c.get("userId" as never) as string;
  const code = generateOtp();
  const now = Date.now();
  const expiresAt = now + 10 * 60 * 1000; // 10 minutes

  // Upsert: if existing unverified link, update it
  const existing = await c.env.DB.prepare(
    "SELECT id FROM whatsapp_links WHERE user_id = ? AND verified_at IS NULL",
  )
    .bind(userId)
    .first<{ id: string }>();

  if (existing) {
    await c.env.DB.prepare(
      "UPDATE whatsapp_links SET link_code = ?, link_code_expires_at = ?, updated_at = ? WHERE id = ?",
    )
      .bind(code, expiresAt, now, existing.id)
      .run();
  } else {
    await c.env.DB.prepare(
      "INSERT INTO whatsapp_links (id, user_id, link_code, link_code_expires_at, created_at, updated_at) VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?)",
    )
      .bind(userId, code, expiresAt, now, now)
      .run();
  }

  return c.json({ code });
});

whatsapp.post("/whatsapp/link/verify", async (c) => {
  const userId = c.get("userId" as never) as string;
  const body = await c.req.json<{ code: string }>();

  if (!body.code || typeof body.code !== "string") {
    return c.json({ error: "code is required" }, 400);
  }

  const now = Date.now();
  const link = await c.env.DB.prepare(
    "SELECT id, link_code, link_code_expires_at FROM whatsapp_links WHERE user_id = ? AND verified_at IS NULL",
  )
    .bind(userId)
    .first<{ id: string; link_code: string; link_code_expires_at: number }>();

  if (!link) {
    return c.json({ error: "No pending link found. Use /whatsapp/link/initiate first." }, 404);
  }

  if (now > link.link_code_expires_at) {
    return c.json({ error: "Link code expired. Request a new one." }, 410);
  }

  if (link.link_code !== body.code) {
    return c.json({ error: "Invalid code" }, 400);
  }

  await c.env.DB.prepare(
    "UPDATE whatsapp_links SET verified_at = ?, updated_at = ? WHERE id = ?",
  )
    .bind(now, now, link.id)
    .run();

  return c.json({ linked: true });
});

whatsapp.delete("/whatsapp/link", async (c) => {
  const userId = c.get("userId" as never) as string;

  await c.env.DB.prepare("DELETE FROM whatsapp_links WHERE user_id = ?")
    .bind(userId)
    .run();

  return c.json({ unlinked: true });
});

whatsapp.get("/whatsapp/link/status", async (c) => {
  const userId = c.get("userId" as never) as string;

  const link = await c.env.DB.prepare(
    "SELECT phone_hash, verified_at, created_at FROM whatsapp_links WHERE user_id = ?",
  )
    .bind(userId)
    .first<{ phone_hash: string | null; verified_at: number | null; created_at: number }>();

  if (!link) {
    return c.json({ linked: false });
  }

  return c.json({
    linked: link.verified_at !== null,
    hasPhone: link.phone_hash !== null,
    linkedAt: link.verified_at,
    createdAt: link.created_at,
  });
});

// --- Webhook verification (Meta handshake) ---

whatsapp.get("/whatsapp/webhook", async (c) => {
  const mode = c.req.query("hub.mode");
  const token = c.req.query("hub.verify_token");
  const challenge = c.req.query("hub.challenge");

  if (mode === "subscribe" && token === c.env.WHATSAPP_VERIFY_TOKEN) {
    return c.text(challenge ?? "", 200);
  }

  return c.text("Forbidden", 403);
});

// --- Webhook (no auth — uses HMAC verification) ---

whatsapp.post("/whatsapp/webhook", async (c) => {
  // 1. Verify HMAC signature
  const sigHeader = c.req.header("X-Hub-Signature-256") ?? "";
  const signature = sigHeader.replace("sha256=", "");
  if (!signature) {
    return c.json({ error: "Missing signature" }, 401);
  }

  const rawBody = await c.req.text();

  const valid = await verifyHmac(rawBody, signature, c.env.WHATSAPP_APP_SECRET);
  if (!valid) {
    return c.json({ error: "Invalid signature" }, 401);
  }

  // 2. Parse Meta webhook payload
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  // Extract message from Meta's nested structure
  const entry = (body as Record<string, unknown[]>).entry as
    Array<{ changes: Array<{ value: { messages?: Array<{ from: string; text?: { body: string }; id: string; type: string }>; statuses?: unknown[] } }> }> | undefined;
  const value = entry?.[0]?.changes?.[0]?.value;

  // Status webhooks (no messages) — acknowledge immediately
  if (!value?.messages || value.messages.length === 0) {
    return c.json({ ok: true });
  }

  const msg = value.messages[0]!;

  // Non-text messages — acknowledge immediately
  if (msg.type !== "text" || !msg.text?.body) {
    return c.json({ ok: true });
  }

  const payload = {
    phone: msg.from,
    message: msg.text.body,
    messageId: msg.id,
  };

  // 3. Hash phone and look up user
  const phoneHash = await hashPhone(payload.phone);

  const link = await c.env.DB.prepare(
    "SELECT user_id FROM whatsapp_links WHERE phone_hash = ? AND verified_at IS NOT NULL",
  )
    .bind(phoneHash)
    .first<{ user_id: string }>();

  // 4. If unlinked, send invitation
  if (!link) {
    try {
      c.executionCtx.waitUntil(
        sendWhatsAppReply(
          c.env,
          payload.phone,
          "Your WhatsApp is not linked to a spike.land account. Visit https://spike.land/settings to link your number.",
        ),
      );
    } catch { /* no ExecutionContext in tests */ }
    return c.json({ ok: true, action: "link_invitation_sent" });
  }

  const userId = link.user_id;

  // 5. Resolve tier
  const tier = await resolveEffectiveTier(c.env.DB, userId);

  // 6. Rate limit check
  const rateResult = await checkRateLimit(c.env, phoneHash, tier);
  if (!rateResult.allowed) {
    try {
      c.executionCtx.waitUntil(
        Promise.all([
          sendWhatsAppReply(c.env, payload.phone, "Rate limit exceeded. Please try again later."),
          recordEloEvent(c.env.DB, userId, "rate_limit_hit", payload.messageId),
        ]),
      );
    } catch { /* no ExecutionContext in tests */ }
    return c.json({ ok: true, action: "rate_limited" });
  }

  // 7. Parse command and dispatch
  const cmd = parseCommand(payload.message);

  const ctx = {
    db: c.env.DB,
    userId,
    tier,
    env: c.env,
    phoneHash,
  };

  let reply: string;
  try {
    reply = await dispatchCommand(cmd, ctx);
  } catch (err) {
    console.error("[whatsapp] Command dispatch error:", err);
    reply = "An error occurred processing your request. Please try again.";
  }

  // 8. Log message and send reply
  const now = Date.now();
  const logWork = c.env.DB.prepare(
    "INSERT INTO whatsapp_message_log (id, user_id, phone_hash, direction, command, message_preview, status, created_at) VALUES (lower(hex(randomblob(16))), ?, ?, 'inbound', ?, ?, 'ok', ?)",
  )
    .bind(userId, phoneHash, cmd.name, payload.message.slice(0, 100), now)
    .run();

  const eloWork = cmd.name !== "chat" && cmd.name !== "help"
    ? recordEloEvent(c.env.DB, userId, "whatsapp_productive_use", payload.messageId)
    : Promise.resolve();

  try {
    c.executionCtx.waitUntil(
      Promise.all([
        logWork,
        eloWork,
        sendWhatsAppReply(c.env, payload.phone, reply),
      ]),
    );
  } catch { /* no ExecutionContext in tests */ }

  return c.json({ ok: true, action: "processed", command: cmd.name });
});

export { whatsapp };
