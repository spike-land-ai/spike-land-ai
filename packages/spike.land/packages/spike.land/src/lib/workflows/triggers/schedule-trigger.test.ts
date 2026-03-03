/**
 * Schedule Trigger Service Tests
 *
 * Tests for cron expression parsing, validation, next run time calculation,
 * and database operations.
 */

import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

// Use vi.hoisted() so variables are available inside vi.mock() factory closures
const {
  mockWorkflowFindFirst,
  mockWorkflowScheduleCreate,
  mockWorkflowScheduleUpdate,
  mockWorkflowScheduleDelete,
  mockWorkflowScheduleFindFirst,
  mockWorkflowScheduleFindMany,
  mockWorkflowScheduleFindUnique,
} = vi.hoisted(() => ({
  mockWorkflowFindFirst: vi.fn(),
  mockWorkflowScheduleCreate: vi.fn(),
  mockWorkflowScheduleUpdate: vi.fn(),
  mockWorkflowScheduleDelete: vi.fn(),
  mockWorkflowScheduleFindFirst: vi.fn(),
  mockWorkflowScheduleFindMany: vi.fn(),
  mockWorkflowScheduleFindUnique: vi.fn(),
}));

// Mock Prisma before importing the module under test
vi.mock("@/lib/prisma", () => ({
  default: {
    workflow: {
      findFirst: mockWorkflowFindFirst,
    },
    workflowSchedule: {
      create: mockWorkflowScheduleCreate,
      update: mockWorkflowScheduleUpdate,
      delete: mockWorkflowScheduleDelete,
      findFirst: mockWorkflowScheduleFindFirst,
      findMany: mockWorkflowScheduleFindMany,
      findUnique: mockWorkflowScheduleFindUnique,
    },
  },
}));

import {
  createScheduleTrigger,
  deleteScheduleTrigger,
  describeCronExpression,
  getDueSchedules,
  getNextRunTime,
  getWorkflowSchedules,
  markScheduleRun,
  parseCronExpression,
  updateScheduleTrigger,
  validateCronExpression,
} from "./schedule-trigger";

// ============================================================================
// Test helpers
// ============================================================================

function makeSchedule(overrides: Partial<{
  id: string;
  workflowId: string;
  cronExpression: string;
  timezone: string;
  isActive: boolean;
  nextRunAt: Date | null;
  lastRunAt: Date | null;
  createdAt: Date;
}> = {}) {
  return {
    id: "sched-1",
    workflowId: "wf-1",
    cronExpression: "0 9 * * 1",
    timezone: "UTC",
    isActive: true,
    nextRunAt: new Date("2025-01-06T09:00:00Z"),
    lastRunAt: null,
    createdAt: new Date("2025-01-01T00:00:00Z"),
    ...overrides,
  };
}

function makeWorkflow(overrides: Partial<{
  id: string;
  workspaceId: string;
  status: string;
}> = {}) {
  return {
    id: "wf-1",
    workspaceId: "ws-1",
    status: "ACTIVE",
    ...overrides,
  };
}

// ============================================================================
// parseCronExpression
// ============================================================================

