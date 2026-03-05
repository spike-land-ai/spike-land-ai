# CI/CD Debugging Guide

This guide helps you troubleshoot CI/CD pipeline failures, understand expected
build times, and locate Vercel preview deployments.

---

## Pipeline Architecture

The CI/CD pipeline runs multiple jobs in parallel for faster feedback:

```
+-------------------+     +-------------------+     +-------------------+
|  Quality Checks   |     |    Unit Tests     |     |      Build        |
|  (Lint, TSC,      |     |   (4 shards)      |     |    Application    |
|   Security Audit) |     |                   |     |                   |
+-------------------+     +-------------------+     +-------------------+
         |                        |                        |
         +------------------------+------------------------+
                                  |
                                  v
+-------------------------------------------------------------------+
|                         E2E Tests (8 shards)                       |
|                    (Runs in parallel with above)                   |
+-------------------------------------------------------------------+
```

**Key Design Decisions:**

- All jobs run in parallel (no dependencies between Tier 1 jobs)
- Unit tests are sharded across 4 runners
- E2E tests are sharded across 8 runners
- Concurrency control cancels in-progress runs when new commits are pushed
- Documentation changes (`**.md`, `docs/**`) skip the pipeline

---

## Expected Build Times

| Job                     | Expected | Max Normal | Investigate If |
| ----------------------- | -------- | ---------- | -------------- |
| Quality Checks          | 1-2 min  | 3 min      | > 4 min        |
| Unit Tests (per shard)  | 1-2 min  | 3 min      | > 5 min        |
| Build Application       | 2-3 min  | 4 min      | > 5 min        |
| E2E Tests (per shard)   | 2-4 min  | 6 min      | > 8 min        |
| **Total Pipeline Time** | 4-6 min  | 8 min      | > 12 min       |

**Performance Tips:**

- Jobs use `actions/cache` for `node_modules` - cache hits are much faster
- Next.js build cache (`/.next/cache`) speeds up repeated builds
- Playwright browser cache avoids repeated downloads

---

## Finding Vercel Preview URLs

### Method 1: PR Comments (Recommended)

Vercel automatically posts a comment on each PR with the preview URL:

1. Open your Pull Request on GitHub
2. Look for a comment from **vercel[bot]**
3. Click the "Preview" link

### Method 2: GitHub Deployments Tab

1. Open your Pull Request
2. Click the "Deployments" section in the sidebar
3. Find the latest deployment with "Preview" environment
4. Click "View deployment"

### Method 3: GitHub CLI

```bash
# View PR status including deployment URLs
gh pr view <PR-NUMBER> --json statusCheckRollup

# Example output will include Vercel deployment URLs in check details
```

### Method 4: Vercel Dashboard

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Select your project
3. Click "Deployments" tab
4. Find the deployment matching your branch/commit

---

## Troubleshooting by Job Type

### Quality Checks

**Job Name:** `Quality Checks (Lint + Security)`

**Steps:**

1. Linting (`yarn lint`)
2. TypeScript check (`yarn tsc --noEmit`)
3. Security audit (`yarn npm audit --all --severity moderate`)

#### Lint Failures

**Symptoms:** `ESLint found X error(s)`

**Local Fix:**

```bash
# Run linter with auto-fix
yarn lint --fix

# Then manually fix remaining issues
yarn lint
```

**Common Causes:**

- Unused imports or variables
- Missing return types
- Console statements left in code

#### TypeScript Errors

**Symptoms:** `error TS2xxx: ...`

**Local Fix:**

```bash
# Run type check
yarn tsc --noEmit
```

**Common Causes:**

- Missing type annotations
- Incorrect import paths
- Incompatible library versions
- Missing `@types/*` packages

#### Security Audit Failures

**Symptoms:** `found X vulnerabilities`

**Local Fix:**

```bash
# View audit details
yarn npm audit --all

# Try automatic fixes
yarn npm audit --fix

# Or update specific packages
yarn up <package-name>
```

