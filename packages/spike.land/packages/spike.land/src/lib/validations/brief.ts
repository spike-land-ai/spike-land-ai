import { z } from "zod";

export const targetAudienceSchema = z.object({
  demographics: z.object({
    ageRange: z.string().min(1, "Age range is required."),
    gender: z.string().min(1, "Gender is required."),
    location: z.string().min(1, "Location is required."),
  }),
  interests: z.array(z.string()).min(1, "At least one interest is required."),
  behaviors: z.array(z.string()).min(1, "At least one behavior is required."),
});

export const campaignObjectivesSchema = z.object({
  objective: z.string().min(1, "Objective is required."),
  kpis: z.array(z.string()).min(1, "At least one KPI is required."),
  successMetrics: z.string().min(1, "Success metrics are required."),
});
