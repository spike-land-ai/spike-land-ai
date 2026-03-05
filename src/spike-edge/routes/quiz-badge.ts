import { Hono } from "hono";
import { generateBadgeToken } from "@spike-land-ai/shared";
import type { Env } from "../env.js";

const quizBadge = new Hono<{ Bindings: Env }>();

// GET /quiz/badge/:token - Verify badge and render HTML with og: meta tags
quizBadge.get("/quiz/badge/:token", async (c) => {
  const token = c.req.param("token");
  const secret = c.env.QUIZ_BADGE_SECRET;

  if (!secret) {
    return c.json({ error: "Badge service not configured" }, 500);
  }

  const parts = token.split(".");
  if (parts.length !== 2) {
    return c.json({ error: "Invalid badge token" }, 400);
  }

  const [payloadB64, sigB64] = parts;
  if (!payloadB64 || !sigB64) {
    return c.json({ error: "Invalid badge token" }, 400);
  }

  let payload: { sid: string; topic: string; score: number; ts: number };
  try {
    const payloadStr = atob(payloadB64);
    payload = JSON.parse(payloadStr);
  } catch {
    return c.json({ error: "Invalid badge payload" }, 400);
  }

  const expectedToken = generateBadgeToken(payload, secret);
  const expectedSig = expectedToken.split(".")[1];
  if (sigB64 !== expectedSig) {
    return c.json({ error: "Invalid badge signature" }, 403);
  }

  const completedDate = new Date(payload.ts).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Determine score color
  const scoreColor = payload.score >= 80 ? "#10b981" : payload.score >= 60 ? "#f59e0b" : "#ef4444";
  const scoreLabel = payload.score >= 80 ? "Excellent" : payload.score >= 60 ? "Good" : "Passing";

  const title = `${payload.topic} - Learning Badge`;
  const description = `Scored ${payload.score}% (${scoreLabel}) on ${completedDate}`;
  const badgeUrl = `https://spike.land/quiz/badge/${token}`;

  // Return HTML with og: meta tags for social sharing
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${escapeHtml(badgeUrl)}">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f3f4f6; display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 20px; }
    .badge { background: white; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.1); padding: 40px; text-align: center; max-width: 420px; width: 100%; }
    .badge-icon { font-size: 48px; margin-bottom: 16px; }
    .badge-topic { font-size: 24px; font-weight: 700; color: #111827; margin-bottom: 8px; }
    .badge-score { font-size: 48px; font-weight: 800; color: ${scoreColor}; margin: 16px 0; }
    .badge-label { font-size: 14px; font-weight: 600; color: ${scoreColor}; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 16px; }
    .badge-date { font-size: 14px; color: #6b7280; }
    .badge-footer { margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; }
    .badge-footer a { color: #3b82f6; text-decoration: none; }
  </style>
</head>
<body>
  <div class="badge">
    <div class="badge-icon">&#x1F393;</div>
    <div class="badge-topic">${escapeHtml(payload.topic)}</div>
    <div class="badge-score">${payload.score}%</div>
    <div class="badge-label">${escapeHtml(scoreLabel)}</div>
    <div class="badge-date">Completed ${escapeHtml(completedDate)}</div>
    <div class="badge-footer">
      Verified learning badge from <a href="https://spike.land">spike.land</a>
    </div>
  </div>
</body>
</html>`;

  return c.html(html);
});

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

export { escapeHtml, quizBadge };
