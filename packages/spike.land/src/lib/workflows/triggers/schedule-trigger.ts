/**
 * Schedule Trigger Service
 *
 * Handles cron-based workflow scheduling with timezone support.
 */

import prisma from "@/lib/prisma";
import type {
  CreateScheduleInput,
  UpdateScheduleInput,
  WorkflowScheduleData,
} from "@/types/workflow";

/**
 * Cron expression field ranges
 */
const CRON_RANGES = {
  minute: { min: 0, max: 59 },
  hour: { min: 0, max: 23 },
  dayOfMonth: { min: 1, max: 31 },
  month: { min: 1, max: 12 },
  dayOfWeek: { min: 0, max: 7 }, // 0 and 7 both represent Sunday
};

/**
 * Parse a cron field (supports *, numbers, ranges, steps, and lists)
 */
function parseCronField(field: string, fieldName: keyof typeof CRON_RANGES): number[] | null {
  const range = CRON_RANGES[fieldName];
  const values: Set<number> = new Set();

  // Handle list (comma-separated)
  const parts = field.split(",");

  for (const part of parts) {
    const trimmed = part.trim();

    // Handle step (e.g., */5, 1-10/2)
    const stepMatch = trimmed.match(/^(.+)\/(\d+)$/);
    let base = trimmed;
    let step = 1;

    if (stepMatch && stepMatch[1] && stepMatch[2]) {
      base = stepMatch[1];
      step = parseInt(stepMatch[2], 10);
      if (step <= 0) return null;
    }

    // Handle wildcard
    if (base === "*") {
      for (let i = range.min; i <= range.max; i += step) {
        values.add(i);
      }
      continue;
    }

    // Handle range (e.g., 1-5)
    const rangeMatch = base.match(/^(\d+)-(\d+)$/);
    if (rangeMatch && rangeMatch[1] && rangeMatch[2]) {
      const start = parseInt(rangeMatch[1], 10);
      const end = parseInt(rangeMatch[2], 10);
      if (start < range.min || end > range.max || start > end) return null;
      for (let i = start; i <= end; i += step) {
        values.add(i);
      }
      continue;
    }

    // Handle single number
    const num = parseInt(base, 10);
    if (isNaN(num) || num < range.min || num > range.max) return null;
    values.add(num);
  }

  return values.size > 0 ? Array.from(values).sort((a, b) => a - b) : null;
}

/**
 * Parsed cron expression
 */
export interface ParsedCron {
  minutes: number[];
  hours: number[];
  daysOfMonth: number[];
  months: number[];
  daysOfWeek: number[];
}

/**
 * Parse a cron expression (5 fields: minute hour dayOfMonth month dayOfWeek)
 *
 * @param expression - Cron expression string
 * @returns Parsed cron fields or null if invalid
 */
export function parseCronExpression(expression: string): ParsedCron | null {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) return null;

  // After length check, we know all 5 fields exist
  const [minuteField, hourField, domField, monthField, dowField] = fields as [
    string,
    string,
    string,
    string,
    string,
  ];

  const minutes = parseCronField(minuteField, "minute");
  const hours = parseCronField(hourField, "hour");
  const daysOfMonth = parseCronField(domField, "dayOfMonth");
  const months = parseCronField(monthField, "month");
  const daysOfWeek = parseCronField(dowField, "dayOfWeek");

  if (!minutes || !hours || !daysOfMonth || !months || !daysOfWeek) {
    return null;
  }

  // Normalize day of week (7 -> 0 for Sunday)
  const normalizedDaysOfWeek = daysOfWeek.map((d) => (d === 7 ? 0 : d));

  return {
    minutes,
    hours,
    daysOfMonth,
    months,
    daysOfWeek: [...new Set(normalizedDaysOfWeek)].sort((a, b) => a - b),
  };
}

/**
 * Validate a cron expression
 *
 * @param expression - Cron expression string
 * @returns Validation result with error message if invalid
 */
export function validateCronExpression(expression: string): {
  valid: boolean;
  error?: string;
} {
  const parsed = parseCronExpression(expression);
  if (!parsed) {
    return {
      valid: false,
      error: "Invalid cron expression. Expected format: 'minute hour dayOfMonth month dayOfWeek'",
    };
  }
  return { valid: true };
}

/**
 * Calculate the next run time after a given date
 *
 * @param cron - Parsed cron expression
 * @param after - Date to calculate next run after
 * @param timezone - IANA timezone string
 * @returns Next run date or null if no valid date within next year
 */
