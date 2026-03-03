import { describe, expect, it } from "vitest";

import {
  formatEntity,
  formatEntityList,
  permissionGatedHandler,
  registerCrudTools,
  workspaceScopedHandler,
} from "./index";

describe("templates/index exports", () => {
  it("should export workspaceScopedHandler", () => {
    expect(workspaceScopedHandler).toBeDefined();
    expect(typeof workspaceScopedHandler).toBe("function");
  });

  it("should export permissionGatedHandler", () => {
    expect(permissionGatedHandler).toBeDefined();
    expect(typeof permissionGatedHandler).toBe("function");
  });

  it("should export registerCrudTools", () => {
    expect(registerCrudTools).toBeDefined();
    expect(typeof registerCrudTools).toBe("function");
  });

  it("should export formatEntity", () => {
    expect(formatEntity).toBeDefined();
    expect(typeof formatEntity).toBe("function");
  });

  it("should export formatEntityList", () => {
    expect(formatEntityList).toBeDefined();
    expect(typeof formatEntityList).toBe("function");
  });
});
