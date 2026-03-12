# Sentry Setup

This repo now has first-pass Sentry wiring for:

- `packages/spike-web` via `@sentry/browser` and `@sentry/vite-plugin`
- `packages/spike-edge` via `@sentry/cloudflare`
- `packages/spike-land-backend` via `@sentry/cloudflare`
- `packages/mcp-auth` via `@sentry/cloudflare`
- `packages/spike-land-mcp` via `@sentry/cloudflare`

## Token strategy

Use a Sentry internal integration token, not a personal auth token. Sentry's current API docs recommend organizational auth tokens created through internal integrations for API access and project automation.

Recommended scopes:

- `org:read`
- `org:write`
- `team:read`
- `project:read`
- `project:write`

If your org restricts project creation more aggressively, add the equivalent admin scope in Sentry before running the provisioning script.

## One-time provisioning

Run the setup script with a one-time Sentry org token:

```bash
SENTRY_AUTH_TOKEN=... \
SENTRY_ORG_SLUG=... \
SENTRY_TEAM_SLUG=... \
yarn sentry:setup --write-spike-web-build-env
```

What it does:

- Ensures the five Sentry projects exist
- Fetches or creates active DSNs
- Prints the exact `wrangler secret put SENTRY_DSN` commands for each Worker
- Writes `packages/spike-web/.env.sentry-build-plugin` when `--write-spike-web-build-env` is passed

## Local envs

Worker local development:

- Copy the relevant `packages/*/.dev.vars.example` to `.dev.vars`
- Set `SENTRY_DSN`
- Optionally set `SENTRY_TRACES_SAMPLE_RATE` (defaults to `0.1` in code)

Web local development:

- Copy `packages/spike-web/.env.example` to `packages/spike-web/.env`
- Set `PUBLIC_SENTRY_DSN`
- Set `PUBLIC_SENTRY_ENVIRONMENT`

Build-time sourcemap upload for `spike-web`:

- Copy `packages/spike-web/.env.sentry-build-plugin.example` to `packages/spike-web/.env.sentry-build-plugin`
- Set `SENTRY_AUTH_TOKEN`
- Set `SENTRY_ORG`
- Set `SENTRY_PROJECT`

## Deployment notes

- Worker DSNs are read from `SENTRY_DSN`
- Worker tracing sample rate can be overridden with `SENTRY_TRACES_SAMPLE_RATE`
- `spike-web` only uploads sourcemaps when `SENTRY_AUTH_TOKEN` and `SENTRY_ORG` are present
- The Vite plugin uses hidden sourcemaps and deletes `.map` files after upload so they do not get shipped to R2
