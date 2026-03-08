import { beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";
import { registerAuthCommand } from "../../../src/cli/spike-cli/core-logic/commands/auth";
import * as flow from "../../../src/cli/spike-cli/node-sys/device-flow";
import * as store from "../../../src/cli/spike-cli/node-sys/token-store";
import type { AuthTokens } from "../../../src/cli/spike-cli/node-sys/token-store";

vi.mock("../../../src/cli/spike-cli/node-sys/device-flow", () => ({ deviceCodeLogin: vi.fn() }));
vi.mock("../../../src/cli/spike-cli/node-sys/token-store", () => ({
  deleteTokens: vi.fn(),
  loadTokens: vi.fn(),
  isTokenExpired: vi.fn(),
}));
vi.mock("../../../src/cli/spike-cli/core-logic/onboarding/wizard", () => ({
  runOnboardingWizard: vi.fn().mockRejectedValue(new Error("skip")),
  submitOnboarding: vi.fn(),
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
    const auth = program.commands.find((c) => c.name() === "auth")!;
    expect(auth).toBeDefined();
    expect(auth.commands.find((c) => c.name() === "login")).toBeDefined();
    expect(auth.commands.find((c) => c.name() === "logout")).toBeDefined();
    expect(auth.commands.find((c) => c.name() === "status")).toBeDefined();
  });

  it("login handles successful device flow", async () => {
    vi.mocked(flow.deviceCodeLogin).mockResolvedValue({
      accessToken: "abc",
      baseUrl: "https://test",
    } as unknown as AuthTokens);

    registerAuthCommand(program);
    const login = program.commands[0].commands.find((c) => c.name() === "login")!;
    // @ts-expect-error - accessing private commander handler
    await login._actionHandler([{ baseUrl: "https://test" }, []]);

    expect(flow.deviceCodeLogin).toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Logged in successfully"));
  });

  it("logout deletes tokens", async () => {
    registerAuthCommand(program);
    const logout = program.commands[0].commands.find((c) => c.name() === "logout")!;
    // @ts-expect-error - accessing private commander handler
    await logout._actionHandler([{}, []]);
    expect(store.deleteTokens).toHaveBeenCalled();
  });

  it("status shows login info", async () => {
    vi.mocked(store.loadTokens).mockResolvedValue({
      baseUrl: "https://test",
    } as unknown as AuthTokens);
    vi.mocked(store.isTokenExpired).mockReturnValue(false);

    registerAuthCommand(program);
    const status = program.commands[0].commands.find((c) => c.name() === "status")!;
    // @ts-expect-error - accessing private commander handler
    await status._actionHandler([{}, []]);

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("Logged in to: https://test"),
    );
  });

  it("status handles not logged in", async () => {
    vi.mocked(store.loadTokens).mockResolvedValue(null);
    registerAuthCommand(program);
    const status = program.commands[0].commands.find((c) => c.name() === "status")!;
    // @ts-expect-error - accessing private commander handler
    await status._actionHandler([{}, []]);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Not logged in"));
  });

  it("login handles onboarding skip", async () => {
    vi.mocked(flow.deviceCodeLogin).mockResolvedValue({
      accessToken: "abc",
      baseUrl: "https://test",
    } as unknown as AuthTokens);
    const wizard = await import("../../../src/cli/spike-cli/core-logic/onboarding/wizard");
    vi.mocked(wizard.runOnboardingWizard).mockRejectedValue(new Error("skip"));

    registerAuthCommand(program);
    const login = program.commands[0].commands.find((c) => c.name() === "login")!;
    // @ts-expect-error - accessing private commander handler
    await login._actionHandler([{ baseUrl: "https://test" }, []]);

    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Logged in successfully"));
  });

  it("login triggers onUserCode callback", async () => {
    vi.mocked(flow.deviceCodeLogin).mockImplementation(async (options) => {
      options.onUserCode?.("USER-CODE", "https://spike.land/activate");
      return { accessToken: "abc", baseUrl: "https://test" } as unknown as AuthTokens;
    });

    registerAuthCommand(program);
    const login = program.commands[0].commands.find((c) => c.name() === "login")!;
    // @ts-expect-error - accessing private commander handler for testing
    await login._actionHandler([{ baseUrl: "https://test" }, []]);

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("https://spike.land/activate"),
    );
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("USER-CODE"));
  });

  it("login completes onboarding successfully", async () => {
    vi.mocked(flow.deviceCodeLogin).mockResolvedValue({
      accessToken: "abc",
      baseUrl: "https://test",
    } as unknown as AuthTokens);
    const wizard = await import("../../../src/cli/spike-cli/core-logic/onboarding/wizard");
    vi.mocked(wizard.runOnboardingWizard).mockResolvedValue({
      personaName: "Coder",
      personaId: 1,
      personaSlug: "coder",
      answers: [true],
    });
    vi.mocked(wizard.submitOnboarding).mockResolvedValue(undefined);

    registerAuthCommand(program);
    const login = program.commands[0].commands.find((c) => c.name() === "login")!;
    // @ts-expect-error - accessing private commander handler for testing
    await login._actionHandler([{ baseUrl: "https://test" }, []]);

    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Welcome"));
  });

  it("status shows expiry info when expiresAt is set", async () => {
    vi.mocked(store.loadTokens).mockResolvedValue({
      baseUrl: "https://test",
      expiresAt: "2030-01-01T00:00:00Z",
    } as unknown as AuthTokens);
    vi.mocked(store.isTokenExpired).mockReturnValue(false);

    registerAuthCommand(program);
    const status = program.commands[0].commands.find((c) => c.name() === "status")!;
    // @ts-expect-error - accessing private commander handler for testing
    await status._actionHandler([{}, []]);

    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Expires at:"));
  });
});
