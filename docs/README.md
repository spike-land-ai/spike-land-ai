# Spike Land Documentation

Welcome to the Spike Land documentation. This is the central index for all
platform documentation.

**Website**: [spike.land](https://spike.land)

---

## Quick Navigation

### For Users

| I want to...              | Document                                                                   |
| ------------------------- | -------------------------------------------------------------------------- |
| Understand the platform   | [features/FEATURES.md](./features/FEATURES.md)                             |
| Learn about subscriptions | [features/SUBSCRIPTION_TIERS.md](./features/SUBSCRIPTION_TIERS.md)         |
| Get credits               | [architecture/TOKEN_SYSTEM.md](./architecture/TOKEN_SYSTEM.md)             |
| Use voucher codes         | [features/VOUCHER_SYSTEM_UPDATED.md](./features/VOUCHER_SYSTEM_UPDATED.md) |

### For Developers

| I want to...              | Document                                                             |
| ------------------------- | -------------------------------------------------------------------- |
| Onboard to the monorepo   | [guides/MONOREPO_ONBOARDING.md](./guides/MONOREPO_ONBOARDING.md)     |
| Understand the edge stack | [architecture/EDGE_STACK.md](./architecture/EDGE_STACK.md)           |
| Integrate with the API    | [architecture/API_REFERENCE.md](./architecture/API_REFERENCE.md)     |
| View API changelog        | [API_CHANGELOG.md](./API_CHANGELOG.md)                               |
| Set up D1 + Drizzle       | [guides/D1_QUICK_START.md](./guides/D1_QUICK_START.md)               |
| Develop CF Workers locally| [guides/CF_WORKERS_DEV.md](./guides/CF_WORKERS_DEV.md)               |
| Understand block-sdk      | [architecture/BLOCK_SDK_FINDINGS.md](./architecture/BLOCK_SDK_FINDINGS.md) |
| Understand testing        | [guides/TESTING_STRATEGY.md](./guides/TESTING_STRATEGY.md)           |
| Run E2E tests             | [E2E_TEST_IMPLEMENTATION.md](./E2E_TEST_IMPLEMENTATION.md)           |
| Automate E2E setup        | [guides/AUTOMATED_SETUP.md](./guides/AUTOMATED_SETUP.md)             |
| Manage dependencies       | [guides/DEPENDENCY_MANAGEMENT.md](./guides/DEPENDENCY_MANAGEMENT.md) |
| Use spike-cli             | `npx @spike-land-ai/spike-cli` (external package)                    |

### For Project Setup

| I want to...               | Document                                                         |
| -------------------------- | ---------------------------------------------------------------- |
| Set up development         | [../README.md](../README.md)                                     |
| Configure secrets/env vars | [guides/SECRETS_SETUP.md](./guides/SECRETS_SETUP.md)             |
| Rotate credentials         | [guides/CREDENTIAL_ROTATION.md](./guides/CREDENTIAL_ROTATION.md) |
| Understand CI/CD           | [../README.md](../README.md#cicd-pipeline)                       |
| Debug CI/CD failures       | [guides/CI_CD_DEBUGGING.md](./guides/CI_CD_DEBUGGING.md)         |
| Review business structure  | [business/BUSINESS_STRUCTURE.md](./business/BUSINESS_STRUCTURE.md)|
| Review CEO decisions       | [CEO_DECISIONS.md](./CEO_DECISIONS.md)                           |

---

## Documentation Structure

```
docs/
├── README.md                         # This index file
├── ROADMAP.md                        # Future development plans
├── TECH_DEBT.md                      # Tech debt tracking
├── deployment-inventory.md           # All services and deployment info
├── architecture/                     # System architecture docs
│   ├── EDGE_STACK.md                 # 8 Cloudflare Workers architecture
│   ├── BLOCK_SDK_FINDINGS.md         # block-sdk technical assessment
│   ├── API_REFERENCE.md              # Complete API documentation
│   ├── MY_APPS_ARCHITECTURE.md       # My-Apps feature architecture
│   ├── TOKEN_SYSTEM.md               # Platform credit system
│   ├── JSON_SCHEMAS.md               # JSON schema definitions
│   └── DEPENDENCY_RESOLUTIONS.md     # Dependency resolution notes
├── features/                         # Feature documentation
│   ├── FEATURES.md                   # Platform features & roadmap
│   ├── SUBSCRIPTION_TIERS.md         # Subscription tier details
│   └── VOUCHER_SYSTEM_UPDATED.md     # Voucher codes and redemption
├── guides/                           # How-to guides
│   ├── MONOREPO_ONBOARDING.md        # New developer onboarding (29 packages)
│   ├── CF_WORKERS_DEV.md             # Cloudflare Workers local development
│   ├── D1_QUICK_START.md             # D1 + Drizzle quick start
│   ├── SECRETS_SETUP.md              # Secrets & environment variables
│   ├── CREDENTIAL_ROTATION.md        # Credential rotation procedures
│   ├── TESTING_STRATEGY.md           # Comprehensive testing guide
│   ├── AUTOMATED_SETUP.md            # E2E authentication bypass setup
│   ├── DEPENDENCY_MANAGEMENT.md      # Dependency management guide
│   ├── CI_CD_DEBUGGING.md            # CI/CD troubleshooting guide
│   └── ...                           # Additional guides
├── integrations/                     # Third-party integrations
│   └── CAMPAIGN_TRACKING_INTEGRATION.md # Campaign analytics
├── business/                         # Business documentation
│   ├── BUSINESS_STRUCTURE.md         # Company information
│   ├── LAUNCH_CHECKLIST.md           # Pre-launch checklist
│   ├── LAUNCH_PLAN.md                # Launch strategy
│   └── ...                           # Additional business docs
├── security/                         # Security documentation
│   ├── SECURITY_AUDIT_REPORT.md      # Security audit
│   └── SECURITY_HARDENING.md         # Security hardening (CSP)
├── best-practices/                   # Development best practices
├── api/                              # OpenAPI specs & examples
├── testing/                          # Testing documentation
└── archive/                          # Historical documentation (AWS, Prisma, etc.)
```

---

## Core Documentation

### Platform

| Document                                                           | Description                                       |
| ------------------------------------------------------------------ | ------------------------------------------------- |
| [features/FEATURES.md](./features/FEATURES.md)                     | Platform vision, MCP-first strategy, feature list |
| [business/ZOLTAN_ERDOS.md](./business/ZOLTAN_ERDOS.md)             | Founder profile, background, and vision           |
| [business/BUSINESS_STRUCTURE.md](./business/BUSINESS_STRUCTURE.md) | Company information and legal structure           |
| [CEO_DECISIONS.md](./CEO_DECISIONS.md)                             | Strategic decisions and technology choices        |
| [ROADMAP.md](./ROADMAP.md)                                         | Future development plans                          |

### Architecture

| Document                                                                       | Description                                |
| ------------------------------------------------------------------------------ | ------------------------------------------ |
| [architecture/EDGE_STACK.md](./architecture/EDGE_STACK.md)                     | 8 Cloudflare Workers — service map & bindings |
| [architecture/BLOCK_SDK_FINDINGS.md](./architecture/BLOCK_SDK_FINDINGS.md)     | block-sdk honest technical assessment      |
| [architecture/API_REFERENCE.md](./architecture/API_REFERENCE.md)               | Complete API documentation with examples   |
| [deployment-inventory.md](./deployment-inventory.md)                           | All services, D1 databases, R2 buckets     |

### API & Integration

| Document                                                         | Description                                   |
| ---------------------------------------------------------------- | --------------------------------------------- |
| [API_CHANGELOG.md](./API_CHANGELOG.md)                           | API version history and breaking changes      |
| [API_VERSIONING.md](./API_VERSIONING.md)                         | Versioning strategy and deprecation policies  |
| [api/](./api/)                                                   | OpenAPI specifications and integration guides |
| [api/00_START_HERE.md](./api/00_START_HERE.md)                   | API getting started guide                     |

### Platform Credits

| Document                                                                   | Description                                |
| -------------------------------------------------------------------------- | ------------------------------------------ |
| [architecture/TOKEN_SYSTEM.md](./architecture/TOKEN_SYSTEM.md)             | Credit acquisition, pricing, subscriptions |
| [features/VOUCHER_SYSTEM_UPDATED.md](./features/VOUCHER_SYSTEM_UPDATED.md) | Voucher codes and redemption               |

### Testing & CI/CD

| Document                                                           | Description                          |
| ------------------------------------------------------------------ | ------------------------------------ |
| [guides/TESTING_STRATEGY.md](./guides/TESTING_STRATEGY.md)         | Comprehensive testing infrastructure |
| [E2E_TEST_IMPLEMENTATION.md](./E2E_TEST_IMPLEMENTATION.md)         | E2E testing setup                    |
| [guides/AUTOMATED_SETUP.md](./guides/AUTOMATED_SETUP.md)           | E2E authentication bypass setup      |
| [guides/MANUAL_TESTING_GUIDE.md](./guides/MANUAL_TESTING_GUIDE.md) | Manual testing procedures            |
| [guides/CI_CD_DEBUGGING.md](./guides/CI_CD_DEBUGGING.md)           | CI/CD troubleshooting guide          |
| [testing/](./testing/)                                             | Testing documentation                |

### Security & Operations

| Document                                                                 | Description                            |
| ------------------------------------------------------------------------ | -------------------------------------- |
| [guides/SECRETS_SETUP.md](./guides/SECRETS_SETUP.md)                     | Secrets & environment variables (SSOT) |
| [guides/CREDENTIAL_ROTATION.md](./guides/CREDENTIAL_ROTATION.md)         | Credential rotation procedures         |
| [security/SECURITY_AUDIT_REPORT.md](./security/SECURITY_AUDIT_REPORT.md) | Security practices and audit           |
| [security/SECURITY_HARDENING.md](./security/SECURITY_HARDENING.md)       | Security hardening measures (CSP)      |
| [guides/ERROR_LOG_AUDIT_GUIDE.md](./guides/ERROR_LOG_AUDIT_GUIDE.md)     | Error log auditing procedures          |

### Development Tools & Utilities

| Document                                                             | Description                         |
| -------------------------------------------------------------------- | ----------------------------------- |
| [guides/DEPENDENCY_MANAGEMENT.md](./guides/DEPENDENCY_MANAGEMENT.md) | Adding, removing, auditing packages |

---

## Best Practices

See [best-practices/](./best-practices/) for development guidelines and quick
reference guides.

### Core Development

| Document                                                        | Description                         |
| --------------------------------------------------------------- | ----------------------------------- |
| [typescript.md](./best-practices/typescript.md)                 | TypeScript guidelines               |
| [react-patterns.md](./best-practices/react-patterns.md)         | React best practices                |
| [testing-strategies.md](./best-practices/testing-strategies.md) | Testing approaches                  |
| [cloudflare-services.md](./best-practices/cloudflare-services.md) | Cloudflare Workers patterns       |

### MCP Development

| Document                                                                | Description                  |
| ----------------------------------------------------------------------- | ---------------------------- |
| [mcp-server-development.md](./best-practices/mcp-server-development.md) | MCP server development guide |
| [MCP_DEVELOPMENT_INDEX.md](./best-practices/MCP_DEVELOPMENT_INDEX.md)   | MCP development index        |
| [MCP_QUICK_REFERENCE.md](./best-practices/MCP_QUICK_REFERENCE.md)       | MCP quick reference guide    |

---

## API Migration Guides

See [migrations/](./migrations/) for API version migration guides.

---

## Archive

Historical documentation is stored in [archive/](./archive/). This includes
outdated AWS, Prisma, PostgreSQL, and Next.js-specific docs that were superseded
by the Cloudflare Workers migration (March 2026).

See [archive/README.md](./archive/README.md) for detailed archive inventory.

---

## Contributing to Documentation

1. **Single source of truth**: Don't duplicate content across files
2. **Link, don't copy**: Reference other docs instead of copying
3. **Keep files focused**: One topic per document
4. **Update the index**: Add new docs to this README
5. **Archive old docs**: Move outdated content to `archive/`
6. **Follow structure**: Place docs in appropriate subdirectories

---

**Last Updated**: 2026-03-04
