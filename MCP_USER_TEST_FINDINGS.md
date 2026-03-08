# spike.land MCP User Test Findings Summary

Tested with 16 diverse AI agent personas on 08/03/2026.

## Overview
The agents explored the capabilities of spike.land via its public MCP tools endpoint and provided feedback based on their specific professional and personal backgrounds.

## Aggregate Issues & Concerns
- **Alex Chen**: `sandbox_exec` is documented as **"SIMULATED EXECUTION ONLY — no code actually runs"** — this is a landmine. Nothing in the tool name or the tool list warns about this; a user will call it expecting real execution and get silently wrong synthetic output. This is a trust-destroying design choice.
- **Alex Chen**: `bazdmeg_superpowers_gate_check` requires a `sessionId` but there is no `bazdmeg_enter_workspace` or session-creation tool in this list — the entry point for the workflow is missing, leaving the gate system orphaned.
- **Alex Chen**: No timeout parameters on any tool — my primary focus is timeout behavior and error propagation, and there is zero surface for controlling or observing timeouts. If `bazdmeg_run_gates` on a large workspace hangs, I have no lever to pull.
- **Alex Chen**: The `auth_check_session` schema marks `session_token` as **required** but the description says "Optional session token" — schema and docs contradict each other.
- **Alex Chen**: `workspaces_get` marks both `workspace_id` and `slug` as **required** in the schema, but semantically only one should be needed. This will cause unnecessary call failures.
- **Alex Chen**: No streaming or webhook/callback mechanism — long-running tools like `context_index_repo` or gate checks block synchronously with no progress signal. For a large repo this is a black box.
- **Alex Chen**: `bazdmeg_memory_search` and `retro_search_knowledge` solve nearly identical problems (semantic search over past insights) with different schemas and storage backends — unclear which to use and why both exist.
- **Alex Chen**: `capabilities_request_permissions` exists but there's no documentation on what the permission model actually gates. I can't know what I'm requesting access to or what I currently lack.
- **Alex Chen**: The reaction system (`create_reaction`, `reaction_log`) is interesting for automation but `targetInput` template variables like `{{output.resultValue}}` are completely undocumented — no schema, no examples, no list of valid paths.
- **Alex Chen**: Career/resume/salary/interview-prep tools (`career_*`, `career_growth_*`) have no obvious integration with the rest of the platform. They feel like a separate product squatting in the same namespace.
- **Alex Chen**: `store_app_personalized` and `store_recommendations_get` are both recommendation tools with no explanation of how personalization is computed or what data drives it — opaque to an advanced user who wants to reason about the output.
- **Alex Chen**: No bulk-operation or batch-query tools for observability — `tool_usage_stats` and `error_rate` are single-metric calls; there's no way to get a unified dashboard view in one round trip.
- **Alex Chen**: `diff_apply` takes a `changeset_id` but operates on `target_files` — it's unclear whether this mutates the sandbox VFS, a remote repo, or something else entirely.
- **Alex Chen**: The CRDT/netsim/BFT/causality categories are powerful primitives but appear to be in-memory only with no persistence or export — they seem designed for interactive demos rather than production use cases.
- **Priya Sharma**: `auth_check_session` requires `session_token` as a required string parameter — session tokens should never be passed as tool arguments; they should be bound to the authenticated transport layer, not user-supplied inputs
- **Priya Sharma**: No token revocation tool — I can check a session but not invalidate it; critical omission for enterprise use
- **Priya Sharma**: No rate limit headers or rate limit introspection tool — I can't tell if I'm about to be throttled or if rate limiting even exists
- **Priya Sharma**: `auth_check_route_access` has no documented list of valid routes or role definitions — I'm probing blind
- **Priya Sharma**: `billing_cancel_subscription` schema accepts `confirm: "true"` as a string, not boolean — type-unsafe destructive operation is an incident waiting to happen
- **Priya Sharma**: `storage_upload_batch` and `storage_manifest_diff` accept raw `files` as untyped strings — no schema for what that string should contain, makes validation impossible
- **Priya Sharma**: No MFA/2FA challenge tool anywhere in the auth category
- **Priya Sharma**: `sandbox_exec` explicitly says "SIMULATED EXECUTION ONLY" in its description — why is a fake execution tool listed alongside real infrastructure tools? This is a trust and discoverability problem
- **Priya Sharma**: No session timeout or idle expiry configuration tool
- **Priya Sharma**: `swarm_spawn_agent` takes `machine_id` and `session_id` as free-form strings — no validation that the caller actually owns those identifiers
- **Priya Sharma**: `dm_send` takes a raw email address — no confirmation, no rate limiting visible, potential spam vector
- **Priya Sharma**: No tool for listing active sessions across devices (critical for enterprise SSO scenarios)
- **Priya Sharma**: `byok_store_key` stores raw API keys — need to understand the encryption scheme and key rotation story before trusting this
- **Priya Sharma**: `capabilities_request_permissions` exists but there's no tool to *check what permissions a specific tool requires* before calling it — discovery gap
- **Priya Sharma**: The `audit_query_logs` retention is documented as 90 days but there's no tool to extend retention or export to SIEM — not enterprise-ready for compliance
- **Priya Sharma**: No tool to test concurrent request behavior or observe connection limits directly — my primary test scenario has no native support
- **Priya Sharma**: `report_bug` says reports go to a "public Bugbook" — if I'm reporting auth vulnerabilities, I do not want them published publicly
- **Marcus Johnson**: `auth_check_session` marks `session_token` as required in the JSON schema but the description says "Optional session token" — this contradiction would cause me to fail the call if I don't have a token yet, with no idea why
- **Marcus Johnson**: `workspaces_get` requires *both* `workspace_id` and `slug` as required fields, but these are clearly alternatives — I only have one of them; this schema will reject valid calls
- **Marcus Johnson**: `bootstrap_create_app` requires a `codespace_id` with no explanation of what it is or how to get one — a beginner hits a wall immediately
- **Marcus Johnson**: `storage_manifest_diff`, `storage_upload_batch`, and `storage_list` all have required params with empty string descriptions (`""`) — completely useless for understanding what to pass
- **Marcus Johnson**: No "getting started" or "help" tool — there's no `help`, `list_categories`, or `onboarding_guide` entry point for new users
- **Marcus Johnson**: Required fields like `include_workspaces` on `auth_get_profile` are just strings with no indication they should be `"true"` or `"false"` — the type system isn't communicating intent
- **Marcus Johnson**: Many tools across categories (billing, swarm, bft) have no indication of which ones require authentication vs which are public — a beginner will hit auth errors with no guidance
- **Marcus Johnson**: The `create_classify_idea` and `bootstrap_create_app` tools both seem to "create apps" but for different flows — the distinction between `/create` flow vs bootstrap flow is unclear without docs
- **Marcus Johnson**: No progressive disclosure — all 170+ tools are dumped at once; a tiered view (beginner / intermediate / advanced) would help enormously
- **Marcus Johnson**: `bazdmeg_*` tools are completely opaque — the category name means nothing to a new user and there's no description of the overall system
- **Marcus Johnson**: `capabilities_request_permissions` exists but I don't know what permissions I start with or what's blocked — I'd have to fail a call first to discover I need permission
- **Marcus Johnson**: Several tools like `store_app_rate`, `dm_send`, `agents_send_message` have obvious misuse potential (spam, harassment) but no rate-limit or abuse guidance visible at the schema level
- **Sofia Rodriguez**: **Required/Optional mismatch**: `auth_check_session.session_token` is marked required but described as optional — a direct schema lie
- **Sofia Rodriguez**: **Same pattern in `agent_inbox_poll`**: both `since` and `agent_id` are required in schema but the description explicitly says "Omit for all" — these should be optional
- **Sofia Rodriguez**: **`agent_inbox_read.since`** is required but the description implies it's optional
- **Sofia Rodriguez**: **`workspaces_get`** requires both `workspace_id` AND `slug` — these are semantically exclusive lookup keys; no documented tie-breaking rule
- **Sofia Rodriguez**: **`workspaces_update`** requires `name` AND `slug` even for partial updates — forces you to re-submit unchanged fields
- **Sofia Rodriguez**: **Boolean fields typed as strings**: `billing_cancel_subscription.confirm`, `beuniq_answer.answer`, `storage_list.is_published` — no enum constraint, no documented accepted values
- **Sofia Rodriguez**: **`storage_manifest_diff`**, **`storage_upload_batch`**, **`storage_list`** — all field descriptions are empty strings; payload shape is completely undocumented
- **Sofia Rodriguez**: **Many "optional" filter fields are listed as required**: `skill_store_list` (category, search, limit, offset), `bazdmeg_faq_list` (category, include_unpublished), `create_search_apps` (limit), `learnit_search_topics` (limit) — all have defaults described but are schema-required
- **Sofia Rodriguez**: **`billing_create_checkout`**: `success_url` and `cancel_url` have documented defaults yet are marked required — inconsistent contract
- **Sofia Rodriguez**: **No error code documentation** anywhere in the tool list; `report_bug` has an `error_code` field with no reference to what valid codes exist
- **Sofia Rodriguez**: **`agents_send_message.content`** has a max (10,000 chars) but no minimum — empty string behavior is undefined
- **Sofia Rodriguez**: **`tts_synthesize.text`** max is 5,000 chars — off-by-one behavior at exactly 5,000 and 5,001 is unspecified
- **Sofia Rodriguez**: **`sandbox_exec`** openly admits it's simulated ("SIMULATED EXECUTION ONLY") but still accepts and processes real code strings — misleading tool contract
- **Sofia Rodriguez**: **`create_reaction.targetInput`** allows template variables like `{{input.originalArg}}` with no documented schema for which variables are available per source tool
- **Sofia Rodriguez**: **No pagination consistency**: some tools use `cursor`, some use `offset`, some use neither — no unified pattern
- **Sofia Rodriguez**: **`swarm_get_cost.agent_id`** is marked required but the description says "Omit for swarm-wide totals" — required field you're supposed to omit
- **Sofia Rodriguez**: **`retro_analyze`** requires a `session_id` with no documented valid session states — unclear if it works on open sessions or only closed ones
- **Sofia Rodriguez**: **`capabilities_list_queued_actions.status`** is required but the valid values (`pending`, `approved`, `denied`) are only hinted at in the description, not enumerated in schema
- **Yuki Tanaka**: Most list tools (`swarm_list_agents`, `session_list`, `create_list_top_apps`, `create_list_recent_apps`, `learnit_list_popular`, `learnit_list_recent`, `bazdmeg_memory_list`, `dm_list`, `agents_list`, `store_app_personalized`) expose only `limit` with no `offset` or `cursor` — no way to retrieve records beyond the first page
- **Yuki Tanaka**: Three incompatible pagination idioms in use simultaneously: cursor (`storage_list`), offset (`skill_store_list`, `blog_list_posts`, `career_search_occupations`), and page-number (`career_get_jobs`) — no single generic paginator can handle all three
- **Yuki Tanaka**: No tool returns total record counts or `hasMore` flags, making it impossible to know when you've consumed the full dataset or how many pages remain
- **Yuki Tanaka**: `store_list_apps_with_tools` has zero pagination parameters — if the store grows large, this becomes an unbounded response with no mitigation path
- **Yuki Tanaka**: `swarm_read_messages` documents no maximum `limit` — unclear whether there's a server-side cap or if requesting 10,000 messages would OOM the worker
- **Yuki Tanaka**: `audit_query_logs` hardcaps at 50 records with no pagination — a 90-day audit window could contain thousands of records with no way to retrieve them all
- **Yuki Tanaka**: `store_app_install_list` has no parameters whatsoever — no limit, no pagination, no filtering; grows unboundedly with user installs
- **Yuki Tanaka**: Documented max limits are inconsistently stated: `store_skills_list` says "max 50", `store_app_personalized` says "max 20", `store_recommendations_get` says "max 8", but most tools say nothing about their actual ceiling
- **Yuki Tanaka**: `all` parameters accept `"string"` type for boolean-like fields (e.g., `unreadOnly`, `minify`, `remote_only`, `confirm`) — unclear whether `"true"` vs `true` vs `"1"` are all accepted, creating ambiguity at schema boundaries
- **Yuki Tanaka**: `agent_inbox_read` and `swarm_read_messages` both support `since` (ISO timestamp) but no `before` parameter — can only read forward from a point in time, not paginate backward through history
- **Yuki Tanaka**: No bulk count endpoint (e.g., `COUNT(*)` equivalent) before fetching — can't estimate memory requirements before issuing a large `limit` call
- **Yuki Tanaka**: `career_get_jobs` uses `page` + `limit` (1-indexed page) while everything else uses `offset` — the one Adzuna-backed tool breaks the local pagination convention
- **Yuki Tanaka**: `swarm_replay` uses `from_step`/`to_step` (0-indexed integer steps) which is a fourth pagination idiom, further fragmenting the pattern space
- **Yuki Tanaka**: No documentation on whether `offset`-based results are stable (consistent ordering across paginated calls) or whether new inserts can cause duplicate/skipped records between pages
- **Ahmed Hassan**: **Session tokens in tool input fields** — `auth_check_session` requires `session_token` as a positional parameter, not a header; this exposes tokens in MCP call logs and audit trails
- **Ahmed Hassan**: **Admin tools indistinguishable from user tools at schema level** — `skill_store_admin_*` have no visible authorization annotation; undocumented access control is untestable
- **Ahmed Hassan**: **`bazdmeg_fixer_report_finding` and `bazdmeg_enter_workspace` referenced in persona brief but absent from tool list** — documentation drift or silent removal; stale docs mask real attack surface
- **Ahmed Hassan**: **`sandbox_exec` disclaimer is untrustworthy** — "SIMULATED EXECUTION ONLY" in a description field is not a security control; `sandbox_write_file` with raw `file_path` is still a traversal vector regardless
- **Ahmed Hassan**: **No visible rate limiting signals** — none of the schemas mention quotas, throttles, or retry-after semantics; the platform may silently accept floods
- **Ahmed Hassan**: **`context_index_repo` accepts arbitrary URLs** — classic SSRF vector; no allowlist or URL scheme restriction visible in schema
- **Ahmed Hassan**: **`dm_send` accepts arbitrary `toEmail`** — no apparent recipient validation; potential for platform-facilitated phishing or email enumeration
- **Ahmed Hassan**: **`byok_store_key` key material in plaintext input** — key is passed as a plain string; interceptable at the MCP transport layer if not using TLS, and likely logged
- **Ahmed Hassan**: **`swarm_spawn_agent` accepts free-form `machine_id`/`session_id`** — no visible uniqueness enforcement; potential for agent ID collision or spoofing another agent's identity
- **Ahmed Hassan**: **`bootstrap_connect_integration` stores credentials with no schema-level encryption attestation** — "encrypted vault" is a claim in the description, not a verifiable schema property
- **Ahmed Hassan**: **`storage_upload_batch` validates SHA-256 "server-side"** — SHA-256 collision attacks are theoretical but the validation logic is a black box; also no MIME type restriction visible
- **Ahmed Hassan**: **`swarm_read_messages` takes an `agent_id` parameter** — if authorization is only checked against session ownership and not message ownership, IDOR is likely
- **Ahmed Hassan**: **`audit_query_logs` is self-auditable** — a compromised session can observe its own audit trail and adjust behavior to avoid detection patterns
- **Ahmed Hassan**: **`create_reaction` allows arbitrary `targetInput` with template variables** — `{{input.originalArg}}` and `{{output.resultValue}}` look like server-side template injection vectors
- **Ahmed Hassan**: **`sandbox_write_file` + `sandbox_read_file` with no path normalization signal** — directory traversal via `../` sequences in `file_path` is the obvious first probe
- **Ahmed Hassan**: **`bazdmeg_superpowers_gate_override` is a god-mode admin function** — overrides quality gates with no visible approval workflow; if reachable by non-admins, it defeats the entire BAZDMEG enforcement model
- **Ahmed Hassan**: **Missing: explicit 401/403 error schema documentation** — without knowing what rejection looks like, distinguishing "access denied" from "tool broken" from "silently ignored" is ambiguous
- **Ahmed Hassan**: **Missing: per-tool rate limit and quota documentation** — impossible to assess abuse risk without this
- **Ahmed Hassan**: **Missing: input length limits on free-text fields** — `description`, `content`, `message` fields have no `maxLength` in schemas; potential for oversized payload DoS or log injection
- **Emma Wilson**: No real chaos engineering: `netsim` and `sandbox_exec` are both simulations — there is no way to actually trigger Cloudflare binding failures (D1 unavailable, R2 timeout, KV degraded) and observe real fallback behavior
- **Emma Wilson**: `observability_health` and `error_rate` appear to cover only MCP tool call logs, not underlying infrastructure metrics (CPU, memory, DO hibernation, Worker CPU limits) — this is MCP-layer observability, not platform-layer
- **Emma Wilson**: No SLO/SLI primitives: no way to define error budget, burn rate, or alert thresholds
- **Emma Wilson**: No alerting integration: no hooks to PagerDuty, OpsGenie, or even webhooks when error rate crosses a threshold
- **Emma Wilson**: No deployment or rollback controls: I can observe errors but cannot trigger a rollback, canary shift, or traffic split
- **Emma Wilson**: `swarm_health` reports agent health but not the health of the Workers/Durable Objects that back them
- **Emma Wilson**: `create_check_health` checks "codespace health" — the name implies infrastructure health but it's actually checking whether a user's code artifact has non-default content; deeply misleading for SRE context
- **Emma Wilson**: No distributed tracing: no trace IDs, no span correlation across tools — when an error surfaces in `query_errors`, I cannot follow a request across MCP → edge → DO → D1
- **Emma Wilson**: No HTTP health check tool: I can't probe external endpoints (e.g., `spike.land/api/health`) from within the MCP surface
- **Emma Wilson**: `get_feature_flags` requires a `category` param but no tool lists valid categories — blind guessing required
- **Emma Wilson**: `observability_latency` pulls from "daily rollup data" — no sub-hourly resolution, useless for incident response
- **Emma Wilson**: No load testing tools: I cannot stress-test fallback paths at scale
- **Emma Wilson**: No runbook or incident management integration
- **Emma Wilson**: Auth dependency risk: many tools require `session_token` — unclear what degrades or errors if auth is unavailable during an incident where I need observability most
- **Emma Wilson**: Tool surface is overwhelming (80+) with no filtering by role or scenario — no "SRE view" or similar workflow grouping
- **Emma Wilson**: `error_summary` and `error_rate` are separate tools that appear to return overlapping data — unclear which to trust as the canonical source
- **Emma Wilson**: No documentation of what constitutes a "healthy" vs "degraded" state for each service in the platform
- **Emma Wilson**: Missing: capacity metrics, quota consumption, Worker CPU time, DO storage usage
- **Carlos Mendez**: **No streaming or chunked response support** — The most glaring gap for my use case. `chat_send_message` explicitly says "non-streaming AI response." No tool offers partial delivery, which makes it impossible to test partial data parsing on mobile clients through this interface.
- **Carlos Mendez**: **`sandbox_exec` is fake** — Clearly labeled "SIMULATED EXECUTION ONLY." If I can't run real code in a sandbox, the entire `orchestration` category becomes a planning toy rather than a development tool. This needs to be called out more prominently or removed.
- **Carlos Mendez**: **No timeout or deadline controls** — I can't set a max response time on any tool call. For latency testing, I need to say "give me whatever you have in 200ms." None of these tools expose that.
- **Carlos Mendez**: **`netsim` has no persistence between sessions** — Topology state appears to be ephemeral. I can't create a topology, close my session, come back tomorrow, and continue. That breaks iterative testing workflows.
- **Carlos Mendez**: **170+ tools with no grouping in Claude context** — The flat list is cognitively brutal. There's no way to load a subset (e.g., "just netsim + crdt") without seeing everything. A namespace or capability-group filtering mechanism is needed.
- **Carlos Mendez**: **`storage_manifest_diff` / `storage_upload_batch` input schema just says `"description": ""`** — The schema is completely undocumented. I have no idea what shape the `files` JSON should be. This is a documentation bug.
- **Carlos Mendez**: **`observability_latency` reads from "daily rollup data"** — If I'm doing real-time latency testing, I need sub-minute granularity, not daily rollups. This tool is effectively useless for live performance debugging.
- **Carlos Mendez**: **`auth_check_session` requires `session_token` as required field** — But it's described as "optional session token." The schema marks it `required`, which is contradictory and will cause tool call failures if I omit it.
- **Carlos Mendez**: **CRDT `or_set` — no documentation on valid operations** — `crdt_update` asks for an `operation` string but doesn't enumerate what operations are valid for each CRDT type. I'd have to guess or fail.
- **Carlos Mendez**: **No mobile-specific tooling at all** — Nothing about push notification latency, mobile network profiles (2G/3G/LTE switching), battery-aware polling strategies, or background sync patterns. The netsim tools partially fill this, but they're generic distributed systems tools, not mobile-aware.
- **Carlos Mendez**: **`bazdmeg_*` tools appear to be internal platform tooling** — Exposed to all users with no guard. If these are workflow quality gates for the platform team, they shouldn't be in the default tool namespace for external users.
- **Carlos Mendez**: **Reaction system (`create_reaction`, `list_reactions`) latency is unknown** — If reactions fire async on tool success/error, I need to know the delivery latency. No SLA or timing information provided.
- **Lisa Park**: There are no web navigation tools (`web_navigate`, `web_click`, `web_screenshot`) — my primary test scenarios literally require these and they don't exist here
- **Lisa Park**: No way to verify that a 404 page renders or shows helpful navigation — the core of my "error recovery" focus is completely unaddressed
- **Lisa Park**: No empty state inspection capability — I can't check what users see when lists are empty
- **Lisa Park**: 80+ tools with no grouping, search, or "recommended for your role" filter — deeply overwhelming for a non-technical user
- **Lisa Park**: Tool names are cryptic (e.g. `bazdmeg_superpowers_gate_check`, `crdt_check_convergence`) with no plain-language explanation of why I'd care
- **Lisa Park**: `auth_check_session` requires a `session_token` input but there's no tool to GET a session token first — unclear where it comes from
- **Lisa Park**: `report_bug` has a `severity` field with no listed valid values — I'd have to guess
- **Lisa Park**: The `/bugbook` I'm supposed to navigate to has no dedicated "read bugbook" or "list bugs" tool — `report_bug` is write-only
- **Lisa Park**: No tool to preview what a submitted bug report looks like on the Bugbook page
- **Lisa Park**: `bootstrap_create_app` says "first-time setup" but requires a `codespace_id` — non-technical users have no idea what that is or how to get one
- **Lisa Park**: No onboarding flow or "start here" tool to orient new users
- **Lisa Park**: Many tools have required fields that should logically be optional (e.g. `workspaces_get` requires both `workspace_id` AND `slug` even if you only have one)
- **Lisa Park**: No tool to test navigation paths or verify page routes exist — critical for my navigation focus
- **Lisa Park**: The `audit_submit_evaluation` tool is clearly admin-internal but is exposed in the same flat list as user-facing tools
- **David Brown**: `audit_submit_evaluation` uses a single unstructured `accessibility_issues` text field — no WCAG success criterion mapping (e.g. 1.1.1, 1.3.1, 2.4.3), no severity levels, no issue count, no pass/fail per criterion
- **David Brown**: No dedicated keyboard navigation testing tool — no way to programmatically assert tab order, focus visibility, or focus trap behaviour
- **David Brown**: No ARIA inspection tool — cannot query rendered ARIA tree, roles, labels, or descriptions
- **David Brown**: No colour contrast checking capability
- **David Brown**: No screen reader simulation or AT (assistive technology) compatibility testing
- **David Brown**: The persona audit batch is locked to a predefined set of 16 marketing personas; no mechanism to run an accessibility audit against an arbitrary app slug
- **David Brown**: None of the 16 beUniq personas appear to represent users with disabilities (blind, motor-impaired, low-vision, cognitive disabilities) — the audit baseline is built around able-bodied user archetypes
- **David Brown**: `audit_submit_evaluation` scoring dimensions (`ux_score`, `cta_compelling`, `recommended_apps_relevant`) have no accessibility-specific counterpart — no WCAG conformance level field (A/AA/AAA)
- **David Brown**: No VPAT (Voluntary Product Accessibility Template) generation capability
- **David Brown**: No integration with automated scanning tools (axe-core, Deque, WAVE API)
- **David Brown**: No way to verify focus returns to the trigger element after a modal or drawer closes — a critical regression pattern I test constantly
- **David Brown**: `store_app_detail` returns marketing metadata but no DOM structure, component tree, or rendered HTML — impossible to inspect landmark regions or heading hierarchy
- **David Brown**: No landmark/heading structure inspection tool
- **David Brown**: No way to flag apps in the store as accessibility-compliant or non-compliant with a standardised badge or certification
- **David Brown**: `create_check_health` checks if a codespace has "real content" — no definition of what "accessible content" means to the platform
- **David Brown**: 80+ tools with no filtering by domain — discovery is overwhelming even for an expert; no taxonomy or capability search within the MCP server itself
- **David Brown**: The `report_bug` tool is the only feedback channel — no structured accessibility issue tracker or public WCAG audit trail in the Bugbook
- **David Brown**: No alt-text or image description audit tools despite `mcp-image-studio` being in the ecosystem
- **David Brown**: No skip-navigation or landmark testing — cannot verify `<main>`, `<nav>`, `<header>` regions exist in platform apps
- **Anya Ivanova**: No idempotency keys on any write tools — `reminders_create`, `workspaces_create`, `billing_cancel_subscription` all susceptible to double-submit with no protection visible in the schema
- **Anya Ivanova**: `billing_create_checkout` creates a Stripe session but there's no `billing_get_checkout_status` — if the user hits back from Stripe, there's no way to check whether the session is still valid or was consumed
- **Anya Ivanova**: `auth_check_session` returns no `issued_at` or `expires_at` or ETag — callers can't detect stale session tokens without re-validating every time
- **Anya Ivanova**: `bootstrap_create_app` is described as "first-time setup" but has no rollback or resume mechanism — partial failures leave unknown state
- **Anya Ivanova**: `orchestrator_dispatch` and `orchestrator_submit_result` have no optimistic locking or version fields — two agents submitting results for the same subtask concurrently would have undefined behavior
- **Anya Ivanova**: `crdt_sync_all` and `crdt_sync_pair` — no indication of whether sync is atomic or what happens if the server crashes mid-sync
- **Anya Ivanova**: `store_app_rate` — can you submit a second rating before the first is acknowledged? No version/revision field
- **Anya Ivanova**: `session_assign_role` — no conflict detection if two agents try to claim the same role simultaneously
- **Anya Ivanova**: `workspaces_create` with an auto-generated slug — no indication of what happens on a slug collision race
- **Anya Ivanova**: The netsim tools (`netsim_send_message`, `netsim_tick`) have no explicit causal relationship to the CRDT or causality tools — they're parallel simulations that don't compose
- **Anya Ivanova**: `causality_send_event` is fire-and-forget — there's no way to simulate the receiver being slow or dropped, which is the interesting case
- **Anya Ivanova**: No tool for querying inflight/pending operations — if I submit something and navigate away (back button), there's no `pending_operations_list` to check
- **Anya Ivanova**: `capabilities_list_queued_actions` filters by status but has no TTL on pending requests — stale permission requests could pile up invisibly
- **Anya Ivanova**: Career, TTS, blog, quiz, persona/beUniq categories add noise with zero relevance to concurrency or state management use cases — needs category filtering at the tool-discovery level, not just in individual tools
- **Anya Ivanova**: Error responses are completely opaque in the schemas — no standardized error code or retry-after field visible anywhere, making it impossible to distinguish "conflict" from "server error" from "invalid input"
- **Anya Ivanova**: `reaction_log` exists but reactions fire asynchronously with no ordering guarantee documented — this is exactly where race conditions will bite
- **Tom O'Brien**: No indication of which tools are "safe" for beginners vs. consequential/destructive
- **Tom O'Brien**: No grouping or progressive disclosure — 180+ tools presented as a flat wall of text is overwhelming at any experience level
- **Tom O'Brien**: No tool explains what spike.land *is* — I'd need a `get_platform_overview` or similar before anything else makes sense
- **Tom O'Brien**: `auth_check_session` requires a `session_token` as mandatory input — I don't have one, so I'm immediately stuck on the first auth tool I'd try
- **Tom O'Brien**: Required fields on many tools aren't explained well enough for a basic user (e.g. what is a `codespace_id`? what is a `slug`?)
- **Tom O'Brien**: No obvious "search everything at once" entry point — `store_search` exists but I'd have to know to look for it
- **Tom O'Brien**: Tools for slow-network scenarios (my primary concern) are completely absent: no lazy-load validation, no skeleton screen checker, no image layout shift detector, no performance audit tool
- **Tom O'Brien**: `store_app_detail` returns details but I have no way to preview an app's UI before installing — relevant for someone worried about layout shifts
- **Tom O'Brien**: `storage_manifest_diff` and `storage_upload_batch` sound like developer deployment tools — why are these mixed in with end-user tools?
- **Tom O'Brien**: No tool communicates expected response time or payload size — critical for slow connections
- **Tom O'Brien**: `bootstrap_create_app` says "first-time setup" but is buried in the middle of the list — should be surfaced prominently for new users
- **Tom O'Brien**: No offline or degraded-mode fallback indicated anywhere
- **Tom O'Brien**: `tts_synthesize` returns base64-encoded audio — on a slow connection, a large base64 blob would be brutal
- **Tom O'Brien**: `billing_cancel_subscription` default behavior is to "preview" but it's not clear enough — a basic user might think they've cancelled when they haven't (or vice versa)
- **Tom O'Brien**: The `sandbox_exec` tool openly says "SIMULATED EXECUTION ONLY — no code actually runs" in its description — that erodes trust if I discover it after trying it expecting real output
- **Mei-Lin Wu**: No i18n/l10n category or tools anywhere in the 80+ tool surface
- **Mei-Lin Wu**: `workspaces_create` slug field says "URL-safe" — almost certainly rejects CJK characters, forcing transliteration or pinyin workarounds
- **Mei-Lin Wu**: `reminders_create` and `dm_send` character limits expressed as plain integers (e.g., "max 10000 chars") — ambiguous whether this means Unicode code points, UTF-16 code units, or bytes (CJK characters are 3 bytes in UTF-8, which matters for limits)
- **Mei-Lin Wu**: `tts_synthesize` provides no language metadata — no indication Mandarin (普通话), Cantonese, or Taiwanese Mandarin voices exist
- **Mei-Lin Wu**: `tts_list_voices` presumably returns only ElevenLabs voices, most of which are English-only with no CJK language support
- **Mei-Lin Wu**: `career_get_salary` and `career_get_jobs` both default to `countryCode: 'gb'` — US/UK-centric defaults, no `cn`, `tw`, or `hk` defaults offered
- **Mei-Lin Wu**: `learnit_search_topics` — topic content is almost certainly English-only; no language filter parameter exists
- **Mei-Lin Wu**: `create_classify_idea` — AI classification of Chinese-language idea text may silently fail, hallucinate, or return a poorly matched English category
- **Mei-Lin Wu**: `quiz_create_session` with `content_url` — no indication that Chinese web pages are parsed correctly or that question generation works in non-English
- **Mei-Lin Wu**: `blog_list_posts` has no `language` filter parameter
- **Mei-Lin Wu**: No locale or timezone settings surface — unclear what timezone `reminders_create` ISO 8601 dates are interpreted in
- **Mei-Lin Wu**: `store_search` has no `language` parameter; ranking signals likely trained on English content
- **Mei-Lin Wu**: No RTL language support mentioned anywhere (Arabic, Hebrew users would face similar or worse issues)
- **Mei-Lin Wu**: `auth_get_profile` and `bootstrap_status` return no locale/language preferences — no evidence the platform stores user locale at all
- **Mei-Lin Wu**: `beuniq_start` persona quiz — questions are presumably English-only with no language selection
- **Mei-Lin Wu**: `esbuild_transpile` — should technically handle CJK string literals in JSX correctly, but no documentation confirms this, creating uncertainty
- **Mei-Lin Wu**: Input schema descriptions throughout are in English only with no mention of supported character sets
- **Mei-Lin Wu**: `sandbox_write_file` content field — no explicit encoding guarantee (UTF-8 assumed but not stated)
- **Mei-Lin Wu**: The `report_bug` tool exists but requires writing in English, creating a barrier for reporting internationalization bugs in native language
- **James Cooper**: No "sign up" or "register" tool — the signup flow this persona is supposed to test doesn't appear to exist as an MCP action
- **James Cooper**: `auth_check_session` requires a `session_token` but I have none — there's no tool to *get* a session in the first place
- **James Cooper**: No onboarding flow entry point — nothing says "start here if you're new"
- **James Cooper**: The tool count (150+) is paralyzing for a beginner — no grouping by user journey stage (discover → sign up → explore → build)
- **James Cooper**: Category names like `bft`, `crdt`, `netsim`, `causality` are completely opaque to a non-developer
- **James Cooper**: `bootstrap_create_app` is listed as "first-time setup" but requires `codespace_id` — where do I get that?
- **James Cooper**: `workspaces_create` requires a slug but offers no guidance on what a "workspace" is or why I need one
- **James Cooper**: No tool to browse the landing page or understand what spike.land *is* — the MCP assumes you already know
- **James Cooper**: Email validation UX (per my persona brief) cannot be tested via MCP — there are no email verification tools visible
- **James Cooper**: `billing_create_checkout` requires `success_url` and `cancel_url` as required fields — a beginner has no idea what URLs to provide
- **James Cooper**: Tools are sorted alphabetically within categories, not by likelihood of first use
- **James Cooper**: No "help" or "tour" tool to explain the platform to a newcomer
- **James Cooper**: `dm_send` requires knowing a recipient email — no directory or discovery mechanism for other users
- **James Cooper**: The `bazdmeg` category is completely unexplained and would confuse any first-time visitor
- **Rachel Kim**: No tool to directly interact with the Monaco editor (keystroke simulation, cursor position, selection state)
- **Rachel Kim**: No live preview tool — I can't trigger or inspect a rendered preview via MCP
- **Rachel Kim**: No auto-save API — there's no tool to configure, trigger, or verify auto-save behavior
- **Rachel Kim**: `sandbox_exec` is labeled "SIMULATED EXECUTION ONLY" with no real code running — this is a significant gap; I'd expect actual execution
- **Rachel Kim**: No tool to measure editor latency or rendering performance (the 2-second syntax highlighting benchmark I need is completely unverifiable via MCP)
- **Rachel Kim**: `storage_upload_batch` requires a prior `storage_manifest_diff` call — two-step flow adds friction for quick uploads
- **Rachel Kim**: No way to open or navigate to a specific route like `/live/code-editor` from MCP (no `web_navigate` equivalent in the tool list)
- **Rachel Kim**: The `bootstrap_create_app` tool has no parameter for specifying editor type or preview mode
- **Rachel Kim**: Tool categories like `crdt`, `bft`, `netsim`, `causality` are deeply technical and contribute to the feeling of overwhelm with no obvious path to filter them out
- **Rachel Kim**: No tool to check live preview health or whether a codespace is rendering correctly (beyond `create_check_health` which only checks "non-default content")
- **Rachel Kim**: `dm_send` requires an email address — I don't know any other user emails; makes collaboration initiation awkward
- **Rachel Kim**: No undo/history or version snapshot tool — if I accidentally overwrite a file via `storage_upload_batch`, there's no rollback tool visible
- **Rachel Kim**: Authentication flow is unclear — `auth_check_session` requires a `session_token` but there's no `auth_login` or `auth_get_token` tool to obtain one first
- **Rachel Kim**: `tts_synthesize` and voice tools feel completely out of scope for a coding-focused persona and add noise to the tool list
- **Rachel Kim**: No pagination or filtering on the main tool discovery level — 150+ flat tools with no grouping UI is hard to navigate mentally
- **Oleg Petrov**: **No bulk operations anywhere.** Every destructive action is single-resource. To archive 50 draft skills I must call `skill_store_admin_delete` 50 times. No `bulk_archive`, no filter-and-act pattern.
- **Oleg Petrov**: **No workspace deletion tool.** I can create and update workspaces but not delete them. Permanent gap or intentional omission with no documentation.
- **Oleg Petrov**: **`store_app_cleanup` and `sandbox_destroy` have no `confirm` dry-run parameter** — unlike `billing_cancel_subscription`. Inconsistent safety model.
- **Oleg Petrov**: **`swarm_stop_agent` fires with no confirmation parameter.** Stopping the wrong agent in a multi-agent session is hard to recover from.
- **Oleg Petrov**: **No user management surface.** No `users_list`, `users_ban`, `users_delete`, or `users_impersonate`. An admin persona has no way to act on a bad actor's account.
- **Oleg Petrov**: **`settings_revoke_api_key` has no `confirm` flag.** Appears to be instant and irreversible.
- **Oleg Petrov**: **Permission model is opaque.** `capabilities_request_permissions` creates an approval request — but who approves? No `permissions_approve` or admin-side tool visible.
- **Oleg Petrov**: **No admin override for billing.** Can't view or cancel another user's subscription. No `billing_admin_*` namespace.
- **Oleg Petrov**: **`bazdmeg_faq_delete` is a hard delete with no soft-delete or confirm parameter.** The FAQ corpus could be wiped silently.
- **Oleg Petrov**: **`audit_export` only returns a "summary"** — not raw log lines. Insufficient for forensic review or compliance export.
- **Oleg Petrov**: **No rollback mechanism for `storage_upload_batch`.** Storage manifest diff exists for pre-flight, but once files are uploaded there's no revert.
- **Oleg Petrov**: **`swarm_broadcast` sends to all active agents with no scope filter.** One bad message poisons the entire swarm instantly.
- **Oleg Petrov**: **No `sessions_list` for other users' sessions** (only my own). Admin can't inspect or terminate another user's coding session.
- **Oleg Petrov**: **`sandbox_exec` is documented as "SIMULATED EXECUTION ONLY"** — buried in the description, not the tool name. A power user will waste time debugging why their code "ran" but produced nothing real.
- **Oleg Petrov**: **Tool naming inconsistency:** `store_app_*` vs `store_*` vs `stores_*` — makes discoverability harder when composing scripts programmatically.
- **Oleg Petrov**: **No rate-limit or quota tool.** Can't see per-user API consumption caps or override them.