**When to Ignore:**

- Development-only vulnerabilities with no fix available
- False positives (verify with CVE details)

---

### Unit Tests

**Job Name:** `unit-tests-1` through `unit-tests-4`

**Key Features:**

- Tests run on 4 parallel shards
- On PRs: Only changed tests run (using `--changed` flag)
- On main: All tests run
- Coverage uploaded to Codecov

#### Coverage Threshold Failures

**Symptoms:** `Coverage threshold not met`

**Local Fix:**

```bash
# Run with coverage
yarn test:coverage

# View HTML report
open coverage/index.html
```

**Required Thresholds (100% required):**

- Statements: 100%
- Branches: 100%
- Functions: 100%
- Lines: 100%

#### Snapshot Mismatches

**Symptoms:** `Snapshot Test Failed`

**Local Fix:**

```bash
# Update snapshots after verifying changes are correct
yarn test --updateSnapshot

# Or for specific file
yarn test path/to/file.test.tsx --updateSnapshot
```

**Warning:** Always verify snapshot diffs before updating!

#### Async Timeout Issues

**Symptoms:** `Timeout - Async callback was not invoked within 5000ms`

**Solutions:**

1. Increase test timeout:

   ```typescript
   test("long running test", async () => {
     // ...
   }, 10000); // 10 second timeout
   ```

2. Ensure all promises are awaited
3. Check for missing `act()` wrappers in React tests

#### Mock Issues

**Symptoms:** `Cannot find module` or `undefined is not a function`

**Common Causes:**

- Missing mock in `vitest.config.ts`
- Incorrect mock path
- Missing `vi.mock()` call

**Local Debug:**

```bash
# Run single test file in isolation
yarn test path/to/failing.test.ts
```

---

### Build Failures

**Job Name:** `Build Application`

#### TypeScript Errors (Build-time)

**Note:** Build-time TypeScript errors may differ from `tsc --noEmit` due to
Next.js build process.

**Local Fix:**

```bash
yarn build
```

**Common Causes:**

- Server Component importing client-only code
- Missing `"use client"` directive
- Dynamic imports without proper typing

#### Import Path Issues

**Symptoms:** `Module not found`

**Solutions:**

1. Check `tsconfig.json` path aliases
2. Verify file exists at the import path
3. Check for case sensitivity (Linux is case-sensitive!)

#### Environment Variable Issues

**Symptoms:** `Environment variable X is required`

**Note:** CI uses a dummy `DATABASE_URL` for Prisma initialization:

```yaml
DATABASE_URL: postgresql://dummy:dummy@localhost:5432/dummy?schema=public
```

**For Real Secrets:**

- Add to GitHub Repository Secrets
- Reference in workflow with `${{ secrets.SECRET_NAME }}`

#### Prisma Schema Issues

**Symptoms:** `Prisma schema validation failed`

**Local Fix:**

```bash
# Validate schema
yarn prisma validate

# Generate client
yarn prisma generate
```

---

### E2E Tests

**Job Name:** `E2E Tests [1/8]` through `E2E Tests [8/8]`

**Key Features:**

- Runs against `localhost:3000` (not Vercel preview)
- Uses Playwright + Cucumber (BDD)
- Tests are sharded across 8 runners
- Reports uploaded as artifacts

#### Element Not Found (Timeout)

**Symptoms:** `Timeout 30000ms exceeded waiting for selector`

**Solutions:**

1. Use `data-testid` selectors (more reliable):

   ```typescript
   // Bad - ambiguous
   page.getByRole("button", { name: "Next" });

   // Good - precise
   page.getByTestId("wizard-next-button");
   ```

2. Use retry helpers from `e2e/support/helpers/retry-helper.ts`:

   ```typescript
   await clickButtonWithRetry(page, "submit-button");
   ```

