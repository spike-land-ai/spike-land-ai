/**
 * `spike alias` command — manage command/tool/server aliases.
 */

import type { Command } from "commander";
import { addAlias, loadAliases, removeAlias } from "../alias/store";
import { AliasResolver } from "../alias/resolver";
import { error as logError } from "../util/logger";

const KNOWN_COMMANDS = new Set(["serve", "shell", "auth", "alias"]);

export function registerAliasCommand(program: Command): void {
  const alias = program.command("alias").description("Manage command, tool, and server aliases");

  alias
    .command("set <name> <expansion>")
    .description("Create an alias (auto-detects section)")
    .action(async (name: string, expansion: string) => {
      const resolver = new AliasResolver(await loadAliases());
      if (resolver.isReserved(name)) {
        logError(`"${name}" is a reserved name and cannot be aliased.`);
        process.exit(1);
      }

      const section = detectSection(expansion);
      await addAlias(section, name, expansion);
      console.error(`Alias set: ${name} -> ${expansion} (${section})`);
    });

  alias
    .command("remove <name>")
    .description("Remove an alias")
    .action(async (name: string) => {
      const result = await removeAlias(name);
      if (result.removed) {
        console.error(`Removed alias "${name}" from ${result.section}`);
      } else {
        logError(`No alias found with name "${name}"`);
      }
    });

  alias
    .command("list")
    .description("List all aliases")
    .action(async () => {
      const aliases = await loadAliases();
      const sections = [
        { name: "Commands", data: aliases.commands },
        { name: "Tools", data: aliases.tools },
        { name: "Servers", data: aliases.servers },
        { name: "Composite", data: aliases.composite },
      ] as const;

      let hasAny = false;
      for (const section of sections) {
        const entries = Object.entries(section.data);
        if (entries.length === 0) continue;
        hasAny = true;
        console.error(`\n${section.name}:`);
        for (const [key, value] of entries) {
          console.error(`  ${key} -> ${typeof value === "string" ? value : JSON.stringify(value)}`);
        }
      }

      if (!hasAny) console.error("No aliases configured.");
    });

  alias
    .command("set-composite <name> <tool> [json-args]")
    .description("Create a composite alias with default args")
    .action(async (name: string, tool: string, jsonArgs?: string) => {
      const resolver = new AliasResolver(await loadAliases());
      if (resolver.isReserved(name)) {
        logError(`"${name}" is a reserved name and cannot be aliased.`);
        process.exit(1);
      }

      let args: Record<string, unknown> | undefined;
      if (jsonArgs) {
        try {
          args = JSON.parse(jsonArgs) as Record<string, unknown>;
        } catch {
          logError(`Invalid JSON: ${jsonArgs}`);
          process.exit(1);
        }
      }

      await addAlias("composite", name, { tool, args });
      console.error(
        `Composite alias set: ${name} -> ${tool}${args ? ` ${JSON.stringify(args)}` : ""}`,
      );
    });
}

function detectSection(expansion: string): "commands" | "tools" | "servers" {
  if (KNOWN_COMMANDS.has(expansion)) return "commands";
  if (expansion.includes("__")) return "tools";
  return "servers";
}