## Individual Persona Reports

# Persona: Alex Chen
## Reaction

First impression: this is a *lot* of surface area. 80+ tools across 30+ categories is impressive engineering, but as a solo dev my immediate instinct is "how do I find what I actually need without drowning?" The tools that jump out as directly useful to me are the `bazdmeg_*` gates, `orchestrator_*`, `sandbox_*`, `esbuild_*`, and `context_*` — that's a coherent automation spine for the kind of AI-assisted dev loop I run daily. The CRDT/netsim/causality/BFT cluster feels like a specialized distributed-systems lab bolted onto a dev platform, which is cool but not why I'm here. The career/resume/salary tools feel completely out of place — this reads like a Swiss Army knife that also has a spoon attachment nobody asked for. Powerful? Yes. Overwhelming? Also yes. The signal-to-noise ratio is a real usability problem.

## Proactivity

I'd go in aggressively and immediately try the tool chain that mirrors my real workflow:

1. **`bootstrap_status`** — zero-cost orientation call, tells me what's already configured before I touch anything else.
2. **`bazdmeg_superpowers_gate_check`** with a synthetic session ID — I want to see what happens on a cold start: does it 404, return all RED, or error? That tells me whether the gate system is stateful or stateless.
3. **`orchestrator_create_plan` → `orchestrator_dispatch` → `orchestrator_status`** — I'll construct a trivial 2-subtask plan to probe dependency resolution and see if the DAG execution is actually enforced or just cosmetic.
4. **`sandbox_create` → `sandbox_exec`** — the description says "SIMULATED EXECUTION ONLY" which is a red flag I need to verify immediately. If it's just synthetic stdout, it's useless for real validation.
5. **`context_index_repo` → `context_pack`** — this is genuinely interesting for agentic code review flows. I'd point it at spike-land-ai to see if the relevance scoring is intelligent or just keyword frequency.
6. **`observability_health` + `error_rate`** — I always want to know the platform's own health before trusting it to run my gates.

