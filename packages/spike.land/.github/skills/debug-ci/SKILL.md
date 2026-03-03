# Debug CI Failures

## Overview

Guide for debugging CI/CD pipeline failures in this repository. The CI pipeline
runs on GitHub Actions with Vercel preview deployments.

## CI Pipeline Structure

The main CI workflow (`.github/workflows/ci.yml`) runs:

1. **Lint** — ESLint checks
2. **Type Check** — TypeScript compilation
3. **Unit Tests** — Vitest with 100% coverage requirement (sharded across
   runners)
4. **Build** — Next.js production build
5. **E2E Tests** — Playwright + Cucumber (requires Vercel preview)

## Debugging Commands

### Check PR Status

```bash
gh pr checks <PR-NUMBER>
gh pr view <PR-NUMBER> --json statusCheckRollup
```

### View Failed Workflow Logs

```bash
# List recent workflow runs
gh run list --limit 10

# View a specific failed run
gh run view <RUN-ID>

# View only failed job logs
gh run view <RUN-ID> --log-failed

# Download full logs
gh run view <RUN-ID> --log > ci-logs.txt
```

### Common Failure Patterns

#### Test Coverage Below 100%

```bash
# Run locally to see uncovered lines
yarn test:coverage
# Check coverage/ directory for HTML report
```

#### TypeScript Errors

```bash
yarn tsc --noEmit
```

#### Lint Errors

```bash
yarn lint
# Auto-fix where possible
yarn lint --fix
```

#### E2E Test Failures

```bash
# E2E tests run against Vercel preview URL
# Check the preview deployment first
gh pr checks <PR-NUMBER> | grep -i vercel

# Run locally
yarn dev &
yarn test:e2e:local
```

#### Sharded Test Failures

Tests are sharded across multiple runners. To find which shard failed:

```bash
gh run view <RUN-ID> --json jobs --jq '.jobs[] | select(.conclusion == "failure") | .name'
```

### Vercel Preview

- Preview URL format: `https://<project>-<hash>-<team>.vercel.app`
- Find preview URL from PR checks or Vercel bot comment
- Smoke test: check home page loads, navigation works, no console errors

## Workflow

1. Identify which check failed (`gh pr checks`)
2. Read the failed logs (`gh run view --log-failed`)
3. Reproduce locally with the appropriate command
4. Fix the issue
5. Push and verify the fix passes CI
