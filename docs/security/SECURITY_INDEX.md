# Security Documentation Index

This index highlights the security docs that matter most for the spike.land app
store, shared MCP runtime, and edge platform.

---

## App Store Security

| Document | What it covers |
| --- | --- |
| [APP_STORE_SECURITY.md](./APP_STORE_SECURITY.md) | Store trust model, publication gates, sandbox boundaries, open-submission posture |
| [SPIKE_EDGE_AUDIT.md](./SPIKE_EDGE_AUDIT.md) | Edge security posture, headers, proxy and CORS review |
| [SECURITY_HARDENING.md](./SECURITY_HARDENING.md) | CSP and hardening controls |
| [SECURITY_QUICK_REFERENCE.md](./SECURITY_QUICK_REFERENCE.md) | Fast lookup for recurring implementation details |

---

## What Matters For The App Store

The app store has a different threat model from a normal web app because it is:

- open to external callers through MCP
- partially public through metadata endpoints
- intended for open submission and publishing
- backed by shared runtime infrastructure

That means the important control families are:

1. runtime access control
2. publication-state gates
3. sandbox boundaries
4. rate limiting and anomaly detection
5. secret and workspace isolation

Read [APP_STORE_SECURITY.md](./APP_STORE_SECURITY.md) first if your question is
specifically about store apps, cross-origin MCP access, or submission safety.
