import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

declare module "vitest" {
  interface Assertion<T> {
    toBeSuccessfulMcpResult(): T;
    toBeErrorMcpResult(): T;
    toHaveTextContaining(expected: string): T;
    toHaveTextMatching(pattern: RegExp): T;
  }
  interface AsymmetricMatchersContaining {
    toBeSuccessfulMcpResult(): void;
    toBeErrorMcpResult(): void;
    toHaveTextContaining(expected: string): void;
    toHaveTextMatching(pattern: RegExp): void;
  }
}

interface TextContent {
  type: "text";
  text: string;
}

function isCallToolResult(value: unknown): value is CallToolResult {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return Array.isArray(obj.content);
}

function getTextContent(result: CallToolResult): string {
  return result.content
    .filter((c): c is TextContent => c.type === "text")
    .map(c => c.text)
    .join("\n");
}

export const mcpMatchers = {
  toBeSuccessfulMcpResult(received: unknown) {
    if (!isCallToolResult(received)) {
      return {
        pass: false,
        message: () =>
          `Expected value to be a CallToolResult with a content array, but got: ${
            JSON.stringify(received)
          }`,
      };
    }

    const hasTextContent = received.content.some(
      c => c.type === "text" && typeof (c as TextContent).text === "string",
    );
    const isNotError = received.isError !== true;
    const pass = isNotError && hasTextContent;

    return {
      pass,
      message: () =>
        pass
          ? `Expected result NOT to be a successful MCP result, but it was (isError: ${received.isError}, content items: ${received.content.length})`
          : `Expected result to be a successful MCP result (isError !== true, has text content), but got isError: ${received.isError}, text content items: ${
            received.content.filter(c => c.type === "text").length
          }`,
    };
  },

  toBeErrorMcpResult(received: unknown) {
    if (!isCallToolResult(received)) {
      return {
        pass: false,
        message: () =>
          `Expected value to be a CallToolResult with a content array, but got: ${
            JSON.stringify(received)
          }`,
      };
    }

    const pass = received.isError === true;

    return {
      pass,
      message: () =>
        pass
          ? `Expected result NOT to be an error MCP result, but isError was true`
          : `Expected result to be an error MCP result (isError: true), but isError was: ${received.isError}`,
    };
  },

  toHaveTextContaining(received: unknown, expected: string) {
    if (!isCallToolResult(received)) {
      return {
        pass: false,
        message: () =>
          `Expected value to be a CallToolResult with a content array, but got: ${
            JSON.stringify(received)
          }`,
      };
    }

    const text = getTextContent(received);
    const pass = text.includes(expected);

    return {
      pass,
      message: () =>
        pass
          ? `Expected MCP result text NOT to contain "${expected}", but it did.\nReceived text: "${text}"`
          : `Expected MCP result text to contain "${expected}", but it did not.\nReceived text: "${text}"`,
    };
  },

  toHaveTextMatching(received: unknown, pattern: RegExp) {
    if (!isCallToolResult(received)) {
      return {
        pass: false,
        message: () =>
          `Expected value to be a CallToolResult with a content array, but got: ${
            JSON.stringify(received)
          }`,
      };
    }

    const text = getTextContent(received);
    const pass = pattern.test(text);

    return {
      pass,
      message: () =>
        pass
          ? `Expected MCP result text NOT to match ${pattern}, but it did.\nReceived text: "${text}"`
          : `Expected MCP result text to match ${pattern}, but it did not.\nReceived text: "${text}"`,
    };
  },
};
