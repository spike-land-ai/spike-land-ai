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
| Get credits               | [develop/TOKEN_SYSTEM.md](./develop/TOKEN_SYSTEM.md)                       |
| Use voucher codes         | [features/VOUCHER_SYSTEM_UPDATED.md](./features/VOUCHER_SYSTEM_UPDATED.md) |

### For Developers

| I want to...              | Document                                                             |
| ------------------------- | -------------------------------------------------------------------- |
| Onboard to the monorepo   | [develop/ONBOARDING.md](./develop/ONBOARDING.md)                     |
| Understand the edge stack | [develop/EDGE_STACK.md](./develop/EDGE_STACK.md)                     |
| Integrate with the API    | [api/API_REFERENCE.md](./api/API_REFERENCE.md)                       |
| View API changelog        | [api/API_CHANGELOG.md](./api/API_CHANGELOG.md)                      |
| Set up D1 + Drizzle       | [develop/D1_QUICK_START.md](./develop/D1_QUICK_START.md)             |
| D1 migration guide        | [develop/D1_MIGRATION_GUIDE.md](./develop/D1_MIGRATION_GUIDE.md)    |
| Develop CF Workers locally| [develop/CF_WORKERS_DEV.md](./develop/CF_WORKERS_DEV.md)             |
| Understand block-sdk      | [develop/BLOCK_SDK_FINDINGS.md](./develop/BLOCK_SDK_FINDINGS.md)     |
| Understand testing        | [develop/TESTING_STRATEGY.md](./develop/TESTING_STRATEGY.md)         |
| Automate E2E setup        | [develop/AUTOMATED_SETUP.md](./develop/AUTOMATED_SETUP.md)           |
| Manage dependencies       | [develop/DEPENDENCY_MANAGEMENT.md](./develop/DEPENDENCY_MANAGEMENT.md) |
| Build MCP servers         | [mcp/SERVER_DEVELOPMENT.md](./mcp/SERVER_DEVELOPMENT.md)             |
| Use spike-cli             | `claude mcp add spike-land --transport http https://spike.land/mcp` or `npx @spike-land-ai/spike-cli shell` |

### For Project Setup

