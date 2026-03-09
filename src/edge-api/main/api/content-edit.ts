import { Hono } from "hono";
import type { Env } from "../core-logic/env.js";

const contentEdit = new Hono<{ Bindings: Env }>();

const SLUG_RE = /^[a-z0-9-]+$/i;

contentEdit.post("/api/blog/:slug/edit", async (c) => {
  const slug = c.req.param("slug");

  if (!SLUG_RE.test(slug)) {
    return c.json({ error: "Invalid slug: must be alphanumeric with hyphens only" }, 400);
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  if (
    typeof body !== "object" ||
    body === null ||
    typeof (body as Record<string, unknown>).content !== "string" ||
    ((body as Record<string, unknown>).content as string).trim().length === 0
  ) {
    return c.json({ error: "content is required and must be a non-empty string" }, 400);
  }

  const content = (body as Record<string, string>).content;
  const token = c.env.GITHUB_TOKEN;
  const branch = `content-edit/${slug}-${Date.now()}`;
  const filePath = `content/blog/${slug}.mdx`;
  const repo = "spike-land-ai/spike-land-ai";
  const apiBase = `https://api.github.com/repos/${repo}`;

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
    "User-Agent": "spike-land-ai-edge",
  };

  // Get default branch SHA
  const repoRes = await fetch(`${apiBase}`, { headers });
  if (!repoRes.ok) {
    return c.json({ error: "Failed to fetch repository info" }, 502);
  }
  const repoData = (await repoRes.json()) as { default_branch: string };
  const defaultBranch = repoData.default_branch ?? "main";

  const refRes = await fetch(`${apiBase}/git/ref/heads/${defaultBranch}`, { headers });
  if (!refRes.ok) {
    return c.json({ error: "Failed to fetch branch ref" }, 502);
  }
  const refData = (await refRes.json()) as { object: { sha: string } };
  const baseSha = refData.object.sha;

  // Create new branch
  const createBranchRes = await fetch(`${apiBase}/git/refs`, {
    method: "POST",
    headers,
    body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: baseSha }),
  });
  if (!createBranchRes.ok) {
    return c.json({ error: "Failed to create branch" }, 502);
  }

  // Get current file SHA (if exists) to allow update
  let existingFileSha: string | undefined;
  const fileRes = await fetch(`${apiBase}/contents/${filePath}?ref=${defaultBranch}`, { headers });
  if (fileRes.ok) {
    const fileData = (await fileRes.json()) as { sha: string };
    existingFileSha = fileData.sha;
  }

  // Commit file to new branch
  const commitBody: Record<string, unknown> = {
    message: `Content edit: ${slug}`,
    content: btoa(unescape(encodeURIComponent(content!))),
    branch,
  };
  if (existingFileSha) commitBody.sha = existingFileSha;

  const commitRes = await fetch(`${apiBase}/contents/${filePath}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(commitBody),
  });
  if (!commitRes.ok) {
    return c.json({ error: "Failed to commit file" }, 502);
  }

  // Create PR
  const prRes = await fetch(`${apiBase}/pulls`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      title: `Content edit: ${slug}`,
      head: branch,
      base: defaultBranch,
      body: `Automated content edit for blog post \`${slug}\`.`,
    }),
  });
  if (!prRes.ok) {
    return c.json({ error: "Failed to create pull request" }, 502);
  }
  const prData = (await prRes.json()) as { html_url: string; number: number };

  // Add label (best-effort)
  await fetch(`${apiBase}/issues/${prData.number}/labels`, {
    method: "POST",
    headers,
    body: JSON.stringify({ labels: ["content-edit"] }),
  });

  return c.json({ prUrl: prData.html_url, prNumber: prData.number });
});

export default contentEdit;
