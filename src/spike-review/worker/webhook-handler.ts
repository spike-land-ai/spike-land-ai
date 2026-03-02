/**
 * Webhook Handler
 *
 * HMAC-SHA256 signature verification and event routing
 * for GitHub webhook payloads.
 */

import type { Env } from "./env.js";

export interface WebhookPayload {
  action: string;
  pull_request?: {
    number: number;
    title: string;
    draft: boolean;
    user: { login: string; type: string };
    head: { sha: string; ref: string };
    base: { ref: string; repo: { name: string; owner: { login: string } } };
    additions: number;
    deletions: number;
    changed_files: number;
  };
}

export interface PRContext {
  owner: string;
  repo: string;
  prNumber: number;
  headSha: string;
  action: string;
}

const SUPPORTED_ACTIONS = new Set(["opened", "synchronize", "ready_for_review"]);

const BOT_SUFFIXES = ["[bot]"];

const LOCKFILE_ONLY_PATTERNS = [
  /^package-lock\.json$/,
  /^yarn\.lock$/,
  /^pnpm-lock\.yaml$/,
  /\.lockb$/,
];

// ── HMAC Verification ───────────────────────────────────────────────────────

export async function verifySignature(
  payload: string,
  signature: string | null,
  secret: string,
): Promise<boolean> {
  if (!signature || !signature.startsWith("sha256=")) {
    return false;
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const computed =
    "sha256=" +
    Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

  return computed === signature;
}

// ── Event Filtering ─────────────────────────────────────────────────────────

export function shouldSkipEvent(payload: WebhookPayload): {
  skip: boolean;
  reason?: string;
} {
  const pr = payload.pull_request;
  if (!pr) {
    return { skip: true, reason: "Not a pull_request event" };
  }

  if (!SUPPORTED_ACTIONS.has(payload.action)) {
    return { skip: true, reason: `Unsupported action: ${payload.action}` };
  }

  if (pr.draft) {
    return { skip: true, reason: "PR is a draft" };
  }

  const author = pr.user.login;
  if (pr.user.type === "Bot" || BOT_SUFFIXES.some((suffix) => author.endsWith(suffix))) {
    return { skip: true, reason: `Author is a bot: ${author}` };
  }

  return { skip: false };
}

export function isLockfileOnly(changedFiles: string[]): boolean {
  return (
    changedFiles.length > 0 &&
    changedFiles.every((f) => LOCKFILE_ONLY_PATTERNS.some((pattern) => pattern.test(f)))
  );
}

// ── Request Handler ─────────────────────────────────────────────────────────

export async function handleWebhook(
  request: Request,
  env: Env,
): Promise<{
  status: number;
  body: string;
  context?: PRContext;
}> {
  const event = request.headers.get("X-GitHub-Event");
  if (event !== "pull_request") {
    return { status: 200, body: `Ignored event: ${event ?? "unknown"}` };
  }

  const body = await request.text();
  const signature = request.headers.get("X-Hub-Signature-256");

  const valid = await verifySignature(body, signature, env.GITHUB_WEBHOOK_SECRET);
  if (!valid) {
    return { status: 401, body: "Invalid signature" };
  }

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(body) as WebhookPayload;
  } catch {
    return { status: 400, body: "Invalid JSON" };
  }
  const skipCheck = shouldSkipEvent(payload);
  if (skipCheck.skip) {
    return { status: 200, body: `Skipped: ${skipCheck.reason ?? "unknown"}` };
  }

  const pr = payload.pull_request;
  if (!pr) {
    return { status: 400, body: "Missing pull_request payload" };
  }
  const context: PRContext = {
    owner: pr.base.repo.owner.login,
    repo: pr.base.repo.name,
    prNumber: pr.number,
    headSha: pr.head.sha,
    action: payload.action,
  };

  return { status: 202, body: "Review queued", context };
}
