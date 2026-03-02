import { describe, it, expect, vi } from "vitest";
import { createMcpServer } from "./server.js";
import type { DrizzleDB } from "../db/index.js";

vi.mock("./manifest", () => ({
  registerAllTools: vi.fn().mockResolvedValue(undefined),
}));

describe("createMcpServer", () => {
  it("creates an MCP server and registers tools", async () => {
    const mockDb = {} as DrizzleDB;
    const server = await createMcpServer("user-123", mockDb);
    
    console.log("Server keys:", Object.keys(server));
    expect(server).toBeDefined();
  });

  it("handles enabledCategories", async () => {
    const mockDb = {} as DrizzleDB;
    const server = await createMcpServer("user-123", mockDb, {
      enabledCategories: ["core"],
    });
    
    expect(server).toBeDefined();
  });
});
