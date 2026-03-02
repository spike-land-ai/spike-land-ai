import { describe, expect, it, vi, beforeEach } from "vitest";
import { Command } from "commander";
import { registerAuthCommand } from "./auth";
import * as flow from "../auth/device-flow";
import * as store from "../auth/token-store";

vi.mock("../auth/device-flow", () => ({ deviceCodeLogin: vi.fn() }));
vi.mock("../auth/token-store", () => ({
  deleteTokens: vi.fn(),
  loadTokens: vi.fn(),
  isTokenExpired: vi.fn()
}));
vi.mock("../onboarding/wizard", () => ({
  runOnboardingWizard: vi.fn().mockRejectedValue(new Error("skip")),
  submitOnboarding: vi.fn()
}));

describe("auth command", () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("registers auth commands", () => {
    registerAuthCommand(program);
    const auth = program.commands.find(c => c.name() === "auth")!;
    expect(auth).toBeDefined();
    expect(auth.commands.find(c => c.name() === "login")).toBeDefined();
    expect(auth.commands.find(c => c.name() === "logout")).toBeDefined();
    expect(auth.commands.find(c => c.name() === "status")).toBeDefined();
  });

  it("login handles successful device flow", async () => {
    vi.mocked(flow.deviceCodeLogin).mockResolvedValue({
      accessToken: "abc",
      baseUrl: "https://test"
    } as any);

    registerAuthCommand(program);
    const login = program.commands[0].commands.find(c => c.name() === "login")!;
    await (login as any)._actionHandler([{ baseUrl: "https://test" }, []]);

    expect(flow.deviceCodeLogin).toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Logged in successfully"));
  });

  it("logout deletes tokens", async () => {
    registerAuthCommand(program);
    const logout = program.commands[0].commands.find(c => c.name() === "logout")!;
    await (logout as any)._actionHandler([{}, []]);
    expect(store.deleteTokens).toHaveBeenCalled();
  });

  it("status shows login info", async () => {
    vi.mocked(store.loadTokens).mockResolvedValue({ baseUrl: "https://test" } as any);
    vi.mocked(store.isTokenExpired).mockReturnValue(false);

    registerAuthCommand(program);
    const status = program.commands[0].commands.find(c => c.name() === "status")!;
    await (status as any)._actionHandler([{}, []]);
    
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Logged in to: https://test"));
  });

  it("status handles not logged in", async () => {
    vi.mocked(store.loadTokens).mockResolvedValue(null);
    registerAuthCommand(program);
    const status = program.commands[0].commands.find(c => c.name() === "status")!;
    await (status as any)._actionHandler([{}, []]);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Not logged in"));
  });

  it("login handles onboarding skip", async () => {
    vi.mocked(flow.deviceCodeLogin).mockResolvedValue({ accessToken: "abc", baseUrl: "https://test" } as any);
    const wizard = await import("../onboarding/wizard");
    vi.mocked(wizard.runOnboardingWizard).mockRejectedValue(new Error("skip"));

    registerAuthCommand(program);
    const login = program.commands[0].commands.find(c => c.name() === "login")!;
    await (login as any)._actionHandler([{ baseUrl: "https://test" }, []]);
    
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Logged in successfully"));
  });
});