describe("parseCronExpression", () => {
  it("parses a simple cron expression", () => {
    const result = parseCronExpression("0 9 * * 1");
    expect(result).not.toBeNull();
    expect(result!.minutes).toEqual([0]);
    expect(result!.hours).toEqual([9]);
    expect(result!.daysOfWeek).toEqual([1]);
  });

  it("parses wildcard fields", () => {
    const result = parseCronExpression("* * * * *");
    expect(result).not.toBeNull();
    expect(result!.minutes).toHaveLength(60);
    expect(result!.hours).toHaveLength(24);
    expect(result!.daysOfMonth).toHaveLength(31);
    expect(result!.months).toHaveLength(12);
    expect(result!.daysOfWeek).toHaveLength(7); // 0-6 (7 normalised to 0)
  });

  it("parses comma-separated values", () => {
    const result = parseCronExpression("0,30 8,17 * * *");
    expect(result).not.toBeNull();
    expect(result!.minutes).toEqual([0, 30]);
    expect(result!.hours).toEqual([8, 17]);
  });

  it("parses range values", () => {
    const result = parseCronExpression("0 9 1-5 * *");
    expect(result).not.toBeNull();
    expect(result!.daysOfMonth).toEqual([1, 2, 3, 4, 5]);
  });

  it("parses step values (*/5 for minutes)", () => {
    const result = parseCronExpression("*/5 * * * *");
    expect(result).not.toBeNull();
    expect(result!.minutes).toEqual([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]);
  });

  it("parses range with step (1-10/2)", () => {
    const result = parseCronExpression("0 0 1-10/2 * *");
    expect(result).not.toBeNull();
    expect(result!.daysOfMonth).toEqual([1, 3, 5, 7, 9]);
  });

  it("normalises day-of-week 7 to 0 (Sunday)", () => {
    const result = parseCronExpression("0 0 * * 7");
    expect(result).not.toBeNull();
    expect(result!.daysOfWeek).toEqual([0]);
  });

  it("deduplicates when 0 and 7 both appear (both mean Sunday)", () => {
    const result = parseCronExpression("0 0 * * 0,7");
    expect(result).not.toBeNull();
    expect(result!.daysOfWeek).toEqual([0]); // deduplicated
  });

  it("returns null for expression with wrong number of fields", () => {
    expect(parseCronExpression("* * * *")).toBeNull();
    expect(parseCronExpression("* * * * * *")).toBeNull();
    expect(parseCronExpression("")).toBeNull();
  });

  it("returns null when minute is out of range", () => {
    expect(parseCronExpression("60 * * * *")).toBeNull();
    expect(parseCronExpression("-1 * * * *")).toBeNull();
  });

  it("returns null when hour is out of range", () => {
    expect(parseCronExpression("0 24 * * *")).toBeNull();
  });

  it("returns null when day-of-month is out of range", () => {
    expect(parseCronExpression("0 0 32 * *")).toBeNull();
    expect(parseCronExpression("0 0 0 * *")).toBeNull();
  });

  it("returns null when month is out of range", () => {
    expect(parseCronExpression("0 0 * 13 *")).toBeNull();
    expect(parseCronExpression("0 0 * 0 *")).toBeNull();
  });

  it("returns null when step is zero or negative", () => {
    expect(parseCronExpression("*/0 * * * *")).toBeNull();
  });

  it("returns null for invalid range (start > end)", () => {
    expect(parseCronExpression("0 0 10-5 * *")).toBeNull();
  });

  it("handles extra whitespace in expression", () => {
    const result = parseCronExpression("  0   9   *   *   1  ");
    expect(result).not.toBeNull();
    expect(result!.hours).toEqual([9]);
  });
});

// ============================================================================
// validateCronExpression
// ============================================================================

describe("validateCronExpression", () => {
  it("returns valid: true for a valid expression", () => {
    expect(validateCronExpression("0 9 * * 1")).toEqual({ valid: true });
  });

  it("returns valid: false with an error message for an invalid expression", () => {
    const result = validateCronExpression("invalid");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Invalid cron expression");
  });

  it("returns valid: false for wrong field count", () => {
    const result = validateCronExpression("* * * *");
    expect(result.valid).toBe(false);
  });
});

// ============================================================================
// getNextRunTime
// ============================================================================