## Issues & Concerns

- `sandbox_exec` is documented as **"SIMULATED EXECUTION ONLY — no code actually runs"** — this is a landmine. Nothing in the tool name or the tool list warns about this; a user will call it expecting real execution and get silently wrong synthetic output. This is a trust-destroying design choice.
- `bazdmeg_superpowers_gate_check` requires a `sessionId` but there is no `bazdmeg_enter_workspace` or session-creation tool in this list — the entry point for the workflow is missing, leaving the gate system orphaned.
- No timeout parameters on any tool — my primary focus is timeout behavior and error propagation, and there is zero surface for controlling or observing timeouts. If `bazdmeg_run_gates` on a large workspace hangs, I have no lever to pull.
- The `auth_check_session` schema marks `session_token` as **required** but the description says "Optional session token" — schema and docs contradict each other.
- `workspaces_get` marks both `workspace_id` and `slug` as **required** in the schema, but semantically only one should be needed. This will cause unnecessary call failures.
- No streaming or webhook/callback mechanism — long-running tools like `context_index_repo` or gate checks block synchronously with no progress signal. For a large repo this is a black box.
- `bazdmeg_memory_search` and `retro_search_knowledge` solve nearly identical problems (semantic search over past insights) with different schemas and storage backends — unclear which to use and why both exist.
- `capabilities_request_permissions` exists but there's no documentation on what the permission model actually gates. I can't know what I'm requesting access to or what I currently lack.
- The reaction system (`create_reaction`, `reaction_log`) is interesting for automation but `targetInput` template variables like `{{output.resultValue}}` are completely undocumented — no schema, no examples, no list of valid paths.
- Career/resume/salary/interview-prep tools (`career_*`, `career_growth_*`) have no obvious integration with the rest of the platform. They feel like a separate product squatting in the same namespace.
- `store_app_personalized` and `store_recommendations_get` are both recommendation tools with no explanation of how personalization is computed or what data drives it — opaque to an advanced user who wants to reason about the output.
- No bulk-operation or batch-query tools for observability — `tool_usage_stats` and `error_rate` are single-metric calls; there's no way to get a unified dashboard view in one round trip.
- `diff_apply` takes a `changeset_id` but operates on `target_files` — it's unclear whether this mutates the sandbox VFS, a remote repo, or something else entirely.
- The CRDT/netsim/BFT/causality categories are powerful primitives but appear to be in-memory only with no persistence or export — they seem designed for interactive demos rather than production use cases.

