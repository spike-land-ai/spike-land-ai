# Better Auth Best Practices

## Overview

Guidelines for implementing authentication using Better Auth patterns with
NextAuth.js.

## Key Principles

- Use server-side session validation (never trust client-only auth)
- Implement CSRF protection on all mutation endpoints
- Store sessions server-side with secure, httpOnly cookies
- Use short-lived access tokens with refresh token rotation
- Implement rate limiting on auth endpoints

## Patterns

### Session Management

- Validate sessions on every server request via middleware
- Use `getServerSession()` in Server Components
- Use `useSession()` hook only in Client Components
- Implement proper session cleanup on logout

### OAuth Providers

- Always verify email from OAuth providers
- Handle account linking carefully (prevent account takeover)
- Store provider tokens encrypted at rest

### API Protection

- Use middleware for route protection patterns
- Implement role-based access control (RBAC) via session claims
- Validate permissions server-side, never client-only

### Security Checklist

- [ ] CSRF tokens on all forms
- [ ] Rate limiting on login/register endpoints
- [ ] Account lockout after failed attempts
- [ ] Secure password hashing (bcrypt/argon2)
- [ ] Email verification before account activation
- [ ] Audit logging for auth events
