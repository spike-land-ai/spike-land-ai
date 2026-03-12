import { describe, expect, it } from "vitest";
import {
  getPackageSpec,
  installGlobalSpikeCli,
  type CommandExecutionResult,
  type CommandRunner,
} from "./upgrade";

class FakeRunner implements CommandRunner {
  readonly calls: Array<{ command: string; args: string[] }> = [];

  constructor(private readonly results: CommandExecutionResult[]) {}

  async run(command: string, args: string[]): Promise<CommandExecutionResult> {
    this.calls.push({ command, args });
    const result = this.results.shift();
    if (!result) {
      throw new Error("No fake result configured");
    }
    return result;
  }
}

describe("upgrade helpers", () => {
  it("builds the expected npm package spec", () => {
    expect(getPackageSpec()).toBe("@spike-land-ai/spike-cli@latest");
    expect(getPackageSpec("0.2.0")).toBe("@spike-land-ai/spike-cli@0.2.0");
  });

  it("installs the global package and validates the CLI before and after", async () => {
    const runner = new FakeRunner([
      { code: 0, stdout: "0.1.2\n", stderr: "" },
      { code: 0, stdout: "", stderr: "" },
      { code: 0, stdout: "0.2.0\n", stderr: "" },
    ]);

    const result = await installGlobalSpikeCli("/tmp/spike-cli.js", "0.2.0", runner);

    expect(result.beforeVersion).toBe("0.1.2");
    expect(result.afterVersion).toBe("0.2.0");
    expect(result.packageSpec).toBe("@spike-land-ai/spike-cli@0.2.0");
    expect(runner.calls).toHaveLength(3);
    expect(runner.calls[1]).toMatchObject({
      args: ["install", "-g", "@spike-land-ai/spike-cli@0.2.0"],
    });
  });

  it("surfaces npm install failures", async () => {
    const runner = new FakeRunner([
      { code: 0, stdout: "0.1.2\n", stderr: "" },
      { code: 1, stdout: "", stderr: "permission denied" },
    ]);

    await expect(installGlobalSpikeCli("/tmp/spike-cli.js", undefined, runner)).rejects.toThrow(
      /permission denied/i,
    );
  });
});
