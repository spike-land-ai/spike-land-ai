# CEO Decisions - Spike Land Platform

> **Purpose**: This document records strategic decisions made by the CEO (Zoltan
> Erdos) for the Spike Land platform. These decisions guide development
> priorities, technology choices, and business direction.

---

## Decision Log

### March 2026

#### DEC-007: Agent AI Cost Optimization (Gemini / Claude Code OAuth)

**Decision Date**: March 2, 2026 **Decision Maker**: Zoltan Erdos (CEO)
**Status**: ACTIVE

**Decision**: Agents and CLI tools shall NOT use the Anthropic API via standard
`ANTHROPIC_API_KEY` for background or automated tasks due to high metered costs.
Instead, agents must use either the Gemini API (e.g., `gemini-2.5-flash`,
`gemini-2.5-pro`) via `GEMINI_API_KEY` or rely on local Claude Code OAuth
sessions (`CLAUDE_CODE_OAUTH_TOKEN`).

**Rationale**:

- Using `ANTHROPIC_API_KEY` for automated agents like inline completion and chat
  quickly becomes prohibitively expensive.
- Gemini models (like Flash) are extremely fast and often have a generous free
  tier or lower cost basis for high-volume automated tasks like inline
  autocomplete.
- Where Claude is absolutely required, it must run through the
  `CLAUDE_CODE_OAUTH_TOKEN` mechanism established in DEC-004 to utilize the
  flat-rate subscription.

**Impact**:

- `spike agent` and inline completions in the Monaco editor now use the Gemini
  API (Google Generative AI).
- Environment variable requirements for `spike agent` updated to prefer
  `GEMINI_API_KEY`.

**Related Files Updated**:

- `src/spike-cli/commands/agent.ts` - Refactored to use `@google/genai` instead
  of `@anthropic-ai/sdk`.

---

### February 2026

#### DEC-006: Decorative Animations Policy

**Decision Date**: February 27, 2026 **Decision Maker**: Zoltan Erdos (CEO)
**Status**: ACTIVE

**Decision**: The site shall not include infinite background animations or
CPU-heavy particle effects just for decoration.

**Rationale**:

- Infinite background animations (like ts-particles swarms or large animated
  blurred gradients) continuously burn visitor CPU resources.
- They degrade the development experience by keeping local CPU usage
  artificially high.
- Animations should be reserved for meaningful interactions: state transitions,
  scrolling effects, hover feedback, and deliberate user actions.
- Performance and battery life for visitors prioritize above decorative "wow"
  factors.

**Impact**:

- Removed the `HeroDataStream` (ts-particles swarm) from the homepage hero.
- Removed infinite `animate-pulse`, `animate-gradient-x`, and `animate-shimmer`
  from the header backgrounds.
- All future decorative UI features must be static, or stop animating after a
  short entry transition.

**Related Files Updated**:

- `src/components/landing/LandingHero.tsx` - Swarm and infinite animations
  removed.

---

#### DEC-005: No `yarn install --immutable` in CI — Use Plain `yarn`

**Decision Date**: February 26, 2026 **Decision Maker**: Zoltan Erdos (CEO)
**Status**: ACTIVE

**Decision**: CI scripts shall use plain `yarn` for dependency installation,
never `yarn install --immutable`.

**Rationale**:

- `--immutable` causes flaky CI failures when yarn.lock drifts even slightly
- A simple `yarn` is self-healing: it installs what's needed without failing on
  lockfile mismatches
- Reduces CI debugging time and false-negative pipeline failures
- Simplicity over strictness — the lockfile is committed and reviewed in PRs
  anyway

**Impact**:

- All CI workflows use plain `yarn` (already the case in
  `.github/actions/setup/action.yml`)
- `silent:install` script removed from `package.json` (no longer needed)
- Agents must not introduce `--immutable` flags in any install commands

**Related Files Updated**:

- `package.json` — `silent:install` script removed
- `.github/actions/setup/action.yml` — already uses plain `yarn` (no change
  needed)

---

#### DEC-004: No Anthropic API Key — OAuth-Only Authentication

**Decision Date**: February 19, 2026 **Decision Maker**: Zoltan Erdos (CEO)
**Status**: ACTIVE

**Decision**: `ANTHROPIC_API_KEY` shall NOT be used anywhere in the Spike Land
platform. All Anthropic/Claude API access must use `CLAUDE_CODE_OAUTH_TOKEN`
(OAuth bearer token from Claude Code chat subscription). The API key environment
variable has been completely removed from the codebase.

**Rationale**:

- **API key** (`ANTHROPIC_API_KEY`) logs into `console.anthropic.com` and bills
  per-token (metered usage) — expensive at scale