export function getNextRunTime(
  cron: ParsedCron,
  after: Date,
  timezone: string = "UTC",
): Date | null {
  // Convert to timezone
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  // Start from the next minute
  const start = new Date(after.getTime() + 60000);
  start.setSeconds(0, 0);

  // Search for up to 1 year
  const maxDate = new Date(start.getTime() + 365 * 24 * 60 * 60 * 1000);

  let current = new Date(start);

  while (current < maxDate) {
    // Get parts in the target timezone
    const parts = formatter.formatToParts(current);
    const getPart = (type: string): number => {
      const part = parts.find((p) => p.type === type);
      return part ? parseInt(part.value, 10) : 0;
    };

    const month = getPart("month");
    const dayOfMonth = getPart("day");
    const hour = getPart("hour");
    const minute = getPart("minute");
    const dayOfWeek = current.getDay(); // 0-6, Sunday = 0

    // Check if this time matches the cron expression
    const matchesMinute = cron.minutes.includes(minute);
    const matchesHour = cron.hours.includes(hour);
    const matchesMonth = cron.months.includes(month);
    const matchesDayOfMonth = cron.daysOfMonth.includes(dayOfMonth);
    const matchesDayOfWeek = cron.daysOfWeek.includes(dayOfWeek);

    // Day matching: either dayOfMonth OR dayOfWeek must match
    // (unless both are restricted, then both must match)
    const dayOfMonthIsWildcard = cron.daysOfMonth.length === 31;
    const dayOfWeekIsWildcard = cron.daysOfWeek.length === 7;

    let matchesDay: boolean;
    if (dayOfMonthIsWildcard && dayOfWeekIsWildcard) {
      matchesDay = true;
    } else if (dayOfMonthIsWildcard) {
      matchesDay = matchesDayOfWeek;
    } else if (dayOfWeekIsWildcard) {
      matchesDay = matchesDayOfMonth;
    } else {
      // Both are restricted - match if either matches (standard cron behavior)
      matchesDay = matchesDayOfMonth || matchesDayOfWeek;
    }

    if (matchesMinute && matchesHour && matchesMonth && matchesDay) {
      return current;
    }

    // Increment by 1 minute
    current = new Date(current.getTime() + 60000);
  }

  return null;
}

/**
 * Describe a cron expression in human-readable format
 */
export function describeCronExpression(expression: string): string | null {
  const parsed = parseCronExpression(expression);
  if (!parsed) return null;

  const parts: string[] = [];

  // Minutes
  if (parsed.minutes.length === 60) {
    parts.push("every minute");
  } else if (parsed.minutes.length === 1) {
    parts.push(`at minute ${parsed.minutes[0]}`);
  } else {
    parts.push(`at minutes ${parsed.minutes.join(", ")}`);
  }

  // Hours
  if (parsed.hours.length === 24) {
    parts.push("of every hour");
  } else if (parsed.hours.length === 1) {
    parts.push(`of hour ${parsed.hours[0]}`);
  } else {
    parts.push(`of hours ${parsed.hours.join(", ")}`);
  }

  return parts.join(" ");
}

// ============================================================================
// Database Operations
// ============================================================================

/**
 * Create a schedule trigger for a workflow
 */
export async function createScheduleTrigger(
  workflowId: string,
  workspaceId: string,
  input: CreateScheduleInput,
): Promise<WorkflowScheduleData> {
  // Verify workflow exists and belongs to workspace
  const workflow = await prisma.workflow.findFirst({
    where: { id: workflowId, workspaceId },
  });

  if (!workflow) {
    throw new Error("Workflow not found");
  }

  // Validate cron expression
  const validation = validateCronExpression(input.cronExpression);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Calculate next run time
  const parsed = parseCronExpression(input.cronExpression)!;
  const nextRunAt = getNextRunTime(parsed, new Date(), input.timezone ?? "UTC");

  const schedule = await prisma.workflowSchedule.create({
    data: {
      workflowId,
      cronExpression: input.cronExpression,
      timezone: input.timezone ?? "UTC",
      nextRunAt,
    },
  });

  return mapScheduleToData(schedule);
}

/**
 * Update a schedule trigger
 */