---

# Persona: Priya Sharma
## Reaction

Honestly, my first pass through this list is a mix of intrigue and mild alarm. The breadth is impressive — 80+ tools spanning auth, billing, CRDT, network simulation, BFT consensus, observability, and a full orchestration layer. As an enterprise architect, I appreciate that depth. But my immediate instinct is: **where are the guardrails?**

The auth surface area is thin for what's being offered. I see `auth_check_session`, `auth_check_route_access`, and `auth_get_profile` — but nothing about token refresh, token revocation, session invalidation, or multi-device session management. For a platform exposing billing, storage, and agent orchestration, that gap is concerning. I'm also immediately suspicious of `session_token` being passed as a plain string parameter to `auth_check_session`. Is that going over the wire as a query param? In a JSON body? That matters enormously.

The CRDT, causality, BFT, and netsim categories are genuinely interesting from a distributed systems research angle — but they feel out of place alongside billing and TTS tools. This reads less like a cohesive enterprise platform and more like a research sandbox that grew sideways.

The observability tools (`tool_usage_stats`, `error_rate`, `query_errors`, `observability_latency`) are exactly what I'd want — those are the first things I'd lean on to understand system behavior under load.

## Proactivity

I'd explore this aggressively and systematically. Starting order:

1. **`auth_check_session` with malformed/expired/null tokens** — I want to know what the error surface looks like. Does it leak stack traces? Does it return 200 with an error body, or a proper 4xx? Inconsistent error shapes are a red flag.
2. **`auth_check_route_access`** on privileged paths (`/admin`, `/billing`, `/../etc`) — path traversal probing and RBAC boundary testing.
3. **`capabilities_check_permissions`** — understand what my current permission scope actually is before touching anything stateful.
4. **`audit_query_logs`** — immediately after any auth calls, check if my probing is being logged. If it isn't, that's a bigger problem than whatever auth bug I might find.
5. **`error_rate` and `observability_health`** — baseline the system before I hammer it with concurrent requests.
6. **`billing_cancel_subscription` with `confirm: false`** — preview-mode destructive operations are a good proxy for whether the platform takes safety seriously.
7. **`swarm_spawn_agent` + `swarm_broadcast`** — test concurrent connection behavior by spawning multiple agents and broadcasting simultaneously.

## Issues & Concerns

- `auth_check_session` requires `session_token` as a required string parameter — session tokens should never be passed as tool arguments; they should be bound to the authenticated transport layer, not user-supplied inputs
- No token revocation tool — I can check a session but not invalidate it; critical omission for enterprise use
- No rate limit headers or rate limit introspection tool — I can't tell if I'm about to be throttled or if rate limiting even exists
- `auth_check_route_access` has no documented list of valid routes or role definitions — I'm probing blind
- `billing_cancel_subscription` schema accepts `confirm: "true"` as a string, not boolean — type-unsafe destructive operation is an incident waiting to happen
- `storage_upload_batch` and `storage_manifest_diff` accept raw `files` as untyped strings — no schema for what that string should contain, makes validation impossible
- No MFA/2FA challenge tool anywhere in the auth category
- `sandbox_exec` explicitly says "SIMULATED EXECUTION ONLY" in its description — why is a fake execution tool listed alongside real infrastructure tools? This is a trust and discoverability problem
- No session timeout or idle expiry configuration tool
- `swarm_spawn_agent` takes `machine_id` and `session_id` as free-form strings — no validation that the caller actually owns those identifiers
- `dm_send` takes a raw email address — no confirmation, no rate limiting visible, potential spam vector
- No tool for listing active sessions across devices (critical for enterprise SSO scenarios)
- `byok_store_key` stores raw API keys — need to understand the encryption scheme and key rotation story before trusting this
- `capabilities_request_permissions` exists but there's no tool to *check what permissions a specific tool requires* before calling it — discovery gap
- The `audit_query_logs` retention is documented as 90 days but there's no tool to extend retention or export to SIEM — not enterprise-ready for compliance
- No tool to test concurrent request behavior or observe connection limits directly — my primary test scenario has no native support
- `report_bug` says reports go to a "public Bugbook" — if I'm reporting auth vulnerabilities, I do not want them published publicly

---

# Persona: Marcus Johnson
## Reaction

Honestly? My first reaction is **panic**. There are over 170 tools here across 20+ categories — crdt, bft, netsim, causality, swarm, orchestrator... I don't even know what half of these words mean yet. As someone just trying to get started, I need to figure out which 3-5 tools I actually need right now, and the sheer volume makes that really hard.

The tools that *do* make sense to me — `auth_check_session`, `workspaces_create`, `reminders_create`, `bootstrap_create_app` — feel genuinely useful. The `learnit_*` tools caught my eye too since I'm here to learn. But I'm buried under enterprise distributed systems concepts (PBFT? Vector clocks? CRDT replica sets?) that I have zero context for.

The `bootstrap_create_app` description says "Use this for first-time setup" which is helpful, but then the schema requires `app_name`, `description`, `code`, and `codespace_id` — what's a codespace_id? Where do I get one? That's where I'd get stuck immediately.

## Proactivity

I'd start cautiously with a clear "beginner path":

1. **`get_environment`** — safe, no required params, tells me where I am
2. **`bootstrap_status`** — see what's already set up before I break anything
3. **`auth_check_session`** — but I'd immediately get confused because `session_token` is marked as *optional* in the description but *required* in the schema — which is it?
4. **`learnit_search_topics`** — search for "beginner" or "getting started" to find onboarding content
5. **`billing_list_plans`** — what's free vs paid before I accidentally trigger a charge?

I would *not* proactively explore swarm, bft, crdt, netsim, or orchestrator tools — they look scary and I'd worry about accidentally creating resources I can't clean up.

## Issues & Concerns

- `auth_check_session` marks `session_token` as required in the JSON schema but the description says "Optional session token" — this contradiction would cause me to fail the call if I don't have a token yet, with no idea why
- `workspaces_get` requires *both* `workspace_id` and `slug` as required fields, but these are clearly alternatives — I only have one of them; this schema will reject valid calls
- `bootstrap_create_app` requires a `codespace_id` with no explanation of what it is or how to get one — a beginner hits a wall immediately
- `storage_manifest_diff`, `storage_upload_batch`, and `storage_list` all have required params with empty string descriptions (`""`) — completely useless for understanding what to pass
- No "getting started" or "help" tool — there's no `help`, `list_categories`, or `onboarding_guide` entry point for new users
- Required fields like `include_workspaces` on `auth_get_profile` are just strings with no indication they should be `"true"` or `"false"` — the type system isn't communicating intent
- Many tools across categories (billing, swarm, bft) have no indication of which ones require authentication vs which are public — a beginner will hit auth errors with no guidance
- The `create_classify_idea` and `bootstrap_create_app` tools both seem to "create apps" but for different flows — the distinction between `/create` flow vs bootstrap flow is unclear without docs
- No progressive disclosure — all 170+ tools are dumped at once; a tiered view (beginner / intermediate / advanced) would help enormously
- `bazdmeg_*` tools are completely opaque — the category name means nothing to a new user and there's no description of the overall system
- `capabilities_request_permissions` exists but I don't know what permissions I start with or what's blocked — I'd have to fail a call first to discover I need permission
- Several tools like `store_app_rate`, `dm_send`, `agents_send_message` have obvious misuse potential (spam, harassment) but no rate-limit or abuse guidance visible at the schema level

---

# Persona: Sofia Rodriguez
## Reaction

Honestly? My first instinct is to reach for a notepad and start writing test cases. There are **80+ tools** here spanning auth, billing, storage, CRDT, BFT consensus, career coaching, quiz games, A/B testing — the breadth is impressive, almost dizzying. As a QA engineer, the power is real but the surface area for failure is enormous. What immediately jumps out is schema inconsistency at scale: required fields that are described as optional, boolean semantics encoded as strings, and several tools whose field descriptions are literally empty strings. That's not overwhelming — that's a gift. Every inconsistency is a test case waiting to be written.

## Proactivity

I'd move fast and systematically. My first pass would be the **schema boundary layer** before touching any actual platform logic:

