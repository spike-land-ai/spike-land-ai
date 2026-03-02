/**
 * esbuild.config.ts
 *
 * Central build configuration for all packages in the monorepo.
 * Reads packages.yaml to determine build profiles per package kind.
 *
 * Usage:
 *   npx tsx esbuild.config.ts [packageName...]
 *   npx tsx esbuild.config.ts --all
 *   npx tsx esbuild.config.ts --kind=mcp-server
 */

import { readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import * as esbuild from "esbuild";
import YAML from "yaml";

// ─── Types ───────────────────────────────────────────────────────────────────

type PackageKind = "library" | "mcp-server" | "worker" | "cli" | "browser" | "config";

interface BuildProfile {
  platform: esbuild.Platform;
  bundle: boolean;
  external: "all" | "internal-only" | "none";
  splitting: boolean;
  minify: boolean;
  format: esbuild.Format;
  banner?: Record<string, string>;
}

interface PackageManifestEntry {
  kind: PackageKind;
  entry: string;
  version: string;
  deps?: string[];
  bin?: string;
  exports?: Record<string, string>;
  type?: string;
  private?: boolean;
}

interface PackagesYaml {
  packages: Record<string, PackageManifestEntry>;
}

// ─── Build Profiles ──────────────────────────────────────────────────────────

const profiles: Record<PackageKind, BuildProfile> = {
  library: {
    platform: "neutral",
    bundle: false,
    external: "all",
    splitting: false,
    minify: false,
    format: "esm",
  },
  "mcp-server": {
    platform: "node",
    bundle: true,
    external: "internal-only",
    splitting: false,
    minify: false,
    format: "esm",
    banner: { js: "#!/usr/bin/env node" },
  },
  worker: {
    platform: "browser",
    bundle: true,
    external: "none",
    splitting: false,
    minify: true,
    format: "esm",
  },
  cli: {
    platform: "node",
    bundle: true,
    external: "internal-only",
    splitting: false,
    minify: true,
    format: "esm",
    banner: { js: "#!/usr/bin/env node" },
  },
  browser: {
    platform: "browser",
    bundle: true,
    external: "internal-only",
    splitting: true,
    minify: true,
    format: "esm",
  },
  config: {
    platform: "neutral",
    bundle: false,
    external: "all",
    splitting: false,
    minify: false,
    format: "esm",
  },
};

// ─── Manifest Loader ─────────────────────────────────────────────────────────

function loadManifest(): PackagesYaml {
  const raw = readFileSync(resolve("packages.yaml"), "utf-8");
  return YAML.parse(raw) as PackagesYaml;
}

// ─── External Resolution ─────────────────────────────────────────────────────

function resolveExternals(
  pkg: PackageManifestEntry,
  allPackages: Record<string, PackageManifestEntry>,
  mode: BuildProfile["external"],
): string[] {
  if (mode === "none") return [];

  const internalPkgs = Object.keys(allPackages).map((n) => `@spike-land-ai/${n}`);

  if (mode === "all") {
    // Mark everything external (library mode — consumers bundle)
    return ["*"];
  }

  // "internal-only": bundle third-party deps, keep internal @spike-land-ai/* external
  return internalPkgs;
}

// ─── Build Function ──────────────────────────────────────────────────────────

export interface BuildOptions {
  packageName: string;
  entry: string;
  kind: PackageKind;
  deps?: string[];
  allPackages: Record<string, PackageManifestEntry>;
}

export function createBuildConfig(opts: BuildOptions): esbuild.BuildOptions {
  const { packageName, entry, kind, allPackages } = opts;
  const profile = profiles[kind];

  const srcDir = resolve("src", packageName);
  const outDir = resolve("dist", packageName);
  const entryPoint = join(srcDir, entry);

  const external = resolveExternals(
    allPackages[packageName]!,
    allPackages,
    profile.external,
  );

  return {
    entryPoints: [entryPoint],
    outdir: outDir,
    platform: profile.platform,
    bundle: profile.bundle,
    splitting: profile.splitting,
    minify: profile.minify,
    format: profile.format,
    sourcemap: true,
    target: "es2022",
    external: external.length > 0 ? external : undefined,
    banner: profile.banner,
    tsconfig: resolve("tsconfig.json"),
    logLevel: "info",
  };
}

export async function buildPackage(opts: BuildOptions): Promise<esbuild.BuildResult> {
  const config = createBuildConfig(opts);
  console.log(`Building ${opts.packageName} (${opts.kind})...`);
  const result = await esbuild.build(config);
  console.log(`  ✓ ${opts.packageName} built to dist/${opts.packageName}/`);
  return result;
}

// ─── Topological Sort ────────────────────────────────────────────────────────

export function topologicalSort(
  packages: Record<string, PackageManifestEntry>,
): string[] {
  const visited = new Set<string>();
  const sorted: string[] = [];

  function visit(name: string): void {
    if (visited.has(name)) return;
    visited.add(name);

    const pkg = packages[name];
    if (pkg?.deps) {
      for (const dep of pkg.deps) {
        if (packages[dep]) {
          visit(dep);
        }
      }
    }
    sorted.push(name);
  }

  for (const name of Object.keys(packages)) {
    visit(name);
  }

  return sorted;
}

// ─── CLI Entry ───────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log("Usage: npx tsx esbuild.config.ts [packageName...] | --all | --kind=<kind>");
    process.exit(1);
  }

  const manifest = loadManifest();
  const allPackages = manifest.packages;

  let targets: string[];

  if (args.includes("--all")) {
    targets = topologicalSort(allPackages);
  } else if (args.some((a) => a.startsWith("--kind="))) {
    const kind = args.find((a) => a.startsWith("--kind="))!.split("=")[1] as PackageKind;
    targets = Object.entries(allPackages)
      .filter(([_, pkg]) => pkg.kind === kind)
      .map(([name]) => name);
  } else {
    targets = args;
  }

  console.log(`Building ${targets.length} package(s)...\n`);

  for (const name of targets) {
    const pkg = allPackages[name];
    if (!pkg) {
      console.error(`Package "${name}" not found in manifest`);
      process.exit(1);
    }

    await buildPackage({
      packageName: name,
      entry: pkg.entry,
      kind: pkg.kind,
      deps: pkg.deps,
      allPackages,
    });
  }

  console.log(`\nDone. ${targets.length} package(s) built.`);
}

// Only run if executed directly
if (process.argv[1]?.endsWith("esbuild.config.ts")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
