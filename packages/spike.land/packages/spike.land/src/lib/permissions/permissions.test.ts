import { describe, expect, it } from "vitest";
import {
  canModifyRole,
  compareRoles,
  getAllActions,
  getPermittedActions,
  getRequiredRole,
  hasPermission,
  isAtLeast,
} from "./permissions";
import type { WorkspaceAction } from "./permissions";

describe("hasPermission", () => {
  describe("OWNER role", () => {
    it("can perform workspace:delete", () => {
      expect(hasPermission("OWNER", "workspace:delete")).toBe(true);
    });

    it("can perform workspace:transfer", () => {
      expect(hasPermission("OWNER", "workspace:transfer")).toBe(true);
    });

    it("can perform all actions", () => {
      const allActions = getAllActions();
      for (const action of allActions) {
        expect(hasPermission("OWNER", action)).toBe(true);
      }
    });
  });

  describe("ADMIN role", () => {
    it("can perform workspace:settings:write", () => {
      expect(hasPermission("ADMIN", "workspace:settings:write")).toBe(true);
    });

    it("cannot perform workspace:delete", () => {
      expect(hasPermission("ADMIN", "workspace:delete")).toBe(false);
    });

    it("cannot perform workspace:transfer", () => {
      expect(hasPermission("ADMIN", "workspace:transfer")).toBe(false);
    });

    it("can perform members:invite", () => {
      expect(hasPermission("ADMIN", "members:invite")).toBe(true);
    });

    it("can perform analytics:export", () => {
      expect(hasPermission("ADMIN", "analytics:export")).toBe(true);
    });
  });

  describe("MEMBER role", () => {
    it("can perform content:create", () => {
      expect(hasPermission("MEMBER", "content:create")).toBe(true);
    });

    it("cannot perform workspace:settings:write", () => {
      expect(hasPermission("MEMBER", "workspace:settings:write")).toBe(false);
    });

    it("cannot perform members:invite", () => {
      expect(hasPermission("MEMBER", "members:invite")).toBe(false);
    });

    it("can view inbox", () => {
      expect(hasPermission("MEMBER", "inbox:view")).toBe(true);
    });

    it("cannot manage notifications", () => {
      expect(hasPermission("MEMBER", "notifications:manage")).toBe(false);
    });
  });

  describe("VIEWER role", () => {
    it("can view inbox (only VIEWER-accessible action)", () => {
      expect(hasPermission("VIEWER", "inbox:view")).toBe(true);
    });

    it("cannot create content", () => {
      expect(hasPermission("VIEWER", "content:create")).toBe(false);
    });

    it("cannot perform workspace settings", () => {
      expect(hasPermission("VIEWER", "workspace:settings:read")).toBe(false);
    });

    it("cannot perform members:list", () => {
      expect(hasPermission("VIEWER", "members:list")).toBe(false);
    });
  });
});

describe("getPermittedActions", () => {
  it("VIEWER gets only inbox:view", () => {
    const actions = getPermittedActions("VIEWER");
    expect(actions).toContain("inbox:view");
    expect(actions).not.toContain("content:create");
    expect(actions).not.toContain("workspace:delete");
  });

  it("OWNER gets all actions", () => {
    const ownerActions = getPermittedActions("OWNER");
    const allActions = getAllActions();
    expect(ownerActions.sort()).toEqual(allActions.sort());
  });

  it("ADMIN gets more actions than MEMBER", () => {
    const adminActions = getPermittedActions("ADMIN");
    const memberActions = getPermittedActions("MEMBER");
    expect(adminActions.length).toBeGreaterThan(memberActions.length);
  });

  it("MEMBER actions are a subset of ADMIN actions", () => {
    const adminActions = new Set(getPermittedActions("ADMIN"));
    const memberActions = getPermittedActions("MEMBER");
    for (const action of memberActions) {
      expect(adminActions.has(action)).toBe(true);
    }
  });
});

describe("getRequiredRole", () => {
  it("returns OWNER for workspace:delete", () => {
    expect(getRequiredRole("workspace:delete")).toBe("OWNER");
  });

  it("returns ADMIN for workspace:settings:write", () => {
    expect(getRequiredRole("workspace:settings:write")).toBe("ADMIN");
  });

  it("returns MEMBER for content:create", () => {
    expect(getRequiredRole("content:create")).toBe("MEMBER");
  });

  it("returns VIEWER for inbox:view", () => {
    expect(getRequiredRole("inbox:view")).toBe("VIEWER");
  });
});

