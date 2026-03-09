import { describe, expect, it } from "vitest";
import { formatCheckLine, getCheckCommands } from "../bazdmeg/runner.js";

describe("bazdmeg runner", () => {
  it("uses non-mutating commands for safe checks", () => {
    expect(getCheckCommands({ safe: true })).toEqual({
      lint: "yarn lint:check",
      typecheck: "yarn typecheck",
      test: "yarn test:src",
    });
  });

  it("keeps the fixing lint command for the real pipeline", () => {
    expect(getCheckCommands()).toEqual({
      lint: "yarn lint",
      typecheck: "yarn typecheck",
      test: "yarn test:src",
    });
  });

  it("formats timed out checks clearly", () => {
    expect(
      formatCheckLine({
        name: "test",
        passed: false,
        output: "Timed out after 60000ms",
        durationMs: 60_000,
        timedOut: true,
      }),
    ).toContain("TIMEOUT");
  });
});