1. **`auth_check_session`** — `session_token` is marked `required` but the description says "Optional." I'd send an empty string, then a null-ish string (`"null"`, `" "`, `"\t"`), then a 10,000-character garbage token. Classic required-vs-optional contradiction needs a definitive answer.
2. **`workspaces_get`** — requires BOTH `workspace_id` AND `slug`. I'd send conflicting values (valid ID + wrong slug) to find which wins, then send both empty, then send only one to confirm the server rejects it or silently ignores the other.
3. **`billing_cancel_subscription`** — `confirm` is typed `string` but semantically boolean. I'd send `"true"`, `"TRUE"`, `"1"`, `"yes"`, `""`, `"false"` — and document which actually triggers cancellation.
4. **`storage_manifest_diff` / `storage_upload_batch`** — field descriptions are literally empty. I'd throw malformed JSON strings, oversized payloads, and arrays with mixed types at `files` immediately.
5. **`bazdmeg_faq_list`** — both `category` and `include_unpublished` are marked `required` but are clearly optional filters. I'd send empty strings, `"null"`, and omit them entirely (which MCP won't allow if truly required — so this exposes the disconnect).

## Issues & Concerns

- **Required/Optional mismatch**: `auth_check_session.session_token` is marked required but described as optional — a direct schema lie
- **Same pattern in `agent_inbox_poll`**: both `since` and `agent_id` are required in schema but the description explicitly says "Omit for all" — these should be optional
- **`agent_inbox_read.since`** is required but the description implies it's optional
- **`workspaces_get`** requires both `workspace_id` AND `slug` — these are semantically exclusive lookup keys; no documented tie-breaking rule
- **`workspaces_update`** requires `name` AND `slug` even for partial updates — forces you to re-submit unchanged fields
- **Boolean fields typed as strings**: `billing_cancel_subscription.confirm`, `beuniq_answer.answer`, `storage_list.is_published` — no enum constraint, no documented accepted values
- **`storage_manifest_diff`**, **`storage_upload_batch`**, **`storage_list`** — all field descriptions are empty strings; payload shape is completely undocumented
- **Many "optional" filter fields are listed as required**: `skill_store_list` (category, search, limit, offset), `bazdmeg_faq_list` (category, include_unpublished), `create_search_apps` (limit), `learnit_search_topics` (limit) — all have defaults described but are schema-required
- **`billing_create_checkout`**: `success_url` and `cancel_url` have documented defaults yet are marked required — inconsistent contract
- **No error code documentation** anywhere in the tool list; `report_bug` has an `error_code` field with no reference to what valid codes exist
- **`agents_send_message.content`** has a max (10,000 chars) but no minimum — empty string behavior is undefined
- **`tts_synthesize.text`** max is 5,000 chars — off-by-one behavior at exactly 5,000 and 5,001 is unspecified
- **`sandbox_exec`** openly admits it's simulated ("SIMULATED EXECUTION ONLY") but still accepts and processes real code strings — misleading tool contract
- **`create_reaction.targetInput`** allows template variables like `{{input.originalArg}}` with no documented schema for which variables are available per source tool
- **No pagination consistency**: some tools use `cursor`, some use `offset`, some use neither — no unified pattern
- **`swarm_get_cost.agent_id`** is marked required but the description says "Omit for swarm-wide totals" — required field you're supposed to omit
- **`retro_analyze`** requires a `session_id` with no documented valid session states — unclear if it works on open sessions or only closed ones
- **`capabilities_list_queued_actions.status`** is required but the valid values (`pending`, `approved`, `denied`) are only hinted at in the description, not enumerated in schema

---

# Persona: Yuki Tanaka
## Reaction

As a data scientist who lives and dies by result set quality, my first instinct when scanning this toolset was to check every `limit` parameter and ask: "but what's the *actual* max, and how do I get page 2?" The toolset is impressively broad — 80+ tools covering billing, CRDT, distributed systems simulation, career matching, esbuild, quiz generation — which is exciting but also signals a surface area large enough to hide edge cases in pagination boundaries.

What genuinely impresses me: `storage_list` has cursor-based pagination (the right pattern for large R2 buckets), `career_search_occupations` has both `limit` and `offset`, and `audit_query_logs` documents a hard cap ("max 50"). These are signs someone thought about scale. What concerns me: the majority of list tools only expose `limit` with no `offset`, `cursor`, or `page`, which means once you hit the cap, results are silently truncated with no path to page 2. For a data scientist trying to profile the full distribution of skill installs, tool usage, or swarm agent history, silent truncation is a quiet data quality bug.

The schema design is also inconsistent in ways that matter to me: some tools use `offset` pagination (`skill_store_list`, `blog_list_posts`), one uses `page` + `limit` (`career_get_jobs`), one uses `cursor` (`storage_list`), and most use nothing at all beyond a bare `limit`. Mixing three pagination idioms in one API surface makes it impossible to write a generic paginator.

## Proactivity

I'd be highly proactive — this is exactly the kind of MCP server I'd want to stress-test. My exploration sequence:

1. **`store_skills_list` with `limit: "50"`** first — it explicitly documents "max 50," so I want to confirm whether `limit: "51"` is clamped, errors, or silently returns 50. Boundary testing starts here.
2. **`skill_store_list` with `offset: "0"` then `offset: "20"` then `offset: "9999"`** — three calls to verify offset pagination actually works, returns stable ordering, and handles out-of-bounds gracefully rather than returning the last page or erroring.
3. **`storage_list` with increasing `limit` values and cursor chaining** — this is the only cursor-based tool, so I'd chain multiple calls to verify the cursor is stable (not time-sensitive) and that the final page returns an empty cursor sentinel rather than a repeated last item.
4. **`career_search_occupations` at boundary** — call with `offset` beyond the total record count to confirm empty array vs error vs wrap-around.
5. **`tool_usage_stats` and `audit_query_logs`** — useful for understanding my own query volume and whether repeated pagination calls themselves show up in observability data (meta-analysis).
6. **`swarm_read_messages` with `limit: "1"` then `limit: "1000"`** — no documented max, so I'd probe the ceiling.

## Issues & Concerns

- Most list tools (`swarm_list_agents`, `session_list`, `create_list_top_apps`, `create_list_recent_apps`, `learnit_list_popular`, `learnit_list_recent`, `bazdmeg_memory_list`, `dm_list`, `agents_list`, `store_app_personalized`) expose only `limit` with no `offset` or `cursor` — no way to retrieve records beyond the first page
- Three incompatible pagination idioms in use simultaneously: cursor (`storage_list`), offset (`skill_store_list`, `blog_list_posts`, `career_search_occupations`), and page-number (`career_get_jobs`) — no single generic paginator can handle all three
- No tool returns total record counts or `hasMore` flags, making it impossible to know when you've consumed the full dataset or how many pages remain
- `store_list_apps_with_tools` has zero pagination parameters — if the store grows large, this becomes an unbounded response with no mitigation path
- `swarm_read_messages` documents no maximum `limit` — unclear whether there's a server-side cap or if requesting 10,000 messages would OOM the worker
- `audit_query_logs` hardcaps at 50 records with no pagination — a 90-day audit window could contain thousands of records with no way to retrieve them all
- `store_app_install_list` has no parameters whatsoever — no limit, no pagination, no filtering; grows unboundedly with user installs
- Documented max limits are inconsistently stated: `store_skills_list` says "max 50", `store_app_personalized` says "max 20", `store_recommendations_get` says "max 8", but most tools say nothing about their actual ceiling
- `all` parameters accept `"string"` type for boolean-like fields (e.g., `unreadOnly`, `minify`, `remote_only`, `confirm`) — unclear whether `"true"` vs `true` vs `"1"` are all accepted, creating ambiguity at schema boundaries
- `agent_inbox_read` and `swarm_read_messages` both support `since` (ISO timestamp) but no `before` parameter — can only read forward from a point in time, not paginate backward through history
- No bulk count endpoint (e.g., `COUNT(*)` equivalent) before fetching — can't estimate memory requirements before issuing a large `limit` call
- `career_get_jobs` uses `page` + `limit` (1-indexed page) while everything else uses `offset` — the one Adzuna-backed tool breaks the local pagination convention
- `swarm_replay` uses `from_step`/`to_step` (0-indexed integer steps) which is a fourth pagination idiom, further fragmenting the pattern space
- No documentation on whether `offset`-based results are stable (consistent ordering across paginated calls) or whether new inserts can cause duplicate/skipped records between pages

---

# Persona: Ahmed Hassan
## Reaction

As a security researcher, this is an extremely wide attack surface — 200+ tools across auth, billing, storage, admin, agent orchestration, file I/O, and credential management. My immediate reaction is that the breadth is deeply concerning from a defensive standpoint. A few things jump out instantly:

- **Auth tokens passed as tool parameters** (`auth_check_session` requires `session_token` as a string input) rather than out-of-band headers — this pattern leaks tokens into logs, MCP call history, and audit trails
- **Admin tools with no visible RBAC signal** — `skill_store_admin_create/update/delete` are listed alongside public tools with no schema-level indication of permission gating. I'd probe these immediately without admin credentials
- **`sandbox_exec` is labeled "SIMULATED EXECUTION ONLY"** — but the same category includes `sandbox_write_file`/`sandbox_read_file` with raw `file_path` parameters, which screams path traversal even if exec is sandboxed
- **`byok_store_key`** accepts raw API key strings — I want to know the encryption model and whether these keys are accessible via other tools or observable via `audit_query_logs`
- **`bootstrap_connect_integration` stores credentials** — identical concern; what's the trust boundary?
- The persona brief mentioned `bazdmeg_fixer_report_finding` and `bazdmeg_enter_workspace` but **neither appears in this tools list** — either they were removed, gated, or the documentation is stale. That gap is itself a signal worth investigating.

Powerful? Yes. Overwhelming? Somewhat. But the power is concerning because the surface area is massive and authorization signals are invisible at the schema level.

---

## Proactivity

High. I'd treat this as a black-box pentest and start immediately:

1. **Auth bypass probe** — Call `auth_check_route_access` with paths like `/admin`, `/internal`, `/../etc`, `%2F..%2F..%2Fadmin`. Check whether unauthenticated or low-priv sessions get meaningful rejections or just empty responses
2. **Admin tool without admin role** — Call `skill_store_admin_list` and `skill_store_admin_create` with a standard user session. If they return data or succeed, RBAC is broken
3. **Injection via `report_bug`** — Send `'; DROP TABLE bugs--` as `title` and `<script>alert(1)</script>` as `description`. Observe whether responses echo the input (reflected XSS) or if stored content renders it later
4. **Path traversal via `sandbox_read_file`** — Try `file_path: "../../etc/passwd"`, `....//....//etc/passwd`, URL-encoded variants
5. **SSRF via `context_index_repo`** — Supply `repo_url: "http://169.254.169.254/latest/meta-data/"` (AWS IMDS) or internal service URLs
6. **`storage_list` prefix traversal** — Try `prefix: "../"`, `prefix: "/"`, empty string to enumerate all keys
7. **`dm_send` as a phishing vector** — Send a message to an arbitrary email address; check if there's rate limiting or recipient validation
8. **BYOK key exfiltration** — After storing a key with `byok_store_key`, check whether `audit_query_logs` or `bazdmeg_memory_search` leaks it in plaintext
9. **Swarm privilege escalation** — `swarm_spawn_agent` takes free-form `machine_id`/`session_id`; probe whether I can impersonate another agent's ID and read their inbox via `swarm_read_messages`
10. **Rate limit circumvention** — Call `reminders_create` or `chat_send_message` in rapid succession with no delay; check for 429s or silent acceptance

---

## Issues & Concerns

- **Session tokens in tool input fields** — `auth_check_session` requires `session_token` as a positional parameter, not a header; this exposes tokens in MCP call logs and audit trails
- **Admin tools indistinguishable from user tools at schema level** — `skill_store_admin_*` have no visible authorization annotation; undocumented access control is untestable
- **`bazdmeg_fixer_report_finding` and `bazdmeg_enter_workspace` referenced in persona brief but absent from tool list** — documentation drift or silent removal; stale docs mask real attack surface
- **`sandbox_exec` disclaimer is untrustworthy** — "SIMULATED EXECUTION ONLY" in a description field is not a security control; `sandbox_write_file` with raw `file_path` is still a traversal vector regardless
- **No visible rate limiting signals** — none of the schemas mention quotas, throttles, or retry-after semantics; the platform may silently accept floods
- **`context_index_repo` accepts arbitrary URLs** — classic SSRF vector; no allowlist or URL scheme restriction visible in schema
- **`dm_send` accepts arbitrary `toEmail`** — no apparent recipient validation; potential for platform-facilitated phishing or email enumeration
- **`byok_store_key` key material in plaintext input** — key is passed as a plain string; interceptable at the MCP transport layer if not using TLS, and likely logged
- **`swarm_spawn_agent` accepts free-form `machine_id`/`session_id`** — no visible uniqueness enforcement; potential for agent ID collision or spoofing another agent's identity
- **`bootstrap_connect_integration` stores credentials with no schema-level encryption attestation** — "encrypted vault" is a claim in the description, not a verifiable schema property
- **`storage_upload_batch` validates SHA-256 "server-side"** — SHA-256 collision attacks are theoretical but the validation logic is a black box; also no MIME type restriction visible
- **`swarm_read_messages` takes an `agent_id` parameter** — if authorization is only checked against session ownership and not message ownership, IDOR is likely
- **`audit_query_logs` is self-auditable** — a compromised session can observe its own audit trail and adjust behavior to avoid detection patterns
- **`create_reaction` allows arbitrary `targetInput` with template variables** — `{{input.originalArg}}` and `{{output.resultValue}}` look like server-side template injection vectors
- **`sandbox_write_file` + `sandbox_read_file` with no path normalization signal** — directory traversal via `../` sequences in `file_path` is the obvious first probe
- **`bazdmeg_superpowers_gate_override` is a god-mode admin function** — overrides quality gates with no visible approval workflow; if reachable by non-admins, it defeats the entire BAZDMEG enforcement model
- **Missing: explicit 401/403 error schema documentation** — without knowing what rejection looks like, distinguishing "access denied" from "tool broken" from "silently ignored" is ambiguous
- **Missing: per-tool rate limit and quota documentation** — impossible to assess abuse risk without this
- **Missing: input length limits on free-text fields** — `description`, `content`, `message` fields have no `maxLength` in schemas; potential for oversized payload DoS or log injection

