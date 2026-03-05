# Automated E2E Bypass Setup Guide

This guide explains how to configure the E2E authentication bypass feature using
both automated tools (Playwright MCP) and manual steps.

## Overview

The E2E bypass requires configuration in **two places**:

1. **GitHub Secrets** - For CI/CD pipeline (build-time and test-time)
2. **Vercel Environment Variables** - For runtime middleware execution

Both must use the **same secret value** for the bypass to work correctly.

---

## Security Requirements

⚠️ **CRITICAL:** The E2E bypass is protected by multiple security layers:

- **Production Protection**: Bypass is BLOCKED when both `NODE_ENV=production`
  AND `VERCEL_ENV=production`
- **Constant-Time Comparison**: Prevents timing attacks on the secret
- **Audit Logging**: All bypass attempts are logged with timestamp and
  environment info
- **Explicit Configuration**: Secret must be explicitly set (empty strings
  rejected)

---

## Part 1: GitHub Secrets Setup

### Status: ✅ COMPLETED

The `E2E_BYPASS_SECRET` is already configured in GitHub Secrets:

- **Location**:
  https://github.com/spike-land-ai/spike.land/settings/secrets/actions
- **Added**: October 27, 2025
- **Status**: Active and functional

### Automated Verification (Playwright MCP)

```javascript
// Navigate to GitHub Secrets page
await page.goto(
  "https://github.com/spike-land-ai/spike.land/settings/secrets/actions",
);

// Verify E2E_BYPASS_SECRET exists
const secretExists = await page.locator('code:has-text("E2E_BYPASS_SECRET")')
  .isVisible();
console.log("E2E_BYPASS_SECRET configured:", secretExists);
```

### Manual Setup (If Needed)

If you need to regenerate or create the secret:

1. **Generate a secure random secret:**
   ```bash
   openssl rand -base64 32
   ```
   Example output: `xK9vL2mN5pQ8rT4wU6yZ0aB1cD3eF7gH9iJ2kL5mN8pQ1rS4tU7v`

2. **Navigate to GitHub Secrets:**
   - Go to: https://github.com/spike-land-ai/spike.land/settings/secrets/actions
   - Click "New repository secret"

3. **Add the secret:**
   - Name: `E2E_BYPASS_SECRET`
   - Value: (paste the generated secret from step 1)
   - Click "Add secret"

4. **Save the secret value:** You'll need it for Vercel configuration next!

---

## Part 2: Vercel Environment Variables Setup

### Status: ⚠️ REQUIRES MANUAL CONFIGURATION

The `E2E_BYPASS_SECRET` must be added to Vercel environment variables for
runtime middleware access.

### Why Vercel Needs This

- **GitHub Secrets**: Available during CI/CD build and test execution
- **Vercel Environment Variables**: Available to the deployed application at
  runtime
- **Middleware Execution**: Runs on Vercel's edge network and needs runtime
  access to the secret

### Automated Navigation (Playwright MCP)

```javascript
// Navigate to Vercel Environment Variables page
await page.goto("https://vercel.com/dashboard");
await page.getByRole("link", { name: "spike.land" }).click();
await page.getByRole("link", { name: "Settings" }).click();
await page.getByRole("link", { name: "Environment Variables" }).click();
```

### Manual Configuration Steps

**IMPORTANT:** You must use the **same secret value** from GitHub Secrets!

1. **Navigate to Vercel Environment Variables:**
   - URL:
     https://vercel.com/zoltan-erdos-projects/spike.land/settings/environment-variables
   - Or: Dashboard → spike.land → Settings → Environment Variables

2. **Click "Add New" → "Environment Variable"**

3. **Configure the environment variable:**
   - **Key**: `E2E_BYPASS_SECRET`
   - **Value**: (paste the same secret value used in GitHub Secrets)
   - **Environments**:
     - ✅ **Preview** (REQUIRED)
     - ✅ **Development** (RECOMMENDED)
     - ❌ **Production** (DO NOT SELECT - for security)

4. **Click "Save"**

5. **Verify the configuration:**
   - You should see `E2E_BYPASS_SECRET` listed with "Preview" and "Development"
     labels
   - Confirm it does NOT have a "Production" label

### Why Not Production?

Even though the middleware has built-in production protection (`NODE_ENV` and
`VERCEL_ENV` checks), we follow defense-in-depth principles:

- **Layer 1**: Don't configure the secret in production environment (Vercel)
- **Layer 2**: Middleware checks both `NODE_ENV` and `VERCEL_ENV` before
  allowing bypass
- **Layer 3**: Constant-time comparison prevents timing attacks
- **Layer 4**: Audit logging for monitoring

---

## Part 3: CI/CD Workflow Configuration

### Status: ✅ COMPLETED

