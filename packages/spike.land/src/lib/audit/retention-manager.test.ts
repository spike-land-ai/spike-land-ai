import type { AuditAction } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Prisma mock setup ---
const mockAuditRetentionPolicyCreate = vi.fn();
const mockAuditRetentionPolicyUpdate = vi.fn();
const mockAuditRetentionPolicyDelete = vi.fn();
const mockAuditRetentionPolicyFindUnique = vi.fn();
const mockAuditRetentionPolicyFindFirst = vi.fn();
const mockAuditRetentionPolicyFindMany = vi.fn();
const mockWorkspaceAuditLogFindMany = vi.fn();
const mockWorkspaceAuditLogDeleteMany = vi.fn();
const mockWorkspaceAuditLogCount = vi.fn();
const mockWorkspaceAuditLogFindFirst = vi.fn();
const mockArchivedAuditLogCreateMany = vi.fn();
const mockArchivedAuditLogDeleteMany = vi.fn();
const mockArchivedAuditLogCount = vi.fn();
const mockArchivedAuditLogFindFirst = vi.fn();

vi.mock("@/lib/prisma", () => ({
  default: {
    auditRetentionPolicy: {
      create: (...args: unknown[]) => mockAuditRetentionPolicyCreate(...args),
      update: (...args: unknown[]) => mockAuditRetentionPolicyUpdate(...args),
      delete: (...args: unknown[]) => mockAuditRetentionPolicyDelete(...args),
      findUnique: (...args: unknown[]) => mockAuditRetentionPolicyFindUnique(...args),
      findFirst: (...args: unknown[]) => mockAuditRetentionPolicyFindFirst(...args),
      findMany: (...args: unknown[]) => mockAuditRetentionPolicyFindMany(...args),
    },
    workspaceAuditLog: {
      findMany: (...args: unknown[]) => mockWorkspaceAuditLogFindMany(...args),
      deleteMany: (...args: unknown[]) => mockWorkspaceAuditLogDeleteMany(...args),
      count: (...args: unknown[]) => mockWorkspaceAuditLogCount(...args),
      findFirst: (...args: unknown[]) => mockWorkspaceAuditLogFindFirst(...args),
    },
    archivedAuditLog: {
      createMany: (...args: unknown[]) => mockArchivedAuditLogCreateMany(...args),
      deleteMany: (...args: unknown[]) => mockArchivedAuditLogDeleteMany(...args),
      count: (...args: unknown[]) => mockArchivedAuditLogCount(...args),
      findFirst: (...args: unknown[]) => mockArchivedAuditLogFindFirst(...args),
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock("@/lib/try-catch", () => ({
  tryCatch: async (promise: Promise<unknown>) => {
    try {
      const data = await promise;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },
}));

const { AuditRetentionManager } = await import("./retention-manager");

// Shared helpers
const NOW = new Date("2025-06-15T12:00:00.000Z");

function makePolicy(overrides: Record<string, unknown> = {}) {
  return {
    id: "policy-1",
    workspaceId: "ws-1",
    name: "Test Policy",
    description: "A test policy",
    retentionDays: 365,
    archiveAfterDays: 90,
    deleteAfterDays: 730,
    actionTypes: [],
    isActive: true,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// createPolicy
// ---------------------------------------------------------------------------
describe("AuditRetentionManager.createPolicy", () => {
  it("creates a retention policy and returns mapped result", async () => {
    const dbRecord = makePolicy();
    mockAuditRetentionPolicyCreate.mockResolvedValue(dbRecord);

    const result = await AuditRetentionManager.createPolicy("ws-1", {
      name: "Test Policy",
      description: "A test policy",
      retentionDays: 365,
      archiveAfterDays: 90,
      deleteAfterDays: 730,
      isActive: true,
    });

    expect(mockAuditRetentionPolicyCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "ws-1",
        name: "Test Policy",
        retentionDays: 365,
        archiveAfterDays: 90,
        deleteAfterDays: 730,
        isActive: true,
      }),
    });

    expect(result).not.toBeNull();
    expect(result!.id).toBe("policy-1");
    expect(result!.name).toBe("Test Policy");
    expect(result!.retentionDays).toBe(365);
  });

  it("creates a system-wide policy when workspaceId is null", async () => {
    const dbRecord = makePolicy({ workspaceId: null });
    mockAuditRetentionPolicyCreate.mockResolvedValue(dbRecord);

    const result = await AuditRetentionManager.createPolicy(null, {
      name: "System Default",
      retentionDays: 365,
      isActive: true,
    });

    expect(mockAuditRetentionPolicyCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ workspaceId: null }),
    });
    expect(result!.workspaceId).toBeNull();
  });

  it("maps actionTypes from array to string array", async () => {
    const dbRecord = makePolicy({ actionTypes: ["ROLE_CHANGE", "USER_DELETE"] });
    mockAuditRetentionPolicyCreate.mockResolvedValue(dbRecord);

    await AuditRetentionManager.createPolicy("ws-1", {
      name: "Filtered Policy",
      retentionDays: 90,
      isActive: true,
      actionTypes: ["ROLE_CHANGE" as AuditAction, "USER_DELETE" as AuditAction],
    });

    expect(mockAuditRetentionPolicyCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actionTypes: ["ROLE_CHANGE", "USER_DELETE"],
      }),
    });
  });

  it("defaults actionTypes to empty array when not provided", async () => {
    const dbRecord = makePolicy({ actionTypes: [] });
    mockAuditRetentionPolicyCreate.mockResolvedValue(dbRecord);

    await AuditRetentionManager.createPolicy("ws-1", {
      name: "No Filter",
      retentionDays: 180,
      isActive: true,
    });

    expect(mockAuditRetentionPolicyCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ actionTypes: [] }),
    });
  });

  it("returns null when prisma throws", async () => {
    mockAuditRetentionPolicyCreate.mockRejectedValue(new Error("DB error"));

    const result = await AuditRetentionManager.createPolicy("ws-1", {
      name: "Bad Policy",
      retentionDays: 30,
      isActive: true,
    });

    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// updatePolicy
// ---------------------------------------------------------------------------
describe("AuditRetentionManager.updatePolicy", () => {
  it("updates specified fields only", async () => {
    const dbRecord = makePolicy({ name: "Updated Name", retentionDays: 180 });
    mockAuditRetentionPolicyUpdate.mockResolvedValue(dbRecord);

    const result = await AuditRetentionManager.updatePolicy("policy-1", {
      name: "Updated Name",
      retentionDays: 180,
    });

    expect(mockAuditRetentionPolicyUpdate).toHaveBeenCalledWith({
      where: { id: "policy-1" },
      data: { name: "Updated Name", retentionDays: 180 },
    });
    expect(result!.name).toBe("Updated Name");
    expect(result!.retentionDays).toBe(180);
  });

  it("only includes defined update fields in the update data", async () => {
    mockAuditRetentionPolicyUpdate.mockResolvedValue(makePolicy());

    await AuditRetentionManager.updatePolicy("policy-1", {
      isActive: false,
    });

    const callArg = mockAuditRetentionPolicyUpdate.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(callArg.data).toEqual({ isActive: false });
    expect(callArg.data).not.toHaveProperty("name");
    expect(callArg.data).not.toHaveProperty("retentionDays");
  });

  it("maps actionTypes to string array during update", async () => {
    mockAuditRetentionPolicyUpdate.mockResolvedValue(makePolicy());

    await AuditRetentionManager.updatePolicy("policy-1", {
      actionTypes: ["TOKEN_ADJUSTMENT" as AuditAction],
    });

    const callArg = mockAuditRetentionPolicyUpdate.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(callArg.data.actionTypes).toEqual(["TOKEN_ADJUSTMENT"]);
  });

  it("returns null when prisma throws", async () => {
    mockAuditRetentionPolicyUpdate.mockRejectedValue(new Error("Update failed"));

    const result = await AuditRetentionManager.updatePolicy("policy-1", {
      name: "New Name",
    });

    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// deletePolicy
// ---------------------------------------------------------------------------
describe("AuditRetentionManager.deletePolicy", () => {
  it("returns true on successful deletion", async () => {
    mockAuditRetentionPolicyDelete.mockResolvedValue({ id: "policy-1" });

    const result = await AuditRetentionManager.deletePolicy("policy-1");

    expect(result).toBe(true);
    expect(mockAuditRetentionPolicyDelete).toHaveBeenCalledWith({
      where: { id: "policy-1" },
    });
  });

  it("returns false when prisma throws", async () => {
    mockAuditRetentionPolicyDelete.mockRejectedValue(new Error("Cannot delete"));

    const result = await AuditRetentionManager.deletePolicy("policy-1");

    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getPolicy
// ---------------------------------------------------------------------------
describe("AuditRetentionManager.getPolicy", () => {
  it("returns mapped policy when found", async () => {
    mockAuditRetentionPolicyFindUnique.mockResolvedValue(makePolicy());

    const result = await AuditRetentionManager.getPolicy("policy-1");

    expect(result).not.toBeNull();
    expect(result!.id).toBe("policy-1");
    expect(result!.workspaceId).toBe("ws-1");
    expect(result!.isActive).toBe(true);
  });

  it("returns null when policy not found", async () => {
    mockAuditRetentionPolicyFindUnique.mockResolvedValue(null);

    const result = await AuditRetentionManager.getPolicy("nonexistent");

    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// listPolicies
// ---------------------------------------------------------------------------
describe("AuditRetentionManager.listPolicies", () => {
  it("returns mapped list of policies for a workspace", async () => {
    const policies = [
      makePolicy({ id: "p-1", name: "Policy A" }),
      makePolicy({ id: "p-2", name: "Policy B" }),
    ];
    mockAuditRetentionPolicyFindMany.mockResolvedValue(policies);

    const result = await AuditRetentionManager.listPolicies("ws-1");

    expect(mockAuditRetentionPolicyFindMany).toHaveBeenCalledWith({
      where: { workspaceId: "ws-1" },
      orderBy: { createdAt: "desc" },
    });
    expect(result).toHaveLength(2);
    expect(result[0]!.name).toBe("Policy A");
    expect(result[1]!.name).toBe("Policy B");
  });

  it("returns empty array when no policies exist", async () => {
    mockAuditRetentionPolicyFindMany.mockResolvedValue([]);

    const result = await AuditRetentionManager.listPolicies("ws-empty");

    expect(result).toEqual([]);
  });

  it("lists system-wide policies when workspaceId is null", async () => {
    mockAuditRetentionPolicyFindMany.mockResolvedValue([]);

    await AuditRetentionManager.listPolicies(null);

    expect(mockAuditRetentionPolicyFindMany).toHaveBeenCalledWith({
      where: { workspaceId: null },
      orderBy: { createdAt: "desc" },
    });
  });
});

// ---------------------------------------------------------------------------
// getEffectivePolicy
// ---------------------------------------------------------------------------
describe("AuditRetentionManager.getEffectivePolicy", () => {
  it("returns workspace-specific active policy when one exists", async () => {
    const workspacePolicy = makePolicy({ id: "ws-policy", workspaceId: "ws-1" });
    mockAuditRetentionPolicyFindFirst.mockResolvedValueOnce(workspacePolicy);

    const result = await AuditRetentionManager.getEffectivePolicy("ws-1");

    expect(result!.id).toBe("ws-policy");
    // Should only call findFirst once (workspace policy found)
    expect(mockAuditRetentionPolicyFindFirst).toHaveBeenCalledTimes(1);
  });

  it("falls back to system-wide policy when no workspace policy exists", async () => {
    const systemPolicy = makePolicy({ id: "sys-policy", workspaceId: null });
    mockAuditRetentionPolicyFindFirst
      .mockResolvedValueOnce(null) // no workspace policy
      .mockResolvedValueOnce(systemPolicy); // system policy

    const result = await AuditRetentionManager.getEffectivePolicy("ws-1");

    expect(result!.id).toBe("sys-policy");
    expect(mockAuditRetentionPolicyFindFirst).toHaveBeenCalledTimes(2);
  });

  it("returns null when neither workspace nor system policy exists", async () => {
    mockAuditRetentionPolicyFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

    const result = await AuditRetentionManager.getEffectivePolicy("ws-no-policy");

    expect(result).toBeNull();
  });

  it("queries workspace policy with isActive: true filter", async () => {
    mockAuditRetentionPolicyFindFirst.mockResolvedValue(null);

    await AuditRetentionManager.getEffectivePolicy("ws-1");

    expect(mockAuditRetentionPolicyFindFirst).toHaveBeenCalledWith({
      where: { workspaceId: "ws-1", isActive: true },
    });
  });
});

// ---------------------------------------------------------------------------
// executeRetentionJob
// ---------------------------------------------------------------------------
describe("AuditRetentionManager.executeRetentionJob", () => {
  it("returns error when policy not found", async () => {
    mockAuditRetentionPolicyFindUnique.mockResolvedValue(null);

    const result = await AuditRetentionManager.executeRetentionJob("missing-id");

    expect(result.errors).toContain("Policy not found");
    expect(result.archivedCount).toBe(0);
    expect(result.deletedCount).toBe(0);
    expect(result.policyId).toBe("missing-id");
    expect(result.executedAt).toBeInstanceOf(Date);
  });

  it("returns error when policy is inactive", async () => {
    mockAuditRetentionPolicyFindUnique.mockResolvedValue(makePolicy({ isActive: false }));

    const result = await AuditRetentionManager.executeRetentionJob("policy-1");

    expect(result.errors).toContain("Policy is not active");
    expect(result.archivedCount).toBe(0);
    expect(result.deletedCount).toBe(0);
  });

  it("archives and deletes logs for active policy with all settings", async () => {
    const policy = makePolicy({
      archiveAfterDays: 90,
      deleteAfterDays: 730,
    });
    mockAuditRetentionPolicyFindUnique.mockResolvedValue(policy);

    const logsToArchive = [
      {
        id: "log-1",
        workspaceId: "ws-1",
        userId: "user-1",
        action: "ROLE_CHANGE",
        targetId: null,
        targetType: null,
        resourceId: null,
        resourceType: null,
        metadata: null,
        ipAddress: null,
        userAgent: null,
        createdAt: new Date("2024-01-01"),
      },
      {
        id: "log-2",
        workspaceId: "ws-1",
        userId: "user-2",
        action: "USER_DELETE",
        targetId: null,
        targetType: null,
        resourceId: null,
        resourceType: null,
        metadata: null,
        ipAddress: null,
        userAgent: null,
        createdAt: new Date("2024-01-02"),
      },
    ];
    mockWorkspaceAuditLogFindMany.mockResolvedValue(logsToArchive);
    mockArchivedAuditLogCreateMany.mockResolvedValue({ count: 2 });
    mockWorkspaceAuditLogDeleteMany.mockResolvedValue({ count: 2 });
    mockArchivedAuditLogDeleteMany.mockResolvedValue({ count: 5 });

    const result = await AuditRetentionManager.executeRetentionJob("policy-1");

    expect(result.archivedCount).toBe(2);
    expect(result.deletedCount).toBe(5);
    expect(result.errors).toHaveLength(0);
    expect(result.policyId).toBe("policy-1");
  });

  it("filters workspace audit logs by workspaceId when set in policy", async () => {
    const policy = makePolicy({
      workspaceId: "ws-specific",
      archiveAfterDays: 30,
      deleteAfterDays: null,
    });
    mockAuditRetentionPolicyFindUnique.mockResolvedValue(policy);
    mockWorkspaceAuditLogFindMany.mockResolvedValue([]);
    mockArchivedAuditLogDeleteMany.mockResolvedValue({ count: 0 });

    await AuditRetentionManager.executeRetentionJob("policy-1");

    const findManyCall = mockWorkspaceAuditLogFindMany.mock.calls[0]![0] as {
      where: Record<string, unknown>;
    };
    expect(findManyCall.where.workspaceId).toBe("ws-specific");
  });

  it("filters by actionTypes when policy specifies them", async () => {
    const policy = makePolicy({
      archiveAfterDays: 30,
      deleteAfterDays: null,
      actionTypes: ["ROLE_CHANGE" as AuditAction],
    });
    mockAuditRetentionPolicyFindUnique.mockResolvedValue(policy);
    mockWorkspaceAuditLogFindMany.mockResolvedValue([]);

    await AuditRetentionManager.executeRetentionJob("policy-1");

    const findManyCall = mockWorkspaceAuditLogFindMany.mock.calls[0]![0] as {
      where: { action?: Record<string, unknown> };
    };
    expect(findManyCall.where.action).toEqual({ in: ["ROLE_CHANGE"] });
  });

  it("skips archive step when archiveAfterDays is null", async () => {
    const policy = makePolicy({ archiveAfterDays: null, deleteAfterDays: 365 });
    mockAuditRetentionPolicyFindUnique.mockResolvedValue(policy);
    mockArchivedAuditLogDeleteMany.mockResolvedValue({ count: 3 });

    const result = await AuditRetentionManager.executeRetentionJob("policy-1");

    expect(mockWorkspaceAuditLogFindMany).not.toHaveBeenCalled();
    expect(result.archivedCount).toBe(0);
    expect(result.deletedCount).toBe(3);
  });

  it("skips delete step when deleteAfterDays is null", async () => {
    const policy = makePolicy({ archiveAfterDays: 30, deleteAfterDays: null });
    mockAuditRetentionPolicyFindUnique.mockResolvedValue(policy);
    mockWorkspaceAuditLogFindMany.mockResolvedValue([]);

    const result = await AuditRetentionManager.executeRetentionJob("policy-1");

    expect(mockArchivedAuditLogDeleteMany).not.toHaveBeenCalled();
    expect(result.deletedCount).toBe(0);
  });

  it("records archive error when createMany throws", async () => {
    const policy = makePolicy({ archiveAfterDays: 30, deleteAfterDays: null });
    mockAuditRetentionPolicyFindUnique.mockResolvedValue(policy);
    mockWorkspaceAuditLogFindMany.mockResolvedValue([
      {
        id: "log-1",
        workspaceId: "ws-1",
        userId: "user-1",
        action: "ROLE_CHANGE",
        targetId: null,
        targetType: null,
        resourceId: null,
        resourceType: null,
        metadata: null,
        ipAddress: null,
        userAgent: null,
        createdAt: new Date("2024-01-01"),
      },
    ]);
    mockArchivedAuditLogCreateMany.mockRejectedValue(new Error("Archive DB error"));

    const result = await AuditRetentionManager.executeRetentionJob("policy-1");

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("Archive error");
    expect(result.errors[0]).toContain("Archive DB error");
  });

  it("records delete error when archivedAuditLog.deleteMany throws", async () => {
    const policy = makePolicy({ archiveAfterDays: null, deleteAfterDays: 365 });
    mockAuditRetentionPolicyFindUnique.mockResolvedValue(policy);
    mockArchivedAuditLogDeleteMany.mockRejectedValue(new Error("Delete DB error"));

    const result = await AuditRetentionManager.executeRetentionJob("policy-1");

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("Delete error");
    expect(result.errors[0]).toContain("Delete DB error");
  });

  it("creates archived records with correct mapping", async () => {
    const policy = makePolicy({ archiveAfterDays: 30, deleteAfterDays: null });
    mockAuditRetentionPolicyFindUnique.mockResolvedValue(policy);

    const log = {
      id: "log-abc",
      workspaceId: "ws-1",
      userId: "user-xyz",
      action: "ROLE_CHANGE",
      targetId: "target-1",
      targetType: "User",
      resourceId: null,
      resourceType: null,
      metadata: { key: "value" },
      ipAddress: "1.2.3.4",
      userAgent: "Mozilla/5.0",
      createdAt: new Date("2024-01-01"),
    };
    mockWorkspaceAuditLogFindMany.mockResolvedValue([log]);
    mockArchivedAuditLogCreateMany.mockResolvedValue({ count: 1 });
    mockWorkspaceAuditLogDeleteMany.mockResolvedValue({ count: 1 });

    await AuditRetentionManager.executeRetentionJob("policy-1");

    expect(mockArchivedAuditLogCreateMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          originalId: "log-abc",
          workspaceId: "ws-1",
          userId: "user-xyz",
          action: "ROLE_CHANGE",
          originalCreatedAt: log.createdAt,
          retentionPolicyId: "policy-1",
          archiveReason: "scheduled",
        }),
      ],
    });
  });
});

// ---------------------------------------------------------------------------
// executeAllRetentionJobs
// ---------------------------------------------------------------------------
describe("AuditRetentionManager.executeAllRetentionJobs", () => {
  it("runs jobs for all active policies and returns results", async () => {
    const activePolicies = [makePolicy({ id: "p-active-1" }), makePolicy({ id: "p-active-2" })];
    mockAuditRetentionPolicyFindMany.mockResolvedValue(activePolicies);

    // Both policies will be fetched individually
    mockAuditRetentionPolicyFindUnique
      .mockResolvedValueOnce(
        makePolicy({ id: "p-active-1", archiveAfterDays: null, deleteAfterDays: null }),
      )
      .mockResolvedValueOnce(
        makePolicy({ id: "p-active-2", archiveAfterDays: null, deleteAfterDays: null }),
      );

    const results = await AuditRetentionManager.executeAllRetentionJobs();

    expect(results).toHaveLength(2);
    expect(results[0]!.policyId).toBe("p-active-1");
    expect(results[1]!.policyId).toBe("p-active-2");
  });

  it("returns empty array when no active policies", async () => {
    mockAuditRetentionPolicyFindMany.mockResolvedValue([]);

    const results = await AuditRetentionManager.executeAllRetentionJobs();

    expect(results).toEqual([]);
  });

  it("queries only active policies", async () => {
    mockAuditRetentionPolicyFindMany.mockResolvedValue([]);

    await AuditRetentionManager.executeAllRetentionJobs();

    expect(mockAuditRetentionPolicyFindMany).toHaveBeenCalledWith({
      where: { isActive: true },
    });
  });
});

// ---------------------------------------------------------------------------
// getRetentionStats
// ---------------------------------------------------------------------------
describe("AuditRetentionManager.getRetentionStats", () => {
  it("returns full stats when all data exists", async () => {
    const oldestActive = new Date("2023-01-01");
    const oldestArchived = new Date("2022-06-01");

    mockWorkspaceAuditLogCount.mockResolvedValue(150);
    mockArchivedAuditLogCount.mockResolvedValue(50);
    mockWorkspaceAuditLogFindFirst.mockResolvedValue({
      createdAt: oldestActive,
    });
    mockArchivedAuditLogFindFirst.mockResolvedValue({
      originalCreatedAt: oldestArchived,
    });
    // getEffectivePolicy → two findFirst calls
    mockAuditRetentionPolicyFindFirst.mockResolvedValueOnce(makePolicy({ id: "effective-policy" }));

    const stats = await AuditRetentionManager.getRetentionStats("ws-1");

    expect(stats.totalActiveLogs).toBe(150);
    expect(stats.totalArchivedLogs).toBe(50);
    expect(stats.oldestActiveLog).toEqual(oldestActive);
    expect(stats.oldestArchivedLog).toEqual(oldestArchived);
    expect(stats.effectivePolicy).not.toBeNull();
  });

  it("returns undefined for oldest logs when tables are empty", async () => {
    mockWorkspaceAuditLogCount.mockResolvedValue(0);
    mockArchivedAuditLogCount.mockResolvedValue(0);
    mockWorkspaceAuditLogFindFirst.mockResolvedValue(null);
    mockArchivedAuditLogFindFirst.mockResolvedValue(null);
    mockAuditRetentionPolicyFindFirst.mockResolvedValue(null);

    const stats = await AuditRetentionManager.getRetentionStats("ws-empty");

    expect(stats.oldestActiveLog).toBeUndefined();
    expect(stats.oldestArchivedLog).toBeUndefined();
    expect(stats.totalActiveLogs).toBe(0);
    expect(stats.totalArchivedLogs).toBe(0);
  });

  it("queries the correct workspaceId for all sub-queries", async () => {
    mockWorkspaceAuditLogCount.mockResolvedValue(10);
    mockArchivedAuditLogCount.mockResolvedValue(5);
    mockWorkspaceAuditLogFindFirst.mockResolvedValue(null);
    mockArchivedAuditLogFindFirst.mockResolvedValue(null);
    mockAuditRetentionPolicyFindFirst.mockResolvedValue(null);

    await AuditRetentionManager.getRetentionStats("ws-specific");

    expect(mockWorkspaceAuditLogCount).toHaveBeenCalledWith({
      where: { workspaceId: "ws-specific" },
    });
    expect(mockArchivedAuditLogCount).toHaveBeenCalledWith({
      where: { workspaceId: "ws-specific" },
    });
  });
});

// ---------------------------------------------------------------------------
// ensureDefaultPolicy
// ---------------------------------------------------------------------------
describe("AuditRetentionManager.ensureDefaultPolicy", () => {
  it("returns existing default policy when one exists", async () => {
    const existing = makePolicy({
      workspaceId: null,
      name: "System Default",
      id: "default-policy",
    });
    mockAuditRetentionPolicyFindFirst.mockResolvedValue(existing);

    const result = await AuditRetentionManager.ensureDefaultPolicy();

    expect(result!.id).toBe("default-policy");
    expect(mockAuditRetentionPolicyCreate).not.toHaveBeenCalled();
  });

  it("creates new default policy when none exists", async () => {
    mockAuditRetentionPolicyFindFirst.mockResolvedValue(null);
    const created = makePolicy({ workspaceId: null, name: "System Default", id: "new-default" });
    mockAuditRetentionPolicyCreate.mockResolvedValue(created);

    const result = await AuditRetentionManager.ensureDefaultPolicy();

    expect(mockAuditRetentionPolicyCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: null,
        name: "System Default",
        retentionDays: 365,
        archiveAfterDays: 90,
        deleteAfterDays: 730,
        isActive: true,
      }),
    });
    expect(result!.id).toBe("new-default");
  });

  it("searches for existing policy with correct criteria", async () => {
    mockAuditRetentionPolicyFindFirst.mockResolvedValue(null);
    mockAuditRetentionPolicyCreate.mockResolvedValue(
      makePolicy({ workspaceId: null, name: "System Default" }),
    );

    await AuditRetentionManager.ensureDefaultPolicy();

    expect(mockAuditRetentionPolicyFindFirst).toHaveBeenCalledWith({
      where: { workspaceId: null, name: "System Default" },
    });
  });
});
