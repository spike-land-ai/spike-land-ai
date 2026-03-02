/**
 * Manifest Parser
 *
 * Reads and parses packages.yaml manifest for the monorepo consolidation.
 * Provides typed access to package metadata, build profiles, and worker config.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

// ── Types ───────────────────────────────────────────────────────────────────

export interface ManifestWorkerConfig {
  name: string;
  entry?: string;
  compatibility_date: string;
  compatibility_flags?: string[];
  kv_namespaces?: Array<{ binding: string; id: string }>;
  d1_databases?: Array<{ binding: string; database_name: string; database_id: string }>;
  r2_buckets?: Array<{ binding: string; bucket_name: string }>;
  durable_objects?: Array<{ name: string; class_name: string; sqlite?: boolean }>;
  routes?: Array<{ pattern: string; custom_domain?: boolean; zone_name?: string }>;
  rules?: Array<{ type: string; globs: string[] }>;
  assets?: { directory: string; not_found_handling?: string };
  site?: { bucket: string };
}

export interface ManifestPackage {
  kind: string;
  version: string;
  description: string;
  entry: string;
  deps?: string[];
  bin?: string;
  binName?: string;
  exports?: Record<string, string>;
  type?: string;
  private?: boolean;
  publish?: { registries: string[] };
  mirror?: string;
  vite?: boolean;
  worker?: ManifestWorkerConfig;
}

export interface ManifestDefaults {
  scope: string;
  registry: string;
  license: string;
  type: string;
}

export interface Manifest {
  defaults: ManifestDefaults;
  packages: Record<string, ManifestPackage>;
}

// ── Simple YAML Parser ──────────────────────────────────────────────────────

/**
 * Minimal YAML parser for the packages.yaml format.
 * Handles the subset of YAML used in the manifest (maps, lists, scalars).
 * Does NOT handle all YAML features — only what's needed for the manifest.
 */
function parseSimpleYaml(text: string): Record<string, unknown> {
  const lines = text.split("\n");
  return parseObject(lines, 0, 0).value as Record<string, unknown>;
}

interface ParseResult {
  value: unknown;
  consumed: number;
}

function getIndent(line: string): number {
  const match = line.match(/^(\s*)/);
  return match ? match[1].length : 0;
}

function isComment(line: string): boolean {
  return line.trim().startsWith("#") || line.trim() === "";
}

function parseObject(lines: string[], start: number, baseIndent: number): ParseResult {
  const obj: Record<string, unknown> = {};
  let i = start;

  while (i < lines.length) {
    if (isComment(lines[i])) {
      i++;
      continue;
    }

    const indent = getIndent(lines[i]);
    if (indent < baseIndent) break;
    if (indent > baseIndent) break;

    const line = lines[i].trim();
    const keyMatch = line.match(/^([^:]+?):\s*(.*)/);
    if (!keyMatch) {
      i++;
      continue;
    }

    const key = keyMatch[1].trim();
    const inlineValue = keyMatch[2].trim();

    if (inlineValue && !inlineValue.startsWith("#")) {
      // Inline scalar value
      obj[key] = parseScalar(inlineValue);
      i++;
    } else {
      // Check next non-empty line for indent
      let nextLine = i + 1;
      while (nextLine < lines.length && isComment(lines[nextLine])) {
        nextLine++;
      }

      if (nextLine >= lines.length) {
        obj[key] = null;
        i++;
        continue;
      }

      const nextIndent = getIndent(lines[nextLine]);
      if (nextIndent <= baseIndent) {
        obj[key] = null;
        i++;
        continue;
      }

      // Check if it's a list or nested object
      const nextTrimmed = lines[nextLine].trim();
      if (nextTrimmed.startsWith("- ")) {
        const listResult = parseList(lines, nextLine, nextIndent);
        obj[key] = listResult.value;
        i = nextLine + listResult.consumed;
      } else {
        const nested = parseObject(lines, nextLine, nextIndent);
        obj[key] = nested.value;
        i = nextLine + nested.consumed;
      }
    }
  }

  return { value: obj, consumed: i - start };
}

