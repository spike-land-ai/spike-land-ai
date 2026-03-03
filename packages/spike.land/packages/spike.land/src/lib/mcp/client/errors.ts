export class McpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "McpError";
  }
}

export class McpRpcError extends McpError {
  constructor(
    public code: number,
    message: string,
    public data?: unknown,
  ) {
    super(message);
    this.name = "McpRpcError";
  }
}

export class McpAuthError extends McpError {
  constructor(message: string = "Unauthorized") {
    super(message);
    this.name = "McpAuthError";
  }
}

export class McpRateLimitError extends McpError {
  constructor(message: string = "Too many requests") {
    super(message);
    this.name = "McpRateLimitError";
  }
}
