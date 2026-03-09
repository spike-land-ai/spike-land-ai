# Open Issues Handoff


## Issue 2: Tailwind dev setup removes unrelated styles

The cleanup logic in [src/frontend/monaco-editor/core-logic/lib/tw-dev-setup.ts](/Users/z/Developer/spike-land-ai/src/frontend/monaco-editor/core-logic/lib/tw-dev-setup.ts) currently removes every `head > style` element before loading the worker. That is broader than the Tailwind problem it is trying to solve. Any inline style block inserted by application code, preview scaffolding, Emotion, or future runtime utilities can be deleted as collateral damage.

This is an architectural issue because the setup layer has no ownership boundary over the styles it removes. It assumes all head-level style tags are disposable Tailwind output, which is not true in a preview environment that also injects theme tokens, error styling, or component-library styles. Until cleanup is narrowed to Tailwind-owned nodes or a marked output channel, the preview remains vulnerable to non-deterministic style loss.





## Issue 10: Store A/B deployment tooling is still a remote control surface

The experiment and rollout tools in [src/edge-api/spike-land/core-logic/tools/store/ab.ts](/Users/z/Developer/spike-land-ai/src/edge-api/spike-land/core-logic/tools/store/ab.ts) are also still proxy-backed. Deployment creation, variant creation, visitor assignment, impression tracking, error tracking, results retrieval, winner declaration, and cleanup all call the remote spike.land API.

These tools are stateful and metrics-heavy, which makes the gap larger than a simple read-only proxy. A/B testing requires durable deployment records, variant membership, deterministic visitor assignment, and metrics integrity. None of that state is local yet, so the worker is acting as a thin remote-control wrapper over an experiment system it does not own.

## Issue 11: Skill store is duplicated and still mostly remote

The skill-store surface is split across [src/edge-api/spike-land/core-logic/tools/skill-store.ts](/Users/z/Developer/spike-land-ai/src/edge-api/spike-land/core-logic/tools/skill-store.ts) and [src/edge-api/spike-land/core-logic/tools/store/skills.ts](/Users/z/Developer/spike-land-ai/src/edge-api/spike-land/core-logic/tools/store/skills.ts). The first file uses `registeredTools` as a stand-in for part of the model, but it still proxies most listing, detail, install, and admin operations to the spike.land API. The second file exposes overlapping store-facing skill operations and is also fully proxy-backed.

This leaves the system with both duplication and incomplete ownership. The worker has no single canonical skill-store model covering categories, versions, featured flags, install counts, installation records, and admin mutations. The interface is fragmented across two entry points while the actual product state remains external.

## Issue 12: Blog tooling is read-only and still tied to remote filesystem access

The blog surface in [src/edge-api/spike-land/core-logic/tools/blog.ts](/Users/z/Developer/spike-land-ai/src/edge-api/spike-land/core-logic/tools/blog.ts) remains a proxy because blog content is treated as living on the spike.land filesystem. The worker does not own the content index, frontmatter metadata, reading-time calculation, or post body retrieval; it simply forwards to `/api/blog/posts`.

This is still an open issue because it preserves a cross-system dependency for a core content surface even though the monorepo already contains first-party content under `content/blog`. The tool layer and the repository content are not aligned under one authority model. Until they are, the worker cannot serve as the direct source for blog discovery and retrieval.

## Issue 13: Career tooling still depends on spike.land as an integration broker

The career feature set in [src/edge-api/spike-land/core-logic/tools/career/career-index.ts](/Users/z/Developer/spike-land-ai/src/edge-api/spike-land/core-logic/tools/career/career-index.ts) remains fully proxy-backed. Skills assessment, occupation search, occupation detail, skill comparison, salary lookup, and job search all go through the remote spike.land API, which in turn brokers ESCO and Adzuna integrations.

This means the worker does not directly own the integration contracts, caching policy, normalization layer, or failure handling for those upstream providers. The product surface is local, but the dependency boundary is still centralized elsewhere. If the goal is to remove remaining proxy paths to older APIs, career is still squarely in the unresolved set.

## Issue 14: BAZDMEG FAQ has no local table yet

The FAQ tool module in [src/edge-api/spike-land/core-logic/tools/bazdmeg/faq.ts](/Users/z/Developer/spike-land-ai/src/edge-api/spike-land/core-logic/tools/bazdmeg/faq.ts) explicitly states that `bazdmegFaqEntry` does not exist in the D1 schema. Listing, create, update, and delete operations all proxy to the remote API until that table exists locally.

This is a straightforward but still open data-model gap. The worker exposes CRUD semantics, but it has no local table for questions, answers, categories, publication status, helpful counts, or ordering. As long as the table is missing, the FAQ product surface is not actually migrated.

## Issue 15: BAZDMEG gates have no local workflow-state model

The gate-checking surface in [src/edge-api/spike-land/core-logic/tools/bazdmeg/gates.ts](/Users/z/Developer/spike-land-ai/src/edge-api/spike-land/core-logic/tools/bazdmeg/gates.ts) explicitly notes that `superpowersSession`, `workflowTransition`, and `gateCheckResult` are not present in the D1 schema. Both the gate check and the override path proxy to the remote API.

This is a larger issue than a missing table or two because the gate system depends on session history, workflow progression, evaluation outputs, and override records. Without that local state model, the worker cannot independently enforce or audit the BAZDMEG quality-gate flow. It can only forward requests to the old implementation.

## Issue 16: BAZDMEG memory has no local persistence layer

The memory tools in [src/edge-api/spike-land/core-logic/tools/bazdmeg/memory.ts](/Users/z/Developer/spike-land-ai/src/edge-api/spike-land/core-logic/tools/bazdmeg/memory.ts) still proxy because `bazdmegMemory` is not in the D1 schema. Search and recent-listing are available as MCP commands, but the worker has no local store for insight text, tags, source prompts, confidence scores, or timestamps.

This keeps BAZDMEG knowledge retrieval outside the worker even though it is exposed as a first-class MCP category. The interface exists, the memory store does not.

## Issue 17: Repo and deployment topology are still only partially simplified

The source-of-truth split has improved, but the repo is still not operationally simple. `src/` is the canonical source tree, while `packages/` still contains deploy shims that remain necessary for some Wrangler deployment paths. Database migrations are still mirrored across source and package-level directories. The Tailwind worker discrepancy shows that built artifacts can drift from source. Preview responsibility is also split across `spike-app`, `code`, and `js.spike.land`, which makes runtime ownership harder to reason about.

This is the remaining architectural debt behind the code-level migrations. Even after individual proxy-backed tools are removed, the platform still has multiple places where deployment configuration, built assets, and runtime responsibility can diverge. That complexity is not fully resolved yet.