function parseList(lines: string[], start: number, baseIndent: number): ParseResult {
  const arr: unknown[] = [];
  let i = start;

  while (i < lines.length) {
    if (isComment(lines[i])) {
      i++;
      continue;
    }

    const indent = getIndent(lines[i]);
    if (indent < baseIndent) break;

    const line = lines[i].trim();
    if (!line.startsWith("- ")) break;

    const itemContent = line.slice(2).trim();

    // Check if it's an inline map (e.g., "- binding: FOO")
    if (itemContent.includes(":")) {
      // Collect the inline map + any continuation lines
      const mapObj: Record<string, unknown> = {};
      const firstPair = itemContent.match(/^([^:]+?):\s*(.*)/);
      if (firstPair) {
        mapObj[firstPair[1].trim()] = parseScalar(firstPair[2].trim());
      }

      // Check for continuation lines at deeper indent
      let j = i + 1;
      const itemIndent = indent + 2;
      while (j < lines.length) {
        if (isComment(lines[j])) {
          j++;
          continue;
        }
        const jIndent = getIndent(lines[j]);
        if (jIndent < itemIndent) break;
        const jLine = lines[j].trim();
        const jPair = jLine.match(/^([^:]+?):\s*(.*)/);
        if (jPair) {
          mapObj[jPair[1].trim()] = parseScalar(jPair[2].trim());
        }
        j++;
      }

      arr.push(mapObj);
      i = j;
    } else {
      arr.push(parseScalar(itemContent));
      i++;
    }
  }

  return { value: arr, consumed: i - start };
}

function parseScalar(value: string): string | number | boolean | null {
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null" || value === "~" || value === "") return null;

  // Strip inline comments
  const commentIdx = value.indexOf(" #");
  const clean = commentIdx >= 0 ? value.slice(0, commentIdx).trim() : value;

  // Remove quotes
  if ((clean.startsWith('"') && clean.endsWith('"')) || (clean.startsWith("'") && clean.endsWith("'"))) {
    return clean.slice(1, -1);
  }

  // Try number
  const num = Number(clean);
  if (!isNaN(num) && clean !== "") return num;

  return clean;
}

// ── Public API ──────────────────────────────────────────────────────────────

let cachedManifest: Manifest | null = null;
let cachedPath: string | null = null;

/**
 * Read and parse the packages.yaml manifest file.
 * Results are cached per path.
 */
export async function readManifest(monorepoRoot?: string): Promise<Manifest> {
  const root = monorepoRoot ?? process.cwd();
  const manifestPath = join(root, "packages.yaml");

  if (cachedManifest && cachedPath === manifestPath) {
    return cachedManifest;
  }

  const raw = await readFile(manifestPath, "utf-8");
  const parsed = parseSimpleYaml(raw) as unknown as Manifest;

  if (!parsed.defaults || !parsed.packages) {
    throw new Error("Invalid packages.yaml: missing 'defaults' or 'packages' top-level keys");
  }

  cachedManifest = parsed;
  cachedPath = manifestPath;
  return parsed;
}

/**
 * Get a single package entry from the manifest.
 */
export async function getManifestPackage(
  packageName: string,
  monorepoRoot?: string,
): Promise<ManifestPackage | null> {
  const manifest = await readManifest(monorepoRoot);
  return manifest.packages[packageName] ?? null;
}

/**
 * Clear the manifest cache (useful for tests).
 */
export function clearManifestCache(): void {
  cachedManifest = null;
  cachedPath = null;
}

/**
 * Build a topological sort of packages based on deps.
 * Returns packages in build order (dependencies first).
 */
export function topologicalSort(packages: Record<string, ManifestPackage>): string[] {
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const order: string[] = [];

  function visit(name: string): void {
    if (visited.has(name)) return;
    if (visiting.has(name)) {
      throw new Error(`Circular dependency detected involving: ${name}`);
    }

    visiting.add(name);
    const pkg = packages[name];
    if (pkg?.deps) {
      for (const dep of pkg.deps) {
        if (packages[dep]) {
          visit(dep);
        }
      }
    }
    visiting.delete(name);
    visited.add(name);
    order.push(name);
  }

  for (const name of Object.keys(packages)) {
    visit(name);
  }

  return order;
}