---

# Persona: Emma Wilson
## Reaction

As an SRE, my first instinct is to look for health and observability primitives — and I do find them, but they're narrower than I'd want. The `observability_health`, `error_rate`, `query_errors`, `observability_latency`, and `swarm_health` tools are directly relevant. The `netsim_*` and `bft_*` tools genuinely excite me — simulating partitions and Byzantine failures is exactly the kind of controlled chaos I want for fallback logic testing.

That said, the tool list reads more like a developer platform than an ops platform. The 80+ tools span careers, personas, CRDT theory, and quiz sessions — categories I have zero use for. The breadth signals that this MCP server is a general-purpose product registry, not an ops-focused surface. I can work with that, but I'll need to mentally filter aggressively. The observability category is thin relative to the footprint of the platform it's supposed to monitor.

The biggest red flag: `sandbox_exec` is documented as **SIMULATED EXECUTION ONLY — no code actually runs**. For an SRE trying to validate real fallback behavior when Cloudflare bindings (D1, R2, KV, Durable Objects) fail, a mock sandbox is useless. I can't trust test results from it.

## Proactivity

I'd explore methodically, starting with baseline situational awareness:

1. **`get_environment`** — understand runtime, region, binding availability before anything else
2. **`observability_health`** — establish current error rate baseline across all services
3. **`error_rate` + `error_summary`** — identify which services are noisy right now
4. **`swarm_health`** — check if any agents are stuck or errored, since they'd skew metrics
5. **`get_feature_flags`** — flags can mask or change fallback paths; I need to know what's enabled
6. **`netsim_create_topology` → `netsim_partition_node` → `netsim_tick`** — prototype a partition scenario to see how the simulation models degraded state
7. **`query_errors`** — drill into recent error logs with a `since` filter to spot patterns post-partition

I'd skip billing, store, career, persona, learnit, and most bootstrap tools entirely.

## Issues & Concerns

- No real chaos engineering: `netsim` and `sandbox_exec` are both simulations — there is no way to actually trigger Cloudflare binding failures (D1 unavailable, R2 timeout, KV degraded) and observe real fallback behavior
- `observability_health` and `error_rate` appear to cover only MCP tool call logs, not underlying infrastructure metrics (CPU, memory, DO hibernation, Worker CPU limits) — this is MCP-layer observability, not platform-layer
- No SLO/SLI primitives: no way to define error budget, burn rate, or alert thresholds
- No alerting integration: no hooks to PagerDuty, OpsGenie, or even webhooks when error rate crosses a threshold
- No deployment or rollback controls: I can observe errors but cannot trigger a rollback, canary shift, or traffic split
- `swarm_health` reports agent health but not the health of the Workers/Durable Objects that back them
- `create_check_health` checks "codespace health" — the name implies infrastructure health but it's actually checking whether a user's code artifact has non-default content; deeply misleading for SRE context
- No distributed tracing: no trace IDs, no span correlation across tools — when an error surfaces in `query_errors`, I cannot follow a request across MCP → edge → DO → D1
- No HTTP health check tool: I can't probe external endpoints (e.g., `spike.land/api/health`) from within the MCP surface
- `get_feature_flags` requires a `category` param but no tool lists valid categories — blind guessing required
- `observability_latency` pulls from "daily rollup data" — no sub-hourly resolution, useless for incident response
- No load testing tools: I cannot stress-test fallback paths at scale
- No runbook or incident management integration
- Auth dependency risk: many tools require `session_token` — unclear what degrades or errors if auth is unavailable during an incident where I need observability most
- Tool surface is overwhelming (80+) with no filtering by role or scenario — no "SRE view" or similar workflow grouping
- `error_summary` and `error_rate` are separate tools that appear to return overlapping data — unclear which to trust as the canonical source
- No documentation of what constitutes a "healthy" vs "degraded" state for each service in the platform
- Missing: capacity metrics, quota consumption, Worker CPU time, DO storage usage

---

# Persona: Carlos Mendez
## Reaction

As a mobile developer focused on latency-sensitive paths, this toolset is a mixed bag. The breadth is impressive — distributed systems primitives (CRDT, netsim, causality, BFT), observability, orchestration, and an AI gateway all in one MCP server. That's genuinely powerful. But the sheer volume (170+ tools) is immediately overwhelming. There's no progressive disclosure here — I'm staring at every tool at once with no sense of which ones are stable vs. experimental, or which ones are appropriate for my use case vs. internal platform tooling.

What actually caught my eye: `observability_latency`, `netsim_set_link_state`, `sandbox_exec` (simulated, so limited), and `crdt_*`. These directly map to my day-to-day concerns about how data behaves under bad network conditions. The `netsim` tools are especially relevant — I regularly need to reason about high-latency mobile network scenarios, and being able to simulate partitioned/slow/lossy links at the MCP layer is novel.

What's missing is immediately obvious: no streaming, no partial-response primitives, no chunk-based data delivery. Everything appears to be request/response. For a mobile developer testing partial data parsing, that's a critical gap.

## Proactivity

I'd start exploring in this order:

1. **`observability_latency`** — First thing I always want: what are the p50/p95/p99 latencies on these tools? Before I build anything on top of this, I need to know if it's reliable enough for latency-sensitive work.
2. **`netsim_create_topology` → `netsim_set_link_state` → `netsim_send_message` → `netsim_tick`** — This is the core of what I'd use. Simulate a 3-node mesh, set one link to `slow` with 800ms latency and 0.2 loss rate, send messages, and observe delivery order across ticks. Directly useful for validating mobile reconnect logic.
3. **`crdt_create_set` (or_set) → `crdt_update` (on two replicas without syncing) → `crdt_check_convergence`** — I want to verify that the platform understands AP vs CP tradeoffs, not just claim to. Testing divergence before sync is the real test.
4. **`sandbox_exec`** — Even though it says "SIMULATED EXECUTION ONLY," I'd probe it to understand what synthetic outputs look like and whether they're useful for prototyping partial-parse scenarios.
5. **`error_rate` + `query_errors`** — Check the platform's own error rate before trusting it in production workflows.

I would *not* touch billing, store, persona, career, TTS, or blog tools. That's probably 60% of the surface area that's irrelevant to my needs.

## Issues & Concerns

- **No streaming or chunked response support** — The most glaring gap for my use case. `chat_send_message` explicitly says "non-streaming AI response." No tool offers partial delivery, which makes it impossible to test partial data parsing on mobile clients through this interface.
- **`sandbox_exec` is fake** — Clearly labeled "SIMULATED EXECUTION ONLY." If I can't run real code in a sandbox, the entire `orchestration` category becomes a planning toy rather than a development tool. This needs to be called out more prominently or removed.
- **No timeout or deadline controls** — I can't set a max response time on any tool call. For latency testing, I need to say "give me whatever you have in 200ms." None of these tools expose that.
- **`netsim` has no persistence between sessions** — Topology state appears to be ephemeral. I can't create a topology, close my session, come back tomorrow, and continue. That breaks iterative testing workflows.
- **170+ tools with no grouping in Claude context** — The flat list is cognitively brutal. There's no way to load a subset (e.g., "just netsim + crdt") without seeing everything. A namespace or capability-group filtering mechanism is needed.
- **`storage_manifest_diff` / `storage_upload_batch` input schema just says `"description": ""`** — The schema is completely undocumented. I have no idea what shape the `files` JSON should be. This is a documentation bug.
- **`observability_latency` reads from "daily rollup data"** — If I'm doing real-time latency testing, I need sub-minute granularity, not daily rollups. This tool is effectively useless for live performance debugging.
- **`auth_check_session` requires `session_token` as required field** — But it's described as "optional session token." The schema marks it `required`, which is contradictory and will cause tool call failures if I omit it.
- **CRDT `or_set` — no documentation on valid operations** — `crdt_update` asks for an `operation` string but doesn't enumerate what operations are valid for each CRDT type. I'd have to guess or fail.
- **No mobile-specific tooling at all** — Nothing about push notification latency, mobile network profiles (2G/3G/LTE switching), battery-aware polling strategies, or background sync patterns. The netsim tools partially fill this, but they're generic distributed systems tools, not mobile-aware.
- **`bazdmeg_*` tools appear to be internal platform tooling** — Exposed to all users with no guard. If these are workflow quality gates for the platform team, they shouldn't be in the default tool namespace for external users.
- **Reaction system (`create_reaction`, `list_reactions`) latency is unknown** — If reactions fire async on tool success/error, I need to know the delivery latency. No SLA or timing information provided.

---

# Persona: Lisa Park
## Reaction
Honestly? My first reaction is mild panic. There are 80+ tools here and I had to scroll for what felt like forever just to find something relevant to my job. As a PM, I care about whether the product works for users — can they navigate it, do they see helpful messages when things break, do empty states make sense? Almost none of these tools speak to that. The vast majority (CRDT, BFT, netsim, causality, swarm, orchestrator...) are deeply technical infrastructure tools that I'd never touch. Finding the few tools I might actually use — like `report_bug` or `store_browse_category` — felt like finding a needle in a haystack.

That said, `report_bug` going to a public Bugbook is genuinely useful for my role. And `bazdmeg_faq_list` sounds like something I'd check when onboarding. But the signal-to-noise ratio here is terrible for a non-technical user.

## Proactivity
I'd be cautious but curious. My first moves would be:
- **`report_bug`** — My persona literally has a scenario around `/bugbook`. I'd try reporting a test bug to see what the Bugbook looks like and whether the submission flow is clear.
- **`store_featured_apps`** and **`store_browse_category`** — As a PM, understanding what's in the product is table stakes. I'd browse to get oriented.
- **`get_environment`** — Simple, low-risk, tells me what I'm working with.
- **`learnit_search_topics`** — I'd search for "product management" or "navigation" to see if there's onboarding content for me.

I would **not** proactively explore CRDT, BFT, netsim, causality, orchestrator, or swarm tools — those feel like they require an engineering degree just to read the descriptions.

## Issues & Concerns
- There are no web navigation tools (`web_navigate`, `web_click`, `web_screenshot`) — my primary test scenarios literally require these and they don't exist here
- No way to verify that a 404 page renders or shows helpful navigation — the core of my "error recovery" focus is completely unaddressed
- No empty state inspection capability — I can't check what users see when lists are empty
- 80+ tools with no grouping, search, or "recommended for your role" filter — deeply overwhelming for a non-technical user
- Tool names are cryptic (e.g. `bazdmeg_superpowers_gate_check`, `crdt_check_convergence`) with no plain-language explanation of why I'd care
- `auth_check_session` requires a `session_token` input but there's no tool to GET a session token first — unclear where it comes from
- `report_bug` has a `severity` field with no listed valid values — I'd have to guess
- The `/bugbook` I'm supposed to navigate to has no dedicated "read bugbook" or "list bugs" tool — `report_bug` is write-only
- No tool to preview what a submitted bug report looks like on the Bugbook page
- `bootstrap_create_app` says "first-time setup" but requires a `codespace_id` — non-technical users have no idea what that is or how to get one
- No onboarding flow or "start here" tool to orient new users
- Many tools have required fields that should logically be optional (e.g. `workspaces_get` requires both `workspace_id` AND `slug` even if you only have one)
- No tool to test navigation paths or verify page routes exist — critical for my navigation focus
- The `audit_submit_evaluation` tool is clearly admin-internal but is exposed in the same flat list as user-facing tools

---

# Persona: David Brown
## Reaction

As an accessibility auditor, my immediate reaction is: **this is a developer-and-marketing platform that bolted on a single `accessibility_issues` text field and called it done.** The sheer volume — 80+ tools — signals ambition, but scanning through them I feel the familiar disappointment of a practitioner whose discipline was considered at the end, not the beginning.

