import { describe, expect, it } from "vitest";
import {
  McpAuthError,
  McpError,
  McpRateLimitError,
  McpRpcError,
} from "./errors";

describe("McpError", () => {
  it("should create an error with the given message", () => {
    const error = new McpError("something went wrong");
    expect(error.message).toBe("something went wrong");
  });

  it("should set name to McpError", () => {
    const error = new McpError("test");
    expect(error.name).toBe("McpError");
  });

  it("should be an instance of Error", () => {
    const error = new McpError("test");
    expect(error).toBeInstanceOf(Error);
  });

  it("should be an instance of McpError", () => {
    const error = new McpError("test");
    expect(error).toBeInstanceOf(McpError);
  });

  it("should have a stack trace", () => {
    const error = new McpError("trace test");
    expect(error.stack).toBeDefined();
  });
});

describe("McpRpcError", () => {
  it("should create an error with code, message, and optional data", () => {
    const error = new McpRpcError(-32600, "Invalid Request", { detail: "bad" });
    expect(error.code).toBe(-32600);
    expect(error.message).toBe("Invalid Request");
    expect(error.data).toEqual({ detail: "bad" });
  });

  it("should set name to McpRpcError", () => {
    const error = new McpRpcError(-32601, "Method not found");
    expect(error.name).toBe("McpRpcError");
  });

  it("should default data to undefined", () => {
    const error = new McpRpcError(-32601, "Method not found");
    expect(error.data).toBeUndefined();
  });

  it("should be an instance of McpError and Error", () => {
    const error = new McpRpcError(-32603, "Internal error");
    expect(error).toBeInstanceOf(McpRpcError);
    expect(error).toBeInstanceOf(McpError);
    expect(error).toBeInstanceOf(Error);
  });
});

describe("McpAuthError", () => {
  it("should default message to 'Unauthorized'", () => {
    const error = new McpAuthError();
    expect(error.message).toBe("Unauthorized");
  });

  it("should allow a custom message", () => {
    const error = new McpAuthError("Token expired");
    expect(error.message).toBe("Token expired");
  });

  it("should set name to McpAuthError", () => {
    const error = new McpAuthError();
    expect(error.name).toBe("McpAuthError");
  });

  it("should be an instance of McpError and Error", () => {
    const error = new McpAuthError();
    expect(error).toBeInstanceOf(McpAuthError);
    expect(error).toBeInstanceOf(McpError);
    expect(error).toBeInstanceOf(Error);
  });
});

describe("McpRateLimitError", () => {
  it("should default message to 'Too many requests'", () => {
    const error = new McpRateLimitError();
    expect(error.message).toBe("Too many requests");
  });

  it("should allow a custom message", () => {
    const error = new McpRateLimitError("Slow down");
    expect(error.message).toBe("Slow down");
  });

  it("should set name to McpRateLimitError", () => {
    const error = new McpRateLimitError();
    expect(error.name).toBe("McpRateLimitError");
  });

  it("should be an instance of McpError and Error", () => {
    const error = new McpRateLimitError();
    expect(error).toBeInstanceOf(McpRateLimitError);
    expect(error).toBeInstanceOf(McpError);
    expect(error).toBeInstanceOf(Error);
  });
});
