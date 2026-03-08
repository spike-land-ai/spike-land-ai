# API Migration Guides

This directory contains step-by-step migration guides for API version changes.

## Overview

When breaking changes are made to the Spike Land API, migration guides are
provided to help developers update their integrations smoothly.

## Current Migrations

| From         | To         | Status      | Guide |
| ------------ | ---------- | ----------- | ----- |
| (Unreleased) | (None yet) | Not Started | N/A   |

## Migration Guide Template

New migration guides should follow the template in `MIGRATION_TEMPLATE.md`.

### Creating a New Migration Guide

1. Copy `MIGRATION_TEMPLATE.md` to `v[OLD]-to-v[NEW].md`
2. Replace all `[PLACEHOLDERS]` with actual information
3. Document each breaking change with:
   - Before/after examples
   - Code migration examples
   - Common issues and solutions
4. Include comprehensive checklists
5. Publish guide on GitHub when API changes announced

## Migration Process Overview

```
Announcement
    ↓
(3+ months)
    ↓
v[NEW] Released (alongside v[OLD])
    ↓
Migration Window (6 months)
    ├─ Developers read migration guide
    ├─ Test against v[NEW]
    ├─ Deploy updated code
    ├─ Monitor for issues
    ├─ Get support if needed
    ↓
v[OLD] Sunset (removed)
    ↓
Complete!
```

## Related Documentation

- **Versioning Strategy**: `docs/API_VERSIONING.md`
- **API Changelog**: `docs/API_CHANGELOG.md`
- **API Reference**: `docs/architecture/API_REFERENCE.md`
- **Error Handling**: `docs/architecture/API_REFERENCE.md#error-handling`

## Support During Migration

### Self-Service

- Read the migration guide thoroughly
- Check "Common Issues" section for your problem
- Review code examples provided
- Test in staging before production

### Community Help

- **GitHub Discussions**: Ask questions, share solutions
- **Stack Overflow**: Tag with `spike-land`
- **GitHub Issues**: Report bugs or guide improvements

### Official Support

- **Email**: zoltan.erdos@spike.land
- **Response time**: 24 hours (business days)
- **Include**: API calls, error messages, reproduction steps

## Best Practices for Migrating

1. **Read First** - Understand all changes before coding
2. **Test Early** - Test against v[NEW] in development immediately
3. **Stage First** - Deploy to staging environment before production
4. **Monitor** - Watch logs for errors during and after deployment
5. **Rollback Ready** - Have a rollback plan in place
6. **Reach Out** - Don't hesitate to ask for help

## Timeline Expectations

- **Discovery**: 1-2 days (reading and planning)
- **Development**: 3-5 days (coding and testing)
- **Staging**: 1-2 days (verification)
- **Production**: 1 day (deployment and monitoring)

**Total**: 1-2 weeks for average integration

## Document History

| Date     | Changes                                   |
| -------- | ----------------------------------------- |
| Dec 2025 | Created migrations directory and template |
