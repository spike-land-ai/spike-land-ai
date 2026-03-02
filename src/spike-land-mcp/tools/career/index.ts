/**
 * Career MCP Tools (CF Workers)
 *
 * Skills assessment, occupation search, salary data, and job listings
 * powered by ESCO and Adzuna APIs via spike.land proxy.
 */

import { z } from "zod";
import type { ToolRegistryAdapter } from "../types";
import { freeTool } from "../../procedures/index";
import { textResult, safeToolCall, apiRequest } from "../tool-helpers";
import type { DrizzleDB } from "../../db/index";

// ─── Schemas ────────────────────────────────────────────────────────────────

const SkillEntrySchema = z.object({
  title: z.string().describe("Skill title"),
  proficiency: z.number().min(0).max(5).optional().describe("Proficiency level 0-5"),
});

const AssessSkillsSchema = z.object({
  skills: z.array(SkillEntrySchema).min(1).describe("User's skills to assess against occupations"),
  limit: z.number().int().min(1).max(20).optional().describe("Max matches (default 10)"),
});

const SearchOccupationsSchema = z.object({
  query: z.string().min(1).describe("Search query for ESCO occupation database"),
  limit: z.number().int().min(1).max(50).optional().describe("Max results (default 20)"),
  offset: z.number().int().min(0).optional().describe("Offset for pagination (default 0)"),
});

const GetOccupationSchema = z.object({
  uri: z.string().min(1).describe("ESCO occupation URI"),
});

const CompareSkillsSchema = z.object({
  skills: z.array(SkillEntrySchema).min(1).describe("User's skills"),
  occupationUri: z.string().min(1).describe("ESCO occupation URI to compare against"),
});

const GetSalarySchema = z.object({
  occupationTitle: z.string().min(1).describe("Occupation title for salary lookup"),
  countryCode: z.string().optional().default("gb").describe("ISO country code (default 'gb')"),
});

