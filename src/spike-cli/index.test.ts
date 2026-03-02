import { describe, expect, it } from "vitest";
import * as index from "./index";

describe("index", () => {
  it("exports expected symbols", () => {
    expect(index.discoverConfig).toBeDefined();
    expect(index.validateConfig).toBeDefined();
    expect(index.setVerbose).toBeDefined();
  });
});
