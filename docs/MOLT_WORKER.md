# Moltworker — Complete Technical Reference

Comprehensive reference for the [cloudflare/moltworker](https://github.com/cloudflare/moltworker)
project. Compiled from the project's README.md, AGENTS.md, CONTRIBUTING.md, and
skills/cloudflare-browser/SKILL.md.

> **Status:** Experimental and unsupported. This is a Cloudflare-maintained
> project for running OpenClaw (Claude Code) inside Cloudflare Sandbox
> containers.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Key Capabilities](#2-key-capabilities)
3. [Architecture](#3-architecture)
4. [Authentication — Defense in Depth](#4-authentication--defense-in-depth)
5. [Container Lifecycle Management](#5-container-lifecycle-management)
6. [R2 Persistent Storage](#6-r2-persistent-storage)
7. [Chrome DevTools Protocol (CDP) Shim](#7-chrome-devtools-protocol-cdp-shim)
8. [Multi-Channel Configuration](#8-multi-channel-configuration)
9. [Configuration Reference](#9-configuration-reference)
10. [Cost Analysis](#10-cost-analysis)
11. [Key Design Patterns](#11-key-design-patterns)
12. [Developer Guide (from AGENTS.md)](#12-developer-guide-from-agentsmd)
13. [Contributing Guide](#13-contributing-guide)
14. [Browser Skills (from SKILL.md)](#14-browser-skills-from-skillmd)
15. [Applicability to spike.land](#15-applicability-to-spikeland)

---

## 1. Overview

Moltworker (formerly Moltbot) is Cloudflare's open-source project for running
OpenClaw (personal AI assistant gateway) on Cloudflare Workers using serverless
Sandbox containers. No self-hosted infrastructure is required — the entire stack
runs on Cloudflare's edge network.

The Worker acts as an authenticated reverse proxy that:

- Starts and manages an OpenClaw gateway process inside a container
- Proxies HTTP and WebSocket traffic to the gateway's Control UI
- Provides an admin interface for device management and storage status
- Exposes API and debug endpoints for operational control
- Syncs persistent state to R2 storage

GitHub: https://github.com/cloudflare/moltworker

---

## 2. Key Capabilities

- **Web-based chat interface** with persistent conversation history
- **Multi-channel support**: Telegram, Discord, Slack
- **Device pairing** with explicit security approval
- **Browser automation** via Chrome DevTools Protocol (CDP)
- **Optional R2 object storage** for persistence across container restarts
- **Multiple AI providers**: Anthropic Claude, OpenAI, Cloudflare AI Gateway
- **Built-in admin dashboard** for device management and storage monitoring

---

## 3. Architecture

Cloudflare Worker as authenticated reverse proxy. Containerized OpenClaw gateway
on port 18789. Durable Objects for lifecycle management (SQLite-backed). Optional
R2 for persistent storage.

```
Browser / Chat Platform
   |
   v
+-------------------------------------+
|     Cloudflare Worker (index.ts)     |
|  - Authenticates requests (CF Access)|
|  - Starts OpenClaw in sandbox        |
|  - Proxies HTTP/WebSocket requests   |
|  - Passes secrets as env vars        |
+------------------+------------------+
                   |
                   v
+-------------------------------------+
|     Cloudflare Sandbox Container     |
|  +-------------------------------+   |
|  |     OpenClaw Gateway          |   |
|  |  - Control UI on port 18789   |   |
|  |  - WebSocket RPC protocol     |   |
|  |  - Agent runtime              |   |
|  +-------------------------------+   |
+-------------------------------------+
```

### Project Structure

```
src/
├── index.ts                    # Main entry (authenticated reverse proxy)
├── types.ts                    # Core type definitions (MoltbotEnv, AppEnv, JWTPayload)
├── config.ts                   # Constants (MOLTBOT_PORT: 18789, STARTUP_TIMEOUT: 3min)
├── auth/
│   ├── middleware.ts           # Cloudflare Access JWT verification
│   └── jwt.ts                  # JWT handling
├── gateway/
│   ├── process.ts              # Container lifecycle (start/find processes)
│   ├── env.ts                  # Environment variable construction
│   ├── sync.ts                 # R2 synchronization (rclone-based)
│   └── r2.ts                   # R2 storage operations
├── routes/
│   ├── api.ts                  # Admin endpoints (device approval, storage ops)
│   ├── cdp.ts                  # Chrome DevTools Protocol shim (largest: 54KB)
│   ├── debug.ts                # Debug endpoints (WebSocket test, version info)
│   ├── admin-ui.ts             # Admin UI SPA routing
│   └── public.ts               # Public health checks, assets
├── client/
│   ├── pages/AdminPage.tsx     # React admin UI (device mgmt, gateway control)
│   ├── App.tsx                 # Main app layout
│   └── api.ts                  # API client for admin operations
└── utils/
    └── logging.ts              # Logging utility

skills/
└── cloudflare-browser/
    └── SKILL.md                # Browser automation skill documentation
```

### Request Flow

1. Request arrives at the Cloudflare Worker
2. Auth middleware validates CF Access JWT (unless `DEV_MODE=true`)
3. Worker checks if a sandbox container is running; starts one if not
4. For gateway requests: proxy HTTP/WS to `localhost:18789` inside the container
5. For admin/API/debug requests: handle directly in the Worker

---

## 4. Authentication — Defense in Depth

Three layers:

### Layer 1: Cloudflare Access

Protects `/admin` routes via JWT verification middleware. Setup:

1. Enable Cloudflare Access on the worker's domain (Workers dashboard -> Settings
   -> Domains & Routes -> menu next to workers.dev domain)
2. Configure identity providers in Zero Trust dashboard
3. Copy the Application Audience (AUD) tag
4. Set secrets:
   ```
   npx wrangler secret put CF_ACCESS_TEAM_DOMAIN   # team name from Zero Trust
   npx wrangler secret put CF_ACCESS_AUD            # Application Audience tag
   ```

The Worker validates CF Access JWTs using JWKS fetched from Cloudflare's
well-known endpoint. JWKS responses are cached.

### Layer 2: Gateway Tokens

Protect WebSocket connections. Injected post-auth since CF Access strips query
params. Passed as a query parameter:

```
https://your-worker.workers.dev/?token=YOUR_TOKEN
```

Generate with:
```bash
openssl rand -hex 32
npx wrangler secret put MOLTBOT_GATEWAY_TOKEN
```

Inside the container this becomes `OPENCLAW_GATEWAY_TOKEN`.

### Layer 3: Device Pairing

Explicit per-device approval, no auto-connections. Every new device that connects
must be explicitly approved by an admin through the admin UI before it can
interact with the assistant. Devices remain in a "pending" state until approved.

Dev mode can bypass all auth via `DEV_MODE` env var.

---

## 5. Container Lifecycle Management

### Check-Then-Start Pattern

Looks for existing process before launching new:

1. Worker receives a request
2. Worker checks if a sandbox container process exists (`gateway/process.ts`)
3. If no container: start one using the Dockerfile image
4. Container runs `start-openclaw.sh`:
   - Restore R2 backup if available (handles migration from legacy `.clawdbot`
     paths to `openclaw/` prefix)
   - Run `openclaw onboard --non-interactive` if config missing
   - Patch `openclaw.json` for channels, gateway auth, trusted proxies
   - Launch gateway: `openclaw gateway --allow-unconfigured --bind lan`
5. Worker waits for gateway to become healthy on port 18789

### Startup Behavior

- 3-minute startup timeout with full timeout reuse for existing processes
- Process searches by command name (`start-openclaw.sh`, `openclaw gateway`)
- Graceful cleanup of failed startups with comprehensive logging
- Lock file removal on startup for clean state
- **First request takes 1-2 minutes** due to container cold start

### AI Provider Selection

The startup script selects the AI provider based on available environment
variables, in priority order:

1. **Cloudflare AI Gateway (native):** `CLOUDFLARE_AI_GATEWAY_API_KEY` +
   `CF_AI_GATEWAY_ACCOUNT_ID` + `CF_AI_GATEWAY_GATEWAY_ID`
2. **Direct Anthropic:** `ANTHROPIC_API_KEY` (with optional `ANTHROPIC_BASE_URL`)
3. **Direct OpenAI:** `OPENAI_API_KEY`
4. **Legacy AI Gateway:** `AI_GATEWAY_API_KEY` + `AI_GATEWAY_BASE_URL`

### Sleep and Wake

Configure idle timeout with `SANDBOX_SLEEP_AFTER`:

```
npx wrangler secret put SANDBOX_SLEEP_AFTER   # e.g., 10m, 1h, 30m
```

When the container sleeps, a new request triggers a cold start. Persistent
storage (R2) preserves data across sleep/wake cycles.

---

## 6. R2 Persistent Storage

Without R2 configured, all data is lost when the container restarts. R2 provides
persistence via an rclone-based sync mechanism.

### Three-Part Rclone Sync Strategy

1. **Config sync** (mandatory): propagates deletions, excludes lock files/logs/git
2. **Workspace sync** (optional): skips skills subdirectory
3. **Skills sync** (optional): handles skill files separately

### Sync Behavior

- 30-second background sync loop with change detection
- Non-fatal error handling on optional syncs (`|| true` pattern)
- Legacy migration from `.clawdbot/` to `openclaw/` paths
- Manual backup available through the admin UI

### Setup

1. Create an R2 API Token with Object Read & Write permissions
2. Set secrets:
   ```
   npx wrangler secret put R2_ACCESS_KEY_ID
   npx wrangler secret put R2_SECRET_ACCESS_KEY
   npx wrangler secret put CF_ACCOUNT_ID
   ```

### Critical R2 Warnings

These are documented pitfalls from the AGENTS.md:

- **rsync flags:** Use `rsync -r --no-times`, never `rsync -a`. s3fs cannot set
  timestamps, causing "Input/output error" with `-a`.
- **Mount verification:** Do not rely on `sandbox.mountBucket()` error messages.
  Verify mount status with `mount | grep s3fs`.
- **Data destruction risk:** `/data/moltbot` IS the R2 bucket. Running
  `rm -rf /data/moltbot/*` permanently deletes backup data. Always verify mount
  status before destructive operations.
- **Process completion:** The sandbox API's `proc.status` may lag. Instead of
  checking `proc.status === 'completed'`, verify through expected artifacts
  (e.g., timestamp file existence after sync).

---

## 7. Chrome DevTools Protocol (CDP) Shim

Full CDP bridge translating commands to Cloudflare Browser Rendering API via
Puppeteer. This is the largest source file in the project at 54KB.

### Security

- Constant-time secret comparison (timing attack prevention)
- Session tracking with node/object ID mappings for DOM/Runtime operations

### CDP Domains Supported

10+ CDP domains: Browser, Target, Page, Runtime, DOM, Input, Network, Emulation,
Fetch.

### Discovery Endpoints

Three discovery endpoints for tool compatibility:

| Endpoint | Method | Purpose |
|---|---|---|
| `/cdp/json` | GET | Available targets |
| `/cdp/json/version` | GET | Browser version info |
| `/cdp/json/list` | GET | Available targets |
| `/cdp/json/new` | GET | Create new target |
| `/cdp/devtools/browser/{id}` | WS | CDP WebSocket commands |

### Configuration

```
npx wrangler secret put CDP_SECRET       # shared auth secret
npx wrangler secret put WORKER_URL       # public worker URL
```

### Connection Pattern

The worker creates a page target automatically on WebSocket connect. Listen for
`Target.targetCreated` to get the `targetId`:

```javascript
const ws = new WebSocket(`wss://your-worker.workers.dev/cdp?secret=${CDP_SECRET}`);
let targetId = null;

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  if (msg.method === 'Target.targetCreated' && msg.params?.targetInfo?.type === 'page') {
    targetId = msg.params.targetInfo.targetId;
  }
});
```

---

## 8. Multi-Channel Configuration

### Telegram

- `botToken` — Bot authentication token
- `dmPolicy` — `"pairing"` (default) or `"open"`
- `allowFrom` — Filtering by user/group ID

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_DM_POLICY   # "pairing" (default) or "open"
npx wrangler secret put TELEGRAM_DM_ALLOW_FROM
```

### Discord

- `token` — Bot token
- Nested `dm.policy` / `dm.allowFrom` (per `DiscordDmConfig` type)

```bash
npx wrangler secret put DISCORD_BOT_TOKEN
npx wrangler secret put DISCORD_DM_POLICY    # "pairing" (default) or "open"
```

### Slack

- `botToken` + `appToken` required (both mandatory)

```bash
npx wrangler secret put SLACK_BOT_TOKEN
npx wrangler secret put SLACK_APP_TOKEN
```

All channels are configured via env vars and patched into OpenClaw `config.json`
on startup. There is no "webchat" channel — the Control UI deploys automatically.

---

## 9. Configuration Reference

### Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| **AI Provider (one required)** | | |
| `ANTHROPIC_API_KEY` | Conditional | Direct Anthropic API key |
| `OPENAI_API_KEY` | Conditional | Direct OpenAI API key |
| `CF_AI_GATEWAY_ACCOUNT_ID` | Conditional | Cloudflare AI Gateway account |
| `CF_AI_GATEWAY_ID` | Conditional | Gateway identifier |
| `CF_AI_GATEWAY_API_KEY` | Conditional | Gateway auth |
| `CF_AI_GATEWAY_MODEL` | No | Model override (format: `provider:model`) |
| **R2 Storage** | | |
| `R2_ACCESS_KEY_ID` | Conditional | R2 access key |
| `R2_SECRET_ACCESS_KEY` | Conditional | R2 secret key |
| `R2_ENDPOINT` | Conditional | R2 endpoint URL |
| `R2_BUCKET` | Conditional | R2 bucket name |
| **Chat Channels** | | |
| `TELEGRAM_BOT_TOKEN` | No | Telegram bot token |
| `TELEGRAM_DM_POLICY` | No | `pairing` or `open` |
| `TELEGRAM_DM_ALLOW_FROM` | No | Allowed user/group filter |
| `DISCORD_BOT_TOKEN` | No | Discord bot token |
| `DISCORD_DM_POLICY` | No | `pairing` or `open` |
| `SLACK_BOT_TOKEN` | No | Slack bot token |
| `SLACK_APP_TOKEN` | No | Slack app-level token |
| **Authentication** | | |
| `CF_ACCESS_TEAM_DOMAIN` | Recommended | CF Access team name |
| `CF_ACCESS_AUD` | Recommended | Application Audience tag |
| `OPENCLAW_GATEWAY_TOKEN` | Yes | Static gateway token (skips device pairing) |
| **Operational** | | |
| `OPENCLAW_DEV_MODE` | No | Dev mode flag (bypasses auth) |
| `OPENCLAW_AUTO_UPDATE` | No | Auto-update OpenClaw on startup |
| `SANDBOX_SLEEP_AFTER` | No | Idle shutdown timeout for cost savings |
| **Browser/CDP** | | |
| `CDP_SECRET` | Conditional | Browser automation secret |
| `WORKER_URL` | Conditional | Public worker URL for CDP |

### Wrangler Bindings (wrangler.jsonc)

- **Durable Objects** for lifecycle management
- **R2 bucket** binding
- **Sandbox container** binding (port 18789)
- **Chrome DevTools Protocol** binding

### Configuration Precedence

1. Cloudflare AI Gateway credentials (highest)
2. Direct Anthropic API key
3. Direct OpenAI API key
4. Legacy AI Gateway config (lowest)

### Container Environment Variable Mapping

Variables passed from Worker to container (internal names):

| Worker Secret | Container Variable | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | `ANTHROPIC_API_KEY` | Passed directly |
| `OPENAI_API_KEY` | `OPENAI_API_KEY` | Passed directly |
| `MOLTBOT_GATEWAY_TOKEN` | `OPENCLAW_GATEWAY_TOKEN` | Renamed |
| `DEV_MODE` | `OPENCLAW_DEV_MODE` | Maps to `controlUi.allowInsecureAuth` |
| `TELEGRAM_BOT_TOKEN` | Patched into `openclaw.json` | `channels.telegram.botToken` |
| `DISCORD_BOT_TOKEN` | Patched into `openclaw.json` | `channels.discord.token` |
| `SLACK_BOT_TOKEN` | Patched into `openclaw.json` | `channels.slack.botToken` |
| `SLACK_APP_TOKEN` | Patched into `openclaw.json` | `channels.slack.appToken` |

### AI Gateway Model Format

`provider/model-id` examples:

- Workers AI: `workers-ai/@cf/meta/llama-3.3-70b-instruct-fp8-fast`
- OpenAI: `openai/gpt-4o`
- Groq: `groq/llama-3.3-70b`

Workers AI models work without separate provider credentials when using the AI
Gateway authentication token (unified billing).

### Local Development (`.dev.vars`)

```bash
ANTHROPIC_API_KEY=sk-ant-...
DEV_MODE=true           # Skip CF Access auth + device pairing
DEBUG_ROUTES=true       # Enable /debug/* routes
```

---

## 10. Cost Analysis

Running a `standard-1` instance (0.5 vCPU, 4 GB memory, 8 GB disk):

| Scenario | Monthly Cost |
|---|---|
| Full 24/7 | ~$34.50 (Workers Paid $5 + Sandbox ~$29.50) |
| Memory-dominant cost | ~$26/month for RAM |
| With `SANDBOX_SLEEP_AFTER` | Reduced to ~$5-6/month |
| R2 storage | Minimal for config persistence |
| AI provider costs | Separate (bring your own key) |

CPU billing is usage-based, so actual costs vary. Setting `SANDBOX_SLEEP_AFTER`
(e.g., `10m`, `1h`) lets the container sleep when idle, reducing costs
significantly for intermittent use.

---

## 11. Key Design Patterns

### Reverse Proxy Pattern

Worker acts as a controlled gateway to containerized OpenClaw:
- WebSocket support with message interception for friendly error messages
- Request/response transformation (e.g., injecting gateway tokens)
- Health checking and intelligent proxying (loading page while container starts)

### Graceful Degradation

- Missing R2 credentials don't block deployment (just disable persistence)
- Non-fatal error handling on optional syncs
- Dev mode bypass for local development without full CF setup

### Sensitive Parameter Redaction

- URL logging safety: strip sensitive query params before logging
- Constant-time secret comparison to prevent timing attacks

### Idempotent Startup

- Config restoration from R2 on every startup
- Lock file cleanup before process start
- Legacy path migration (automatic)

### Cold Start Handling

- Loading page served while container initializes (1-2 minutes)
- Full timeout reuse prevents race conditions with concurrent requests

---

## 12. Developer Guide (from AGENTS.md)

### Local Development

```bash
npm install
cp .dev.vars.example .dev.vars
# Edit .dev.vars:
#   ANTHROPIC_API_KEY=sk-ant-...
#   DEV_MODE=true
#   DEBUG_ROUTES=true
npm run start   # wrangler dev (local worker)
```

**WebSocket limitation:** `wrangler dev` struggles with WebSocket proxying
through the sandbox. HTTP works but WebSocket connections may fail. Full
functionality requires deployment.

### Available Commands

```bash
npm test              # Run tests (vitest)
npm run test:watch    # Watch mode
npm run build         # Build worker + client
npm run deploy        # Build and deploy
npm run dev           # Vite dev server (client only)
npm run start         # wrangler dev (local worker)
npm run typecheck     # TypeScript check
```

### CLI Usage Inside Containers

OpenClaw CLI calls require explicit WebSocket URL:

```typescript
sandbox.startProcess('openclaw devices list --json --url ws://localhost:18789');
```

CLI execution typically takes 10-15 seconds due to WebSocket overhead. Use
`waitForProcess()` from `src/routes/api.ts`.

### R2 Storage Warnings and Sync Behavior

- rsync flags: Use `rsync -r --no-times`, never `rsync -a`
- Mount verification: Use `mount | grep s3fs`, not `sandbox.mountBucket()` errors
- Data destruction risk: `/data/moltbot` IS the R2 bucket

### Architecture Overview for Contributors

- Route handlers stay thin; logic extracted to modules
- Hono context methods (`c.json()`, `c.html()`) for responses
- TypeScript strict mode with explicit type annotations
- Each module has colocated `*.test.ts` files

### Configuration Priorities and Debugging Tips

```bash
npx wrangler tail                    # Live logs
npx wrangler secret list             # Check secrets
```

Enable debug routes with `DEBUG_ROUTES=true`:

| Endpoint | Purpose |
|---|---|
| `GET /debug/processes` | Active container processes |
| `GET /debug/logs?id=<pid>` | Process-specific logs |
| `GET /debug/version` | Container and OpenClaw version |

### Success Detection

The CLI outputs "Approved" with capital A. Use case-insensitive matching:

```typescript
stdout.toLowerCase().includes('approved');
```

### OpenClaw Config Pitfalls

- `agents.defaults.model` requires object format `{ "primary": "model/name" }`,
  not a string
- `gateway.mode` must be `"local"` for headless operation
- `gateway.bind` is not a config option; use `--bind` CLI flag
- See [docs.openclaw.ai](https://docs.openclaw.ai/) for the full schema

### Adding API Endpoints

1. Create route handler in `src/routes/api.ts`
2. Add types to `src/types.ts` if needed
3. Update client API in `src/client/api.ts`
4. Write tests

### Adding Environment Variables

1. Add to `MoltbotEnv` interface in `src/types.ts`
2. Update `buildEnvVars()` in `src/gateway/env.ts` if targeting the container
3. Update `.dev.vars.example`
4. Document in README.md secrets section

### Testing

Vitest with colocated test files (`*.test.ts`). Coverage includes:

- `auth/jwt.test.ts` — JWT decoding and validation
- `auth/middleware.test.ts` — Auth middleware behavior
- `gateway/env.test.ts` — Environment variable building
- `gateway/process.test.ts` — Process finding logic
- `gateway/r2.test.ts` — R2 mounting logic
- `gateway/sync.test.ts` — R2 backup sync logic

---

## 13. Contributing Guide

### AI Disclosure Requirement

Contributors must be transparent about AI tooling:

- Identify the specific tool used (Claude Code, Cursor, Amp, etc.)
- Describe the extent of AI assistance
- AI-generated PRs are restricted to issues that have already been accepted
- Unsolicited AI-generated PRs without an accepted issue reference will be closed
- AI must not create hypothetically correct code that has not been tested
- AI-generated media (artwork, images, videos, audio) is prohibited

### Contribution Workflow

1. Create an issue before submitting non-trivial PRs (including typos and docs)
2. Demonstrate testing (manual, automated, or both)
3. Human review and editing required for all AI-assisted issues/discussions
4. Maintainers reserve the right to decline contributions without obligation
5. Maintainers are exempt from AI restrictions

### Philosophy

Quality over velocity. Fork, branch, PR workflow. Tests required for new
features.

---

## 14. Browser Skills (from SKILL.md)

Pre-installed in the container at `/root/clawd/skills/cloudflare-browser/`.

### Prerequisites

- `CDP_SECRET` environment variable set
- Browser profile configured in `openclaw.json`:
  ```json
  {
    "browser": {
      "profiles": {
        "cloudflare": {
          "cdpUrl": "https://your-worker.workers.dev/cdp?secret=..."
        }
      }
    }
  }
  ```

### CDP Integration Patterns

Via Cloudflare Browser Rendering:

### Screenshot Capabilities

Full page, element, viewport:

```bash
node /path/to/skills/cloudflare-browser/scripts/screenshot.js https://example.com output.png
```

### Video Creation

Frame-by-frame stitching with ffmpeg:

```bash
node /path/to/skills/cloudflare-browser/scripts/video.js \
  "https://site1.com,https://site2.com" output.mp4
```

Video creation process:
1. Capture frames as PNGs during navigation
2. Stitch with ffmpeg:
   ```
   ffmpeg -framerate 10 -i frame_%04d.png -c:v libx264 -pix_fmt yuv420p output.mp4
   ```

### Page Navigation and JavaScript Execution

Navigate and screenshot:
```javascript
await send('Page.navigate', { url: 'https://example.com' });
await new Promise(r => setTimeout(r, 3000));
const { data } = await send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync('out.png', Buffer.from(data, 'base64'));
```

Set viewport:
```javascript
await send('Emulation.setDeviceMetricsOverride', {
  width: 1280, height: 720, deviceScaleFactor: 1, mobile: false
});
```

Execute JavaScript (`Runtime.evaluate`):
```javascript
await send('Runtime.evaluate', { expression: 'window.scrollBy(0, 300)' });
```

### Connection Troubleshooting

| Issue | Fix |
|---|---|
| No target created | Race condition — wait for `Target.targetCreated` with timeout |
| Commands timeout | Cold start delay; increase timeout to 30-60s |
| WebSocket hangs | Verify `CDP_SECRET` matches worker configuration |
| Sandbox port forwarding | Ensure port 18789 is accessible within container |
| WebSocket stability | Check for proxy timeouts and idle disconnects |

---

## 15. Applicability to spike.land

### Patterns Adopted

| Pattern | spike.land Implementation |
|---------|--------------------------|
| Session Durable Object | SpikeChatSessionDO — server-side session state, SQLite-backed |
| Zero-polling callbacks | DO-based browser result delivery (replaces D1 250ms polling) |
| Stream resumption | Last-Event-ID ring buffer in DO + SSE reconnection |
| Constant-time secrets | `constantTimeEquals()` in security-utils.ts |
| URL redaction | `redactUrl()` strips sensitive query params for logging |
| Debug endpoints | `/api/spike-chat/debug/*` for provider health + session inspection |

### Patterns Not Adopted (and Why)

| Pattern | Reason |
|---------|--------|
| Multi-channel (Telegram/Discord/Slack) | Separate concern; spike-chat channel system already exists |
| R2 background sync | DO storage + D1 sufficient for chat data volume |
| Cloudflare Access layer | Would lock out unauthenticated blog embed users |
| Separate admin dashboard | Existing cockpit UI serves this purpose |

---

## References

- [OpenClaw Repository](https://github.com/openclaw/openclaw)
- [OpenClaw Documentation](https://docs.openclaw.ai/)
- [Cloudflare Sandbox](https://developers.cloudflare.com/sandbox/)
- [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/policies/access/)
- [Moltworker Repository](https://github.com/cloudflare/moltworker)

---

*Extracted from [cloudflare/moltworker](https://github.com/cloudflare/moltworker) on 2026-03-13.*
*Applied to spike.land as part of the Spike Chat improvement initiative.*
