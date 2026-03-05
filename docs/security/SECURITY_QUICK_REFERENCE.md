# Web Security Quick Reference

A fast lookup guide for the most critical security implementations. For detailed
information, see [web-security.md](./web-security.md).

---

## Immediate Actions Checklist

These should be implemented in every application:

### 1. Password Security

```javascript
import argon2 from "argon2";

// Hash: Argon2id with recommended parameters
const hash = await argon2.hash(password, {
  type: argon2.argon2id,
  memoryCost: 65536, // 64 MB
  timeCost: 3,
  parallelism: 4,
});

// Verify
const valid = await argon2.verify(hash, password);
```

### 2. Secure Cookies

```javascript
res.cookie("__Host-sessionId", sessionId, {
  path: "/",
  httpOnly: true, // No JavaScript access
  secure: true, // HTTPS only
  sameSite: "Strict", // No cross-site
  maxAge: 1800000, // 30 minutes
});
```

### 3. Security Headers

```javascript
// Minimum required headers
res.setHeader(
  "Strict-Transport-Security",
  "max-age=31536000; includeSubDomains; preload",
);
res.setHeader(
  "Content-Security-Policy",
  "default-src 'self'; script-src 'nonce-<random>'; frame-ancestors 'none'",
);
res.setHeader("X-Frame-Options", "DENY");
res.setHeader("X-Content-Type-Options", "nosniff");
res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
```

### 4. CSRF Protection

```javascript
// Generate token
const csrfToken = crypto.randomBytes(32).toString("hex");
req.session.csrfToken = csrfToken;

// Validate on POST/PUT/DELETE
if (req.body.csrfToken !== req.session.csrfToken) {
  return res.status(403).json({ error: "CSRF validation failed" });
}
```

### 5. Input Validation

```javascript
// Server-side validation ALWAYS
function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

if (!validateEmail(req.body.email)) {
  return res.status(400).json({ error: "Invalid email" });
}

// Use parameterized queries for database
const user = await User.findOne({ email: req.body.email }); // Prisma auto-parameterizes
// NOT: `SELECT * FROM users WHERE email = '${req.body.email}'`
```

### 6. Secrets Management

```bash
# .env file (NEVER commit to git)
DATABASE_URL=postgresql://user:pass@localhost/db
API_KEY=sk_live_xxx
JWT_SECRET=your_secret_key

# .gitignore
.env
.env.local
*.pem
secrets/
```

### 7. Dependency Security

```bash
# Run in CI/CD pipeline
npm audit --production
snyk test --prod

# Monitor regularly
npm audit fix
```

### 8. Logging (No Sensitive Data!)

```javascript
function logSecurityEvent(eventType, userId, severity = "info") {
  const log = {
    timestamp: new Date().toISOString(),
    eventType, // FAILED_LOGIN, UNAUTHORIZED_ACCESS, etc.
    userId, // User ID (not email or password!)
    severity, // 'info', 'warning', 'critical'
    ipAddress: req.ip,
  };
  securityLogger.log(log);
}
```

---

## OWASP Top 10 Prevention Quick Guide

| Vulnerability                 | Prevention                                                    |
| ----------------------------- | ------------------------------------------------------------- |
| **Broken Access Control**     | Validate permissions on every endpoint                        |
| **Cryptographic Failures**    | Use HTTPS, encrypt at rest (AES-256), hash passwords (Argon2) |
| **Injection**                 | Parameterized queries, input validation                       |
| **Insecure Design**           | Threat modeling, defense in depth                             |
| **Security Misconfiguration** | Remove defaults, keep updated, proper error handling          |
| **Vulnerable Components**     | `npm audit`, Snyk, Dependabot, keep dependencies updated      |
| **Auth Failures**             | Strong passwords, MFA, rate limiting, session management      |
| **Data Integrity**            | Use trusted sources, verify signatures, secure CI/CD          |
| **Logging Failures**          | Log security events, centralized logging, alerts              |
| **SSRF**                      | Validate URLs, block internal IP ranges, allowlists           |