describe("getNextRunTime", () => {
  it("returns the next matching minute for * * * * *", () => {
    const cron = parseCronExpression("* * * * *")!;
    const after = new Date("2025-01-01T12:00:00Z");
    const next = getNextRunTime(cron, after, "UTC");
    // Next run should be 1 minute later
    expect(next).not.toBeNull();
    expect(next!.getTime()).toBe(new Date("2025-01-01T12:01:00Z").getTime());
  });

  it("returns a run time exactly 1 minute in the future by default", () => {
    const cron = parseCronExpression("* * * * *")!;
    const after = new Date("2025-06-15T10:30:00Z");
    const next = getNextRunTime(cron, after, "UTC");
    expect(next).not.toBeNull();
    expect(next!.getTime()).toBe(after.getTime() + 60000);
  });

  it("finds the next daily run at 9:00 UTC", () => {
    const cron = parseCronExpression("0 9 * * *")!;
    // After 9:05 the same day – next should be next day at 09:00
    const after = new Date("2025-01-01T09:05:00Z");
    const next = getNextRunTime(cron, after, "UTC");
    expect(next).not.toBeNull();
    expect(next!.toISOString()).toBe("2025-01-02T09:00:00.000Z");
  });

  it("finds the next run on a specific day of week", () => {
    const cron = parseCronExpression("0 0 * * 1")!; // Every Monday midnight
    // 2025-01-01 is a Wednesday; next Monday is 2025-01-06
    const after = new Date("2025-01-01T00:00:00Z");
    const next = getNextRunTime(cron, after, "UTC");
    expect(next).not.toBeNull();
    // 2025-01-06 is Monday
    expect(next!.getUTCDay()).toBe(1);
  });

  it("returns null when no matching time exists within a year", () => {
    // 30th of February never exists — iterates all 525,600 minutes in a year
    const cron = parseCronExpression("0 0 30 2 *")!;
    const after = new Date("2025-01-01T00:00:00Z");
    const next = getNextRunTime(cron, after, "UTC");
    expect(next).toBeNull();
  }, 60_000);

  it("defaults timezone to UTC when not provided", () => {
    const cron = parseCronExpression("0 0 * * *")!;
    const after = new Date("2025-01-01T23:00:00Z");
    const next = getNextRunTime(cron, after);
    expect(next).not.toBeNull();
    expect(next!.toISOString()).toBe("2025-01-02T00:00:00.000Z");
  });

  it("respects non-UTC timezone", () => {
    // 9:00 in America/New_York = 14:00 UTC in winter (EST = UTC-5)
    const cron = parseCronExpression("0 9 * * *")!;
    const after = new Date("2025-01-01T13:00:00Z"); // 8:00 EST
    const next = getNextRunTime(cron, after, "America/New_York");
    expect(next).not.toBeNull();
    // Should fire at 14:00 UTC (9:00 EST)
    expect(next!.getUTCHours()).toBe(14);
  });
});

// ============================================================================
// describeCronExpression
// ============================================================================

describe("describeCronExpression", () => {
  it("describes a specific time", () => {
    const desc = describeCronExpression("0 9 * * *");
    expect(desc).not.toBeNull();
    expect(desc).toContain("9");
    expect(desc).toContain("0");
  });

  it("describes every minute", () => {
    const desc = describeCronExpression("* * * * *");
    expect(desc).not.toBeNull();
    expect(desc).toContain("every minute");
  });

  it("describes multiple minutes", () => {
    const desc = describeCronExpression("0,30 * * * *");
    expect(desc).not.toBeNull();
    expect(desc).toContain("0");
    expect(desc).toContain("30");
  });

  it("describes every hour wildcard", () => {
    const desc = describeCronExpression("0 * * * *");
    expect(desc).not.toBeNull();
    expect(desc).toContain("every hour");
  });

  it("returns null for an invalid expression", () => {
    expect(describeCronExpression("invalid")).toBeNull();
  });
});

// ============================================================================
// createScheduleTrigger
// ============================================================================

