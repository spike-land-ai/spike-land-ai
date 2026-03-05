# Credential Rotation Procedures

This document provides step-by-step instructions for rotating credentials when a
security incident occurs or as part of regular security hygiene.

## When to Rotate Credentials

**IMMEDIATE rotation required when:**

- Credentials are committed to git (even if quickly removed - git history
  persists)
- Credentials are exposed in logs, error messages, or screenshots
- Unauthorized access is detected
- An employee with access leaves the organization
- A third-party service reports a breach

**Scheduled rotation recommended:**

- Annually for all production credentials
- Quarterly for highly sensitive credentials (Stripe live keys, database)

## Credential Inventory

| Service           | Variables                                        | Priority | Rotation URL                                         |
| ----------------- | ------------------------------------------------ | -------- | ---------------------------------------------------- |
| Stripe            | STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET         | CRITICAL | https://dashboard.stripe.com/apikeys                 |
| Database (Legacy) | DATABASE_URL, DATABASE_URL_UNPOOLED              | Removed  | (was legacy spike.land, now deleted)                 |
| Cloudflare API    | CLOUDFLARE_API_TOKEN                             | HIGH     | https://dash.cloudflare.com/profile/api-tokens       |
| Auth Secret       | AUTH_SECRET                                      | HIGH     | Generate locally                                     |
| GitHub PAT        | GH_PAT_TOKEN                                     | HIGH     | https://github.com/settings/tokens                   |
| GitHub OAuth      | GITHUB_ID, GITHUB_SECRET                         | HIGH     | https://github.com/settings/developers               |
| Google OAuth      | GOOGLE_ID, GOOGLE_SECRET                         | HIGH     | https://console.cloud.google.com/apis/credentials    |
| Cloudflare R2     | CLOUDFLARE_R2_ACCESS_KEY_ID, ...SECRET_ACCESS... | HIGH     | https://dash.cloudflare.com/ > R2 > Manage API       |
| Gemini API        | GEMINI_API_KEY                                   | MEDIUM   | https://aistudio.google.com/app/apikey               |
| Twilio            | TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN            | MEDIUM   | https://console.twilio.com/                          |
| Resend            | RESEND_API_KEY                                   | MEDIUM   | https://resend.com/api-keys                          |
| E2E Bypass Secret | E2E_BYPASS_SECRET                                | LOW      | Generate locally                                     |
| Token Encryption  | TOKEN_ENCRYPTION_KEY                             | CRITICAL | Generate locally (WARNING: rotating breaks tokens)   |
| User ID Salt      | USER_ID_SALT                                     | CRITICAL | Generate locally (WARNING: rotating breaks user IDs) |

## Rotation Procedures

### 1. Stripe Credentials (CRITICAL)

**Impact**: Payment processing will fail if not updated everywhere

```bash
# 1. Go to Stripe Dashboard
# https://dashboard.stripe.com/apikeys

# 2. Roll the secret key (creates new key, old key still works)
# Click "Roll key" on the secret key

# 3. Update all environments:
# - .env.local (local development)
# - Vercel Environment Variables (production/preview)
# - GitHub Secrets (CI/CD)

# 4. Test payment flow in preview environment

# 5. Complete the roll (revokes old key)
# Back in Stripe, confirm the roll to revoke old key
```

**Webhook Secret**:

1. Go to Developers > Webhooks
2. Select your endpoint
3. Click "Reveal" then "Roll secret"
4. Update STRIPE_WEBHOOK_SECRET in all environments
5. Verify webhook delivery in Stripe dashboard

### 2. AUTH_SECRET (HIGH)

**Impact**: All existing sessions will be invalidated; users must re-login

```bash
# Generate a new secret
openssl rand -base64 32

# Update in:
# - .env.local
# - Vercel Environment Variables
# - GitHub Secrets

# Note: This is expected to log out all users
```

### 4. GitHub PAT Token (HIGH)

**Impact**: CI/CD workflows using the PAT will fail