const GetJobsSchema = z.object({
  query: z.string().min(1).describe("Job search query"),
  location: z.string().optional().describe("Location filter"),
  countryCode: z.string().optional().default("gb").describe("ISO country code (default 'gb')"),
  page: z.number().int().min(1).optional().default(1).describe("Page number (default 1)"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .default(10)
    .describe("Results per page (default 10)"),
});

export function registerCareerTools(
  registry: ToolRegistryAdapter,
  userId: string,
  db: DrizzleDB,
): void {
  const t = freeTool(userId, db);

  // career_assess_skills
  registry.registerBuilt(
    t
      .tool(
        "career_assess_skills",
        "Match user skills against occupations in the ESCO database. Returns top matching occupations with match scores and skill gaps.",
        AssessSkillsSchema.shape,
      )
      .meta({ category: "career", tier: "free" })
      .handler(async ({ input }) => {
        return safeToolCall("career_assess_skills", async () => {
          const results = await apiRequest<
            Array<{
              occupation: { title: string };
              score: number;
              matchedSkills: number;
              totalRequired: number;
              gaps: Array<{ skill: { title: string }; priority: string }>;
            }>
          >("/api/career/assess", {
            method: "POST",
            body: JSON.stringify({ skills: input.skills, limit: input.limit }),
          });

          if (results.length === 0) {
            return textResult("No matching occupations found. Try different skill terms.");
          }

          let text = `**Skills Assessment Results (${results.length} matches):**\n\n`;
          for (const match of results) {
            text += `- **${match.occupation.title}** — Score: ${match.score}%\n`;
            text += `  Matched: ${match.matchedSkills}/${match.totalRequired} skills\n`;
            const highGaps = match.gaps.filter((g) => g.priority === "high");
            if (highGaps.length > 0) {
              text += `  Key gaps: ${highGaps
                .slice(0, 3)
                .map((g) => g.skill.title)
                .join(", ")}\n`;
            }
            text += "\n";
          }
          return textResult(text);
        });
      }),
  );

  // career_search_occupations
  registry.registerBuilt(
    t
      .tool(
        "career_search_occupations",
        "Search the ESCO occupation database by keyword. Returns occupation titles, URIs, and descriptions.",
        SearchOccupationsSchema.shape,
      )
      .meta({ category: "career", tier: "free" })
      .handler(async ({ input }) => {
        return safeToolCall("career_search_occupations", async () => {
          const result = await apiRequest<{
            results: Array<{ title: string; uri: string; className: string }>;
            total: number;
          }>("/api/career/search", {
            method: "POST",
            body: JSON.stringify({ query: input.query, limit: input.limit, offset: input.offset }),
          });

          if (result.results.length === 0) {
            return textResult("No occupations found matching your query.");
          }

          let text = `**Occupations Found (${result.results.length} of ${result.total}):**\n\n`;
          for (const occ of result.results) {
            text += `- **${occ.title}**\n`;
            text += `  URI: \`${occ.uri}\`\n`;
            text += `  Type: ${occ.className}\n\n`;
          }
          return textResult(text);
        });
      }),
  );

  // career_get_occupation
  registry.registerBuilt(
    t
      .tool(
        "career_get_occupation",
        "Get detailed occupation data from ESCO including required skills, ISCO group, and alternative labels.",
        GetOccupationSchema.shape,
      )
      .meta({ category: "career", tier: "free" })
      .handler(async ({ input }) => {
        return safeToolCall("career_get_occupation", async () => {
          const occupation = await apiRequest<{
            title: string;
            uri: string;
            iscoGroup: string;
            description: string;
            alternativeLabels: string[];
            skills: Array<{ title: string; skillType: string }>;
          } | null>("/api/career/occupation", {
            method: "POST",
            body: JSON.stringify({ uri: input.uri }),
          });

          if (!occupation) {
            return textResult("**Error: NOT_FOUND**\nOccupation not found.\n**Retryable:** false");
          }

          const essentialSkills = occupation.skills.filter((s) => s.skillType === "essential");
          const optionalSkills = occupation.skills.filter((s) => s.skillType === "optional");

          let text = `**${occupation.title}**\n\n`;
          text += `**URI:** ${occupation.uri}\n`;
          text += `**ISCO Group:** ${occupation.iscoGroup}\n`;
          if (occupation.alternativeLabels.length > 0) {
            text += `**Also known as:** ${occupation.alternativeLabels.join(", ")}\n`;
          }
          text += `\n**Description:**\n${occupation.description}\n\n`;
          text += `**Essential Skills (${essentialSkills.length}):**\n`;
          for (const skill of essentialSkills.slice(0, 15)) {
            text += `- ${skill.title}\n`;
          }
          if (essentialSkills.length > 15) {
            text += `- ...and ${essentialSkills.length - 15} more\n`;
          }
          if (optionalSkills.length > 0) {
            text += `\n**Optional Skills (${optionalSkills.length}):**\n`;
            for (const skill of optionalSkills.slice(0, 10)) {
              text += `- ${skill.title}\n`;
            }
            if (optionalSkills.length > 10) {
              text += `- ...and ${optionalSkills.length - 10} more\n`;
            }
          }
          return textResult(text);
        });
      }),
  );

  // career_compare_skills
  registry.registerBuilt(
    t
      .tool(
        "career_compare_skills",
        "Compare user skills against a specific occupation. Shows per-skill gap analysis with priorities.",
        CompareSkillsSchema.shape,
      )
      .meta({ category: "career", tier: "free" })
      .handler(async ({ input }) => {
        return safeToolCall("career_compare_skills", async () => {
          const result = await apiRequest<{
            occupationTitle: string;
            score: number;
            matchedSkills: number;
            totalRequired: number;
            gaps: Array<{
              skill: { title: string };
              requiredLevel: string;
              userProficiency: string;
              gap: string;
              priority: string;
            }>;
          }>("/api/career/compare", {
            method: "POST",
            body: JSON.stringify({ skills: input.skills, occupationUri: input.occupationUri }),
          });

          let text = `**Skill Comparison: ${result.occupationTitle}**\n`;
          text += `**Overall Score:** ${result.score}%\n`;
          text += `**Skills Matched:** ${result.matchedSkills}/${result.totalRequired}\n\n`;

          text += `| Skill | Required | Your Level | Gap | Priority |\n`;
          text += `|-------|----------|------------|-----|----------|\n`;
          for (const gap of result.gaps) {
            text += `| ${gap.skill.title} | ${gap.requiredLevel} | ${gap.userProficiency} | ${gap.gap} | ${gap.priority} |\n`;
          }
          return textResult(text);
        });
      }),
  );

  // career_get_salary
  registry.registerBuilt(
    t
      .tool(
        "career_get_salary",
        "Get salary estimates for an occupation in a specific location.",
        GetSalarySchema.shape,
      )
      .meta({ category: "career", tier: "free" })
      .handler(async ({ input }) => {
        return safeToolCall("career_get_salary", async () => {
          const salary = await apiRequest<{
            location: string;
            currency: string;
            median: number;
            p25: number;
            p75: number;
            source: string;
          } | null>("/api/career/salary", {
            method: "POST",
            body: JSON.stringify({
              occupationTitle: input.occupationTitle,
              countryCode: input.countryCode,
            }),
          });

          if (!salary) {
            return textResult("Salary data not available for this occupation/location.");
          }

          return textResult(
            `**Salary: ${input.occupationTitle}** (${salary.location})\n\n` +
              `**Median:** ${salary.currency}${salary.median.toLocaleString()}\n` +
              `**25th Percentile:** ${salary.currency}${salary.p25.toLocaleString()}\n` +
              `**75th Percentile:** ${salary.currency}${salary.p75.toLocaleString()}\n` +
              `**Source:** ${salary.source}`,
          );
        });
      }),
  );

  // career_get_jobs
  registry.registerBuilt(
    t
      .tool(
        "career_get_jobs",
        "Search for job listings from Adzuna matching a query and location.",
        GetJobsSchema.shape,
      )
      .meta({ category: "career", tier: "free" })
      .handler(async ({ input }) => {
        return safeToolCall("career_get_jobs", async () => {
          const result = await apiRequest<{
            jobs: Array<{
              title: string;
              company: string;
              location: string;
              salary_min: number | null;
              salary_max: number | null;
              currency: string;
              url: string;
            }>;
          }>("/api/career/jobs", {
            method: "POST",
            body: JSON.stringify({
              query: input.query,
              location: input.location,
              countryCode: input.countryCode,
              page: input.page,
              limit: input.limit,
            }),
          });

          if (result.jobs.length === 0) {
            return textResult("No job listings found matching your criteria.");
          }

          let text = `**Job Listings (${result.jobs.length}):**\n\n`;
          for (const job of result.jobs) {
            text += `- **${job.title}** at ${job.company}\n`;
            text += `  Location: ${job.location}\n`;
            if (job.salary_min !== null || job.salary_max !== null) {
              const salary =
                job.salary_min && job.salary_max
                  ? `${job.currency}${job.salary_min.toLocaleString()} - ${job.currency}${job.salary_max.toLocaleString()}`
                  : job.salary_min
                    ? `From ${job.currency}${job.salary_min.toLocaleString()}`
                    : `Up to ${job.currency}${job.salary_max!.toLocaleString()}`;
              text += `  Salary: ${salary}\n`;
            }
            text += `  [Apply](${job.url})\n\n`;
          }
          return textResult(text);
        });
      }),
  );
}
