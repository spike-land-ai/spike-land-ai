# Dependency Management Guide

This guide covers best practices for managing dependencies in the Spike Land
codebase, including adding/removing packages, dead code detection, security
auditing, and handling Dependabot updates.

---

## Overview

| Metric                   | Value                 |
| ------------------------ | --------------------- |
| Package Manager          | Yarn 4.12.0           |
| Production Dependencies  | 62                    |
| Development Dependencies | 33                    |
| Workspaces               | `src/*`               |
| Lock File                | `yarn.lock` (checked) |

---

## Adding Dependencies

### Before Adding a New Package

1. **Check if functionality already exists** in the codebase or current
   dependencies
2. **Evaluate the package**:
   - Check bundle size at [bundlephobia.com](https://bundlephobia.com)
   - Review maintenance status (last update, open issues)
   - Check for security vulnerabilities
   - Verify TypeScript support
3. **Consider alternatives**:
   - Can this be implemented with existing dependencies?
   - Is there a smaller alternative?
   - Is this a one-time use that doesn't justify a dependency?

### Installation Commands

```bash
# Production dependency
yarn add <package-name>

# Development dependency
yarn add -D <package-name>

# Specific version
yarn add <package-name>@<version>

# Multiple packages
yarn add <package1> <package2>
```

### Post-Installation Checklist

After adding a dependency:

- [ ] Run `yarn lint` - Ensure no linting errors
- [ ] Run `yarn build` - Verify the build still works
- [ ] Run `yarn test:coverage` - Confirm tests pass
- [ ] Run `yarn dead-code:deps` - Check for unused dependencies
- [ ] Update `knip.json` if the package is incorrectly flagged as unused

---

## Removing Dependencies

### Finding Unused Dependencies

```bash
# Check for unused dependencies
yarn dead-code:deps

# Search for package usage in source code
grep -r "from '<package-name>'" src/
grep -r "import.*<package-name>" src/
```

### Removal Commands

```bash
# Remove a dependency
yarn remove <package-name>

# Remove multiple packages
yarn remove <package1> <package2>
```

### Post-Removal Checklist

- [ ] Run `yarn build` - Verify build succeeds
- [ ] Run `yarn test:coverage` - Confirm tests pass
- [ ] Run `yarn dev` - Check development server works
- [ ] Check for runtime errors in browser console

---

## Dead Code Detection with Knip

This project uses [Knip](https://knip.dev/) for detecting unused files, exports,
and dependencies.

### Available Commands

| Command                  | Description                                  |
| ------------------------ | -------------------------------------------- |
| `yarn dead-code`         | Full analysis (files, exports, dependencies) |
| `yarn dead-code:files`   | Find unused files only                       |
| `yarn dead-code:exports` | Find unused exports only                     |
| `yarn dead-code:deps`    | Find unused dependencies only                |

### When to Run Dead Code Detection

- **Monthly maintenance**: Schedule regular cleanup sessions
- **Before major refactors**: Identify code to remove first
- **After removing features**: Clean up orphaned code
- **Before releases**: Reduce bundle size

### Handling False Positives

If Knip incorrectly flags something as unused, update `knip.json`:

```json
{
  "ignoreDependencies": [
    "@types/*",
    "package-name-to-ignore"
  ],
  "ignore": [
    "path/to/file-to-ignore.ts"
  ]
}
```

### Current Knip Configuration

The project's `knip.json` is configured to:

- **Entry points**: App Router pages, layouts, routes, and auth files
- **Ignored paths**: Test files, type definitions, e2e tests, scripts
- **Ignored dependencies**: Type packages, ESLint plugins

See `/knip.json` for the complete configuration.

---

## Security Auditing

### Automated Security Checks

Security audits run automatically in CI:

```bash
yarn npm audit --all --severity moderate
```

### Manual Security Audit

```bash
# Full audit
yarn npm audit --all

# Only critical/high severity
yarn npm audit --all --severity high

# JSON output for scripting
yarn npm audit --all --json
```

### Handling Vulnerabilities

1. **Update the package** (preferred):
   ```bash
   yarn up <vulnerable-package>
   ```

2. **Use resolutions** for transitive dependencies:
   ```json
   // package.json
   {
     "resolutions": {
       "vulnerable-package@<bad-version>": "<fixed-version>"
     }
   }
   ```

3. **Document accepted risks** if no fix is available:
   - Create an issue documenting the vulnerability
   - Add to security exceptions with justification
   - Set a reminder to check for fixes

### Current Resolutions

The project uses resolutions to fix known vulnerabilities in transitive
dependencies:

```json
{
  "resolutions": {
    "path-to-regexp@6.1.0": "6.3.0",
    "undici@5.28.4": "5.29.0",
    "esbuild@0.14.47": "0.25.0",
    "esbuild@0.23.1": "0.25.0",
    "tsx@4.19.2": "4.21.0"
  }
}
```

---

## Dependabot Workflow

### Configuration

Dependabot is configured in `.github/dependabot.yml`:

| Setting       | Value                      |
| ------------- | -------------------------- |
| Schedule      | Weekly (Monday 09:00 UTC)  |
| Open PR Limit | 10                         |
| Reviewer      | @zerdos                    |
| Labels        | `dependencies`, `security` |

### Dependency Groups

PRs are grouped to reduce noise:

- **development-dependencies**: Minor and patch updates for dev deps
- **production-dependencies**: Minor and patch updates for prod deps
- **Major updates**: Individual PRs (require more attention)

### Review Checklist

Before merging a Dependabot PR:

- [ ] **CI passes** - All automated checks are green
- [ ] **Review changelog** - Check for breaking changes
- [ ] **Check bundle impact** - Compare build output sizes
- [ ] **Manual verification** - Test affected features on preview URL

### Merge Criteria by Update Type

| Update Type | CI Required | Manual Test | Changelog Review |
| ----------- | ----------- | ----------- | ---------------- |
| Patch       | Yes         | Optional    | Scan             |
| Minor       | Yes         | Recommended | Required         |
| Major       | Yes         | Required    | Required         |
| Security    | Yes         | Required    | Required         |

### Testing Requirements

1. **Automated tests must pass** - Unit tests and E2E tests
2. **Preview deployment** - Verify on Vercel preview URL
3. **Security updates** - Prioritize and test thoroughly
4. **Major updates** - Test all affected functionality

---

## Bundle Size Awareness

### Current Approach

The project uses Next.js build output to monitor bundle sizes. The build command
displays route-level JavaScript sizes.

### Bundle Size Targets

| Metric        | Target   | Description                     |
| ------------- | -------- | ------------------------------- |
| First Load JS | < 100 KB | Shared JavaScript for all pages |
| Page JS       | < 50 KB  | Additional JS per page          |

### Before Adding Large Packages

1. Check package size at [bundlephobia.com](https://bundlephobia.com)
2. Look for tree-shakeable alternatives
3. Consider lazy loading for optional features
4. Evaluate if the functionality justifies the size

### Monitoring Bundle Size

```bash
# Run production build and check output
yarn build

# Output includes route sizes like:
# Route (app)                              Size     First Load JS
# /                                        5.2 kB   95.3 kB
```

### Future Improvements

Consider adding `@next/bundle-analyzer` for detailed bundle analysis:

```bash
yarn add -D @next/bundle-analyzer
```

---

## Yarn-Specific Commands

### Useful Yarn 4 Commands

```bash
# Update all dependencies to latest
yarn up

# Update a specific package
yarn up <package-name>

# Interactive upgrade (choose versions)
yarn up -i

# Check for outdated packages
yarn npm info <package-name>

# Why is a package installed?
yarn why <package-name>

# Clean cache
yarn cache clean

# Verify lock file integrity
yarn install --check-cache
```

### Lock File Management

- **Always commit `yarn.lock`** - Ensures reproducible builds
- **Use `--immutable` in CI** - Prevents accidental lock file changes
- **Resolve conflicts carefully** - Run `yarn install` after merging

---

## Best Practices Summary

1. **Evaluate before adding** - Check size, maintenance, alternatives
2. **Remove unused dependencies** - Run `yarn dead-code:deps` regularly
3. **Keep dependencies updated** - Review Dependabot PRs promptly
4. **Monitor security** - Address vulnerabilities quickly
5. **Watch bundle size** - Track build output sizes
6. **Document exceptions** - Explain any unusual configurations
7. **Test thoroughly** - Verify changes don't break functionality

---

## Troubleshooting

### Knip Reports False Positives

Update `knip.json` to ignore specific files or dependencies. See the
[Knip documentation](https://knip.dev/reference/configuration) for options.

### Dependency Conflicts

Use Yarn resolutions to force specific versions:

```json
{
  "resolutions": {
    "conflicting-package": "desired-version"
  }
}
```

### Build Fails After Dependency Update

1. Check for breaking changes in the package changelog
2. Review TypeScript errors for API changes
3. Check `node_modules` is fresh: `rm -rf node_modules && yarn install`

---

**Last Updated**: December 2025