1. Go to https://github.com/settings/tokens
2. Find the token (or create new if compromised)
3. Click "Regenerate token"
4. Update GH_PAT_TOKEN in:
   - GitHub Secrets
   - Any local .env.local files

### 5. OAuth Credentials (HIGH)

**GitHub OAuth**:

1. Go to https://github.com/settings/developers
2. Find your OAuth App
3. Generate a new client secret
4. Update GITHUB_SECRET in all environments
5. (Optional) Delete old secret after verification

**Google OAuth**:

1. Go to https://console.cloud.google.com/apis/credentials
2. Find your OAuth 2.0 Client
3. Click "Add Secret" to create new
4. Update GOOGLE_SECRET in all environments
5. Delete old secret after verification

### 6. Cloudflare R2 (HIGH)

1. Go to https://dash.cloudflare.com/
2. Navigate to R2 > Overview > Manage R2 API Tokens
3. Create a new API token with same permissions
4. Update in all environments:
   - CLOUDFLARE_R2_ACCESS_KEY_ID
   - CLOUDFLARE_R2_SECRET_ACCESS_KEY
5. Test file upload/download
6. Revoke old token

### 7. Gemini API Key (MEDIUM)

1. Go to https://aistudio.google.com/app/apikey
2. Create a new API key
3. Update GEMINI_API_KEY in all environments
4. Delete old key after verification

### 8. Twilio (MEDIUM)

1. Go to https://console.twilio.com/
2. Navigate to Account > API keys & tokens
3. Create new credentials
4. Update TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN
5. Revoke old credentials

### 9. Cloudflare API Token (HIGH)

**Impact**: Worker deployments and D1 operations will fail

1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Create a new API token with "Edit Cloudflare Workers" template
3. Update `CLOUDFLARE_API_TOKEN` in GitHub Secrets
4. Test with `wrangler whoami`
5. Revoke old token

## Post-Rotation Checklist

After rotating any credential:

- [ ] Updated in `.env.local` (local development)
- [ ] Updated in Vercel Environment Variables
  - [ ] Production
  - [ ] Preview
  - [ ] Development (if applicable)
- [ ] Updated in GitHub Secrets (if used in CI/CD)
- [ ] Verified functionality in preview environment
- [ ] Verified functionality in production
- [ ] Old credential revoked/deleted
- [ ] Documented rotation in security log

## Security Log Template

When a rotation occurs, document it:

```markdown
## Credential Rotation - [DATE]

**Credentials Rotated**: [List] **Reason**: [Scheduled/Incident/Offboarding]
**Rotated By**: [Name] **Environments Updated**:
[Production/Preview/Development/CI] **Verification**: [Passed/Issues] **Notes**:
[Any issues or observations]
```

## Emergency Rotation

If you suspect active compromise:

1. **Immediately revoke** the compromised credential (don't just rotate)
2. Create new credential with different identifier if possible
3. Update all environments in parallel (not sequentially)
4. Check audit logs for unauthorized usage
5. Notify affected parties if user data accessed
6. Document the incident thoroughly

## Non-Rotatable Secrets

**WARNING**: These secrets cannot be rotated without data loss:

### TOKEN_ENCRYPTION_KEY

Used to encrypt OAuth tokens in the database. Rotating this will make all stored
tokens unreadable.

**If compromised**:

1. Rotate the key
2. Users must re-authenticate with OAuth providers
3. Marketing integrations will need to be reconnected

### USER_ID_SALT

Used to generate deterministic user IDs from email addresses. Rotating this will
create new user IDs for all users.

**If compromised**:

1. This is a serious incident - all user data associations break
2. Consider migrating to UUID-based user IDs
3. Requires database migration to update all user references

## Prevention Best Practices

1. **Never commit secrets** - Use `.env.local` which is gitignored
2. **Use secret scanning** - gitleaks runs on pre-commit and CI
3. **Principle of least privilege** - Use scoped tokens where possible
4. **Separate environments** - Use different credentials for prod/preview
5. **Regular audits** - Review access logs monthly
6. **Offboarding checklist** - Rotate shared secrets when people leave
