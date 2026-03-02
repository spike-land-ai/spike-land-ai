import { z } from "zod";

export const SkillInputSchema = z.object({
  uri: z.string().min(1).describe("ESCO skill URI"),
  title: z.string().min(1).describe("Skill name"),
  proficiency: z.number().int().min(1).max(5).describe("Self-assessed proficiency 1-5"),
});

export const AssessSkillsSchema = z.object({
  skills: z.array(SkillInputSchema).min(1).max(50).describe("User's skills with proficiency"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .describe("Max occupations to return (default 10)"),
});

export const SearchOccupationsSchema = z.object({
  query: z.string().min(1).max(200).describe("Search query for occupations"),
  limit: z.number().int().min(1).max(100).optional().describe("Max results (default 20)"),
  offset: z.number().int().min(0).optional().describe("Offset for pagination (default 0)"),
});

export const GetOccupationSchema = z.object({
  uri: z.string().min(1).describe("ESCO occupation URI"),
});

export const CompareSkillsSchema = z.object({
  skills: z.array(SkillInputSchema).min(1).max(50).describe("User's skills"),
  occupationUri: z.string().min(1).describe("ESCO occupation URI to compare against"),
});

export const GetSalarySchema = z.object({
  occupationTitle: z.string().min(1).describe("Occupation title for salary lookup"),
  countryCode: z.string().length(2).optional().describe("ISO country code (default: gb)"),
});

export const GetJobsSchema = z.object({
  query: z.string().min(1).max(200).describe("Job search query"),
  location: z.string().optional().describe("Location (city or region)"),
  countryCode: z.string().length(2).optional().describe("ISO country code (default: gb)"),
  page: z.number().int().min(1).optional().describe("Page number (default 1)"),
  limit: z.number().int().min(1).max(50).optional().describe("Results per page (default 10)"),
});

export const SearchSkillsSchema = z.object({
  query: z.string().min(1).max(200).describe("Search query for skills"),
  limit: z.number().int().min(1).max(50).optional().describe("Max results (default 10)"),
});
