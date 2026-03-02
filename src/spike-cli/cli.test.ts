import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { program } from "commander";
import * as auth from "./commands/auth";
import * as alias from "./commands/alias";
import { main } from "./cli";

// Mock the commands so we don't trigger real logic
vi.mock("./commands/auth", () => ({ registerAuthCommand: vi.fn() }));
vi.mock("./commands/alias", () => ({ registerAliasCommand: vi.fn() }));
vi.mock("./commands/completions", () => ({ registerCompletionsCommand: vi.fn() }));
vi.mock("./commands/registry", () => ({ registerRegistryCommand: vi.fn() }));
vi.mock("./commands/agent", () => ({ registerAgentCommand: vi.fn() }));
vi.mock("./alias/store", () => ({ loadAliases: vi.fn().mockResolvedValue({ commands: {} }) }));

describe("cli", () => {
  const originalArgv = process.argv;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    // Reset program state
    (program as any).commands = [];
    (program as any).options = [];
    vi.spyOn(program, "parse").mockImplementation(() => program as any);
  });

  afterEach(() => {
    process.argv = originalArgv;
  });

  it("registers all commands", async () => {
    process.argv = ["node", "spike"];
    await main();
    
    expect(auth.registerAuthCommand).toHaveBeenCalled();
    expect(alias.registerAliasCommand).toHaveBeenCalled();
  });

  it("handles --generate-completions", async () => {
    process.argv = ["node", "spike", "--generate-completions"];
    await main();
    
    expect(console.log).toHaveBeenCalledWith("auth");
    expect(console.log).toHaveBeenCalledWith("--verbose");
    // Should NOT have called parse because it exits early
    expect(program.parse).not.toHaveBeenCalled();
  });

  it("rewrites command aliases", async () => {
    const store = await import("./alias/store");
    vi.mocked(store.loadAliases).mockResolvedValue({
      commands: { "st": "status" }
    } as any);

    process.argv = ["node", "spike", "st"];
    await main();
    
    expect(process.argv[2]).toBe("status");
  });
});
