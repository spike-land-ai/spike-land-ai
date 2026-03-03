"use client";

import type { McpToken } from "./types";

class TokenManager {
  private token: McpToken | null = null;
  private expiresAt: number = 0;
  private refreshPromise: Promise<McpToken | null> | null = null;
  private expiryTimer: ReturnType<typeof setTimeout> | null = null;

  async getToken(): Promise<string | null> {
    if (!this.token) {
      return this.initialExchange();
    }

    if (this.isExpired()) {
      return this.refreshToken();
    }

    return this.token.access_token;
  }

  private async initialExchange(): Promise<string | null> {
    try {
      const response = await fetch("/api/mcp/token", { method: "POST" });
      if (!response.ok) {
        if (response.status === 401) return null;
        throw new Error("Failed to exchange session for MCP token");
      }

      this.setToken(await response.json());
      this.setupAutoRefresh();
      return this.token?.access_token || null;
    } catch (error) {
      console.error("[TokenManager] Initial exchange failed:", error);
      return null;
    }
  }

  private async refreshToken(): Promise<string | null> {
    if (this.refreshPromise) {
      return (await this.refreshPromise)?.access_token || null;
    }

    this.refreshPromise = (async () => {
      try {
        if (!this.token?.refresh_token) throw new Error("No refresh token");

        const response = await fetch("/api/mcp/oauth/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            grant_type: "refresh_token",
            refresh_token: this.token.refresh_token,
            client_id: "spike-land-frontend",
          }),
        });

        if (!response.ok) throw new Error("Refresh failed");

        this.setToken(await response.json());
        this.setupAutoRefresh();
        return this.token;
      } catch (error) {
        console.error("[TokenManager] Refresh failed:", error);
        this.token = null;
        this.expiresAt = 0;
        return null;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return (await this.refreshPromise)?.access_token || null;
  }

  private setToken(token: McpToken) {
    this.token = token;
    this.expiresAt = Date.now() + (token.expires_in * 1000);
  }

  private isExpired(): boolean {
    if (!this.token) return true;
    // Refresh 2 minutes before actual expiry
    return Date.now() > (this.expiresAt - 2 * 60 * 1000);
  }

  private setupAutoRefresh() {
    if (this.expiryTimer) clearTimeout(this.expiryTimer);
    if (!this.token) return;

    // Refresh 2 minutes before expiry
    const delay = this.expiresAt - Date.now() - (2 * 60 * 1000);
    if (delay > 0) {
      this.expiryTimer = setTimeout(() => this.refreshToken(), delay);
    }
  }

  clear() {
    this.token = null;
    this.expiresAt = 0;
    if (this.expiryTimer) clearTimeout(this.expiryTimer);
  }
}

export const tokenManager = new TokenManager();