3. Increase timeout for slow elements:
   ```typescript
   await expect(element).toBeVisible({ timeout: TIMEOUTS.LONG });
   ```

#### Strict Mode Violations

**Symptoms:** `strict mode violation: locator resolved to 2 elements`

**Solution:** Use more specific selectors:

```typescript
// Instead of:
page.getByRole("button", { name: "Next" });

// Use:
page.getByTestId("wizard-next-button");
```

#### Flaky Tests

**Symptoms:** Test passes sometimes, fails other times

**Investigation Steps:**

1. Tag with `@flaky` temporarily
2. Run with retries: `yarn test:e2e:flaky`
3. Check for race conditions
4. Add proper waits/retries

**Common Causes:**

- Missing `await` statements
- Race conditions in async operations
- Network timing issues
- Animation/transition timing

#### Authentication Issues

**Symptoms:** Tests fail due to login/session issues

**Note:** See `e2e/README.md` for current authentication status.

**Workarounds:**

- Use `E2E_BYPASS_SECRET` for test authentication
- Check if auth bypass middleware is working

---

## CI Monitoring Commands

### Check PR Status

```bash
# View all checks for a PR
gh pr checks <PR-NUMBER>

# Detailed view with status rollup
gh pr view <PR-NUMBER> --json statusCheckRollup

# Watch checks in real-time
gh pr checks <PR-NUMBER> --watch
```

### View Workflow Run Details

```bash
# List recent workflow runs
gh run list

# View specific run
gh run view <RUN-ID>

# View failed job logs
gh run view <RUN-ID> --log-failed

# Download artifacts (test reports, coverage)
gh run download <RUN-ID>
```

### Rerun Failed Jobs

```bash
# Rerun only failed jobs
gh run rerun <RUN-ID> --failed

# Rerun entire workflow
gh run rerun <RUN-ID>
```

---

## When to Retry vs Investigate

### Safe to Retry

- Network timeouts (intermittent)
- Infrastructure issues (GitHub Actions runner problems)
- First-run after major dependency update
- Cache invalidation issues

### Must Investigate

- Same test fails 2+ times consecutively
- Coverage dropped below threshold
- Security audit found new vulnerability
- Build fails with TypeScript errors
- All E2E shards fail on same test

---

## Downloading Test Reports

### E2E Test Reports

```bash
# List artifacts from a run
gh run view <RUN-ID> --json artifacts

# Download all E2E reports
gh run download <RUN-ID> -n "e2e-reports-shard-*"

# Reports include:
# - HTML reports: e2e/reports/cucumber-report-*.html
# - JSON reports: e2e/reports/cucumber-report-ci.json
# - Screenshots: e2e/reports/screenshots/
```

### Coverage Reports

Coverage is uploaded to Codecov. View at:

- PR comment from codecov bot
- [codecov.io/gh/spike-land-ai/spike.land](https://codecov.io/gh/spike-land-ai/spike.land)

---

## Environment Variables Reference

### CI Environment

| Variable            | Purpose                         | Set By         |
| ------------------- | ------------------------------- | -------------- |
| `DATABASE_URL`      | Prisma connection (dummy in CI) | Workflow       |
| `AUTH_SECRET`       | NextAuth secret                 | GitHub Secrets |
| `E2E_BYPASS_SECRET` | E2E auth bypass token           | GitHub Secrets |
| `CODECOV_TOKEN`     | Coverage upload token           | GitHub Secrets |
| `CI`                | Indicates CI environment        | GitHub Actions |

### Local Development

```bash
# Copy example and fill in values
cp .env.example .env.local
```

---

## Related Documentation

- [README.md](../README.md) - Development setup
- [e2e/README.md](../e2e/README.md) - E2E testing details
- [CLAUDE.md](../CLAUDE.md) - CI/CD verification requirements
- [.github/workflows/ci-cd.yml](../.github/workflows/ci-cd.yml) - Pipeline
  definition

---

**Last Updated:** December 2025
