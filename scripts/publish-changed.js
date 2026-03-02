#!/usr/bin/env node
/**
 * publish-changed.js
 *
 * Compares manifest versions against registry and publishes packages
 * with higher versions. Reads packages.yaml for the source of truth.
 *
 * Usage:
 *   node scripts/publish-changed.js [--dry-run] [--registry=github|npm]
 *
 * Environment:
 *   NODE_AUTH_TOKEN — npm auth token for publishing
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { execSync } from "node:child_process";
import YAML from "yaml";

const ROOT = resolve(import.meta.dirname, "..");
const DIST = join(ROOT, "dist");
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const registryArg = args.find((a) => a.startsWith("--registry="));
const targetRegistry = registryArg?.split("=")[1] ?? "github";

function loadManifest() {
  const raw = readFileSync(join(ROOT, "packages.yaml"), "utf-8");
  return YAML.parse(raw);
}

function getRegistryVersion(packageName, registry) {
  const registryUrl =
    registry === "npm"
      ? "https://registry.npmjs.org"
      : "https://npm.pkg.github.com";

  try {
    const result = execSync(
      `npm view ${packageName} version --registry=${registryUrl}`,
      { encoding: "utf-8", timeout: 10_000 },
    ).trim();
    return result;
  } catch {
    return null; // Not published yet
  }
}

function isNewer(local, remote) {
  if (!remote) return true;
  const [lMajor, lMinor, lPatch] = local.split(".").map(Number);
  const [rMajor, rMinor, rPatch] = remote.split(".").map(Number);
  if (lMajor !== rMajor) return lMajor > rMajor;
  if (lMinor !== rMinor) return lMinor > rMinor;
  return lPatch > rPatch;
}

function generatePackageJson(name, pkg, defaults) {
  const fullName = `${defaults.scope}/${name}`;
  const packageJson = {
    name: fullName,
    version: pkg.version,
    description: pkg.description,
    type: pkg.type ?? defaults.type,
    license: defaults.license,
    main: `./index.js`,
    types: `./index.d.ts`,
    publishConfig: {
      access: "public",
    },
    repository: {
      type: "git",
      url: `https://github.com/spike-land-ai/${name}.git`,
    },
  };

  if (pkg.bin) {
    packageJson.bin = { [pkg.binName ?? name]: `./${pkg.bin}` };
  }

  if (pkg.exports) {
    packageJson.exports = {};
    for (const [key, value] of Object.entries(pkg.exports)) {
      const jsPath = value.replace(/\.ts$/, ".js");
      packageJson.exports[key] = {
        types: value.replace(/\.ts$/, ".d.ts"),
        import: jsPath,
        default: jsPath,
      };
    }
  }

  return packageJson;
}

async function main() {
  const manifest = loadManifest();
  const { defaults, packages } = manifest;

  const toPublish = [];

  for (const [name, pkg] of Object.entries(packages)) {
    if (pkg.private) continue;
    if (!pkg.publish) continue;
    if (!pkg.publish.registries.includes(targetRegistry)) continue;

    const fullName = `${defaults.scope}/${name}`;
    const remoteVersion = getRegistryVersion(fullName, targetRegistry);

    if (isNewer(pkg.version, remoteVersion)) {
      toPublish.push({ name, fullName, pkg, remoteVersion });
    }
  }

  if (toPublish.length === 0) {
    console.log("No packages need publishing.");
    return;
  }

  console.log(`${toPublish.length} package(s) to publish:\n`);

  for (const { name, fullName, pkg, remoteVersion } of toPublish) {
    console.log(
      `  ${fullName}: ${remoteVersion ?? "(new)"} → ${pkg.version}`,
    );

    if (dryRun) continue;

    const pkgDist = join(DIST, name);
    mkdirSync(pkgDist, { recursive: true });

    // Write generated package.json
    const packageJson = generatePackageJson(name, pkg, defaults);
    writeFileSync(
      join(pkgDist, "package.json"),
      JSON.stringify(packageJson, null, 2),
    );

    // Publish
    const registryUrl =
      targetRegistry === "npm"
        ? "https://registry.npmjs.org"
        : "https://npm.pkg.github.com";

    try {
      execSync(`npm publish --access public --registry=${registryUrl}`, {
        cwd: pkgDist,
        stdio: "inherit",
        timeout: 60_000,
      });
      console.log(`  ✓ Published ${fullName}@${pkg.version}`);
    } catch (err) {
      console.error(`  ✗ Failed to publish ${fullName}: ${err.message}`);
      process.exit(1);
    }
  }

  if (dryRun) {
    console.log("\n(dry run — no packages were published)");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
