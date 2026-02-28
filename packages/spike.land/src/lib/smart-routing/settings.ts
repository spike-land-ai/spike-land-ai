import prisma from "../prisma";
import { SmartRoutingSettingsSchema } from "../validations/smart-routing";
import type { SmartRoutingSettings } from "./types";
import { logger } from "@/lib/logger";

const DEFAULT_SETTINGS: SmartRoutingSettings = {
  enabled: true,
  autoAnalyzeOnFetch: true,
  negativeSentimentThreshold: -0.3,
  priorityWeights: {
    sentiment: 30,
    urgency: 25,
    followerCount: 20,
    engagement: 15,
    accountTier: 10,
  },
  escalation: {
    enabled: true,
    slaTimeoutMinutes: 60,
    levels: [
      { level: 0, name: "Normal", notifyChannels: [] },
      {
        level: 1,
        name: "Supervisor",
        notifyChannels: ["in_app"],
        triggerDelayMinutes: 60,
      },
      {
        level: 2,
        name: "Manager",
        notifyChannels: ["email", "in_app"],
        triggerDelayMinutes: 240,
      },
      {
        level: 3,
        name: "Director",
        notifyChannels: ["email", "slack", "sms"],
        triggerDelayMinutes: 1440,
      },
    ],
    autoAssign: true,
  },
  rules: [],
};

// Key for storing settings in Workspace.settings JSON field
const SETTINGS_KEY = "inboxRouting";

export async function getSmartRoutingSettings(
  workspaceId: string,
): Promise<SmartRoutingSettings> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { settings: true },
  });

  if (!workspace?.settings) return DEFAULT_SETTINGS;

  const settings = (workspace.settings as Record<string, unknown>)
    ?.[SETTINGS_KEY];
  if (!settings) return DEFAULT_SETTINGS;

  // Validate and parse, falling back to defaults for missing fields
  const result = SmartRoutingSettingsSchema.safeParse(settings);
  if (!result.success) {
    logger.warn(
      "Invalid smart routing settings found, using defaults",
      { errors: result.error.issues },
    );
    return DEFAULT_SETTINGS;
  }

  // Merge with defaults to ensure all fields exist (especially new ones)
  return {
    ...DEFAULT_SETTINGS,
    ...result.data,
    escalation: { ...DEFAULT_SETTINGS.escalation, ...result.data.escalation },
  } as SmartRoutingSettings;
}

export async function updateSmartRoutingSettings(
  workspaceId: string,
  updates: Partial<SmartRoutingSettings>,
): Promise<SmartRoutingSettings> {
  const current = await getSmartRoutingSettings(workspaceId);
  const newSettings = { ...current, ...updates };

  // Validate before saving
  const validation = SmartRoutingSettingsSchema.safeParse(newSettings);
  if (!validation.success) {
    throw new Error("Invalid settings provided: " + validation.error.message);
  }

  // Fetch current workspace settings to preserve other keys
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { settings: true },
  });

  const fullSettings: Record<string, unknown> = (workspace?.settings as Record<string, unknown>)
    || {};
  fullSettings[SETTINGS_KEY] = newSettings;

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      settings: fullSettings as import("@/generated/prisma").Prisma.InputJsonValue,
    },
  });

  return newSettings;
}
