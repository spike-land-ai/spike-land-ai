/**
 * Alias store — persists aliases at ~/.spike/aliases.json.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import type { AliasConfig, CompositeAlias } from "./types";

const DEFAULT_ALIASES: AliasConfig = {
  version: 1,
  commands: {},
  tools: {},
  servers: {},
  composite: {},
};

export function getAliasPath(): string {
  return join(homedir(), ".spike", "aliases.json");
}

export async function loadAliases(): Promise<AliasConfig> {
  try {
    const raw = await readFile(getAliasPath(), "utf-8");
    return JSON.parse(raw) as AliasConfig;
  } catch {
    return {
      ...DEFAULT_ALIASES,
      commands: {},
      tools: {},
      servers: {},
      composite: {},
    };
  }
}

export async function saveAliases(config: AliasConfig): Promise<void> {
  const aliasPath = getAliasPath();
  await mkdir(join(aliasPath, ".."), { recursive: true });
  await writeFile(aliasPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

export async function addAlias(
  section: keyof Omit<AliasConfig, "version">,
  name: string,
  value: string | CompositeAlias,
): Promise<AliasConfig> {
  const config = await loadAliases();
  if (section === "composite") {
    if (typeof value === "string") {
      throw new Error(`Composite alias "${name}" requires a CompositeAlias object, not a string`);
    }
    config.composite[name] = value;
  } else {
    if (typeof value !== "string") {
      throw new Error(`Alias "${name}" in section "${section}" requires a string value`);
    }
    config[section][name] = value;
  }
  await saveAliases(config);
  return config;
}

export async function removeAlias(name: string): Promise<{ removed: boolean; section?: string }> {
  const config = await loadAliases();
  const sections = ["commands", "tools", "servers", "composite"] as const;

  for (const section of sections) {
    if (name in config[section]) {
      delete (config[section] as Record<string, unknown>)[name];
      await saveAliases(config);
      return { removed: true, section };
    }
  }

  return { removed: false };
}
