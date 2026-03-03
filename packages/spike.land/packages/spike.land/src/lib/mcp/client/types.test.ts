import { describe, expect, it } from "vitest";
import type {
  CallToolResult,
  JsonRpcId,
  JsonRpcRequest,
  JsonRpcResponse,
  McpToken,
} from "./types";

describe("types", () => {
  describe("JsonRpcId", () => {
    it("should accept string, number, or null", () => {
      const strId: JsonRpcId = "abc-123";
      const numId: JsonRpcId = 42;
      const nullId: JsonRpcId = null;

      expect(strId).toBe("abc-123");
      expect(numId).toBe(42);
      expect(nullId).toBeNull();
    });
  });

  describe("JsonRpcRequest", () => {
    it("should accept a valid request object", () => {
      const request: JsonRpcRequest = {
        jsonrpc: "2.0",
        method: "tools/call",
        params: { name: "test" },
        id: "1",
      };

      expect(request.jsonrpc).toBe("2.0");
      expect(request.method).toBe("tools/call");
      expect(request.params).toEqual({ name: "test" });
      expect(request.id).toBe("1");
    });

    it("should allow optional params and id", () => {
      const request: JsonRpcRequest = {
        jsonrpc: "2.0",
        method: "tools/list",
      };

      expect(request.params).toBeUndefined();
      expect(request.id).toBeUndefined();
    });
  });

  describe("JsonRpcResponse", () => {
    it("should accept a success response", () => {
      const response: JsonRpcResponse<string> = {
        jsonrpc: "2.0",
        result: "hello",
        id: "1",
      };

      expect(response.result).toBe("hello");
      expect(response.error).toBeUndefined();
    });

    it("should accept an error response", () => {
      const response: JsonRpcResponse = {
        jsonrpc: "2.0",
        error: {
          code: -32600,
          message: "Invalid Request",
          data: { extra: true },
        },
        id: null,
      };

      expect(response.error?.code).toBe(-32600);
      expect(response.error?.message).toBe("Invalid Request");
      expect(response.error?.data).toEqual({ extra: true });
    });

    it("should allow error without data field", () => {
      const response: JsonRpcResponse = {
        jsonrpc: "2.0",
        error: {
          code: -32601,
          message: "Method not found",
        },
        id: 1,
      };

      expect(response.error?.data).toBeUndefined();
    });
  });

  describe("CallToolResult", () => {
    it("should accept a valid tool result", () => {
      const result: CallToolResult = {
        content: [
          { type: "text", text: "{\"key\":\"value\"}" },
        ],
      };

      expect(result.content).toHaveLength(1);
      if (result.content && result.content[0]) {
        expect(result.content[0].type).toBe("text");
        expect(result.content[0].text).toBe("{\"key\":\"value\"}");
      }
    });

    it("should accept isError flag", () => {
      const result: CallToolResult = {
        content: [{ type: "text", text: "Something went wrong" }],
        isError: true,
      };

      expect(result.isError).toBe(true);
    });

    it("should accept additional properties via index signature", () => {
      const result: CallToolResult = {
        content: [{ type: "image", mimeType: "image/png" }],
        metadata: { timing: 123 },
      };

      expect(result.metadata).toEqual({ timing: 123 });
    });

    it("should accept content items with additional properties", () => {
      const result: CallToolResult = {
        content: [
          { type: "resource", uri: "file://test.txt", mimeType: "text/plain" },
        ],
      };

      if (result.content && result.content[0]) {
        expect(result.content[0].uri).toBe("file://test.txt");
      }
    });
  });

  describe("McpToken", () => {
    it("should accept a valid token object", () => {
      const token: McpToken = {
        access_token: "eyJhbGciOiJSUzI1NiJ9.test",
        refresh_token: "rt_abc123",
        expires_in: 3600,
        token_type: "Bearer",
      };

      expect(token.access_token).toBe("eyJhbGciOiJSUzI1NiJ9.test");
      expect(token.refresh_token).toBe("rt_abc123");
      expect(token.expires_in).toBe(3600);
      expect(token.token_type).toBe("Bearer");
    });
  });
});