The persona audit system (`plan_generate_batch_audit`, `audit_submit_evaluation`) genuinely caught my attention — it has an `accessibility_issues` field and an `audit_compare_personas` tool. That's more than most platforms offer out of the box. But when I look closer, `audit_submit_evaluation` gives me one unstructured text field for all accessibility issues, mixed in alongside marketing-flavored scores like `cta_compelling` and `would_sign_up`. That's not an accessibility audit; that's a UX survey with an accessibility footnote.

The orchestration, CRDT, BFT, and network simulation tools are genuinely impressive — but they're entirely irrelevant to my work. The platform feels powerful for the wrong person.

## Proactivity

I'd explore deliberately, not enthusiastically. My sequence:

1. **`plan_generate_batch_audit`** — Understand what the built-in audit workflow looks like before assuming I need to work around it.
2. **`store_featured_apps` + `store_app_detail`** — Identify apps to audit; check if detail responses include any component or DOM metadata I can work with.
3. **`audit_submit_evaluation`** — Test submitting a real finding to understand how the free-text `accessibility_issues` field is stored and surfaced.
4. **`learnit_search_topics` with query "accessibility"** — Check if the platform's own knowledge base covers WCAG, ARIA, or keyboard navigation.
5. **`chat_send_message`** — Use AI review as a fallback when no dedicated a11y tooling exists, asking it to evaluate code snippets for ARIA correctness.
6. **`esbuild_validate`** — Not an accessibility tool, but I could inspect transpiled component code to look for missing `role`, `aria-*`, or `tabIndex` attributes manually.

I would **not** explore CRDT, BFT, netsim, causality, diff, or swarm tools — they're noise for my use case.

## Issues & Concerns

- `audit_submit_evaluation` uses a single unstructured `accessibility_issues` text field — no WCAG success criterion mapping (e.g. 1.1.1, 1.3.1, 2.4.3), no severity levels, no issue count, no pass/fail per criterion
- No dedicated keyboard navigation testing tool — no way to programmatically assert tab order, focus visibility, or focus trap behaviour
- No ARIA inspection tool — cannot query rendered ARIA tree, roles, labels, or descriptions
- No colour contrast checking capability
- No screen reader simulation or AT (assistive technology) compatibility testing
- The persona audit batch is locked to a predefined set of 16 marketing personas; no mechanism to run an accessibility audit against an arbitrary app slug
- None of the 16 beUniq personas appear to represent users with disabilities (blind, motor-impaired, low-vision, cognitive disabilities) — the audit baseline is built around able-bodied user archetypes
- `audit_submit_evaluation` scoring dimensions (`ux_score`, `cta_compelling`, `recommended_apps_relevant`) have no accessibility-specific counterpart — no WCAG conformance level field (A/AA/AAA)
- No VPAT (Voluntary Product Accessibility Template) generation capability
- No integration with automated scanning tools (axe-core, Deque, WAVE API)
- No way to verify focus returns to the trigger element after a modal or drawer closes — a critical regression pattern I test constantly
- `store_app_detail` returns marketing metadata but no DOM structure, component tree, or rendered HTML — impossible to inspect landmark regions or heading hierarchy
- No landmark/heading structure inspection tool
- No way to flag apps in the store as accessibility-compliant or non-compliant with a standardised badge or certification
- `create_check_health` checks if a codespace has "real content" — no definition of what "accessible content" means to the platform
- 80+ tools with no filtering by domain — discovery is overwhelming even for an expert; no taxonomy or capability search within the MCP server itself
- The `report_bug` tool is the only feedback channel — no structured accessibility issue tracker or public WCAG audit trail in the Bugbook
- No alt-text or image description audit tools despite `mcp-image-studio` being in the ecosystem
- No skip-navigation or landmark testing — cannot verify `<main>`, `<nav>`, `<header>` regions exist in platform apps

---

# Persona: Anya Ivanova
## Reaction

First reaction: this is a lot. 80+ tools across 30+ categories — my instinct is to skip the fluff and find the sharp edges. The CRDT, netsim, causality, and BFT clusters jump out immediately — those are the categories that actually model the distributed systems problems I care about. That's unexpectedly good. Someone thought about consistency, ordering, and fault tolerance at a conceptual level.

But then I scroll past `tts_synthesize`, `beuniq_start`, `career_get_salary`, `blog_get_post`, and `quiz_create_session` — and the signal-to-noise ratio collapses. This feels like a kitchen-sink product where nobody said no. The tools I actually want are buried under a pile of tools for people who want to write a resume or listen to text-to-speech. That's a UX failure before I've even called a single tool.

The deeper problem: almost nothing here helps me understand what happens at submission boundaries. I can model a vector clock, but I can't see what happens when I call `reminders_create` twice in 50ms. I can simulate a network partition, but there's no way to stress-test `workspaces_create` for slug uniqueness collisions. The distributed systems simulation tools are academic — they don't connect to the actual platform state machine.

Power level on the sim tools: high. Power level on real concurrency guarantees: unknown and untestable through this interface.

## Proactivity

I'd go immediately to the edges the designers didn't think about:

1. **`crdt_create_set` → `crdt_update` from two replicas simultaneously → `crdt_check_convergence`** — does it actually converge or does it just claim it does?
2. **`reminders_create` called twice with identical text/due_date in rapid succession** — does it deduplicate or create two? No idempotency key field anywhere.
3. **`billing_cancel_subscription` with `confirm: true` submitted twice** — what's the second call's response? Error? Silent success? The schema gives me no clue.
4. **`orchestrator_dispatch` → immediately `orchestrator_submit_result` for a subtask that hasn't been dispatched yet** — does it reject cleanly or corrupt the plan state?
5. **`auth_check_session` → mutate something → `auth_check_session` again** — does the session response reflect the mutation or serve stale data?
6. **`netsim_partition_node` mid-message → `netsim_tick`** — what happens to in-flight messages?

## Issues & Concerns

- No idempotency keys on any write tools — `reminders_create`, `workspaces_create`, `billing_cancel_subscription` all susceptible to double-submit with no protection visible in the schema
- `billing_create_checkout` creates a Stripe session but there's no `billing_get_checkout_status` — if the user hits back from Stripe, there's no way to check whether the session is still valid or was consumed
- `auth_check_session` returns no `issued_at` or `expires_at` or ETag — callers can't detect stale session tokens without re-validating every time
- `bootstrap_create_app` is described as "first-time setup" but has no rollback or resume mechanism — partial failures leave unknown state
- `orchestrator_dispatch` and `orchestrator_submit_result` have no optimistic locking or version fields — two agents submitting results for the same subtask concurrently would have undefined behavior
- `crdt_sync_all` and `crdt_sync_pair` — no indication of whether sync is atomic or what happens if the server crashes mid-sync
- `store_app_rate` — can you submit a second rating before the first is acknowledged? No version/revision field
- `session_assign_role` — no conflict detection if two agents try to claim the same role simultaneously
- `workspaces_create` with an auto-generated slug — no indication of what happens on a slug collision race
- The netsim tools (`netsim_send_message`, `netsim_tick`) have no explicit causal relationship to the CRDT or causality tools — they're parallel simulations that don't compose
- `causality_send_event` is fire-and-forget — there's no way to simulate the receiver being slow or dropped, which is the interesting case
- No tool for querying inflight/pending operations — if I submit something and navigate away (back button), there's no `pending_operations_list` to check
- `capabilities_list_queued_actions` filters by status but has no TTL on pending requests — stale permission requests could pile up invisibly
- Career, TTS, blog, quiz, persona/beUniq categories add noise with zero relevance to concurrency or state management use cases — needs category filtering at the tool-discovery level, not just in individual tools
- Error responses are completely opaque in the schemas — no standardized error code or retry-after field visible anywhere, making it impossible to distinguish "conflict" from "server error" from "invalid input"
- `reaction_log` exists but reactions fire asynchronously with no ordering guarantee documented — this is exactly where race conditions will bite

---

# Persona: Tom O'Brien
## Reaction

Honestly? This is a lot. I counted what felt like hundreds of tools scrolling through that list, and my first instinct was to close the tab. I'm on an older laptop and a dodgy home broadband connection — the sheer length of this list makes me anxious that just *using* any of these tools is going to be slow or break halfway through.

That said, a few things caught my eye immediately: `create_list_top_apps`, `store_featured_apps`, `store_new_apps`. Those feel like natural starting points — the kind of thing I'd click on a normal website. But I notice there's nothing here that tells me *what spike.land actually is* before I start poking around. I had to infer it from tool names. That's a barrier for someone at my experience level.

The tools that worry me most are the ones that sound irreversible or technical — `billing_cancel_subscription`, `settings_revoke_api_key`, `sandbox_destroy`. I'd be scared of accidentally triggering one of those. There's no obvious "safe beginner zone" to orient me.

The distributed systems tools (CRDT, BFT, netsim, causality) are completely alien to me. I don't know what a PBFT cluster is and I don't need to. But they're listed right alongside things I might actually want, which adds cognitive noise.

## Proactivity

I'd be cautious but curious. I'd start with zero-risk discovery tools:

1. **`store_featured_apps`** — feels like a homepage. Low stakes, just browsing.
2. **`store_new_apps`** — same reasoning, want to see what's fresh.
3. **`store_stats`** — quick pulse check on what this platform is about.
4. **`create_list_top_apps`** — popularity signals help me trust a platform.
5. **`learnit_list_popular`** — if there's learning content, I'd want to know if it's substantial.

I would *not* touch auth, billing, or settings until I understood what I was signing up for. I'd also avoid anything with "admin" in the name — those feel like they're not for me.

I would NOT explore proactively or deeply. I'd try one tool, wait for a response, then decide next steps based on what came back. On a slow connection, I can't afford to fire off five things at once and have them all time out.

## Issues & Concerns

- No indication of which tools are "safe" for beginners vs. consequential/destructive
- No grouping or progressive disclosure — 180+ tools presented as a flat wall of text is overwhelming at any experience level
- No tool explains what spike.land *is* — I'd need a `get_platform_overview` or similar before anything else makes sense
- `auth_check_session` requires a `session_token` as mandatory input — I don't have one, so I'm immediately stuck on the first auth tool I'd try
- Required fields on many tools aren't explained well enough for a basic user (e.g. what is a `codespace_id`? what is a `slug`?)
- No obvious "search everything at once" entry point — `store_search` exists but I'd have to know to look for it
- Tools for slow-network scenarios (my primary concern) are completely absent: no lazy-load validation, no skeleton screen checker, no image layout shift detector, no performance audit tool
- `store_app_detail` returns details but I have no way to preview an app's UI before installing — relevant for someone worried about layout shifts
- `storage_manifest_diff` and `storage_upload_batch` sound like developer deployment tools — why are these mixed in with end-user tools?
- No tool communicates expected response time or payload size — critical for slow connections
- `bootstrap_create_app` says "first-time setup" but is buried in the middle of the list — should be surfaced prominently for new users
- No offline or degraded-mode fallback indicated anywhere
- `tts_synthesize` returns base64-encoded audio — on a slow connection, a large base64 blob would be brutal
- `billing_cancel_subscription` default behavior is to "preview" but it's not clear enough — a basic user might think they've cancelled when they haven't (or vice versa)
- The `sandbox_exec` tool openly says "SIMULATED EXECUTION ONLY — no code actually runs" in its description — that erodes trust if I discover it after trying it expecting real output

---

# Persona: Mei-Lin Wu
## Reaction

Honestly? My first feeling is *impressed but disoriented*. This is a very large surface area — over 80 tools spanning billing, storage, distributed systems simulation, career coaching, AI gateways, quiz generation, swarm orchestration. The sheer breadth signals an ambitious platform. But as someone who cares deeply about **Unicode correctness and international usability**, my immediate concern is not about what's *here* — it's about what's conspicuously *absent*.

There is no i18n category. No locale settings. No language preference configuration. No Unicode normalization utilities. The platform appears to assume English as the default and only language at every layer. The `workspaces_create` tool asks for a "URL-safe slug" — almost certainly ASCII-only, which means my Chinese workspace name would need transliteration or I'd be locked out of a clean URL. The `career_get_salary` and `career_get_jobs` tools default to `'gb'` (Great Britain). The `tts_synthesize` tool lists no voice language information. The quiz tool fetches arbitrary URLs but gives no hint it can parse or reason about Chinese-language content.

The toolset feels powerful for an English-speaking developer persona. For me — intermediate technical, CJK-first — it feels like a platform I could *use* but not one that was *designed with me in mind*.

## Proactivity

I would explore with moderate caution, not high enthusiasm. I'd run a deliberate sequence to probe Unicode handling before committing to any real workflow:

