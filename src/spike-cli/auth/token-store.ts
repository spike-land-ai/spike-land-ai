/**
 * Manages authentication tokens stored in ~/.spike/auth.json.
 */

import { chmod, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export interface AuthTokens {
  clientId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string; // ISO 8601
  baseUrl: string;
}

export function getAuthPath(): string {
  return join(homedir(), ".spike", "auth.json");
}

export async function loadTokens(): Promise<AuthTokens | null> {
  const path = getAuthPath();
  if (!existsSync(path)) return null;

  try {
    const content = await readFile(path, "utf-8");
    return JSON.parse(content) as AuthTokens;
  } catch {
    return null;
  }
}

export async function saveTokens(tokens: AuthTokens): Promise<void> {
  const path = getAuthPath();
  const dir = join(homedir(), ".spike");

  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }

  await writeFile(path, JSON.stringify(tokens, null, 2), "utf-8");
  await chmod(path, 0o600);
}

export async function deleteTokens(): Promise<void> {
  const path = getAuthPath();
  if (existsSync(path)) {
    await unlink(path);
  }
}

export function isTokenExpired(tokens: AuthTokens): boolean {
  if (!tokens.expiresAt) return false;
  return new Date(tokens.expiresAt).getTime() <= Date.now();
}

export async function hasValidToken(): Promise<boolean> {
  const tokens = await loadTokens();
  if (!tokens) return false;
  return !isTokenExpired(tokens);
}