The GitHub Actions workflow is already configured with `E2E_BYPASS_SECRET`:

- **Build Step**: `E2E_BYPASS_SECRET: ${{ secrets.E2E_BYPASS_SECRET }}`
- **E2E Test Step**: `E2E_BYPASS_SECRET: ${{ secrets.E2E_BYPASS_SECRET }}`

Location: `.github/workflows/ci-cd.yml`

---

## Verification Steps

After completing the setup, verify everything works:

### 1. Verify GitHub Secret

```bash
# This will fail if the secret is not configured
gh secret list | grep E2E_BYPASS_SECRET
```

Expected output:

```
E2E_BYPASS_SECRET  Updated 2025-10-27
```

### 2. Verify Vercel Environment Variable

1. Go to:
   https://vercel.com/zoltan-erdos-projects/spike.land/settings/environment-variables
2. Search for `E2E_BYPASS_SECRET`
3. Confirm it shows: "Preview" and "Development" (NOT "Production")

### 3. Test E2E Tests Locally

```bash
# Generate a test secret (for local testing only)
export E2E_BYPASS_SECRET="local-test-secret-$(openssl rand -hex 16)"

# Run E2E tests
npm run test:e2e:local
```

Expected result: Tests should pass and access protected routes

### 4. Test E2E Tests in CI

1. Push a change to a feature branch
2. Create a pull request
3. Wait for CI checks to complete
4. Verify E2E tests pass on the preview deployment

---

## Troubleshooting

### Problem: E2E tests fail with "Failed to bypass authentication"

**Solution:**

1. Verify GitHub Secret exists: `gh secret list | grep E2E_BYPASS_SECRET`
2. Verify Vercel Environment Variable is configured for Preview environment
3. Ensure both secrets use the **exact same value**
4. Trigger a new deployment to pick up the environment variable changes

### Problem: Bypass works in Preview but not Production

**Expected Behavior:** This is correct! The bypass should be blocked in
production.

**Verification:**

- Check middleware logs: `console.warn('[E2E Bypass]')` should NOT appear in
  production
- Production environment check: `NODE_ENV=production` AND
  `VERCEL_ENV=production`

### Problem: "Sensitive" toggle is disabled in Vercel

**Explanation:** The project has existing non-sensitive environment variables,
so new variables default to non-sensitive mode.

**Action:** This is acceptable for E2E_BYPASS_SECRET since:

- It's only configured in non-production environments
- The value is not displayed after creation
- Production has additional middleware protection

---

## Environment Variable Behavior Matrix

| NODE_ENV      | VERCEL_ENV   | E2E Bypass Allowed? | Use Case                               |
| ------------- | ------------ | ------------------- | -------------------------------------- |
| `production`  | `production` | ❌ NO               | Production deployment (bypass BLOCKED) |
| `production`  | `preview`    | ✅ YES              | Preview deployment from PR             |
| `test`        | `preview`    | ✅ YES              | E2E tests in CI against preview        |
| `development` | (undefined)  | ✅ YES              | Local development                      |
| `development` | `production` | ✅ YES              | Local dev with prod env var            |

---

## Security Audit Log Format

When the E2E bypass is successfully used, the middleware logs:

```javascript
[E2E Bypass] {
  timestamp: '2025-10-28T10:30:45.123Z',
  path: '/my-apps',
  environment: {
    NODE_ENV: 'test',
    VERCEL_ENV: 'preview'
  }
}
```

**Where to find logs:**

- Vercel Dashboard → Project → Logs
- Filter by: "E2E Bypass" string
- Check for unexpected production bypass attempts (should be zero)

---

## Summary Checklist

- [x] GitHub Secret `E2E_BYPASS_SECRET` configured
- [ ] Vercel Environment Variable `E2E_BYPASS_SECRET` configured
  - [ ] Added to **Preview** environment
  - [ ] Added to **Development** environment
  - [ ] **NOT** added to Production environment
- [x] GitHub Actions workflow updated with secret references
- [x] Middleware includes production environment protection
- [x] Tests verify production bypass is blocked
- [ ] Local E2E tests pass with the secret
- [ ] CI E2E tests pass against preview deployments

---

## References

- **GitHub Secrets Documentation**:
  https://docs.github.com/en/actions/security-guides/encrypted-secrets
- **Vercel Environment Variables**:
  https://vercel.com/docs/environment-variables
- **Proxy Code**: `src/proxy.ts:99-121`
- **Proxy Tests**: `src/proxy.test.ts:382-525`
- **Setup Documentation**: `docs/archive/WORKFLOW_CHANGES_NEEDED.md`
- **Environment Variable Examples**: `.env.example:48-78`

---

🤖 **Generated with Claude Code**

Last Updated: October 28, 2025