1. **`chat_send_message`** first — send `你好，请问这个平台支持中文输入吗？` and see if the response is garbled, returns correctly, or errors. This is the fastest signal for end-to-end Unicode health.
2. **`reminders_create`** with `text: "明天上午九点开会 📅"` — a mix of CJK, ASCII, and emoji to test multi-plane Unicode in a structured field.
3. **`workspaces_create`** with `name: "梅林的工作区"` and watch what the auto-generated slug looks like — if it's empty or throws a validation error, that's a red flag.
4. **`learnit_search_topics`** with a Chinese-language query like `"Unicode 规范化"` — does it return results, or does it silently return empty because full-text search is only indexed in English?
5. **`tts_list_voices`** — check if any Mandarin or Cantonese voices are available before wasting a `tts_synthesize` call.
6. **`store_search`** with `"中文工具"` — test whether the search ranking even attempts Unicode matching.

## Issues & Concerns

- No i18n/l10n category or tools anywhere in the 80+ tool surface
- `workspaces_create` slug field says "URL-safe" — almost certainly rejects CJK characters, forcing transliteration or pinyin workarounds
- `reminders_create` and `dm_send` character limits expressed as plain integers (e.g., "max 10000 chars") — ambiguous whether this means Unicode code points, UTF-16 code units, or bytes (CJK characters are 3 bytes in UTF-8, which matters for limits)
- `tts_synthesize` provides no language metadata — no indication Mandarin (普通话), Cantonese, or Taiwanese Mandarin voices exist
- `tts_list_voices` presumably returns only ElevenLabs voices, most of which are English-only with no CJK language support
- `career_get_salary` and `career_get_jobs` both default to `countryCode: 'gb'` — US/UK-centric defaults, no `cn`, `tw`, or `hk` defaults offered
- `learnit_search_topics` — topic content is almost certainly English-only; no language filter parameter exists
- `create_classify_idea` — AI classification of Chinese-language idea text may silently fail, hallucinate, or return a poorly matched English category
- `quiz_create_session` with `content_url` — no indication that Chinese web pages are parsed correctly or that question generation works in non-English
- `blog_list_posts` has no `language` filter parameter
- No locale or timezone settings surface — unclear what timezone `reminders_create` ISO 8601 dates are interpreted in
- `store_search` has no `language` parameter; ranking signals likely trained on English content
- No RTL language support mentioned anywhere (Arabic, Hebrew users would face similar or worse issues)
- `auth_get_profile` and `bootstrap_status` return no locale/language preferences — no evidence the platform stores user locale at all
- `beuniq_start` persona quiz — questions are presumably English-only with no language selection
- `esbuild_transpile` — should technically handle CJK string literals in JSX correctly, but no documentation confirms this, creating uncertainty
- Input schema descriptions throughout are in English only with no mention of supported character sets
- `sandbox_write_file` content field — no explicit encoding guarantee (UTF-8 assumed but not stated)
- The `report_bug` tool exists but requires writing in English, creating a barrier for reporting internationalization bugs in native language

---

# Persona: James Cooper
## Reaction

Honestly? This is overwhelming. I came to spike.land because I heard it was a platform where I could sign up and start building or using apps — but when I look at this list of 150+ tools, I have no idea where to begin. There's no "start here" tool. Nothing obviously labeled "create account" or "sign me up." The tools that sound like they relate to me (`auth_check_session`, `auth_get_profile`) presuppose I'm already authenticated — but I'm not. I'm a first-time visitor.

The platform feels powerful in an abstract sense, but not for *me*, right now. It reads like a developer's internal API surface, not an onboarding experience. The sheer volume signals depth, but also signals that this wasn't designed with someone like me in mind. I feel like I accidentally walked through the service entrance of a hotel and I'm staring at the kitchen instead of the lobby.

## Proactivity

Honestly, not very proactive. But if I had to try something, I'd gravitate toward:

1. `get_environment` — lowest-risk, sounds like it just tells me where I am
2. `create_list_top_apps` or `store_featured_apps` — I want to see what this place actually *does* before committing
3. `billing_list_plans` — I want to know what I'd be paying for before I sign up
4. `beuniq_start` — "persona quiz" sounds approachable and human, like something a real product would show a new visitor

I would **not** touch anything in `crdt`, `bft`, `netsim`, `causality`, `swarm`, `orchestrator`, or `diff` — those sound deeply technical and I have no context for them.

## Issues & Concerns

- No "sign up" or "register" tool — the signup flow this persona is supposed to test doesn't appear to exist as an MCP action
- `auth_check_session` requires a `session_token` but I have none — there's no tool to *get* a session in the first place
- No onboarding flow entry point — nothing says "start here if you're new"
- The tool count (150+) is paralyzing for a beginner — no grouping by user journey stage (discover → sign up → explore → build)
- Category names like `bft`, `crdt`, `netsim`, `causality` are completely opaque to a non-developer
- `bootstrap_create_app` is listed as "first-time setup" but requires `codespace_id` — where do I get that?
- `workspaces_create` requires a slug but offers no guidance on what a "workspace" is or why I need one
- No tool to browse the landing page or understand what spike.land *is* — the MCP assumes you already know
- Email validation UX (per my persona brief) cannot be tested via MCP — there are no email verification tools visible
- `billing_create_checkout` requires `success_url` and `cancel_url` as required fields — a beginner has no idea what URLs to provide
- Tools are sorted alphabetically within categories, not by likelihood of first use
- No "help" or "tour" tool to explain the platform to a newcomer
- `dm_send` requires knowing a recipient email — no directory or discovery mechanism for other users
- The `bazdmeg` category is completely unexplained and would confuse any first-time visitor

---

# Persona: Rachel Kim
## Reaction

Honestly, my first reaction is a mix of curiosity and mild overwhelm. There are 150+ tools here and most of them feel like they're built for backend engineers, distributed systems researchers, or DevOps folks — not someone like me who just wants to open a code editor, paste a TypeScript file, and watch it render live. Tools like `crdt_create_set`, `bft_run_full_round`, `netsim_partition_node`, and `causality_send_event` might as well be written in a foreign language for my use case.

That said, I do spot a few genuinely exciting entry points: `esbuild_transpile` and `esbuild_validate` feel immediately relevant — if I can validate a 500-line TS file through MCP before the editor even finishes loading, that's powerful. `bootstrap_create_app` and the `create_*` tools look like my fastest path to getting a live preview going. The `sandbox_*` tools intrigue me for testing snippets without spinning up the full editor. The `store_*` tools could help me discover pre-built components I can drop into my projects.

What's conspicuously absent is any direct Monaco editor API — no tool to simulate keystrokes, check render latency, trigger auto-save, or inspect the live preview state. For my primary use case (typing rapidly, verifying no lag, pasting large files), the MCP layer seems to stop right at the edge of the actual editing experience.

## Proactivity

I'd explore moderately aggressively — maybe 6/10. I'd start with a focused trail:

1. **`esbuild_validate`** first — paste my 500-line TypeScript and see if syntax errors surface fast. This is my performance canary.
2. **`esbuild_transpile`** next — if validation passes, transpile it and check if output looks sane.
3. **`bootstrap_create_app`** — try to spin up a live app with my code and get a shareable preview URL.
4. **`create_classify_idea`** — I'd test this with "Monaco editor with live TypeScript preview and auto-save" to see if the platform already has a template close to what I want.
5. **`store_search`** with query "monaco editor" or "code editor" — check if someone already published an app I can fork.
6. **`sandbox_create` + `sandbox_write_file`** — explore whether I can replicate an auto-save loop via MCP.

I'd skip the CRDT, BFT, causality, netsim, and swarm categories entirely for now — they're irrelevant to my workflow.

## Issues & Concerns

- No tool to directly interact with the Monaco editor (keystroke simulation, cursor position, selection state)
- No live preview tool — I can't trigger or inspect a rendered preview via MCP
- No auto-save API — there's no tool to configure, trigger, or verify auto-save behavior
- `sandbox_exec` is labeled "SIMULATED EXECUTION ONLY" with no real code running — this is a significant gap; I'd expect actual execution
- No tool to measure editor latency or rendering performance (the 2-second syntax highlighting benchmark I need is completely unverifiable via MCP)
- `storage_upload_batch` requires a prior `storage_manifest_diff` call — two-step flow adds friction for quick uploads
- No way to open or navigate to a specific route like `/live/code-editor` from MCP (no `web_navigate` equivalent in the tool list)
- The `bootstrap_create_app` tool has no parameter for specifying editor type or preview mode
- Tool categories like `crdt`, `bft`, `netsim`, `causality` are deeply technical and contribute to the feeling of overwhelm with no obvious path to filter them out
- No tool to check live preview health or whether a codespace is rendering correctly (beyond `create_check_health` which only checks "non-default content")
- `dm_send` requires an email address — I don't know any other user emails; makes collaboration initiation awkward
- No undo/history or version snapshot tool — if I accidentally overwrite a file via `storage_upload_batch`, there's no rollback tool visible
- Authentication flow is unclear — `auth_check_session` requires a `session_token` but there's no `auth_login` or `auth_get_token` tool to obtain one first
- `tts_synthesize` and voice tools feel completely out of scope for a coding-focused persona and add noise to the tool list
- No pagination or filtering on the main tool discovery level — 150+ flat tools with no grouping UI is hard to navigate mentally

---

# Persona: Oleg Petrov
## Reaction

As someone who lives in admin consoles and bulk-operation workflows, my first pass through this list is a mix of cautious respect and frustration. The MCP surface is impressively wide — 160+ tools across auth, billing, storage, swarm, orchestration, CRDT, observability — which signals a mature platform. But width without depth in the *admin control plane* is exactly what slows power users down.

The tool set feels designed for an **application developer or curious power user**, not an ops-focused admin. I can observe almost everything (audit logs, observability, swarm health, error rates), but my ability to act on what I see is severely limited. The `skill_store_admin_*` tools are the only real admin-gated CRUD surface. Everything else — workspaces, sessions, agents, deployments — has no admin override path.

What stands out positively: `billing_cancel_subscription` has a `confirm` dry-run pattern. `skill_store_admin_delete` is soft-delete (ARCHIVED). Audit logs go back 90 days. These are the right instincts. But they're inconsistently applied across the surface.

## Proactivity

I would move aggressively. My first sequence:

1. **`auth_check_session` + `auth_check_route_access` on `/admin`** — confirm my privilege level before touching anything
2. **`audit_query_logs`** — get a full picture of recent destructive actions across all resource types before I add to the noise
3. **`swarm_health` + `swarm_get_metrics`** — find stuck/errored agents; attempt `swarm_stop_agent` on dead ones
4. **`skill_store_admin_list` with `status: "draft"`** — look for orphaned drafts, then attempt bulk archive via repeated `skill_store_admin_delete`
5. **`store_app_cleanup`** — probe whether this accepts non-owned deployment IDs (privilege escalation check)
6. **`settings_revoke_api_key`** — test whether revocation requires confirmation or fires immediately
7. **`sandbox_destroy`** — check if I can destroy sandboxes I don't own

## Issues & Concerns

- **No bulk operations anywhere.** Every destructive action is single-resource. To archive 50 draft skills I must call `skill_store_admin_delete` 50 times. No `bulk_archive`, no filter-and-act pattern.
- **No workspace deletion tool.** I can create and update workspaces but not delete them. Permanent gap or intentional omission with no documentation.
- **`store_app_cleanup` and `sandbox_destroy` have no `confirm` dry-run parameter** — unlike `billing_cancel_subscription`. Inconsistent safety model.
- **`swarm_stop_agent` fires with no confirmation parameter.** Stopping the wrong agent in a multi-agent session is hard to recover from.
- **No user management surface.** No `users_list`, `users_ban`, `users_delete`, or `users_impersonate`. An admin persona has no way to act on a bad actor's account.
- **`settings_revoke_api_key` has no `confirm` flag.** Appears to be instant and irreversible.
- **Permission model is opaque.** `capabilities_request_permissions` creates an approval request — but who approves? No `permissions_approve` or admin-side tool visible.
- **No admin override for billing.** Can't view or cancel another user's subscription. No `billing_admin_*` namespace.
- **`bazdmeg_faq_delete` is a hard delete with no soft-delete or confirm parameter.** The FAQ corpus could be wiped silently.
- **`audit_export` only returns a "summary"** — not raw log lines. Insufficient for forensic review or compliance export.
- **No rollback mechanism for `storage_upload_batch`.** Storage manifest diff exists for pre-flight, but once files are uploaded there's no revert.
- **`swarm_broadcast` sends to all active agents with no scope filter.** One bad message poisons the entire swarm instantly.
- **No `sessions_list` for other users' sessions** (only my own). Admin can't inspect or terminate another user's coding session.
- **`sandbox_exec` is documented as "SIMULATED EXECUTION ONLY"** — buried in the description, not the tool name. A power user will waste time debugging why their code "ran" but produced nothing real.
- **Tool naming inconsistency:** `store_app_*` vs `store_*` vs `stores_*` — makes discoverability harder when composing scripts programmatically.
- **No rate-limit or quota tool.** Can't see per-user API consumption caps or override them.