| I want to...               | Document                                                             |
| -------------------------- | -------------------------------------------------------------------- |
| Set up development         | [../README.md](../README.md)                                         |
| Configure secrets/env vars | [develop/SECRETS_SETUP.md](./develop/SECRETS_SETUP.md)               |
| Rotate credentials         | [develop/CREDENTIAL_ROTATION.md](./develop/CREDENTIAL_ROTATION.md)   |
| Understand CI/CD           | [../README.md](../README.md#cicd-pipeline)                           |
| Debug CI/CD failures       | [develop/CI_CD_DEBUGGING.md](./develop/CI_CD_DEBUGGING.md)           |
| Review business structure  | [business/BUSINESS_STRUCTURE.md](./business/BUSINESS_STRUCTURE.md)   |
| Review CEO decisions       | [business/CEO_DECISIONS.md](./business/CEO_DECISIONS.md)             |

---

## Documentation Structure

```
docs/
├── README.md                           # This index file
├── develop/                            # Developer guides
│   ├── ONBOARDING.md                   # New developer onboarding (28 packages)
│   ├── EDGE_STACK.md                   # Cloudflare Workers architecture
│   ├── CF_WORKERS_DEV.md               # CF Workers local development
│   ├── D1_QUICK_START.md               # D1 + Drizzle quick start
│   ├── D1_MIGRATION_GUIDE.md           # D1 migration guide
│   ├── DEPLOYMENT_INVENTORY.md         # All services and deployment info
│   ├── DEPENDENCY_MANAGEMENT.md        # Dependency management guide
│   ├── DEPENDENCY_RESOLUTIONS.md       # Dependency resolution notes
│   ├── CI_CD_DEBUGGING.md              # CI/CD troubleshooting guide
│   ├── SECRETS_SETUP.md                # Secrets & environment variables
│   ├── CREDENTIAL_ROTATION.md          # Credential rotation procedures
│   ├── TESTING_STRATEGY.md             # Comprehensive testing guide
│   ├── AUTOMATED_SETUP.md              # E2E authentication bypass setup
│   ├── ERROR_LOG_AUDIT_GUIDE.md        # Error log auditing procedures
│   ├── TOKEN_SYSTEM.md                 # Platform credit system
│   ├── BLOCK_SDK_FINDINGS.md           # block-sdk technical assessment
│   └── JSON_SCHEMAS.md                 # JSON schema definitions
├── api/                                # API documentation
│   ├── 00_START_HERE.md                # API getting started guide
│   ├── API_REFERENCE.md                # Complete API documentation
│   ├── API_CHANGELOG.md                # API version history
│   ├── API_VERSIONING.md               # Versioning strategy
│   ├── ALBUMS_BATCH_ENHANCE.md         # Album batch enhancement API
│   ├── PUBLIC_ALBUMS_GALLERY.md        # Public albums gallery API
│   ├── CAMPAIGN_TRACKING.md            # Campaign analytics integration
│   ├── openapi.yaml                    # OpenAPI specification
│   └── ...                             # Additional API docs
├── mcp/                                # MCP ecosystem
│   ├── TOOL_GUIDELINES.md              # MCP tool design guidelines
│   ├── SERVER_DEVELOPMENT.md           # MCP server development guide
│   ├── DEVELOPMENT_INDEX.md            # MCP development index
│   ├── QUICK_REFERENCE.md              # MCP quick reference
│   ├── TOOL_SYSTEM_ANALYSIS.md         # MCP tool system analysis
│   └── SPIKE_CLI_LANDSCAPE.md          # spike-cli competitive landscape
├── best-practices/                     # Development best practices
│   ├── typescript.md                   # TypeScript guidelines
│   ├── react-patterns.md               # React best practices
│   ├── cloudflare-services.md          # Cloudflare Workers patterns
│   └── ...                             # Additional best practices
├── security/                           # Security documentation
│   ├── SECURITY_AUDIT_REPORT.md        # Security audit
│   ├── SECURITY_HARDENING.md           # Security hardening (CSP)
│   ├── SECURITY_INDEX.md               # Security documentation index
│   ├── SECURITY_QUICK_REFERENCE.md     # Security quick reference
│   └── SPIKE_EDGE_AUDIT.md             # spike-edge security audit
├── business/                           # Business documentation
│   ├── BUSINESS_STRUCTURE.md           # Company information
│   ├── CEO_DECISIONS.md                # Strategic decisions
│   ├── ROADMAP.md                      # Future development plans
│   ├── LAUNCH_CHECKLIST.md             # Pre-launch checklist
│   └── ...                             # Additional business docs
├── operations/                         # Operations & metrics
│   ├── GROWTH_METRICS.md               # Analytics & growth measurement
│   └── TECH_DEBT.md                    # Tech debt registry
├── features/                           # Feature documentation
├── database/                           # Database documentation
├── migrations/                         # API migration guides
├── testing/                            # Testing documentation
└── archive/                            # Historical documentation
```

---

## Core Documentation

### Platform

| Document                                                           | Description                                       |
| ------------------------------------------------------------------ | ------------------------------------------------- |
| [features/FEATURES.md](./features/FEATURES.md)                     | Platform vision, MCP-first strategy, feature list |
| [business/ZOLTAN_ERDOS.md](./business/ZOLTAN_ERDOS.md)             | Founder profile, background, and vision           |
| [business/BUSINESS_STRUCTURE.md](./business/BUSINESS_STRUCTURE.md) | Company information and legal structure           |
| [business/CEO_DECISIONS.md](./business/CEO_DECISIONS.md)           | Strategic decisions and technology choices        |
| [business/ROADMAP.md](./business/ROADMAP.md)                       | Future development plans                          |

### Architecture

| Document                                                                   | Description                                   |
| -------------------------------------------------------------------------- | --------------------------------------------- |
| [develop/EDGE_STACK.md](./develop/EDGE_STACK.md)                           | Cloudflare Workers — service map & bindings   |
| [develop/BLOCK_SDK_FINDINGS.md](./develop/BLOCK_SDK_FINDINGS.md)           | block-sdk honest technical assessment         |
| [api/API_REFERENCE.md](./api/API_REFERENCE.md)                             | Complete API documentation with examples      |
| [develop/DEPLOYMENT_INVENTORY.md](./develop/DEPLOYMENT_INVENTORY.md)       | All services, D1 databases, R2 buckets        |

### API & Integration

| Document                                                     | Description                                   |
| ------------------------------------------------------------ | --------------------------------------------- |
| [api/API_CHANGELOG.md](./api/API_CHANGELOG.md)               | API version history and breaking changes      |
| [api/API_VERSIONING.md](./api/API_VERSIONING.md)             | Versioning strategy and deprecation policies  |
| [api/](./api/)                                               | OpenAPI specifications and integration guides |
| [api/00_START_HERE.md](./api/00_START_HERE.md)               | API getting started guide                     |

### Platform Credits

| Document                                                                   | Description                                |
| -------------------------------------------------------------------------- | ------------------------------------------ |
| [develop/TOKEN_SYSTEM.md](./develop/TOKEN_SYSTEM.md)                       | Credit acquisition, pricing, subscriptions |
| [features/VOUCHER_SYSTEM_UPDATED.md](./features/VOUCHER_SYSTEM_UPDATED.md) | Voucher codes and redemption               |

### Testing & CI/CD

| Document                                                                 | Description                          |
| ------------------------------------------------------------------------ | ------------------------------------ |
| [develop/TESTING_STRATEGY.md](./develop/TESTING_STRATEGY.md)             | Comprehensive testing infrastructure |
| [develop/AUTOMATED_SETUP.md](./develop/AUTOMATED_SETUP.md)               | E2E authentication bypass setup      |
| [develop/CI_CD_DEBUGGING.md](./develop/CI_CD_DEBUGGING.md)               | CI/CD troubleshooting guide          |
| [testing/](./testing/)                                                   | Testing documentation                |

### Security & Operations

| Document                                                                 | Description                            |
| ------------------------------------------------------------------------ | -------------------------------------- |
| [develop/SECRETS_SETUP.md](./develop/SECRETS_SETUP.md)                   | Secrets & environment variables (SSOT) |
| [develop/CREDENTIAL_ROTATION.md](./develop/CREDENTIAL_ROTATION.md)       | Credential rotation procedures         |
| [security/SECURITY_AUDIT_REPORT.md](./security/SECURITY_AUDIT_REPORT.md) | Security practices and audit           |
| [security/SECURITY_HARDENING.md](./security/SECURITY_HARDENING.md)       | Security hardening measures (CSP)      |
| [security/SPIKE_EDGE_AUDIT.md](./security/SPIKE_EDGE_AUDIT.md)           | spike-edge security audit              |
| [develop/ERROR_LOG_AUDIT_GUIDE.md](./develop/ERROR_LOG_AUDIT_GUIDE.md)   | Error log auditing procedures          |
| [operations/GROWTH_METRICS.md](./operations/GROWTH_METRICS.md)           | Analytics & growth measurement         |
| [operations/TECH_DEBT.md](./operations/TECH_DEBT.md)                     | Tech debt registry                     |

### Development Tools & Utilities

| Document                                                                     | Description                         |
| ---------------------------------------------------------------------------- | ----------------------------------- |
| [develop/DEPENDENCY_MANAGEMENT.md](./develop/DEPENDENCY_MANAGEMENT.md)       | Adding, removing, auditing packages |

---

## Best Practices

See [best-practices/](./best-practices/) for development guidelines.

### Core Development

| Document                                                          | Description               |
| ----------------------------------------------------------------- | ------------------------- |
| [best-practices/typescript.md](./best-practices/typescript.md)     | TypeScript guidelines     |
| [best-practices/react-patterns.md](./best-practices/react-patterns.md) | React best practices |
| [best-practices/testing-strategies.md](./best-practices/testing-strategies.md) | Testing approaches |
| [best-practices/cloudflare-services.md](./best-practices/cloudflare-services.md) | CF Workers patterns |

### MCP Development

| Document                                                   | Description                  |
| ---------------------------------------------------------- | ---------------------------- |
| [mcp/SERVER_DEVELOPMENT.md](./mcp/SERVER_DEVELOPMENT.md)   | MCP server development guide |
| [mcp/DEVELOPMENT_INDEX.md](./mcp/DEVELOPMENT_INDEX.md)     | MCP development index        |
| [mcp/QUICK_REFERENCE.md](./mcp/QUICK_REFERENCE.md)         | MCP quick reference guide    |
| [mcp/TOOL_GUIDELINES.md](./mcp/TOOL_GUIDELINES.md)         | MCP tool design guidelines   |

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

**Last Updated**: 2026-03-05
