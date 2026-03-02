#!/usr/bin/env node
/**
 * mirror-sync.js
 *
 * Syncs source code from src/<package>/ to mirror GitHub repositories
 * using the GitHub API (synthetic commits via Git Data API).
 *
 * Usage:
 *   node scripts/mirror-sync.js '["shared","mcp-server-base"]'
 *   node scripts/mirror-sync.js --all
 *   node scripts/mirror-sync.js --dry-run shared
 *
 * Environment:
 *   GITHUB_TOKEN — GitHub token with repo write access to mirror repos
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join, relative } from "node:path";
import YAML from "yaml";

const ROOT = resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

if (!GITHUB_TOKEN && !dryRun) {
  console.error("GITHUB_TOKEN environment variable required");
  process.exit(1);
}

function loadManifest() {
  const raw = readFileSync(join(ROOT, "packages.yaml"), "utf-8");
  return YAML.parse(raw);
}

function getPackagesToSync(manifest) {
  const filtered = args.filter((a) => !a.startsWith("--"));

  if (filtered.length === 1 && filtered[0].startsWith("[")) {
    return JSON.parse(filtered[0]);
  }

  if (args.includes("--all")) {
    return Object.entries(manifest.packages)
      .filter(([_, pkg]) => pkg.mirror)
      .map(([name]) => name);
  }

  return filtered;
}

function collectFiles(dir, baseDir) {
  const files = [];
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      files.push(...collectFiles(fullPath, baseDir));
    } else {
      files.push({
        path: relative(baseDir, fullPath),
        content: readFileSync(fullPath),
      });
    }
  }

  return files;
}

async function githubApi(method, path, body) {
  const url = `https://api.github.com${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API ${method} ${path}: ${res.status} ${text}`);
  }

  return res.json();
}

async function syncPackage(name, pkg, defaults) {
  const [owner, repo] = pkg.mirror.split("/");
  const srcDir = join(ROOT, "src", name);

  console.log(`\nSyncing ${name} → ${pkg.mirror}`);

  // Collect all source files
  const files = collectFiles(srcDir, srcDir);
  console.log(`  ${files.length} files to sync`);

  if (dryRun) {
    for (const f of files.slice(0, 5)) {
      console.log(`    src/${f.path}`);
    }
    if (files.length > 5) console.log(`    ... and ${files.length - 5} more`);
    return;
  }

  // Get current HEAD of mirror
  let parentSha;
  try {
    const ref = await githubApi("GET", `/repos/${owner}/${repo}/git/refs/heads/main`);
    parentSha = ref.object.sha;
  } catch {
    console.log(`  Mirror repo ${pkg.mirror} not found or empty, skipping`);
    return;
  }

  // Create blobs for each file
  const treeEntries = [];
  for (const file of files) {
    const blob = await githubApi("POST", `/repos/${owner}/${repo}/git/blobs`, {
      content: file.content.toString("base64"),
      encoding: "base64",
    });

    // Map src/<name>/foo.ts -> src/foo.ts in mirror
    treeEntries.push({
      path: `src/${file.path}`,
      mode: "100644",
      type: "blob",
      sha: blob.sha,
    });
  }

  // Generate package.json for mirror
  const packageJson = {
    name: `${defaults.scope}/${name}`,
    version: pkg.version,
    description: pkg.description,
    type: pkg.type ?? defaults.type,
    license: defaults.license,
    main: `./dist/index.js`,
    types: `./dist/index.d.ts`,
    repository: {
      type: "git",
      url: `https://github.com/${pkg.mirror}.git`,
    },
  };

  const pkgBlob = await githubApi("POST", `/repos/${owner}/${repo}/git/blobs`, {
    content: Buffer.from(JSON.stringify(packageJson, null, 2) + "\n").toString("base64"),
    encoding: "base64",
  });
  treeEntries.push({
    path: "package.json",
    mode: "100644",
    type: "blob",
    sha: pkgBlob.sha,
  });

  // Create tree
  const tree = await githubApi("POST", `/repos/${owner}/${repo}/git/trees`, {
    tree: treeEntries,
  });

  // Create commit
  const commit = await githubApi("POST", `/repos/${owner}/${repo}/git/commits`, {
    message: `sync: update from monorepo (v${pkg.version})`,
    tree: tree.sha,
    parents: [parentSha],
  });

  // Update ref
  await githubApi("PATCH", `/repos/${owner}/${repo}/git/refs/heads/main`, {
    sha: commit.sha,
    force: false,
  });

  console.log(`  ✓ Pushed commit ${commit.sha.slice(0, 8)} to ${pkg.mirror}`);
}

async function main() {
  const manifest = loadManifest();
  const packages = getPackagesToSync(manifest);

  if (packages.length === 0) {
    console.log("No packages to sync.");
    return;
  }

  console.log(`Syncing ${packages.length} package(s)...`);

  for (const name of packages) {
    const pkg = manifest.packages[name];
    if (!pkg) {
      console.error(`Package "${name}" not found in manifest`);
      continue;
    }
    if (!pkg.mirror) {
      console.log(`${name}: no mirror configured, skipping`);
      continue;
    }

    await syncPackage(name, pkg, manifest.defaults);
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