---

## HTTP Security Headers Cheatsheet

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
Content-Security-Policy: default-src 'self'; script-src 'nonce-{random}'; frame-ancestors 'none'
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
Cache-Control: no-store, no-cache, must-revalidate
X-Content-Type-Options: nosniff
```

---

## Cookie Security Matrix

| Attribute         | Purpose              | When Required                            |
| ----------------- | -------------------- | ---------------------------------------- |
| `HttpOnly`        | Block XSS attacks    | Session cookies, always                  |
| `Secure`          | HTTPS only           | Production, always                       |
| `SameSite=Strict` | Block CSRF           | Session cookies, default                 |
| `SameSite=Lax`    | Balance security/UX  | Less critical cookies                    |
| `SameSite=None`   | Cross-site           | Only if needed + Secure                  |
| `__Host-` prefix  | Subdomain protection | Critical cookies                         |
| `path=/`          | Root only            | With `__Host-` prefix                    |
| `maxAge`          | Expiration           | 30min for sensitive, 1yr for remember-me |

**Most Secure Configuration**:

```
Set-Cookie: __Host-sessionId=xxx; path=/; Secure; HttpOnly; SameSite=Strict; maxAge=1800000
```

---

## Password Hashing Parameters

### Argon2id (Recommended)

```
Memory: 64 MB (65536 KiB)
Iterations: 3
Parallelism: 4
Salt: 16+ bytes (library handles)
Time: ~250-500ms per hash
```

### bcrypt (If needed)

```
Cost Factor: 12+
Salt: 16 bytes (auto-generated)
Time: ~250-500ms per hash
WARNING: Truncates passwords > 72 bytes
```

---

## MFA Strength Ranking

1. **FIDO/WebAuthn** (Phishing-resistant)
   - Biometrics, hardware keys, platform authenticators
   - Best option, requires compatible devices

2. **TOTP** (Time-based One-Time Password)
   - Google Authenticator, Authy, Microsoft Authenticator
   - Strong, device-based, time-synchronized

3. **Push Notifications**
   - App-based with number matching
   - Blocks bombardment attacks

4. **SMS** (Weakest - Avoid if possible)
   - Subject to SIM swapping, interception
   - US government stopped using in 2016

---

## CSRF Token Implementation

**For Forms (Traditional)**:

```html
<form method="POST">
  <input type="hidden" name="csrfToken" value="<server-generated>">
</form>
```

**For APIs (Modern)**:

```javascript
// Cookie + Header method
headers: {
  'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content
}
```

**Token Generation**:

```javascript
crypto.randomBytes(32).toString("hex"); // 256-bit entropy
```

---

## SQL Injection Prevention

**WRONG** (DO NOT USE):

```javascript
const query = `SELECT * FROM users WHERE id = ${req.params.id}`;
```

**RIGHT** (Use Parameterized Queries):

```javascript
// With Prisma (ORM - auto-parameterized)
const user = await prisma.user.findUnique({
  where: { id: parseInt(req.params.id) },
});

// With MySQL2 (parameterized)
const [rows] = await connection.execute("SELECT * FROM users WHERE id = ?", [
  req.params.id,
]);

// With Sequelize (parameterized)
const user = await User.findByPk(req.params.id);
```

---

## XSS Prevention Layers

**Layer 1: Output Encoding** (Required)

```javascript
// HTML context
const safe = htmlEncode(userInput);

// React auto-encodes
<div>{userInput}</div>; // Safe by default
```

**Layer 2: Input Validation** (Required)

```javascript
// Allowlist safe patterns
if (!/^[a-zA-Z0-9_-]{3,20}$/.test(username)) {
  reject("Invalid format");
}
```

**Layer 3: CSP with Nonce** (Highly recommended)

```javascript
res.setHeader("Content-Security-Policy", `script-src 'nonce-${nonce}'`);
// <script nonce="<%= nonce %>">safe inline script</script>
```

**Layer 4: Framework Auto-Escape** (React, Vue, Angular)

- Modern frameworks escape by default
- Still need to apply other layers

---

## Dependency Vulnerability Workflow

```bash
# Local development
npm audit                          # Identify issues
npm audit fix                      # Auto-fix if safe
npm audit fix --force             # Force fix (may break)

