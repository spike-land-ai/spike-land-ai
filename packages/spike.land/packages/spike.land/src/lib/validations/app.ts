import { z } from "zod";

export const MONETIZATION_MODELS = [
  "free",
  "freemium",
  "subscription",
  "one-time",
  "usage-based",
] as const;

export const APP_BUILD_STATUSES = [
  "PROMPTING",
  "WAITING",
  "DRAFTING",
  "BUILDING",
  "FINE_TUNING",
  "TEST",
  "LIVE",
  "ARCHIVED",
  "FAILED",
] as const;

export const APP_MESSAGE_ROLES = ["USER", "AGENT", "SYSTEM"] as const;

export const appCreationSchema = z.object({
  name: z
    .string()
    .min(3, "App name must be at least 3 characters")
    .max(50, "App name must be less than 50 characters")
    .regex(
      /^[a-zA-Z0-9\s-]+$/,
      "App name can only contain letters, numbers, spaces, and hyphens",
    ),
  description: z
    .string()
    .min(10, "Description must be at least 10 characters")
    .max(500, "Description must be less than 500 characters"),
  requirements: z
    .string()
    .min(20, "Requirements must be at least 20 characters")
    .max(2000, "Requirements must be less than 2000 characters"),
  monetizationModel: z.enum(MONETIZATION_MODELS, {
    message: "Please select a monetization model",
  }),
  codespaceId: z
    .string()
    .regex(
      /^[a-zA-Z0-9_.-]+$/,
      "Codespace ID can only contain letters, numbers, hyphens, underscores, and dots",
    )
    .max(100)
    .optional(),
});

// Simplified app creation schema for prompt-based flow
export const appPromptCreationSchema = z.object({
  prompt: z
    .string()
    .min(10, "Prompt must be at least 10 characters")
    .max(4000, "Prompt must be less than 4000 characters"),
  codespaceId: z
    .string()
    .regex(
      /^[a-z0-9.-]{10,50}$/,
      "Codespace ID must be 10-50 characters with only lowercase letters, numbers, dots, and hyphens",
    )
    .optional(),
  imageIds: z.array(z.string()).optional(),
  templateId: z.string().optional(), // Template to use for initial code
  workspaceId: z.string().optional(), // Workspace to link this app to
  linkedCampaign: z.string().optional(), // Campaign name/ID for tracking
});

// Schema for app message creation
export const appMessageCreateSchema = z.object({
  content: z
    .string()
    .min(1, "Message cannot be empty")
    .max(10000, "Message is too long"),
  imageIds: z.array(z.string()).optional(),
});

// Schema for updating app status
export const appStatusUpdateSchema = z.object({
  status: z.enum(APP_BUILD_STATUSES),
  message: z.string().max(1000).optional(),
});

// Schema for updating app settings
export const appSettingsUpdateSchema = z.object({
  name: z
    .string()
    .min(3, "App name must be at least 3 characters")
    .max(50, "App name must be less than 50 characters")
    .regex(
      /^[a-zA-Z0-9\s-]+$/,
      "App name can only contain letters, numbers, spaces, and hyphens",
    )
    .optional(),
  description: z
    .string()
    .max(500, "Description must be less than 500 characters")
    .optional(),
  isPublic: z.boolean().optional(),
  codespaceId: z
    .string()
    .regex(
      /^[a-zA-Z0-9_.-]+$/,
      "Codespace ID can only contain letters, numbers, hyphens, underscores, and dots",
    )
    .max(100)
    .optional(),
});

// Schema for linking a codespace to an existing app (PATCH operation)
export const appCodespaceLinkSchema = z.object({
  codespaceId: z
    .string()
    .regex(
      /^[a-zA-Z0-9_.-]+$/,
      "Codespace ID can only contain letters, numbers, hyphens, underscores, and dots",
    )
    .max(100),
});

// Schema for agent updates (internal use)
export const agentAppUpdateSchema = z.object({
  name: z
    .string()
    .min(3, "App name must be at least 3 characters")
    .max(50, "App name must be less than 50 characters")
    .optional(),
  description: z
    .string()
    .max(500, "Description must be less than 500 characters")
    .optional(),
  status: z.enum(APP_BUILD_STATUSES).optional(),
  statusMessage: z.string().max(1000).optional(),
  codespaceId: z
    .string()
    .regex(
      /^[a-zA-Z0-9_.-]+$/,
      "Codespace ID can only contain letters, numbers, hyphens, underscores, and dots",
    )
    .max(100)
    .optional(),
  isPublic: z.boolean().optional(),
  isCurated: z.boolean().optional(),
  agentMessage: z.string().max(10000).optional(),
  systemMessage: z.string().max(10000).optional(),
});

export type AppCreationFormData = z.infer<typeof appCreationSchema>;

export const step1Schema = appCreationSchema.pick({
  name: true,
  description: true,
});

export const step2Schema = appCreationSchema.pick({
  requirements: true,
});

export const step3Schema = appCreationSchema.pick({
  monetizationModel: true,
});