describe("createScheduleTrigger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a schedule trigger successfully", async () => {
    mockWorkflowFindFirst.mockResolvedValue(makeWorkflow());
    const schedule = makeSchedule();
    mockWorkflowScheduleCreate.mockResolvedValue(schedule);

    const result = await createScheduleTrigger("wf-1", "ws-1", {
      cronExpression: "0 9 * * 1",
      timezone: "UTC",
    });

    expect(result.id).toBe("sched-1");
    expect(result.workflowId).toBe("wf-1");
    expect(result.cronExpression).toBe("0 9 * * 1");
    expect(result.timezone).toBe("UTC");
    expect(result.isActive).toBe(true);
  });

  it("defaults timezone to UTC when not provided", async () => {
    mockWorkflowFindFirst.mockResolvedValue(makeWorkflow());
    const schedule = makeSchedule({ timezone: "UTC" });
    mockWorkflowScheduleCreate.mockResolvedValue(schedule);

    await createScheduleTrigger("wf-1", "ws-1", {
      cronExpression: "0 9 * * *",
    });

    const createCall = mockWorkflowScheduleCreate.mock.calls[0]?.[0];
    expect(createCall?.data.timezone).toBe("UTC");
  });

  it("throws when workflow is not found", async () => {
    mockWorkflowFindFirst.mockResolvedValue(null);

    await expect(
      createScheduleTrigger("missing", "ws-1", { cronExpression: "* * * * *" }),
    ).rejects.toThrow("Workflow not found");
  });

  it("throws when cron expression is invalid", async () => {
    mockWorkflowFindFirst.mockResolvedValue(makeWorkflow());

    await expect(
      createScheduleTrigger("wf-1", "ws-1", { cronExpression: "bad-cron" }),
    ).rejects.toThrow("Invalid cron expression");
  });

  it("passes calculated nextRunAt to the database", async () => {
    mockWorkflowFindFirst.mockResolvedValue(makeWorkflow());
    const schedule = makeSchedule();
    mockWorkflowScheduleCreate.mockResolvedValue(schedule);

    await createScheduleTrigger("wf-1", "ws-1", {
      cronExpression: "0 9 * * 1",
      timezone: "UTC",
    });

    const createData = mockWorkflowScheduleCreate.mock.calls[0]?.[0]?.data;
    // nextRunAt should be a Date or null (could be null if no match within a year)
    expect(createData).toHaveProperty("nextRunAt");
  });
});

// ============================================================================
// updateScheduleTrigger
// ============================================================================

describe("updateScheduleTrigger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates a schedule trigger successfully", async () => {
    const updated = makeSchedule({ cronExpression: "0 10 * * *" });
    mockWorkflowFindFirst.mockResolvedValue(makeWorkflow());
    mockWorkflowScheduleFindFirst.mockResolvedValue(makeSchedule());
    mockWorkflowScheduleUpdate.mockResolvedValue(updated);

    const result = await updateScheduleTrigger("sched-1", "wf-1", "ws-1", {
      cronExpression: "0 10 * * *",
    });

    expect(result.cronExpression).toBe("0 10 * * *");
  });

  it("throws when workflow is not found", async () => {
    mockWorkflowFindFirst.mockResolvedValue(null);

    await expect(
      updateScheduleTrigger("sched-1", "wf-1", "ws-1", {}),
    ).rejects.toThrow("Workflow not found");
  });

  it("throws when schedule is not found", async () => {
    mockWorkflowFindFirst.mockResolvedValue(makeWorkflow());
    mockWorkflowScheduleFindFirst.mockResolvedValue(null);

    await expect(
      updateScheduleTrigger("missing", "wf-1", "ws-1", {}),
    ).rejects.toThrow("Schedule not found");
  });

  it("throws when an invalid cron expression is provided", async () => {
    mockWorkflowFindFirst.mockResolvedValue(makeWorkflow());
    mockWorkflowScheduleFindFirst.mockResolvedValue(makeSchedule());

    await expect(
      updateScheduleTrigger("sched-1", "wf-1", "ws-1", { cronExpression: "bad" }),
    ).rejects.toThrow("Invalid cron expression");
  });

  it("recalculates nextRunAt when cronExpression changes", async () => {
    mockWorkflowFindFirst.mockResolvedValue(makeWorkflow());
    mockWorkflowScheduleFindFirst.mockResolvedValue(makeSchedule());
    mockWorkflowScheduleUpdate.mockResolvedValue(makeSchedule());

    await updateScheduleTrigger("sched-1", "wf-1", "ws-1", {
      cronExpression: "0 10 * * *",
    });

    const updateData = mockWorkflowScheduleUpdate.mock.calls[0]?.[0]?.data;
    expect(updateData).toHaveProperty("nextRunAt");
  });

  it("recalculates nextRunAt when timezone changes", async () => {
    mockWorkflowFindFirst.mockResolvedValue(makeWorkflow());
    mockWorkflowScheduleFindFirst.mockResolvedValue(makeSchedule());
    mockWorkflowScheduleUpdate.mockResolvedValue(makeSchedule());

    await updateScheduleTrigger("sched-1", "wf-1", "ws-1", {
      timezone: "America/New_York",
    });

    const updateData = mockWorkflowScheduleUpdate.mock.calls[0]?.[0]?.data;
    expect(updateData).toHaveProperty("nextRunAt");
  });

  it("updates isActive flag", async () => {
    mockWorkflowFindFirst.mockResolvedValue(makeWorkflow());
    mockWorkflowScheduleFindFirst.mockResolvedValue(makeSchedule());
    mockWorkflowScheduleUpdate.mockResolvedValue(makeSchedule({ isActive: false }));

    const result = await updateScheduleTrigger("sched-1", "wf-1", "ws-1", {
      isActive: false,
    });

    // The result should reflect what prisma returned
    expect(result.isActive).toBe(false);
  });
});