export async function updateScheduleTrigger(
  scheduleId: string,
  workflowId: string,
  workspaceId: string,
  input: UpdateScheduleInput,
): Promise<WorkflowScheduleData> {
  // Verify workflow exists and belongs to workspace
  const workflow = await prisma.workflow.findFirst({
    where: { id: workflowId, workspaceId },
  });

  if (!workflow) {
    throw new Error("Workflow not found");
  }

  // Verify schedule exists
  const existing = await prisma.workflowSchedule.findFirst({
    where: { id: scheduleId, workflowId },
  });

  if (!existing) {
    throw new Error("Schedule not found");
  }

  // Validate cron expression if provided
  if (input.cronExpression) {
    const validation = validateCronExpression(input.cronExpression);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
  }

  // Calculate new next run time if cron or timezone changed
  let nextRunAt = existing.nextRunAt;
  const newCron = input.cronExpression ?? existing.cronExpression;
  const newTimezone = input.timezone ?? existing.timezone;

  if (input.cronExpression || input.timezone) {
    const parsed = parseCronExpression(newCron)!;
    nextRunAt = getNextRunTime(parsed, new Date(), newTimezone);
  }

  const schedule = await prisma.workflowSchedule.update({
    where: { id: scheduleId },
    data: {
      ...(input.cronExpression && { cronExpression: input.cronExpression }),
      ...(input.timezone && { timezone: input.timezone }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
      nextRunAt,
    },
  });

  return mapScheduleToData(schedule);
}

/**
 * Delete a schedule trigger
 */
export async function deleteScheduleTrigger(
  scheduleId: string,
  workflowId: string,
  workspaceId: string,
): Promise<void> {
  // Verify workflow exists and belongs to workspace
  const workflow = await prisma.workflow.findFirst({
    where: { id: workflowId, workspaceId },
  });

  if (!workflow) {
    throw new Error("Workflow not found");
  }

  // Verify schedule exists
  const existing = await prisma.workflowSchedule.findFirst({
    where: { id: scheduleId, workflowId },
  });

  if (!existing) {
    throw new Error("Schedule not found");
  }

  await prisma.workflowSchedule.delete({
    where: { id: scheduleId },
  });
}

/**
 * Get all schedule triggers for a workflow
 */
export async function getWorkflowSchedules(
  workflowId: string,
  workspaceId: string,
): Promise<WorkflowScheduleData[]> {
  // Verify workflow exists and belongs to workspace
  const workflow = await prisma.workflow.findFirst({
    where: { id: workflowId, workspaceId },
  });

  if (!workflow) {
    throw new Error("Workflow not found");
  }

  const schedules = await prisma.workflowSchedule.findMany({
    where: { workflowId },
    orderBy: { createdAt: "asc" },
  });

  return schedules.map(mapScheduleToData);
}

/**
 * Get schedules that are due to run
 */
export async function getDueSchedules(): Promise<
  Array<{
    scheduleId: string;
    workflowId: string;
    workspaceId: string;
    cronExpression: string;
    timezone: string;
  }>
> {
  const now = new Date();

  const schedules = await prisma.workflowSchedule.findMany({
    where: {
      isActive: true,
      nextRunAt: {
        lte: now,
      },
    },
    include: {
      workflow: {
        select: {
          workspaceId: true,
          status: true,
        },
      },
    },
  });

  // Filter to only active workflows
  return schedules
    .filter((s) => s.workflow.status === "ACTIVE")
    .map((s) => ({
      scheduleId: s.id,
      workflowId: s.workflowId,
      workspaceId: s.workflow.workspaceId,
      cronExpression: s.cronExpression,
      timezone: s.timezone,
    }));
}

/**
 * Mark a schedule as having run and calculate next run time
 */
export async function markScheduleRun(scheduleId: string): Promise<void> {
  const schedule = await prisma.workflowSchedule.findUnique({
    where: { id: scheduleId },
  });

  if (!schedule) return;

  const parsed = parseCronExpression(schedule.cronExpression);
  if (!parsed) return;

  const nextRunAt = getNextRunTime(parsed, new Date(), schedule.timezone);

  await prisma.workflowSchedule.update({
    where: { id: scheduleId },
    data: {
      lastRunAt: new Date(),
      nextRunAt,
    },
  });
}

// ============================================================================
// Helper Functions
// ============================================================================

function mapScheduleToData(schedule: {
  id: string;
  workflowId: string;
  cronExpression: string;
  timezone: string;
  isActive: boolean;
  nextRunAt: Date | null;
  lastRunAt: Date | null;
}): WorkflowScheduleData {
  return {
    id: schedule.id,
    workflowId: schedule.workflowId,
    cronExpression: schedule.cronExpression,
    timezone: schedule.timezone,
    isActive: schedule.isActive,
    nextRunAt: schedule.nextRunAt,
    lastRunAt: schedule.lastRunAt,
  };
}
