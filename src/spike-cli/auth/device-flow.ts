/**
 * Device code OAuth flow for CLI authentication.
 */

import { execFile } from "node:child_process";
import { platform } from "node:os";
import type { AuthTokens } from "./token-store";
import { loadTokens, saveTokens } from "./token-store";
import { log } from "../util/logger";

export interface DeviceFlowOptions {
  baseUrl: string;
  onUserCode?: (code: string, verificationUri: string) => void;
}

interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type: string;
}

interface PollErrorResponse {
  error: string;
}

async function registerClient(baseUrl: string): Promise<string> {
  const res = await fetch(`${baseUrl}/api/mcp/oauth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: "spike-cli",
      grant_types: ["urn:ietf:params:oauth:grant-type:device_code"],
      token_endpoint_auth_method: "none",
    }),
  });

  if (!res.ok) {
    throw new Error(`Client registration failed: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as { client_id: string };
  return data.client_id;
}

async function requestDeviceCode(baseUrl: string, clientId: string): Promise<DeviceCodeResponse> {
  const res = await fetch(`${baseUrl}/api/mcp/oauth/device`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId }),
  });

  if (!res.ok) {
    throw new Error(`Device code request failed: ${res.status} ${res.statusText}`);
  }

  return (await res.json()) as DeviceCodeResponse;
}

function openBrowser(url: string): void {
  try {
    const os = platform();
    if (os === "darwin") {
      execFile("open", [url]);
    } else if (os === "linux") {
      execFile("xdg-open", [url]);
    }
  } catch {
    // Browser open is best-effort
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollForToken(
  baseUrl: string,
  clientId: string,
  deviceCode: string,
  interval: number,
  expiresIn: number,
): Promise<TokenResponse> {
  const deadline = Date.now() + expiresIn * 1000;
  let pollInterval = interval * 1000;

  while (Date.now() < deadline) {
    await sleep(pollInterval);

    const res = await fetch(`${baseUrl}/api/mcp/oauth/device/poll`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        device_code: deviceCode,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      }),
    });

    if (res.ok) {
      return (await res.json()) as TokenResponse;
    }

    const body = (await res.json()) as PollErrorResponse;

    switch (body.error) {
      case "authorization_pending":
        continue;
      case "slow_down":
        pollInterval += 5000;
        continue;
      case "expired_token":
        throw new Error("Device code expired. Please try again.");
      case "access_denied":
        throw new Error("Access denied by user.");
      default:
        throw new Error(`Unexpected poll error: ${body.error}`);
    }
  }

  throw new Error("Device code expired. Please try again.");
}

export async function deviceCodeLogin(options: DeviceFlowOptions): Promise<AuthTokens> {
  const { baseUrl } = options;

  // Check for existing clientId
  const existing = await loadTokens();
  let clientId = existing?.clientId;

  if (!clientId) {
    log("Registering CLI client...");
    clientId = await registerClient(baseUrl);
  }

  // Request device code
  const deviceCode = await requestDeviceCode(baseUrl, clientId);

  // Notify user
  if (options.onUserCode) {
    options.onUserCode(deviceCode.user_code, deviceCode.verification_uri);
  }

  // Try to open browser
  openBrowser(deviceCode.verification_uri);

  // Poll for token
  const tokenResponse = await pollForToken(
    baseUrl,
    clientId,
    deviceCode.device_code,
    deviceCode.interval,
    deviceCode.expires_in,
  );

  const tokens: AuthTokens = {
    clientId,
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token,
    baseUrl,
    expiresAt: tokenResponse.expires_in
      ? new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString()
      : undefined,
  };

  await saveTokens(tokens);
  return tokens;
}