// ============================================================================
// deleteScheduleTrigger
// ============================================================================

describe("deleteScheduleTrigger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes a schedule trigger successfully", async () => {
    mockWorkflowFindFirst.mockResolvedValue(makeWorkflow());
    mockWorkflowScheduleFindFirst.mockResolvedValue(makeSchedule());
    mockWorkflowScheduleDelete.mockResolvedValue(makeSchedule());

    await expect(
      deleteScheduleTrigger("sched-1", "wf-1", "ws-1"),
    ).resolves.toBeUndefined();

    expect(mockWorkflowScheduleDelete).toHaveBeenCalledWith({
      where: { id: "sched-1" },
    });
  });

  it("throws when workflow is not found", async () => {
    mockWorkflowFindFirst.mockResolvedValue(null);

    await expect(
      deleteScheduleTrigger("sched-1", "wf-1", "ws-1"),
    ).rejects.toThrow("Workflow not found");
  });

  it("throws when schedule is not found", async () => {
    mockWorkflowFindFirst.mockResolvedValue(makeWorkflow());
    mockWorkflowScheduleFindFirst.mockResolvedValue(null);

    await expect(
      deleteScheduleTrigger("missing", "wf-1", "ws-1"),
    ).rejects.toThrow("Schedule not found");
  });
});

// ============================================================================
// getWorkflowSchedules
// ============================================================================

describe("getWorkflowSchedules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns all schedules for a workflow", async () => {
    const schedules = [
      makeSchedule({ id: "s1" }),
      makeSchedule({ id: "s2", cronExpression: "0 17 * * 5" }),
    ];
    mockWorkflowFindFirst.mockResolvedValue(makeWorkflow());
    mockWorkflowScheduleFindMany.mockResolvedValue(schedules);

    const result = await getWorkflowSchedules("wf-1", "ws-1");

    expect(result).toHaveLength(2);
    expect(result[0]?.id).toBe("s1");
    expect(result[1]?.id).toBe("s2");
  });

  it("returns empty array when there are no schedules", async () => {
    mockWorkflowFindFirst.mockResolvedValue(makeWorkflow());
    mockWorkflowScheduleFindMany.mockResolvedValue([]);

    const result = await getWorkflowSchedules("wf-1", "ws-1");
    expect(result).toEqual([]);
  });

  it("throws when workflow is not found", async () => {
    mockWorkflowFindFirst.mockResolvedValue(null);

    await expect(
      getWorkflowSchedules("missing", "ws-1"),
    ).rejects.toThrow("Workflow not found");
  });
});

