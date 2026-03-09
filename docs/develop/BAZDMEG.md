# Bazdmeg Workflow

`bazdmeg` is the intended checkpoint/orchestration entrypoint for risky or
multi-step repo work.

Do not start with the destructive pipeline by default. Start with a safe read of
the repo state, then preview the pipeline, then run the real thing only when
the preview matches intent.

## Safe entrypoints

### Status

Read-only repo status for Bazdmeg:

```bash
yarn bazdmeg:status
```

What it shows:

- current branch and SHA
- working tree status
- remaining `spike-edge` Worker test backlog
- current phase 3 deploy plan
- prompt arena rankings
- recent Bazdmeg trend data

What it does **not** do:

- no Claude spawn
- no git add / commit
- no deploy
- no build

### Dry run

Pipeline preview without side effects:

```bash
yarn bazdmeg:dry-run
```

What it does:

- runs Bazdmeg checks in read-only mode
- selects the prompt variants Bazdmeg would use
- prints what phase 1, phase 2, and phase 3 would do

Read-only check behavior:

- lint uses `yarn lint:check` instead of `yarn lint`
- each check is capped at 60 seconds
- timed-out checks are reported as `TIMEOUT` in the preview

What it does **not** do:

- no agent spawn
- no commit
- no deploy

## Default usage for `spike-edge` test migration

For the remaining slow Worker-test cleanup, use Bazdmeg in this order:

1. `yarn bazdmeg:status`
2. `yarn bazdmeg:dry-run`
3. inspect the `spike-edge` Worker backlog in the output
4. choose the next migration slice
5. run plain `yarn bazdmeg` only after the dry run looks safe

## Current focus

The current `spike-edge` migration goal is:

- move branching and scoring logic into source-local `*-logic.ts` modules
- keep route tests in `src/edge-api/main/api/__tests__`
- shrink `.tests/spike-edge/__tests__` to a small set of high-value Worker smoke suites

See [EDGE_API_TESTING.md](/Users/z/Developer/spike-land-ai/docs/develop/EDGE_API_TESTING.md)
for the route-testing split and current migration status.

## Current limitation

The Bazdmeg runner is now safe to inspect with `status` and `dry-run`, but the
full pipeline is still an invasive workflow:

- it can spawn Claude
- it can create commits
- it can deploy

That is why `status` and `dry-run` exist. They are the required first step.
