/**
 * `spike completions` command — install/uninstall shell completions.
 */

import { type Command, Option } from "commander";
import { detectShell, installCompletions, uninstallCompletions } from "../completions/installer";

export function registerCompletionsCommand(program: Command): void {
  const completions = program.command("completions").description("Manage shell tab completions");

  completions
    .command("install")
    .description("Install shell completions for the detected shell")
    .option("--shell <type>", "Override shell detection (bash, zsh, fish)")
    .action((options) => {
      const shell = (options.shell as string) ?? detectShell();
      if (shell === "unknown") {
        console.error("Could not detect shell. Use --shell to specify: bash, zsh, or fish");
        process.exit(1);
      }

      try {
        const result = installCompletions(shell);
        console.error(result.instructions);
      } catch (err) {
        console.error(
          `Failed to install completions: ${err instanceof Error ? err.message : String(err)}`,
        );
        process.exit(1);
      }
    });

  completions
    .command("uninstall")
    .description("Remove installed shell completions")
    .option("--shell <type>", "Override shell detection (bash, zsh, fish)")
    .action((options) => {
      const shell = (options.shell as string) ?? detectShell();
      if (shell === "unknown") {
        console.error("Could not detect shell. Use --shell to specify: bash, zsh, or fish");
        process.exit(1);
      }

      const removed = uninstallCompletions(shell);
      if (removed) {
        console.error(`Completions for ${shell} removed.`);
      } else {
        console.error(`No completions found for ${shell}.`);
      }
    });

  // Hidden flag for dynamic completions (called by completion scripts)
  const completionsOpt = new Option(
    "--generate-completions",
    "Generate completions for current input",
  ).hideHelp();
  program.addOption(completionsOpt);
}
