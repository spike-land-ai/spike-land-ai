# Security Policy

## Supported Versions

Only the latest code on the `main` branch is actively supported with security updates.

## Reporting a Vulnerability

**Do not open a public issue for security vulnerabilities.**

Instead, use one of the following:

- **Email:** hello@spike.land
- **GitHub Security Advisory:** Open a private security advisory via the "Security" tab of this repository.

### What to Include

- Description of the vulnerability.
- Steps to reproduce.
- Impact assessment (what an attacker could achieve).
- Affected package(s) or component(s).

## Response Timeline

- **Acknowledgment:** Within 48 hours of report.
- **Initial assessment:** Within 5 business days.
- **Fix or mitigation:** Timeline communicated after assessment, depending on severity.

## Disclosure Policy

We follow coordinated disclosure with a 90-day window. After a fix is released, we will publicly document the vulnerability. If no fix is available within 90 days, reporters may disclose at their discretion.

## Scope

The following are in scope:

- All packages under `src/`.
- Cloudflare Workers infrastructure (spike-edge, spike-land-backend, spike-land-mcp, mcp-auth, transpile).
- Authentication and authorization flows.

## Out of Scope

- Social engineering attacks.
- Denial of service (DoS/DDoS).
- Third-party services and dependencies (report these to the upstream maintainer).
- Issues in development-only tooling with no production impact.