- **OAuth token** (`CLAUDE_CODE_OAUTH_TOKEN`) uses the Claude Code chat
  subscription (~£180/mo), which provides ~£3,000 worth of API equivalent usage
- The OAuth token cannot be used with the standard Anthropic SDK; it requires
  direct HTTP calls with specific headers
- Claude Code's OAuth 2.0 + PKCE flow uses a hardcoded Client ID locked to the
  official CLI — third-party apps cannot complete this flow

**Technical Details**:

OAuth tokens require different headers than API keys:

```typescript
// OAuth token — use Bearer auth + beta flag
headers: {
  Authorization: `Bearer ${token}`,
  "anthropic-version": "2023-06-01",
  "anthropic-beta": "oauth-2025-04-20",
}
// Endpoint: https://api.anthropic.com/v1/messages?beta=true
```

Claude Code auth flow:

1. OAuth 2.0 with PKCE against `console.anthropic.com`
2. Redirects to `http://localhost:54545/callback`
3. Exchanges code for bearer token
4. Tokens stored via keytar in OS keychain
5. Responses stream back as Server-Sent Events

**Impact**:

- Eliminates per-token billing costs for Anthropic API usage
- All workers and services use `CLAUDE_CODE_OAUTH_TOKEN` with Bearer auth
- DB-stored token (AIProvider table) takes precedence via
  `resolveAIProviderConfig("anthropic")`

**Related Files Updated**:

- `workers/services/ai-proxy/index.js` — switched from `x-api-key` to Bearer
  auth
- `workers/entrypoint.sh` — replaced env var
- `workers/config.capnp` and `workers/config.capnp.template` — replaced binding
- `docker-compose.yml` — replaced env var
- `docs/RUNBOOK.md` — cleaned up stale references

---

### January 2026

#### DEC-003: No Sharp Dependency - Client-Side Image Optimization

**Decision Date**: January 29, 2026 **Decision Maker**: Zoltan Erdos (CEO)
**Status**: ACTIVE

**Decision**: Sharp shall NOT be used as a direct dependency for image
processing. All image optimization happens client-side, and server-side
dimension extraction uses lightweight header parsing instead.

**Rationale**:

- Sharp is a native Node.js module (~50MB+) with platform-specific binaries
- Causes issues with Yarn PnP's zero-install approach
- Complicates CI/CD builds with native compilation requirements
- Lightweight header parsing is sufficient for dimension extraction
- Client-side processing already exists for resize/convert operations

**Technical Details**:

- Dimension extraction: `src/lib/images/image-dimensions.ts` (reads
  PNG/JPEG/WebP/GIF headers)
- Client-side processing: `src/lib/images/browser-image-processor.ts`
- Sharp remains as a transitive dependency of Next.js but is not directly used

**Impact**:

- Eliminates ~50MB+ native dependency from direct usage
- Simpler deployments (no native binary concerns)
- Better Yarn PnP compatibility
- Faster CI/CD builds
- No platform-specific build issues

**Update (February 2026)**: Extended to cover image enhancement comparison. When
the slider shows original vs enhanced, both images must be at matching standard
ARs. Rather than adding sharp for server-side cropping, the browser upload now
resizes originals to exact standard 1K dimensions (e.g., 1376x768 for 16:9).
This ensures Gemini receives and returns standard dimensions, eliminating AR
mismatches in the comparison slider.

**Related Files Updated**:

- `src/app/api/orbit/assets/upload/route.ts` - replaced sharp with header parser
- `package.json` - removed sharp from dependenciesMeta
- `next.config.ts` - removed sharp from serverExternalPackages
- `src/lib/ai/aspect-ratio.ts` - added STANDARD_1K_DIMENSIONS map
- `src/lib/images/browser-image-processor.ts` - uses exact standard 1K dims
- `src/components/enhance/ImageComparisonSlider.tsx` - simplified to
  object-cover

---

### December 2025

#### DEC-001: No Sentry in Tech Stack

**Decision Date**: December 11, 2025 **Decision Maker**: Zoltan Erdos (CEO)
**Status**: SUPERSEDED (February 2026)

**Decision**: Sentry shall NOT be included in the Spike Land tech stack for
error tracking and monitoring.

**Rationale**:

- Alternative monitoring solutions are preferred
- Vercel Analytics and built-in logging provide sufficient observability
- Cost optimization consideration
- Reduced external dependencies

**Superseded Note**: Sentry is now approved and integrated into the platform.
The SDK is disabled in development
(`enabled: process.env.NODE_ENV === "production"`) and trace sampling is set to
10% by default. See `sentry.server.config.ts`, `sentry.edge.config.ts`, and
`instrumentation-client.ts`.