# CI/CD Pipeline
npm audit --production            # Production deps only
snyk test --prod                  # Advanced scanning
npx audit-ci --moderate          # Fail on moderate+ vulnerabilities

# GitHub Integration
# Enable Dependabot alerts in Settings
# Enable Dependabot security updates (auto PRs)
# Review and merge security PRs promptly
```

---

## Logging Checklist

Log these events (WITHOUT sensitive data):

- ✓ Failed login attempts (count, user ID, IP)
- ✓ Successful login (user ID, IP, timestamp)
- ✓ MFA setup/change
- ✓ Password change
- ✓ Permission changes
- ✓ Sensitive operations (data export, delete, transfer)
- ✓ Admin actions
- ✓ API key created/revoked
- ✓ Suspicious patterns (multiple failures, unusual IPs)

DO NOT log:

- ✗ Passwords (plain text or hashed)
- ✗ API keys, tokens, secrets
- ✗ Full credit card numbers
- ✗ SSNs or other sensitive PII
- ✗ Encryption keys

---

## HTTPS/TLS Checklist

- ✓ Enforce HTTPS for all traffic
- ✓ Use TLS 1.2 minimum (1.3 preferred)
- ✓ Strong cipher suites only
- ✓ HSTS header with max-age=31536000
- ✓ Certificate auto-renewal configured
- ✓ No mixed content (HTTP resources on HTTPS page)
- ✓ Valid certificate for domain
- ✓ Certificate chain complete

---

## Environment Setup Template

```javascript
// config.js - Load and validate environment variables
const requiredEnvVars = [
  "NODE_ENV",
  "DATABASE_URL",
  "API_KEY",
  "JWT_SECRET",
  "SESSION_SECRET",
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

export const config = {
  nodeEnv: process.env.NODE_ENV,
  databaseUrl: process.env.DATABASE_URL,
  apiKey: process.env.API_KEY,
  jwtSecret: process.env.JWT_SECRET,
  sessionSecret: process.env.SESSION_SECRET,
  port: process.env.PORT || 3000,
  isProduction: process.env.NODE_ENV === "production",
  isDevelopment: process.env.NODE_ENV === "development",
};

// Fail fast on startup if config invalid
if (config.isProduction && config.apiKey === "dev-key") {
  throw new Error("Production cannot use development API key");
}
```

---

## Testing Security (Essential)

```javascript
// Test CSRF protection
describe("CSRF Protection", () => {
  test("should reject requests without valid CSRF token", async () => {
    const res = await request(app)
      .post("/api/action")
      .send({ data: "value" })
      .expect(403);
  });

  test("should accept requests with valid CSRF token", async () => {
    const token = generateCSRFToken();
    const res = await request(app)
      .post("/api/action")
      .send({ csrfToken: token, data: "value" })
      .expect(200);
  });
});

// Test SQL injection protection
describe("SQL Injection Prevention", () => {
  test("should safely handle SQL injection attempt", async () => {
    const userId = "1 OR 1=1";
    const user = await User.findById(userId);
    expect(user).toBeNull();
  });
});

// Test XSS protection
describe("XSS Prevention", () => {
  test("should escape HTML in output", async () => {
    const html = await renderUserProfile({
      name: '<script>alert("XSS")</script>',
    });
    expect(html).not.toContain("<script>");
  });
});
```

---

## Further Reading

- **Full Documentation**: [web-security.md](./web-security.md)
- **OWASP**: https://owasp.org/www-project-top-ten/
- **MDN Web Security**: https://developer.mozilla.org/en-US/docs/Web/Security
- **Web.dev Security**: https://web.dev/secure/

---

**Version**: 1.0 **Updated**: December 2024 **Status**: Ready for Use
