# Dependency Resolution Explanations

> **Last Updated**: 2026-02-26

This document explains why certain dependency versions are overridden in the
root `package.json` file.

## Current Resolutions

```json
"resolutions": {
  "path-to-regexp@6.1.0": "6.3.0",
  "undici@5.28.4": "5.29.0",
  "esbuild@0.23.1": "0.25.0",
  "tsx@4.19.2": "4.21.0",
  "graphmatch@npm:^1.1.0": "patch:graphmatch@npm%3A1.1.0#~/.yarn/patches/graphmatch-npm-1.1.0-d85b5ee191.patch"
}
```

## `esbuild`

**Resolution:** `"esbuild@0.23.1": "0.25.0"`

**Reasoning:**

- **`esbuild@0.23.1`:** This version is a transitive dependency of
  `@tanstack/router-generator` via `recast`. The project requires a newer
  version of `esbuild` for its own build processes, so we must force the
  resolution.

> The previous `esbuild@0.14.47` resolution has been removed as the transitive
> dependency chain that required it no longer exists.

## `path-to-regexp`

**Resolution:** `"path-to-regexp@6.1.0": "6.3.0"`

**Reasoning:** Fixes a security vulnerability (ReDoS) in the older version that
is pulled in as a transitive dependency.

## `undici`

**Resolution:** `"undici@5.28.4": "5.29.0"`

**Reasoning:** Patches a security issue in the HTTP client library used
transitively by various packages.

## `tsx`

**Resolution:** `"tsx@4.19.2": "4.21.0"`

**Reasoning:** Forces consistency with the project's direct `tsx` dependency
version to prevent duplicate installations.

## `graphmatch`

**Resolution:** Patch applied to `graphmatch@1.1.0`

**Reasoning:** Adds subpath export `'./dist/index.js'` to `package.json`
exports. Required for ESM compatibility when imported by the unplugged
`zeptomatch` package. Fixes GitHub Actions workflow failures. See issue #828.

## Overrides

```json
"overrides": {
  "@auth/core": {
    "nodemailer": "$nodemailer"
  }
}
```

The `@auth/core` package (used by `next-auth@5.0.0-beta.30`) declares
`nodemailer` as a peer dependency. Since this project does not use email-based
auth via nodemailer, the override prevents the dependency from being installed.

**Future Action:**

- Periodically re-evaluate the need for these resolutions as upstream packages
  release new versions.