// ============================================================================
// getDueSchedules
// ============================================================================

describe("getDueSchedules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns active workflows that are due", async () => {
    const dueSchedules = [
      {
        id: "s1",
        workflowId: "wf-1",
        cronExpression: "* * * * *",
        timezone: "UTC",
        workflow: { workspaceId: "ws-1", status: "ACTIVE" },
      },
    ];
    mockWorkflowScheduleFindMany.mockResolvedValue(dueSchedules);

    const result = await getDueSchedules();
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      scheduleId: "s1",
      workflowId: "wf-1",
      workspaceId: "ws-1",
      cronExpression: "* * * * *",
      timezone: "UTC",
    });
  });

  it("filters out non-ACTIVE workflows", async () => {
    const dueSchedules = [
      {
        id: "s1",
        workflowId: "wf-1",
        cronExpression: "* * * * *",
        timezone: "UTC",
        workflow: { workspaceId: "ws-1", status: "DRAFT" },
      },
      {
        id: "s2",
        workflowId: "wf-2",
        cronExpression: "0 9 * * *",
        timezone: "UTC",
        workflow: { workspaceId: "ws-1", status: "ACTIVE" },
      },
    ];
    mockWorkflowScheduleFindMany.mockResolvedValue(dueSchedules);

    const result = await getDueSchedules();
    expect(result).toHaveLength(1);
    expect(result[0]?.scheduleId).toBe("s2");
  });

  it("returns empty array when no schedules are due", async () => {
    mockWorkflowScheduleFindMany.mockResolvedValue([]);

    const result = await getDueSchedules();
    expect(result).toEqual([]);
  });

  it("queries with isActive: true and nextRunAt <= now", async () => {
    mockWorkflowScheduleFindMany.mockResolvedValue([]);

    await getDueSchedules();

    const query = mockWorkflowScheduleFindMany.mock.calls[0]?.[0]?.where;
    expect(query?.isActive).toBe(true);
    expect(query?.nextRunAt).toHaveProperty("lte");
  });
});

// ============================================================================
// markScheduleRun
// ============================================================================

describe("markScheduleRun", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates lastRunAt and calculates new nextRunAt", async () => {
    const schedule = makeSchedule({ cronExpression: "0 9 * * *" });
    mockWorkflowScheduleFindUnique.mockResolvedValue(schedule);
    mockWorkflowScheduleUpdate.mockResolvedValue(schedule);

    await markScheduleRun("sched-1");

    expect(mockWorkflowScheduleUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sched-1" },
        data: expect.objectContaining({
          lastRunAt: expect.any(Date),
        }),
      }),
    );
  });

  it("does nothing when schedule is not found", async () => {
    mockWorkflowScheduleFindUnique.mockResolvedValue(null);

    await expect(markScheduleRun("missing")).resolves.toBeUndefined();
    expect(mockWorkflowScheduleUpdate).not.toHaveBeenCalled();
  });

  it("handles invalid cron expression gracefully", async () => {
    const schedule = makeSchedule({ cronExpression: "invalid" });
    mockWorkflowScheduleFindUnique.mockResolvedValue(schedule);

    // Should not throw even if cron is unparseable – it just skips update
    await expect(markScheduleRun("sched-1")).resolves.toBeUndefined();
    expect(mockWorkflowScheduleUpdate).not.toHaveBeenCalled();
  });

  it("stores a Date object for lastRunAt", async () => {
    const schedule = makeSchedule();
    mockWorkflowScheduleFindUnique.mockResolvedValue(schedule);
    mockWorkflowScheduleUpdate.mockResolvedValue(schedule);

    await markScheduleRun("sched-1");

    const updateData = mockWorkflowScheduleUpdate.mock.calls[0]?.[0]?.data;
    expect(updateData?.lastRunAt).toBeInstanceOf(Date);
  });
});
