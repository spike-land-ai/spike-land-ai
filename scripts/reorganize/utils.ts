import fs from "node:fs/promises";
import * as yaml from "yaml";
import type { ManifestPkg } from "./types.js";

export function extractRootPackage(importPath: string): string | null {
  if (importPath.startsWith(".") || importPath.startsWith("/") || importPath.startsWith("http")) {
    return null;
  }
  if (importPath.startsWith("@/")) {
    return null; // path alias
  }
  const parts = importPath.split("/");
  if (importPath.startsWith("@") && parts.length >= 2) {
    return `${parts[0]}/${parts[1]}`;
  }
  return parts[0] || null;
}

export async function readPackagesYaml(): Promise<Record<string, ManifestPkg>> {
  try {
    const content = await fs.readFile("packages.yaml", "utf-8");
    const parsed = yaml.parse(content);
    return parsed.packages || {};
  } catch (e) {
    return {};
  }
}