describe("getAllActions", () => {
  it("returns an array of strings", () => {
    const actions = getAllActions();
    expect(Array.isArray(actions)).toBe(true);
    expect(actions.length).toBeGreaterThan(0);
  });

  it("includes key actions", () => {
    const actions = getAllActions() as WorkspaceAction[];
    expect(actions).toContain("workspace:delete");
    expect(actions).toContain("content:create");
    expect(actions).toContain("inbox:view");
  });
});

describe("canModifyRole", () => {
  it("OWNER can promote MEMBER to ADMIN", () => {
    expect(canModifyRole("OWNER", "MEMBER", "ADMIN")).toBe(true);
  });

  it("OWNER can demote ADMIN to MEMBER", () => {
    expect(canModifyRole("OWNER", "ADMIN", "MEMBER")).toBe(true);
  });

  it("OWNER can transfer ownership (promote to OWNER)", () => {
    expect(canModifyRole("OWNER", "ADMIN", "OWNER")).toBe(true);
  });

  it("ADMIN cannot promote to OWNER", () => {
    expect(canModifyRole("ADMIN", "MEMBER", "OWNER")).toBe(false);
  });

  it("ADMIN cannot modify OWNER", () => {
    expect(canModifyRole("ADMIN", "OWNER", "MEMBER")).toBe(false);
  });

  it("ADMIN cannot modify other ADMINs", () => {
    expect(canModifyRole("ADMIN", "ADMIN", "MEMBER")).toBe(false);
  });

  it("ADMIN cannot promote MEMBER to ADMIN", () => {
    expect(canModifyRole("ADMIN", "MEMBER", "ADMIN")).toBe(false);
  });

  it("ADMIN can demote MEMBER to VIEWER", () => {
    expect(canModifyRole("ADMIN", "MEMBER", "VIEWER")).toBe(true);
  });

  it("ADMIN can promote VIEWER to MEMBER", () => {
    expect(canModifyRole("ADMIN", "VIEWER", "MEMBER")).toBe(true);
  });

  it("MEMBER cannot change roles (no permission)", () => {
    expect(canModifyRole("MEMBER", "VIEWER", "MEMBER")).toBe(false);
  });

  it("returns false when role is not changing", () => {
    expect(canModifyRole("OWNER", "ADMIN", "ADMIN")).toBe(false);
  });
});

describe("compareRoles", () => {
  it("OWNER > ADMIN", () => {
    expect(compareRoles("OWNER", "ADMIN")).toBeGreaterThan(0);
  });

  it("ADMIN > MEMBER", () => {
    expect(compareRoles("ADMIN", "MEMBER")).toBeGreaterThan(0);
  });

  it("MEMBER > VIEWER", () => {
    expect(compareRoles("MEMBER", "VIEWER")).toBeGreaterThan(0);
  });

  it("equal roles return 0", () => {
    expect(compareRoles("ADMIN", "ADMIN")).toBe(0);
    expect(compareRoles("MEMBER", "MEMBER")).toBe(0);
  });

  it("VIEWER < OWNER (negative)", () => {
    expect(compareRoles("VIEWER", "OWNER")).toBeLessThan(0);
  });
});

describe("isAtLeast", () => {
  it("OWNER is at least OWNER", () => {
    expect(isAtLeast("OWNER", "OWNER")).toBe(true);
  });

  it("OWNER is at least VIEWER", () => {
    expect(isAtLeast("OWNER", "VIEWER")).toBe(true);
  });

  it("VIEWER is NOT at least MEMBER", () => {
    expect(isAtLeast("VIEWER", "MEMBER")).toBe(false);
  });

  it("MEMBER is at least MEMBER", () => {
    expect(isAtLeast("MEMBER", "MEMBER")).toBe(true);
  });

  it("ADMIN is at least MEMBER", () => {
    expect(isAtLeast("ADMIN", "MEMBER")).toBe(true);
  });

  it("ADMIN is NOT at least OWNER", () => {
    expect(isAtLeast("ADMIN", "OWNER")).toBe(false);
  });
});
