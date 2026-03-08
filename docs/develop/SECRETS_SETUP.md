# Secrets and Environment Variables Setup

This is the **single source of truth** for all secrets and environment variables
used in the Spike Land platform. All other documentation should reference this
file rather than duplicating secrets information.

**Last Updated**: March 2026

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Secrets Inventory](#secrets-inventory)
3. [Local Development](#local-development)
4. [GitHub Actions CI/CD](#github-actions-cicd)
5. [Vercel Production](#vercel-production)
6. [Secret Generation Commands](#secret-generation-commands)
7. [Security Best Practices](#security-best-practices)
8. [Troubleshooting](#troubleshooting)

---

## Quick Start

```bash
# 1. Copy environment template
cp .env.example .env.local

# 2. Generate required secrets
openssl rand -base64 32  # For AUTH_SECRET, USER_ID_SALT, E2E_BYPASS_SECRET

# 3. Configure OAuth providers (see sections below)

# 4. Start development
yarn dev
```

---

## Secrets Inventory

### Required vs Optional Matrix

| Secret                   | Local | GH Actions | Vercel  | Required Level |
| ------------------------ | :---: | :--------: | :-----: | :------------: |
| DATABASE_URL             |  No   |     No     |    No   |  Removed (D1)  |
| AUTH_SECRET              |  Yes  |    Yes     |   Yes   |  **Required**  |
| USER_ID_SALT             |  Yes  |     No     |   Yes   |  **Required**  |
| GITHUB_ID/SECRET         |  Yes  |     No     |   Yes   |  **Required**  |
| GOOGLE_ID/SECRET         |  Yes  |     No     |   Yes   |  **Required**  |
| GEMINI_API_KEY           |  Yes  |    Yes     |   Yes   |  **Required**  |
| CLOUDFLARE_R2_*          |  Yes  |    Yes     |   Yes   |  **Required**  |
| E2E_BYPASS_SECRET        |  Yes  |    Yes     | Preview |  **Required**  |
| GH_PAT_TOKEN             |  Yes  |    Yes     |   No    |  CI Required   |
| VERCEL_TOKEN             |  No   |  Optional  |   No    |    Optional    |
| CODECOV_TOKEN            |  No   |  Optional  |   No    |    Optional    |
| CLAUDE_CODE_OAUTH_TOKEN  |  No   |  Optional  |   No    |    Optional    |
| STRIPE_*                 |  Yes  |     No     |   Yes   |    Optional    |
| RESEND_API_KEY           |  Yes  |     No     |   Yes   |    Optional    |
| AUTH_FACEBOOK_ID/SECRET  |  Yes  |     No     |   Yes   |    Optional    |
| AUTH_APPLE_ID/SECRET     |  Yes  |     No     |   Yes   |    Optional    |
| TOKEN_ENCRYPTION_KEY     |  Yes  |     No     |   Yes   |    Optional    |
| FACEBOOK_MARKETING_APP_* |  Yes  |     No     |   Yes   |    Optional    |
| GOOGLE_ADS_*             |  Yes  |     No     |   Yes   |    Optional    |
| UPSTASH_REDIS_REST_*     |  Yes  |     No     |   Yes   |    Optional    |
| TWITTER_CLIENT_*         |  Yes  |     No     |   Yes   |    Optional    |
| FACEBOOK_SOCIAL_APP_*    |  Yes  |     No     |   Yes   |    Optional    |

---

## Local Development

### Core Authentication

#### AUTH_SECRET (Required)

Used by Better Auth to sign and encrypt session tokens.

```bash
# Generate:
openssl rand -base64 32
# Or visit: https://generate-secret.vercel.app/32

# .env.local:
AUTH_SECRET=your-generated-secret
```

#### USER_ID_SALT (Required for Production)

Generates stable user IDs from email addresses across OAuth providers.

```bash
# Generate:
openssl rand -base64 32

# .env.local:
USER_ID_SALT=your-user-id-salt
```

**CRITICAL SECURITY WARNING:**

- **NEVER rotate this value after going live** - changing it will cause all user
  IDs to change, breaking user data associations
- If not set, AUTH_SECRET is used as fallback (not recommended for production)
- User IDs are tied to email addresses (`user_<hash-of-email>`)
- If a user changes their email at the OAuth provider, they get a NEW user ID

### Database Configuration

Database is managed via Cloudflare D1 (serverless SQLite). No DATABASE_URL
needed — D1 bindings are configured in `wrangler.toml`. See
[D1_QUICK_START.md](./D1_QUICK_START.md) for setup details.

### OAuth Providers

#### GitHub OAuth (Required)

1. Go to: https://github.com/settings/developers
2. Click "New OAuth App"
3. Set Authorization callback URL to:
   - Development: `http://localhost:3000/api/auth/callback/github`
   - Production: `https://spike.land/api/auth/callback/github`
4. Copy Client ID and generate Client Secret

```bash
GITHUB_ID=your-github-client-id
GITHUB_SECRET=your-github-client-secret
```

#### Google OAuth (Required)

1. Go to: https://console.cloud.google.com/
2. Create/select project
3. Navigate to "APIs & Services" > "Credentials"
4. Click "Create Credentials" > "OAuth client ID"
5. Choose "Web application"
6. Add authorized redirect URI:
   - Development: `http://localhost:3000/api/auth/callback/google`
   - Production: `https://spike.land/api/auth/callback/google`

```bash
GOOGLE_ID=your-google-client-id
GOOGLE_SECRET=your-google-client-secret
```

#### Facebook OAuth (Optional)

1. Go to: https://developers.facebook.com/apps/
2. Create app with "Consumer" type (NOT "Business")
3. Select use case: "Authenticate and request data from users with Facebook
   Login"
4. Add Valid OAuth Redirect URI:
   - Development: `http://localhost:3000/api/auth/callback/facebook`
   - Production: `https://spike.land/api/auth/callback/facebook`

```bash
AUTH_FACEBOOK_ID=your-facebook-app-id
AUTH_FACEBOOK_SECRET=your-facebook-app-secret
```

**NOTE:** Uses `AUTH_` prefix to distinguish from `FACEBOOK_MARKETING_APP_*`
(Marketing API).

#### Apple OAuth (Optional)

Apple Sign-In requires a **JWT-based client secret** instead of a static secret.
The secret must be regenerated every 6 months (maximum validity).

**Setup Steps:**

1. Go to: https://developer.apple.com/account/
2. Navigate to **Certificates, Identifiers & Profiles**

**Step A - Create an App ID:**

3. Go to Identifiers > App IDs > Click "+"
4. Select "App IDs" → "App" type
5. Enter Description and Bundle ID (e.g., `com.spike.land`)
6. Enable **Sign in with Apple** capability
7. Register the App ID

**Step B - Create a Services ID (this becomes AUTH_APPLE_ID):**

8. Go to Identifiers > Services IDs > Click "+"
9. Enter Description (e.g., "Spike Land Web") and Identifier (e.g.,
   `com.spike.land.web`)
10. Enable **Sign in with Apple** and click Configure
11. Select your Primary App ID from Step A
12. Add domains: `spike.land` (and `localhost` for dev)
13. Add Return URLs:
    - Development: `http://localhost:3000/api/auth/callback/apple`
    - Production: `https://auth-mcp.spike.land/api/auth/callback/apple`
14. Copy the Identifier - this is your `AUTH_APPLE_ID`

**Step C - Create a Key:**

15. Go to Keys > Click "+"
16. Enter Key Name (e.g., "Spike Land Auth Key")
17. Enable **Sign in with Apple** and configure with your App ID
18. Register and **download the .p8 file** (one-time download!)
19. Note the **Key ID** shown on the page

**Step D - Generate the Client Secret JWT:**

```bash
# Use the provided script
yarn generate:apple-secret
```

The script will prompt for:

- **Team ID**: Found in top-right of Apple Developer portal (10 characters)
- **Services ID**: Your `AUTH_APPLE_ID` from Step B
- **Key ID**: From Step C (10 characters)
- **Private Key**: Path to your `.p8` file from Step C

```bash
AUTH_APPLE_ID=com.spike.land.web
AUTH_APPLE_SECRET=your-generated-jwt-secret
```

**IMPORTANT:**

- The client secret JWT **expires after 6 months**
- Set a calendar reminder to run `yarn generate:apple-secret` before expiration
- Store the .p8 private key securely (needed for regeneration)
- Apple may return private relay emails (`unique@privaterelay.appleid.com`)

### Social Media Posting APIs

#### Twitter/X API v2 (Optional)

For posting tweets and managing Twitter content.

1. Go to: https://developer.twitter.com/en/portal/dashboard
2. Sign up for developer account (Free tier available)
3. Create a Project and App
4. Enable OAuth 2.0:
   - Type: Web App (Confidential client)
   - Callback URL: `https://spike.land/api/social/twitter/callback`
   - Local dev: `http://localhost:3000/api/social/twitter/callback`
5. Copy Client ID and Client Secret

```bash
TWITTER_CLIENT_ID=your-client-id
TWITTER_CLIENT_SECRET=your-client-secret
TWITTER_CALLBACK_URL=https://spike.land/api/social/twitter/callback
```

#### Facebook/Instagram Graph API (Optional)

For posting to Facebook Pages and Instagram accounts.

**NOTE**: This is DIFFERENT from:

- `AUTH_FACEBOOK_*` (user login)
- `FACEBOOK_MARKETING_APP_*` (ads management)

1. Go to: https://developers.facebook.com/
2. Create a new App (Type: Business)
3. Add products: Facebook Login, Instagram Graph API
4. Configure OAuth redirect URI:
   - Production: `https://spike.land/api/social/facebook/callback`
   - Local dev: `http://localhost:3000/api/social/facebook/callback`
5. Request permissions: `pages_manage_posts`, `pages_read_engagement`,
   `instagram_basic`, `instagram_content_publish`
6. Copy App ID and App Secret from Basic Settings

```bash
FACEBOOK_SOCIAL_APP_ID=your-app-id
FACEBOOK_SOCIAL_APP_SECRET=your-app-secret
FACEBOOK_SOCIAL_CALLBACK_URL=https://spike.land/api/social/facebook/callback
```

### AI Services

#### Google Gemini API (Required)

Used for image analysis and enhancement.

1. Go to: https://aistudio.google.com/app/apikey
2. Create API key

```bash
GEMINI_API_KEY=your-gemini-api-key
# IMAGEN_API_KEY may be the same as GEMINI_API_KEY
```

### Cloud Storage

#### Cloudflare R2 (Required)

Used for image storage and database backups.

**Setup Steps:**

1. Go to: https://dash.cloudflare.com/
2. Navigate to R2 > Overview
3. Create bucket (e.g., `spike-land-images` for images, `spike-land-backups` for
   database backups)
4. Go to "Manage R2 API Tokens" > Create API Token
5. Configure token:
   - **Permissions**: Read & Write (required for uploads and deletion during
     backup rotation)
   - **Bucket Scope**: Limit to specific bucket(s) for security
6. Copy the following values (shown only once):
   - **Access Key ID**
   - **Secret Access Key**
   - **Endpoint URL** (format: `https://<account-id>.r2.cloudflarestorage.com`)

```bash
CLOUDFLARE_ACCOUNT_ID=your-cloudflare-account-id
CLOUDFLARE_R2_ACCESS_KEY_ID=your-r2-access-key-id
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
CLOUDFLARE_R2_BUCKET_NAME=spike-land-images
CLOUDFLARE_R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
```

**For database backups**, you may want a separate bucket and configuration:

```bash
# Used by scripts/backup/backup.ts
CLOUDFLARE_R2_BUCKET_NAME=spike-land-backups  # Separate bucket for backups
CLOUDFLARE_R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
CLOUDFLARE_R2_ACCESS_KEY_ID=your-r2-access-key-id
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
```

**IMPORTANT**: The endpoint URL must include the full `https://` prefix.

#### Cloudflare Workers (Wrangler Configuration)

Wrangler CLI automatically reads credentials from environment variables. **Do
NOT hardcode credentials in `wrangler.toml` files.**

**Required environment variables:**

```bash
# Account ID - Wrangler reads this automatically
export CLOUDFLARE_ACCOUNT_ID="your-account-id"

# API Token for deployments
export CLOUDFLARE_API_TOKEN="your-api-token"
```

**Finding your Account ID:**

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Select any domain or the Workers section
3. The Account ID is shown in the right sidebar
4. Or run: `wrangler whoami` (after authenticating)

**Creating an API Token:**

1. Go to [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. Click "Create Token"
3. Use the "Edit Cloudflare Workers" template or create custom with:
   - Account > Workers Scripts: Edit
   - Account > Workers KV Storage: Edit
   - Account > Workers R2 Storage: Edit
   - Zone > Workers Routes: Edit

**Local development options:**

```bash
# Option 1: Add to shell profile (~/.bashrc, ~/.zshrc)
export CLOUDFLARE_ACCOUNT_ID="your-account-id"
export CLOUDFLARE_API_TOKEN="your-api-token"

# Option 2: Use wrangler login for interactive auth
wrangler login

# Option 3: Pass inline when running wrangler
CLOUDFLARE_ACCOUNT_ID="your-id" yarn wrangler deploy
```

**SECURITY WARNING:** The `account_id` field in `wrangler.toml` files has been
intentionally commented out. Never hardcode Cloudflare credentials in version
control. The Cloudflare Worker packages are now in external repos under the
`@spike-land-ai` npm org.

#### Wrangler Secrets (Per-Worker)

Each Cloudflare Worker can have its own secrets set via:

```bash
# Set a secret for a specific worker
wrangler secret put SECRET_NAME --name worker-name

# List secrets for a worker
wrangler secret list --name worker-name
```

Common worker secrets:

| Worker | Secret | Purpose |
|---|---|---|
| mcp-auth | `BETTER_AUTH_SECRET` | Session encryption |
| mcp-auth | `GOOGLE_CLIENT_ID/SECRET` | Google OAuth |
| mcp-auth | `GITHUB_CLIENT_ID/SECRET` | GitHub OAuth |
| spike-edge | `STRIPE_SECRET_KEY` | Stripe payments |
| image-studio-worker | `GEMINI_API_KEY` | Image analysis |
| image-studio-worker | `CF_AIG_TOKEN` | Cloudflare AI Gateway |
| spike-land-mcp | (varies) | Per-tool secrets |

See [deployment-inventory.md](../deployment-inventory.md) for the full secrets inventory per worker.

#### Cloudflare Images API (Optional)

For image transformation and CDN delivery.

```bash
CLOUDFLARE_IMAGES_API_KEY=your-images-api-key
CLOUDFLARE_IMAGES_ACCOUNT_HASH=your-account-hash
```

### E2E Testing

#### E2E_BYPASS_SECRET (Required for Testing)

Allows E2E tests to bypass authentication.

```bash
# Generate:
openssl rand -base64 32

# .env.local:
E2E_BYPASS_SECRET=your-e2e-bypass-secret
```

**Security Features:**

- **Production Protection**: Bypass is BLOCKED in production even if secret is
  configured (requires both `NODE_ENV=production` AND `VERCEL_ENV=production` to
  block)
- **Constant-time Comparison**: Uses `timingSafeEqual` to prevent timing attacks
- **Audit Logging**: All bypass attempts are logged with timestamp and
  environment info

### Optional Services

#### Stripe Payment Integration

```bash
STRIPE_SECRET_KEY=sk_test_your-stripe-secret-key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your-stripe-publishable-key
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret
```

Get credentials from: https://dashboard.stripe.com/apikeys

#### Resend Email Service

```bash
RESEND_API_KEY=re_your_resend_api_key
EMAIL_FROM=zoltan.erdos@spike.land
```

Get API key from: https://resend.com/api-keys

#### Upstash Redis (Rate Limiting & Message Queue)

```bash
UPSTASH_REDIS_REST_URL=https://your-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-upstash-token
```

Get credentials from: https://console.upstash.com/redis

#### Token Encryption (Marketing OAuth)

Encrypts OAuth tokens stored in the database using AES-256-GCM.

```bash
# Generate 32-byte key:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

TOKEN_ENCRYPTION_KEY=your-64-character-hex-key
```

**IMPORTANT**: Do NOT rotate this key after tokens are stored - they will become
unreadable.

---

## GitHub Actions CI/CD

### Required Secrets

Add these to: **Settings > Secrets and variables > Actions > New repository
secret**

#### DATABASE_URL

- **Used by**: `ci-cd.yml` (E2E tests)
- **Purpose**: Database connection for E2E tests

#### AUTH_SECRET

- **Used by**: `ci-cd.yml` (E2E tests)
- **Purpose**: Better Auth session signing

#### E2E_BYPASS_SECRET

- **Used by**: `ci-cd.yml` (E2E tests)
- **Purpose**: Bypass authentication in E2E tests
- **Value**: Must match what's configured in Vercel Preview environment

#### GH_PAT_TOKEN

- **Used by**: `claude.yml`, `claude-code-review.yml`
- **Purpose**: GitHub CLI (`gh`) authentication for Claude workflows
- **How to obtain**:
  1. Go to https://github.com/settings/tokens?type=beta
  2. Create a fine-grained Personal Access Token
  3. Repository access: Select `spike-land-ai/spike.land`
  4. Permissions: `Contents` (read/write), `Issues` (read/write),
     `Pull
     requests` (read/write)

#### CLOUDFLARE_R2_BUCKET_NAME

- **Used by**: `backup.yml`
- **Purpose**: R2 bucket name for database backups
- **Example**: `spike-land-backups`

#### CLOUDFLARE_R2_ENDPOINT

- **Used by**: `backup.yml`
- **Purpose**: Cloudflare R2 endpoint URL
- **Format**: `https://<account-id>.r2.cloudflarestorage.com`
- **Important**: Must include full `https://` prefix

#### CLOUDFLARE_R2_ACCESS_KEY_ID

- **Used by**: `backup.yml`
- **Purpose**: R2 API access key ID for authentication

#### CLOUDFLARE_R2_SECRET_ACCESS_KEY

- **Used by**: `backup.yml`
- **Purpose**: R2 API secret access key for authentication

### Optional Secrets

#### VERCEL_TOKEN

- **Used by**: Manual deployments (if needed)
- **Purpose**: Vercel CLI authentication
- **How to obtain**: https://vercel.com/account/tokens
- **Note**: Usually not needed - Vercel Git integration handles deployments

#### CODECOV_TOKEN

- **Used by**: `ci-cd.yml` (coverage upload)
- **Purpose**: Upload test coverage reports
- **How to obtain**: https://codecov.io (link repository)

#### CLAUDE_CODE_OAUTH_TOKEN

- **Used by**: `claude.yml`
- **Purpose**: Authenticate Claude Code GitHub Action
- **How to obtain**: Anthropic Claude Code setup

### Workflow Files Reference

| Workflow                 | Secrets Used                                                                                                                  |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `ci-cd.yml`              | DATABASE_URL, AUTH_SECRET, E2E_BYPASS_SECRET, CODECOV_TOKEN                                                                   |
| `claude.yml`             | GH_PAT_TOKEN, CLAUDE_CODE_OAUTH_TOKEN                                                                                         |
| `claude-code-review.yml` | GH_PAT_TOKEN, CLAUDE_CODE_OAUTH_TOKEN                                                                                         |
| `backup.yml`             | DATABASE_URL, CLOUDFLARE_R2_BUCKET_NAME, CLOUDFLARE_R2_ENDPOINT, CLOUDFLARE_R2_ACCESS_KEY_ID, CLOUDFLARE_R2_SECRET_ACCESS_KEY |

---

## Vercel Production

### Environment Variable Configuration

Add variables in: **Vercel Dashboard > Project > Settings > Environment
Variables**

### Environment Selection

| Variable          | Development | Preview | Production |
| ----------------- | :---------: | :-----: | :--------: |
| DATABASE_URL      |     Yes     |   Yes   |    Yes     |
| AUTH_SECRET       |     Yes     |   Yes   |    Yes     |
| USER_ID_SALT      |     Yes     |   Yes   |    Yes     |
| GITHUB_ID/SECRET  |     Yes     |   Yes   |    Yes     |
| GOOGLE_ID/SECRET  |     Yes     |   Yes   |    Yes     |
| GEMINI_API_KEY    |     Yes     |   Yes   |    Yes     |
| CLOUDFLARE_R2_*   |     Yes     |   Yes   |    Yes     |
| E2E_BYPASS_SECRET |     Yes     |   Yes   |   **NO**   |
| STRIPE_*          |     Yes     |   Yes   |    Yes     |
| RESEND_API_KEY    |     Yes     |   Yes   |    Yes     |

### Production Security Rules

**CRITICAL - E2E_BYPASS_SECRET:**

- Enable for: Development, Preview
- **NEVER enable for: Production**
- The bypass middleware blocks requests in production even if the secret is
  configured, but do not configure it at all for defense in depth

### Auto-Linked Variables

Vercel automatically provides these variables:

- `VERCEL_URL` - Deployment URL (e.g., `my-app-abc123.vercel.app`)
- `VERCEL_ENV` - Environment name (`production`, `preview`, `development`)
- `VERCEL_GIT_COMMIT_SHA` - Git commit hash
- `VERCEL_GIT_COMMIT_REF` - Git branch name

### OAuth Callback URLs

For production, update OAuth providers with production URLs:

- GitHub: `https://spike.land/api/auth/callback/github`
- Google: `https://spike.land/api/auth/callback/google`
- Facebook: `https://spike.land/api/auth/callback/facebook`
- Apple: `https://spike.land/api/auth/callback/apple`

**Recommendation**: Use separate OAuth apps for development vs production for
better security isolation.

**Apple-Specific Note**: Remember to regenerate the Apple client secret JWT
every 6 months using `yarn generate:apple-secret`.

---

## Secret Generation Commands

### AUTH_SECRET / USER_ID_SALT / E2E_BYPASS_SECRET

```bash
# macOS/Linux:
openssl rand -base64 32

# Alternative (Node.js):
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Online generator:
# https://generate-secret.vercel.app/32
```

### TOKEN_ENCRYPTION_KEY (64-character hex)

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Verify Secret Strength

```bash
# Check length and entropy
echo -n "your-secret" | wc -c  # Should be 32+ characters
```

---

## Security Best Practices

### Never Rotate

1. **USER_ID_SALT** - Rotating breaks all user ID associations
2. **TOKEN_ENCRYPTION_KEY** - Rotating makes stored tokens unreadable

### Rotate Periodically

1. **AUTH_SECRET** - Can be rotated; users will be logged out
2. **OAuth secrets** - Rotate via provider dashboard; update everywhere

### Environment File Security

```bash
# .env.local is gitignored (local development only)
# NEVER commit .env files with real secrets
# Use .env.example as template (contains placeholder values only)
```

### Secret Storage Hierarchy

| Environment | Storage Method                             |
| ----------- | ------------------------------------------ |
| Local Dev   | `.env.local` (gitignored)                  |
| GitHub CI   | GitHub Secrets (encrypted at rest)         |
| Vercel      | Environment Variables (encrypted, scoped)  |
| Production  | Wrangler secrets (encrypted, per-worker)   |

### Audit Checklist

- [ ] All secrets use strong random values (32+ bytes)
- [ ] `.env.local` is in `.gitignore`
- [ ] No secrets in git history
- [ ] Production uses different secrets than development
- [ ] E2E_BYPASS_SECRET is NOT in production
- [ ] OAuth apps are separated (dev vs prod)
- [ ] Secrets are rotated on team member departure

---

## Troubleshooting

### "Invalid credentials" in OAuth

1. Verify client ID and secret are correct
2. Check callback URLs match exactly (including trailing slashes)
3. Ensure OAuth app is not in "development mode" (Facebook)

### "Database connection failed"

1. Check DATABASE_URL format: `postgresql://user:pass@host:port/db`
2. For Neon/Supabase: Ensure `?sslmode=require` is appended
3. Verify IP allowlist on database provider

### "E2E tests failing with 401"

1. Verify E2E_BYPASS_SECRET is set in both:
   - GitHub Secrets (for CI)
   - Vercel Environment Variables (Preview environment)
2. Values must match exactly
3. Check it's NOT enabled for Production

### "CLAUDE_CODE_OAUTH_TOKEN" errors

1. Regenerate token from Anthropic
2. Update GitHub Secret
3. Verify workflow has correct permissions

### Secret Not Loading

```bash
# Debug: Print loaded env vars (development only!)
console.log(process.env.MY_SECRET ? "loaded" : "missing");

# Check Vercel deployment logs for "Environment Variables" section
```

---

## Related Documentation

- [DATABASE_SETUP.md](./DATABASE_SETUP.md) - Database configuration
- [LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md) - Pre-launch verification
- [../.github/workflows/README.md](../.github/workflows/README.md) - CI/CD
  pipeline
- [../.env.example](../.env.example) - Environment variable template

---

**Maintained by**: Security Team | **Questions**: Create a GitHub issue with
label `security`
