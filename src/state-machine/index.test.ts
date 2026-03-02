/**
 * Index re-export tests
 *
 * Verifies that the public API surface re-exported from index.ts is intact.
 */

import { describe, it, expect } from "vitest";
import * as indexExports from "./index.js";

describe("index.ts re-exports", () => {
  it("re-exports evaluateGuard from parser", () => {
    expect(typeof indexExports.evaluateGuard).toBe("function");
  });

  it("re-exports evaluateExpression from parser", () => {
    expect(typeof indexExports.evaluateExpression).toBe("function");
  });

  it("re-exports createMachine from engine", () => {
    expect(typeof indexExports.createMachine).toBe("function");
  });

  it("re-exports addState from engine", () => {
    expect(typeof indexExports.addState).toBe("function");
  });

  it("re-exports addTransition from engine", () => {
    expect(typeof indexExports.addTransition).toBe("function");
  });

  it("re-exports removeState from engine", () => {
    expect(typeof indexExports.removeState).toBe("function");
  });

  it("re-exports removeTransition from engine", () => {
    expect(typeof indexExports.removeTransition).toBe("function");
  });

  it("re-exports sendEvent from engine", () => {
    expect(typeof indexExports.sendEvent).toBe("function");
  });

  it("re-exports getState from engine", () => {
    expect(typeof indexExports.getState).toBe("function");
  });

  it("re-exports getHistory from engine", () => {
    expect(typeof indexExports.getHistory).toBe("function");
  });

  it("re-exports resetMachine from engine", () => {
    expect(typeof indexExports.resetMachine).toBe("function");
  });

  it("re-exports validateMachine from engine", () => {
    expect(typeof indexExports.validateMachine).toBe("function");
  });

  it("re-exports exportMachine from engine", () => {
    expect(typeof indexExports.exportMachine).toBe("function");
  });

  it("re-exports listMachines from engine", () => {
    expect(typeof indexExports.listMachines).toBe("function");
  });

  it("re-exports getMachine from engine", () => {
    expect(typeof indexExports.getMachine).toBe("function");
  });

  it("re-exports setContext from engine", () => {
    expect(typeof indexExports.setContext).toBe("function");
  });

  it("re-exports clearMachines from engine (test helper)", () => {
    expect(typeof indexExports.clearMachines).toBe("function");
  });

  it("re-exports generateVisualizerCode from visualizer-template", () => {
    expect(typeof indexExports.generateVisualizerCode).toBe("function");
  });

  it("evaluateGuard works through the re-export", () => {
    const result = indexExports.evaluateGuard("context.x > 5", { x: 10 });
    expect(result).toBe(true);
  });

  it("evaluateExpression works through the re-export", () => {
    const result = indexExports.evaluateExpression("1 + 2", {});
    expect(result).toBe(3);
  });
});