**Impact**:

- Error tracking to use alternative approaches (Vercel Analytics, structured
  logging)
- Remove all Sentry references from documentation and code
- Update environment variable examples to exclude SENTRY_DSN

**Related Files Updated**:

- `docs/business/LAUNCH_CHECKLIST.md`
- `docs/business/LAUNCH_PLAN.md`
- `docs/best-practices/logging-monitoring.md`
- `docs/best-practices/error-handling.md`
- `.env.example`
- `src/lib/error-logger.ts`

---

#### DEC-002: Gemini Model for Image Enhancement

**Decision Date**: December 11, 2025 **Decision Maker**: Zoltan Erdos (CEO)
**Status**: ACTIVE

**Decision**: The official AI model for image enhancement in Pixel is
`gemini-3-pro-image-preview`. This model name is confirmed correct and exists in
the Google Gemini API.

**Rationale**:

- Model provides excellent image enhancement capabilities
- Supports multiple resolution tiers (1K, 2K, 4K)
- Reliable API performance with appropriate timeout handling (5 minutes)
- Cost-effective for the enhancement quality delivered

**Technical Details**:

- Model ID: `gemini-3-pro-image-preview`
- Location: `src/lib/ai/gemini-client.ts`
- Timeout: 5 minutes (300 seconds) - sufficient for 4K image processing
- API: Google Generative AI (@google/genai)

**Related Configuration**:

```typescript
// src/lib/ai/gemini-client.ts
export const DEFAULT_MODEL = "gemini-3-pro-image-preview";
export const GEMINI_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
```

---

## Decision Categories

### Technology Decisions

- DEC-001: ~~No Sentry in tech stack~~ SUPERSEDED — Sentry now approved
- DEC-002: Gemini model for image enhancement
- DEC-003: No Sharp dependency - client-side image optimization
- DEC-004: No Anthropic API Key - OAuth-only authentication
- DEC-005: No `yarn install --immutable` in CI - use plain `yarn`
- DEC-006: Decorative Animations Policy

### Business Decisions

_(None recorded yet)_

### Product Decisions

_(None recorded yet)_

---

## How to Use This Document

1. **New Decisions**: Add new entries under the current month with incrementing
   IDs
2. **Format**: Use the template structure (Decision Date, Decision Maker,
   Status, Rationale, Impact)
3. **Updates**: If a decision is superseded, change status to SUPERSEDED and
   reference new decision
4. **Review**: Decisions should be reviewed quarterly for relevance

---

## Decision Template

```markdown
#### DEC-XXX: [Decision Title]

**Decision Date**: [Date] **Decision Maker**: [Name] ([Role]) **Status**: ACTIVE
| SUPERSEDED | UNDER_REVIEW

**Decision**: [Clear statement of what was decided]

**Rationale**:

- [Reason 1]
- [Reason 2]

**Impact**:

- [Impact 1]
- [Impact 2]

**Related Files Updated**:

- [File 1]
- [File 2]
```

---

## Agent Notes Registry

This section tracks agent-specific documentation and productivity notes. Each
agent maintains their own notes file with health scores and experiences.

| Agent    | Notes Location                            | Last Updated | Health Score | Status |
| -------- | ----------------------------------------- | ------------ | ------------ | ------ |
| @copilot | [.copilot/notes.md](../.copilot/notes.md) | 2026-02-06   | 7/9          | Active |
| @jules   | [.jules/bolt.md](../.jules/bolt.md)       | 2024-05-22   | -            | Active |
| @claude  | _Not yet registered_                      | -            | -            | -      |

### Guidelines for Agent Notes

1. **Only the agent can modify their own notes**
2. **Health Score [1-9]**:
   - 1-3: Significant productivity issues (document blockers)
   - 4-6: Working but with friction points
   - 7-8: Productive with minor issues
   - 9: Optimal productivity (we'll investigate why you're delulu 😄)
3. **Update frequency**: After significant work or when productivity changes
4. **Content**: Experiences, learnings, challenges, recommendations for
   improvement

---

## Related Documentation

| Document                                         | Description                             |
| ------------------------------------------------ | --------------------------------------- |
| [ZOLTAN_ERDOS.md](./ZOLTAN_ERDOS.md)             | Founder profile, background, and vision |
| [BUSINESS_STRUCTURE.md](./BUSINESS_STRUCTURE.md) | Company legal structure                 |

---

**Document Owner**: [Zoltan Erdos](./ZOLTAN_ERDOS.md) (CEO) | **Last Updated**:
February 26, 2026 | **Version**: 1.3
