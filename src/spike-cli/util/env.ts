/**
 * Expand ${VAR} references in string values from process.env.
 */

import { warn } from "./logger";

const ENV_VAR_RE = /\$\{([^}]+)\}/g;

export function expandEnvVars(
  value: string,
  env: Record<string, string | undefined> = process.env,
): string {
  return value.replace(ENV_VAR_RE, (_, varName: string) => {
    if (!(varName in env)) {
      warn(`Environment variable '${varName}' is not set — this may cause authentication failures`);
    }
    return env[varName] ?? "";
  });
}

export function expandEnvRecord(
  record: Record<string, string>,
  env: Record<string, string | undefined> = process.env,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(record)) {
    result[key] = expandEnvVars(value, env);
  }
  return result;
}
