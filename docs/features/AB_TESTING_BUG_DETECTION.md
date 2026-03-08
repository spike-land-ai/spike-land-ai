# A/B Testing And Bug Detection

## Summary

spike.land uses experimentation as a reliability system, not only as a growth
tool. The platform can ship multiple variants of an app or experience, assign
visitors consistently, measure impressions and outcomes, and promote winners
only after deterministic guardrails are met.

The AI part of the loop is variant creation, failure diagnosis, and next-step
proposal. The shipping decision stays statistical and auditable.

---

## Two Related Systems

### 1. Store App Variant Tooling

The store-specific tool family supports:

- deployment creation
- variant creation
- visitor assignment
- impression recording
- error recording
- result retrieval
- winner declaration

Representative tools:

- `store_app_deploy`
- `store_app_add_variant`
- `store_app_assign_visitor`
- `store_app_record_impression`
- `store_app_record_error`
- `store_app_get_results`
- `store_app_declare_winner`

This is the app-store-facing workflow.

### 2. Generic Experiments Engine

The general engine in `src/edge-api/main/api/routes/experiments.ts` handles:

- hash-based assignment
- event batching
- metric materialization
- Bayesian evaluation
- anomaly monitoring

This is the platform-level measurement and decision system.

---

## Assignment Model

Visitor assignment is deterministic.

- the engine hashes `clientId + experimentId`
- variant weights define bucket ranges
- the same visitor keeps landing on the same variant

This avoids the noise you get when a visitor flips between variants across page
loads or sessions.

---

## What Gets Measured

The generic experiments engine records event streams and materialized metrics.

Important event types include:

- `widget_impression`
- `donate_click`
- `fistbump_click`
- `checkout_started`
- `thankyou_viewed`

For store-app reliability, the important signals are simpler:

- impressions
- engagements
- errors

That is enough to detect a bad variant quickly, especially when one version is
throwing more runtime errors than another.

---

## Statistical Decision Rules

The current code-backed graduation rules are strict:

- minimum runtime: 48 hours
- minimum sample size: 500 impressions per variant
- evaluation method: Beta-Binomial Monte Carlo
- number of draws: 10,000
- confidence threshold: winner probability above 95%
- improvement threshold: at least 10% lift over control unless control itself
  is the winner

In code terms:

- posterior uses `Beta(1 + successes, 1 + failures)`
- the best variant is the one that wins most Monte Carlo draws
- only then can the experiment auto-graduate

This keeps “AI-powered testing” from becoming a hand-wavy claim. The decision
path is measurable.

---

## Bayesian, Not Gut-Driven

spike.land uses Bayesian evaluation because it answers the real question:

`what is the probability that this variant is actually better?`

That is more useful than treating experiments like one-shot dashboard theater.

The engine returns:

- per-variant win probabilities
- best variant
- control rate
- winner rate
- percent improvement
- graduation decision

That is enough to automate promotion when the evidence is strong and hold back
when it is not.

---

## Anomaly Monitoring

The platform also monitors experiments for operational failure, not just
performance uplift.

Current anomaly logic checks for active variants with zero impressions during a
time window. That catches cases where a rollout silently stops receiving
traffic, which is often a deployment or routing problem rather than a product
problem.

For app-store variants, the equivalent reliability questions are:

- Is the variant being served?
- Is it producing impressions?
- Is it throwing more errors than the control?

That is the bug-detection side of the system.

---

## Where AI Actually Helps

The statistical engine is deterministic by design. AI fits around it:

- generating alternative layouts or interaction variants
- proposing safer fallback implementations
- clustering error patterns into bug themes
- explaining why a losing variant likely failed
- suggesting the next variant worth testing

In other words:

- AI creates and interprets
- the experiment engine measures and decides

That division is important for trust.

---

## Practical Workflow

1. Deploy a base app variant.
2. Add one or more alternatives.
3. Assign visitors consistently.
4. Record impressions and runtime errors.
5. Review statistical results.
6. Promote the winner or keep collecting data.
7. Feed findings back into the next iteration.

This is how spike.land turns A/B testing into an automated quality loop instead
of a marketing-only feature.

---

## Why This Matters For The Store

An open app store has a quality problem by default. More submissions mean more
ways to ship broken behavior.

The experimentation layer reduces that risk by making reliability measurable at
the same level as growth:

- better variants get promoted
- unstable variants are visible
- anomalies can be monitored continuously
- iteration becomes a product capability

That is the real meaning of AI-powered A/B bug detection on spike.land.
