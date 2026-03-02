/**
 * `spike auth` commands — login, logout, status.
 */

import type { Command } from "commander";
import { deviceCodeLogin } from "../auth/device-flow";
import { deleteTokens, isTokenExpired, loadTokens } from "../auth/token-store";
import { runOnboardingWizard, submitOnboarding } from "../onboarding/wizard";
import { log } from "../util/logger";

const DEFAULT_BASE_URL = "https://spike.land";

export function registerAuthCommand(program: Command): void {
  const auth = program.command("auth").description("Manage authentication");

  auth
    .command("login")
    .description("Log in with device code flow")
    .option("--base-url <url>", "Base URL for spike.land", DEFAULT_BASE_URL)
    .action(async (options) => {
      const baseUrl = options.baseUrl as string;

      console.error("Logging in to spike.land...");

      const tokens = await deviceCodeLogin({
        baseUrl,
        onUserCode: (code, uri) => {
          console.error(`\nOpen this URL in your browser: ${uri}`);
          console.error(`Enter code: ${code}\n`);
        },
      });

      console.error("Logged in successfully!");
      log(`Token stored for ${tokens.baseUrl}`);

      // Run onboarding if first login
      try {
        const result = await runOnboardingWizard();
        await submitOnboarding(result, baseUrl, tokens.accessToken);
        console.error(`\nWelcome, ${result.personaName}!`);
      } catch {
        // Onboarding is optional — skip on error
        log("Onboarding skipped");
      }
    });

  auth
    .command("logout")
    .description("Remove stored credentials")
    .action(async () => {
      await deleteTokens();
      console.error("Logged out.");
    });

  auth
    .command("status")
    .description("Show current auth state")
    .action(async () => {
      const tokens = await loadTokens();

      if (!tokens) {
        console.error("Not logged in. Run `spike auth login` to authenticate.");
        return;
      }

      const expired = isTokenExpired(tokens);
      console.error(`Logged in to: ${tokens.baseUrl}`);
      console.error(`Token status: ${expired ? "expired" : "valid"}`);

      if (tokens.expiresAt) {
        console.error(`Expires at: ${tokens.expiresAt}`);
      }
    });
}
