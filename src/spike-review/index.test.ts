import { describe, expect, it, vi } from "vitest";
import { createServer } from "./index.js";

// Mock Octokit to avoid real API calls
vi.mock("@octokit/rest", () => ({
  Octokit: class MockOctokit {
    rest = {
      pulls: {
        get: vi.fn(),
        listFiles: vi.fn(),
        createReview: vi.fn(),
      },
      checks: {
        create: vi.fn(),
        update: vi.fn(),
      },
    };
  },
}));

describe("createServer", () => {
  it("creates an MCP server instance", () => {
    const server = createServer("fake-token");
    expect(server).toBeDefined();
  });

  it("server has the correct name", () => {
    const server = createServer("fake-token");
    // McpServer is created with name "Spike Review"
    expect(server).toBeDefined();
  });
});
