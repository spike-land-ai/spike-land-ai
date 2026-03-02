/**
 * Shared utilities for spike-cli commands.
 * Provides common argument-parsing helpers used by serve, chat, and shell.
 */

/**
 * Commander collect helper — appends each flag value into an array.
 * Pass as the third argument to `.option()` with `[]` as the default.
 */
export function collect(value: string, previous: string[]): string[] {
  return previous.concat([value]);
}

/**
 * Parse `--server name=command` inline server definitions.
 * Validates that both name and command are non-empty.
 */
export function parseInlineServers(items: string[]): Array<{ name: string; command: string }> {
  return items.map((item) => {
    const eq = item.indexOf("=");
    if (eq === -1) {
      throw new Error(`Invalid --server format: "${item}". Use name=command`);
    }
    const name = item.slice(0, eq).trim();
    const command = item.slice(eq + 1).trim();
    if (!name) {
      throw new Error(`Invalid --server format: "${item}". Server name must not be empty`);
    }
    if (!command) {
      throw new Error(`Invalid --server format: "${item}". Server command must not be empty`);
    }
    return { name, command };
  });
}

/**
 * Parse `--server-url name=url` inline URL definitions.
 * Validates that both name and url are non-empty, and that the port (if
 * present in the URL) is in the valid range 1–65535.
 */
export function parseInlineUrls(items: string[]): Array<{ name: string; url: string }> {
  return items.map((item) => {
    const eq = item.indexOf("=");
    if (eq === -1) {
      throw new Error(`Invalid --server-url format: "${item}". Use name=url`);
    }
    const name = item.slice(0, eq).trim();
    const url = item.slice(eq + 1).trim();
    if (!name) {
      throw new Error(`Invalid --server-url format: "${item}". Server name must not be empty`);
    }
    if (!url) {
      throw new Error(`Invalid --server-url format: "${item}". URL must not be empty`);
    }

    // Validate port range (1–65535) when a port is explicitly specified in the URL
    try {
      const parsed = new URL(url);
      if (parsed.port !== "") {
        const port = parseInt(parsed.port, 10);
        if (port < 1 || port > 65535) {
          throw new Error(`Invalid port ${port} in --server-url "${item}". Port must be 1–65535`);
        }
      }
    } catch (err) {
      // Re-throw our own port validation errors
      if (err instanceof Error && err.message.includes("Port must be")) {
        throw err;
      }
      // If it's a generic "Invalid URL" and it looks like a port issue, we might want to catch it too,
      // but let's stick to the test expectation for now.
      if (err instanceof Error && err.message === "Invalid URL" && url.includes(":")) {
         const parts = url.split(":");
         const lastPart = parts[parts.length - 1];
         const port = parseInt(lastPart, 10);
         if (!isNaN(port) && (port < 1 || port > 65535)) {
            throw new Error(`Invalid port ${port} in --server-url "${item}". Port must be 1–65535`);
         }
      }
    }

    return { name, url };
  });
}
