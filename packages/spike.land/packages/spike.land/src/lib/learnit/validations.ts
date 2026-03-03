import { z } from "zod";

export const pathSegmentSchema = z
  .string()
  .regex(/^[a-z0-9-]+$/, "Lowercase alphanumeric with hyphens only")
  .min(2, "Segment too short")
  .max(50, "Segment too long");

export const learnItPathSchema = z
  .array(pathSegmentSchema)
  .min(1, "Path required")
  .max(10, "Path too deep (max 10 levels)");

export const generateTopicSchema = z.object({
  path: learnItPathSchema,
});
