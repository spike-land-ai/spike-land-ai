# Contributing to spike.land

## The Model: Intent-Driven Development

spike.land uses a unique contribution model. You don't need to write code. You write **intent**.

### How it works

1. **Open a PR with your intent** — describe WHAT you want to change and WHY
2. **Our agents read your intent** — Claude Code agents parse your description
3. **Agents implement the change** — code generation, tests, type checking
4. **Community reviews the output** — humans verify the result matches the intent
5. **Merge** — if tests pass and the community approves

### What a good intent PR looks like

```markdown
## Intent
Add a rate limiter to the /api/evaluate endpoint

## Why
The endpoint is currently unprotected and could be abused.
Load testing showed it can handle 100 req/s but we want to cap at 20.

## Acceptance criteria
- Requests above 20/s per IP return 429
- Rate limit headers included in response
- Existing tests still pass
```

### What you DON'T need to do
- Write the implementation code
- Know TypeScript
- Understand the full codebase
- Set up a local dev environment

### What you DO need to do
- Clearly describe what you want
- Explain why it matters
- Define how to verify it works

## Traditional contributions

If you prefer to write code directly, that's welcome too. Follow these guidelines:

- TypeScript strict mode, no `any`, no `eslint-disable`
- Run `npm test` before submitting
- Follow the existing patterns in CLAUDE.md

## Architecture overview

All packages live under `src/`. See CLAUDE.md for the full map.

| Layer | Packages | Purpose |
|-------|----------|---------|
| Frontend | spike-app | Vite + TanStack Router SPA |
| Edge API | spike-edge, spike-land-mcp, mcp-auth | Cloudflare Workers + Hono |
| MCP Tools | 80+ tools across multiple servers | Business logic as composable tools |
| Infrastructure | shared, tsconfig, eslint-config | Shared config and types |

## Free APIs

All spike.land APIs are free. No paid tiers. No API keys required for public endpoints. The MCP registry (spike-land-mcp) exposes 80+ tools at no cost.

## Code of Conduct

Be kind. Be curious. Argue with evidence, not authority. If you disagree with a decision, open an issue with your reasoning. The best argument wins, regardless of who makes it.

## License

MIT. See LICENSE file.
