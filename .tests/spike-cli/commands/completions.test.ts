import { beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";
import { registerCompletionsCommand } from "../../../src/cli/spike-cli/core-logic/commands/completions";
import * as installer from "../../../src/cli/spike-cli/node-sys/installer";

vi.mock("../../../src/cli/spike-cli/node-sys/installer", () => ({
  detectShell: vi.fn().mockReturnValue("zsh"),
  installCompletions: vi.fn().mockReturnValue({ instructions: "done" }),
  uninstallCompletions: vi.fn().mockReturnValue(true),
}));

describe("completions command", () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
  });

  it("registers completions commands", () => {
    registerCompletionsCommand(program);
    const completions = program.commands.find((c) => c.name() === "completions");
    expect(completions).toBeDefined();
    expect(completions?.commands.find((c) => c.name() === "install")).toBeDefined();
    expect(completions?.commands.find((c) => c.name() === "uninstall")).toBeDefined();
  });

  it("install handles zsh", async () => {
    registerCompletionsCommand(program);
    const install = program.commands[0].commands.find((c) => c.name() === "install");
    if (!install) throw new Error("install command not registered");
    // @ts-expect-error - accessing private commander handler
    await install._actionHandler([{ shell: "zsh" }, []]);
    expect(installer.installCompletions).toHaveBeenCalledWith("zsh");
    expect(console.error).toHaveBeenCalledWith("done");
  });

  it("uninstall handles zsh", async () => {
    registerCompletionsCommand(program);
    const uninstall = program.commands[0].commands.find((c) => c.name() === "uninstall");
    if (!uninstall) throw new Error("uninstall command not registered");
    // @ts-expect-error - accessing private commander handler
    await uninstall._actionHandler([{ shell: "zsh" }, []]);
    expect(installer.uninstallCompletions).toHaveBeenCalledWith("zsh");
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("removed"));
  });

  it("install handles unknown shell", async () => {
    vi.mocked(installer.detectShell).mockReturnValue("unknown" as unknown as string);
    registerCompletionsCommand(program);
    const install = program.commands[0].commands.find((c) => c.name() === "install");
    if (!install) throw new Error("install command not registered");
    // @ts-expect-error - accessing private commander handler
    await install._actionHandler([{}, []]);
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it("install handles error", async () => {
    vi.mocked(installer.installCompletions).mockImplementation(() => {
      throw new Error("fail");
    });
    registerCompletionsCommand(program);
    const install = program.commands[0].commands.find((c) => c.name() === "install");
    if (!install) throw new Error("install command not registered");
    // @ts-expect-error - accessing private commander handler
    await install._actionHandler([{ shell: "zsh" }, []]);
    expect(process.exit).toHaveBeenCalledWith(1);
  });
});
