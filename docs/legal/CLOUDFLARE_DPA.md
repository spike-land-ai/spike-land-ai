# Cloudflare Data Processing Addendum (DPA)

## Overview

SPIKE LAND LTD processes user data through Cloudflare infrastructure. Under GDPR (and UK GDPR), Cloudflare acts as a **data processor** on behalf of SPIKE LAND LTD (the **data controller**). A Data Processing Addendum (DPA) must be in place to ensure GDPR-compliant data handling.

## Cloudflare's Standard DPA

**Version**: v6.3 (effective June 20, 2025)

**DPA document**: https://www.cloudflare.com/cloudflare-customer-dpa/

The DPA covers:
- EU GDPR, UK GDPR, Swiss FADP
- CCPA and US state privacy laws
- Standard Contractual Clauses (SCCs) for international data transfers
- Technical and organisational security measures (Annex 2)
- Sub-processor obligations and notification procedures
- Data subject rights facilitation
- Data breach notification (without undue delay)

## Services Covered

The following Cloudflare services are used by SPIKE LAND LTD and covered under the DPA:

| Service | Usage | Data Processed |
|---------|-------|----------------|
| **Workers** | Edge compute (spike-edge, spike-land-backend, transpile, spike-land-mcp, mcp-auth) | Request metadata, application data |
| **D1** | SQL database (spike-land-mcp, mcp-auth) | User accounts, MCP tool registry, auth tokens |
| **KV** | Key-value storage | Session data, cached responses |
| **R2** | Object storage | User-uploaded files, build artefacts |
| **Durable Objects** | Stateful coordination (spike-land-backend) | Real-time sync state, WebSocket connections |
| **Pages** | Static site hosting | No personal data (static assets only) |

## DPA Acceptance

The DPA is **automatically incorporated by reference** into the Self-Serve Subscription Agreement. Per Cloudflare's Trust Hub: "no action is required to ensure that the appropriate cross-border data transfer mechanisms are in place."

There is no separate acceptance button or signature flow for self-serve customers. The DPA is binding by virtue of using Cloudflare services under the Self-Serve Subscription Agreement.

**Verification**: https://www.cloudflare.com/trust-hub/gdpr/

### What to do for your records

1. Save a PDF copy of the DPA from https://www.cloudflare.com/cloudflare-customer-dpa/
2. Note the version (v6.3) and effective date (June 20, 2025)
3. Record that the DPA applies automatically via the Self-Serve Subscription Agreement

## Annex 1: Data Processing Description

### Data subjects
- **End Users** -- individuals accessing Customer's domains, networks, websites, and applications via Cloudflare
- **Administrators** -- Customer personnel accessing the Cloudflare dashboard

### Personal data categories
- **Customer Logs** -- IP addresses, Zero Trust user identity information, request/response metadata
- **Customer Content** -- files, data, and content transiting or stored on Cloudflare infrastructure
- **Admin audit logs** -- dashboard access and configuration changes

### Processing nature and duration
- **Nature**: Continuous automated processing for the purpose of providing Cloudflare services
- **Duration**: For the term of the Main Agreement (Self-Serve Subscription Agreement)
- **Retention**: Until expiry or termination of the Main Agreement

## Annex 2: Security Measures

Key technical and organisational measures from the DPA:

| Category | Measure |
|----------|---------|
| **Encryption at rest** | AES-XTS 128-bit or stronger |
| **Encryption in transit** | TLS |
| **Certifications** | ISO/IEC 27001, ISO/IEC 27701 |
| **Audit standards** | SOC 2 Type II, PCI DSS Level 1 |
| **Access control** | Zero-trust access model, physical hard token MFA |
| **Disaster recovery** | Geo-distributed data centres, redundant infrastructure |
| **Access log retention** | 12 months |

## Key DPA Terms

### Sub-processor management
- **Advance notice**: 30 days before engaging a new sub-processor
- **Objection window**: 10 business days to object to a new sub-processor
- **Sub-processor list**: https://www.cloudflare.com/gdpr/subprocessors/

### Data breach notification
- Notification **without undue delay** upon becoming aware of a breach involving Customer data

### Audit rights
- Annual third-party audit report provided to Customer
- One onsite audit per year if the third-party report is insufficient

### Data deletion
- On termination, Customer may choose: **delete** or **return** of Customer data

### Transparency commitments (Section 8.5)
- No backdoors in products or services
- No encryption key turnover to any government
- No law enforcement data feeds
- Challenges requests for Customer data that are overly broad or conflict with EU law

## International Transfer Mechanisms

From DPA Section 6, the following cross-border transfer mechanisms are in place:

| Mechanism | Coverage |
|-----------|----------|
| **EU SCCs** | Module Two (controller-to-processor), Module Three (processor-to-sub-processor) |
| **UK Addendum** | Addendum to EU SCCs for UK GDPR transfers |
| **Swiss FADP amendments** | Amendments to EU SCCs for Swiss data transfers |
| **Data Privacy Framework** | EU-US DPF, UK Extension to EU-US DPF, Swiss-US DPF |
| **Global CBPR** | Global Cross-Border Privacy Rules (Global PRP System) |

## Completion Checklist

- [x] DPA reviewed by director (Founder) -- 2026-03-07
- [x] DPA in effect -- auto-incorporated via Self-Serve Subscription Agreement (v6.3, June 20, 2025)
- [x] PDF copy of DPA saved to company records -- `docs/legal/Cloudflare_Customer_DPA_v6.3_June_20_2025.pdf`
- [x] Sub-processor list reviewed -- 2026-03-07
- [ ] Privacy policy updated to reference Cloudflare as processor

## Record Keeping

Store the accepted DPA copy in:
- Company records (digital filing)
- This repository: attach or reference the accepted version

Under GDPR Article 28, the controller must be able to demonstrate that appropriate data processing agreements are in place. Retain the DPA for the duration of the service relationship and for 6 years after termination.

## Contact

- **Cloudflare Privacy Team**: privacy@cloudflare.com
- **Cloudflare Trust Hub (GDPR)**: https://www.cloudflare.com/trust-hub/gdpr/
- **UK ICO** (supervisory authority): https://ico.org.uk
