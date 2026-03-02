/**
 * Webhook Handler Tests
 *
 * Tests HMAC verification, event filtering, and request handling.
 */

import { describe, expect, it } from "vitest";
import {
  handleWebhook,
  isLockfileOnly,
  shouldSkipEvent,
  verifySignature,
} from "./webhook-handler.js";
import type { WebhookPayload } from "./webhook-handler.js";
import type { Env } from "./env.js";

// ── Test Helpers ────────────────────────────────────────────────────────────

function makePRPayload(
  overrides?: Partial<{
    action: string;
    draft: boolean;
    login: string;
    userType: string;
  }>,
): WebhookPayload {
  return {
    action: overrides?.action ?? "opened",
    pull_request: {
      number: 42,
      title: "Test PR",
      draft: overrides?.draft ?? false,
      user: {
        login: overrides?.login ?? "testuser",
        type: overrides?.userType ?? "User",
      },
      head: { sha: "abc123", ref: "feature/test" },
      base: {
        ref: "main",
        repo: { name: "my-repo", owner: { login: "my-org" } },
      },
      additions: 10,
      deletions: 5,
      changed_files: 2,
    },
  };
}

async function computeHMAC(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return (
    "sha256=" +
    Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

const TEST_SECRET = "test-webhook-secret";

const mockEnv: Env = {
  GITHUB_TOKEN: "ghp_test",
  GITHUB_WEBHOOK_SECRET: TEST_SECRET,
  CLAUDE_CODE_OAUTH_TOKEN: "oauth_test",
};

// ── verifySignature ─────────────────────────────────────────────────────────

describe("verifySignature", () => {
  it("returns true for valid signature", async () => {
    const body = '{"action":"opened"}';
    const sig = await computeHMAC(body, TEST_SECRET);
    expect(await verifySignature(body, sig, TEST_SECRET)).toBe(true);
  });

  it("returns false for wrong secret", async () => {
    const body = '{"action":"opened"}';
    const sig = await computeHMAC(body, "wrong-secret");
    expect(await verifySignature(body, sig, TEST_SECRET)).toBe(false);
  });

  it("returns false for null signature", async () => {
    expect(await verifySignature("{}", null, TEST_SECRET)).toBe(false);
  });

  it("returns false for missing sha256= prefix", async () => {
    expect(await verifySignature("{}", "invalid", TEST_SECRET)).toBe(false);
  });

  it("returns false for tampered payload", async () => {
    const sig = await computeHMAC('{"action":"opened"}', TEST_SECRET);
    expect(await verifySignature('{"action":"closed"}', sig, TEST_SECRET)).toBe(false);
  });
});

// ── shouldSkipEvent ─────────────────────────────────────────────────────────

describe("shouldSkipEvent", () => {
  it("does not skip opened PRs", () => {
    const result = shouldSkipEvent(makePRPayload({ action: "opened" }));
    expect(result.skip).toBe(false);
  });

  it("does not skip synchronize PRs", () => {
    const result = shouldSkipEvent(makePRPayload({ action: "synchronize" }));
    expect(result.skip).toBe(false);
  });

  it("does not skip ready_for_review PRs", () => {
    const result = shouldSkipEvent(makePRPayload({ action: "ready_for_review" }));
    expect(result.skip).toBe(false);
  });

  it("skips unsupported actions", () => {
    const result = shouldSkipEvent(makePRPayload({ action: "closed" }));
    expect(result.skip).toBe(true);
    expect(result.reason).toContain("Unsupported action");
  });

  it("skips draft PRs", () => {
    const result = shouldSkipEvent(makePRPayload({ draft: true }));
    expect(result.skip).toBe(true);
    expect(result.reason).toContain("draft");
  });

  it("skips bot users by type", () => {
    const result = shouldSkipEvent(makePRPayload({ login: "dependabot", userType: "Bot" }));
    expect(result.skip).toBe(true);
    expect(result.reason).toContain("bot");
  });

  it("skips bot users by suffix", () => {
    const result = shouldSkipEvent(makePRPayload({ login: "renovate[bot]" }));
    expect(result.skip).toBe(true);
    expect(result.reason).toContain("bot");
  });

  it("skips non-PR events", () => {
    const result = shouldSkipEvent({ action: "created" });
    expect(result.skip).toBe(true);
    expect(result.reason).toContain("Not a pull_request");
  });
});

// ── isLockfileOnly ──────────────────────────────────────────────────────────

describe("isLockfileOnly", () => {
  it("returns true for only lockfiles", () => {
    expect(isLockfileOnly(["package-lock.json", "yarn.lock"])).toBe(true);
  });

  it("returns true for pnpm lockfile", () => {
    expect(isLockfileOnly(["pnpm-lock.yaml"])).toBe(true);
  });

  it("returns true for bun lockfile", () => {
    expect(isLockfileOnly(["bun.lockb"])).toBe(true);
  });

  it("returns false when non-lockfiles present", () => {
    expect(isLockfileOnly(["package-lock.json", "src/index.ts"])).toBe(false);
  });

  it("returns false for empty array", () => {
    expect(isLockfileOnly([])).toBe(false);
  });
});

// ── handleWebhook ───────────────────────────────────────────────────────────

describe("handleWebhook", () => {
  it("ignores non-pull_request events", async () => {
    const request = new Request("https://example.com/webhook", {
      method: "POST",
      headers: { "X-GitHub-Event": "push" },
      body: "{}",
    });
    const result = await handleWebhook(request, mockEnv);
    expect(result.status).toBe(200);
    expect(result.body).toContain("Ignored event");
  });

  it("rejects invalid signature", async () => {
    const body = JSON.stringify(makePRPayload());
    const request = new Request("https://example.com/webhook", {
      method: "POST",
      headers: {
        "X-GitHub-Event": "pull_request",
        "X-Hub-Signature-256": "sha256=invalid",
      },
      body,
    });
    const result = await handleWebhook(request, mockEnv);
    expect(result.status).toBe(401);
  });

  it("accepts valid webhook and returns context", async () => {
    const payload = makePRPayload();
    const body = JSON.stringify(payload);
    const sig = await computeHMAC(body, TEST_SECRET);
    const request = new Request("https://example.com/webhook", {
      method: "POST",
      headers: {
        "X-GitHub-Event": "pull_request",
        "X-Hub-Signature-256": sig,
      },
      body,
    });
    const result = await handleWebhook(request, mockEnv);
    expect(result.status).toBe(202);
    expect(result.context).toBeDefined();
    expect(result.context?.owner).toBe("my-org");
    expect(result.context?.repo).toBe("my-repo");
    expect(result.context?.prNumber).toBe(42);
  });

  it("skips draft PRs with valid signature", async () => {
    const payload = makePRPayload({ draft: true });
    const body = JSON.stringify(payload);
    const sig = await computeHMAC(body, TEST_SECRET);
    const request = new Request("https://example.com/webhook", {
      method: "POST",
      headers: {
        "X-GitHub-Event": "pull_request",
        "X-Hub-Signature-256": sig,
      },
      body,
    });
    const result = await handleWebhook(request, mockEnv);
    expect(result.status).toBe(200);
    expect(result.body).toContain("Skipped");
    expect(result.context).toBeUndefined();
  });
});
