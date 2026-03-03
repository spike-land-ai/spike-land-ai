import { describe, expect, it } from "vitest";
import { generateUserData } from "./user-data-template";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function decodeBase64(encoded: string): string {
  return Buffer.from(encoded, "base64").toString("utf-8");
}

function isValidBase64(value: string): boolean {
  // A valid base64 string consists only of [A-Za-z0-9+/] with optional
  // trailing '=' padding, and its length is a multiple of 4.
  return /^[A-Za-z0-9+/]*={0,2}$/.test(value) && value.length % 4 === 0;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("generateUserData", () => {
  const SECRET = "my-vnc-secret-token";
  const TUNNEL = "eyJhIjoidHVubmVsLXRva2VuIn0";

  describe("return type and encoding", () => {
    it("returns a string", () => {
      const result = generateUserData(SECRET, TUNNEL);
      expect(typeof result).toBe("string");
    });

    it("returns a non-empty string", () => {
      const result = generateUserData(SECRET, TUNNEL);
      expect(result.length).toBeGreaterThan(0);
    });

    it("returns a valid base64-encoded value", () => {
      const result = generateUserData(SECRET, TUNNEL);
      expect(isValidBase64(result)).toBe(true);
    });

    it("decodes to a non-empty string", () => {
      const decoded = decodeBase64(generateUserData(SECRET, TUNNEL));
      expect(decoded.length).toBeGreaterThan(0);
    });
  });

  describe("decoded script structure", () => {
    let decoded: string;

    beforeEach(() => {
      decoded = decodeBase64(generateUserData(SECRET, TUNNEL));
    });

    it("starts with a bash shebang", () => {
      expect(decoded.startsWith("#!/bin/bash")).toBe(true);
    });

    it("enables strict error handling via set -euo pipefail", () => {
      expect(decoded).toContain("set -euo pipefail");
    });

    it("redirects output to /var/log/user-data.log", () => {
      expect(decoded).toContain("/var/log/user-data.log");
    });

    it("installs Docker when not present", () => {
      expect(decoded).toContain("https://get.docker.com");
    });

    it("runs a docker container", () => {
      expect(decoded).toContain("docker run");
    });

    it("runs the devbox container with a restart policy", () => {
      expect(decoded).toContain("--name devbox");
      expect(decoded).toContain("--restart unless-stopped");
    });

    it("binds noVNC to localhost only", () => {
      expect(decoded).toContain("127.0.0.1:6080:6080");
    });

    it("references the devcontainer image", () => {
      expect(decoded).toContain("devimages/bookworm-devcontainer");
    });

    it("installs Node.js via nodesource", () => {
      expect(decoded).toContain("nodesource.com/setup_22.x");
    });

    it("creates the vnc-proxy directory", () => {
      expect(decoded).toContain("/opt/vnc-proxy");
    });

    it("embeds a proxy.js that reads VNC_TOKEN_SECRET from the environment", () => {
      expect(decoded).toContain("VNC_TOKEN_SECRET");
    });

    it("creates a systemd service for the proxy", () => {
      expect(decoded).toContain("vnc-proxy.service");
    });

    it("installs cloudflared", () => {
      expect(decoded).toContain("cloudflared");
    });

    it("installs cloudflared from the official GitHub release", () => {
      expect(decoded).toContain(
        "github.com/cloudflare/cloudflared/releases/latest/download",
      );
    });

    it("runs cloudflared service install", () => {
      expect(decoded).toContain("cloudflared service install");
    });
  });

  describe("parameter interpolation", () => {
    it("writes vncTokenSecret to an environment file for the systemd service", () => {
      const secret = "super-secret-vnc-value";
      const decoded = decodeBase64(generateUserData(secret, TUNNEL));
      expect(decoded).toContain(`printf 'VNC_TOKEN_SECRET=%s\\n' '${secret}' > /etc/vnc-proxy.env`);
      expect(decoded).toContain("EnvironmentFile=/etc/vnc-proxy.env");
    });

    it("writes tunnelToken to a file and uses file-based cloudflared install", () => {
      const token = "cloudflare-tunnel-jwt-abc123";
      const decoded = decodeBase64(generateUserData(SECRET, token));
      expect(decoded).toContain(`printf '%s' '${token}' > /etc/cloudflared-token`);
      expect(decoded).toContain("cloudflared service install \"$(cat /etc/cloudflared-token)\"");
    });

    it("places vncTokenSecret only in the Environment= line, not elsewhere verbatim", () => {
      const secret = "unique-secret-xyz-789";
      const decoded = decodeBase64(generateUserData(secret, TUNNEL));
      const occurrences = decoded.split(secret).length - 1;
      // The secret appears exactly once in the systemd unit Environment line
      expect(occurrences).toBe(1);
    });

    it("places tunnelToken only in the cloudflared install line", () => {
      const token = "unique-tunnel-abc-456";
      const decoded = decodeBase64(generateUserData(SECRET, token));
      const occurrences = decoded.split(token).length - 1;
      // The token appears exactly once in the cloudflared service install call
      expect(occurrences).toBe(1);
    });
  });

  describe("different inputs produce different outputs", () => {
    it("different vncTokenSecrets produce different base64 outputs", () => {
      const out1 = generateUserData("secret-a", TUNNEL);
      const out2 = generateUserData("secret-b", TUNNEL);
      expect(out1).not.toBe(out2);
    });

    it("different tunnelTokens produce different base64 outputs", () => {
      const out1 = generateUserData(SECRET, "tunnel-token-x");
      const out2 = generateUserData(SECRET, "tunnel-token-y");
      expect(out1).not.toBe(out2);
    });

    it("different vncTokenSecrets produce different decoded scripts", () => {
      const decoded1 = decodeBase64(generateUserData("alpha-secret", TUNNEL));
      const decoded2 = decodeBase64(generateUserData("beta-secret", TUNNEL));
      expect(decoded1).not.toBe(decoded2);
    });

    it("different tunnelTokens produce different decoded scripts", () => {
      const decoded1 = decodeBase64(generateUserData(SECRET, "tunnel-one"));
      const decoded2 = decodeBase64(generateUserData(SECRET, "tunnel-two"));
      expect(decoded1).not.toBe(decoded2);
    });

    it("same inputs always produce the same output (deterministic)", () => {
      const out1 = generateUserData(SECRET, TUNNEL);
      const out2 = generateUserData(SECRET, TUNNEL);
      expect(out1).toBe(out2);
    });
  });

  describe("edge cases", () => {
    it("handles empty vncTokenSecret without throwing", () => {
      expect(() => generateUserData("", TUNNEL)).not.toThrow();
    });

    it("handles empty tunnelToken without throwing", () => {
      expect(() => generateUserData(SECRET, "")).not.toThrow();
    });

    it("handles both parameters being empty strings without throwing", () => {
      expect(() => generateUserData("", "")).not.toThrow();
    });

    it("handles special shell characters in vncTokenSecret", () => {
      const secret = "secret$with!special@chars#and%more";
      expect(() => generateUserData(secret, TUNNEL)).not.toThrow();
      const decoded = decodeBase64(generateUserData(secret, TUNNEL));
      expect(decoded).toContain(secret);
    });

    it("handles special shell characters in tunnelToken", () => {
      const token = "token$with!special@chars";
      expect(() => generateUserData(SECRET, token)).not.toThrow();
      const decoded = decodeBase64(generateUserData(SECRET, token));
      expect(decoded).toContain(token);
    });

    it("handles very long vncTokenSecret values", () => {
      const longSecret = "a".repeat(1024);
      expect(() => generateUserData(longSecret, TUNNEL)).not.toThrow();
      const decoded = decodeBase64(generateUserData(longSecret, TUNNEL));
      expect(decoded).toContain(longSecret);
    });

    it("handles very long tunnelToken values", () => {
      const longToken = "b".repeat(1024);
      expect(() => generateUserData(SECRET, longToken)).not.toThrow();
      const decoded = decodeBase64(generateUserData(SECRET, longToken));
      expect(decoded).toContain(longToken);
    });

    it("empty inputs produce valid base64 output", () => {
      const result = generateUserData("", "");
      expect(isValidBase64(result)).toBe(true);
    });
  });
});
