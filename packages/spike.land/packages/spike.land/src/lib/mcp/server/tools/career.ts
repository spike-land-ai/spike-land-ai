/**
 * Career MCP Tools
 *
 * Skills assessment, occupation search, salary data, and job listings
 * powered by ESCO and Adzuna APIs.
 */

import type { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "../tool-registry";
import { safeToolCall, textResult } from "./tool-helpers";
import {
  AssessSkillsSchema,
  CompareSkillsSchema,
  GetJobsSchema,
  GetOccupationSchema,
  GetSalarySchema,
  SearchOccupationsSchema,
} from "@/lib/career/schemas";

export function registerCareerTools(
  registry: ToolRegistry,
  _userId: string,
): void {
  registry.register({
    name: "career_assess_skills",
    description:
      "Match user skills against occupations in the ESCO database. Returns top matching occupations with match scores and skill gaps.",
    category: "career",
    tier: "free",
    annotations: { readOnlyHint: true },
    inputSchema: AssessSkillsSchema.shape,
    handler: async (
      { skills, limit = 10 }: z.infer<typeof AssessSkillsSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("career_assess_skills", async () => {
        const { searchOccupations, getOccupation } = await import(
          "@/lib/career/services/esco-client"
        );
        const { assessSkills } = await import(
          "@/lib/career/services/matching-engine"
        );

        // Search for occupations related to user's skill titles
        const queries = skills.slice(0, 5).map(s => s.title);
        const searchResults = await Promise.all(
          queries.map(q => searchOccupations(q, 20)),
        );

        // Collect unique URIs from search results
        const seen = new Set<string>();
        const uniqueUris: string[] = [];
        for (const { results } of searchResults) {
          for (const result of results) {
            if (!seen.has(result.uri)) {
              seen.add(result.uri);
              uniqueUris.push(result.uri);
            }
          }
        }

        if (uniqueUris.length === 0) {
          return textResult(
            "No matching occupations found. Try different skill terms.",
          );
        }

        // Fetch full occupation details for matching (capped at 10 to limit API calls)
        const occupationDetails = await Promise.all(
          uniqueUris.slice(0, 10).map(uri => getOccupation(uri).catch(() => null)),
        );
        const occupations = occupationDetails.filter((
          o,
        ): o is NonNullable<typeof o> => o !== null);

        if (occupations.length === 0) {
          return textResult(
            "No matching occupations found. Try different skill terms.",
          );
        }

        const results = assessSkills(skills, occupations).slice(0, limit);

        let text = `**Skills Assessment Results (${results.length} matches):**\n\n`;
        for (const match of results) {
          text += `- **${match.occupation.title}** — Score: ${match.score}%\n`;
          text += `  Matched: ${match.matchedSkills}/${match.totalRequired} skills\n`;
          const highGaps = match.gaps.filter((g: { priority: string; }) => g.priority === "high");
          if (highGaps.length > 0) {
            text += `  Key gaps: ${
              highGaps.slice(0, 3).map((g: { skill: { title: string; }; }) => g.skill.title).join(
                ", ",
              )
            }\n`;
          }
          text += "\n";
        }
        return textResult(text);
      }, { timeoutMs: 30_000 }),
  });

  registry.register({
    name: "career_search_occupations",
    description:
      "Search the ESCO occupation database by keyword. Returns occupation titles, URIs, and descriptions.",
    category: "career",
    tier: "free",
    annotations: { readOnlyHint: true },
    inputSchema: SearchOccupationsSchema.shape,
    handler: async (
      { query, limit = 20, offset = 0 }: z.infer<
        typeof SearchOccupationsSchema
      >,
    ): Promise<CallToolResult> =>
      safeToolCall("career_search_occupations", async () => {
        const { searchOccupations } = await import(
          "@/lib/career/services/esco-client"
        );
        const { results, total } = await searchOccupations(
          query,
          limit,
          offset,
        );

        if (results.length === 0) {
          return textResult("No occupations found matching your query.");
        }

        let text = `**Occupations Found (${results.length} of ${total}):**\n\n`;
        for (const occ of results) {
          text += `- **${occ.title}**\n`;
          text += `  URI: \`${occ.uri}\`\n`;
          text += `  Type: ${occ.className}\n\n`;
        }
        return textResult(text);
      }, { timeoutMs: 30_000 }),
  });

  registry.register({
    name: "career_get_occupation",
    description:
      "Get detailed occupation data from ESCO including required skills, ISCO group, and alternative labels.",
    category: "career",
    tier: "free",
    annotations: { readOnlyHint: true },
    inputSchema: GetOccupationSchema.shape,
    handler: async (
      { uri }: z.infer<typeof GetOccupationSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("career_get_occupation", async () => {
        const { getOccupation } = await import(
          "@/lib/career/services/esco-client"
        );
        const occupation = await getOccupation(uri);

        if (!occupation) {
          return textResult(
            "**Error: NOT_FOUND**\nOccupation not found.\n**Retryable:** false",
          );
        }

        const essentialSkills = occupation.skills.filter((
          s: { skillType: string; },
        ) => s.skillType === "essential");
        const optionalSkills = occupation.skills.filter((
          s: { skillType: string; },
        ) => s.skillType === "optional");

        let text = `**${occupation.title}**\n\n`;
        text += `**URI:** ${occupation.uri}\n`;
        text += `**ISCO Group:** ${occupation.iscoGroup}\n`;
        if (occupation.alternativeLabels.length > 0) {
          text += `**Also known as:** ${occupation.alternativeLabels.join(", ")}\n`;
        }
        text += `\n**Description:**\n${occupation.description}\n\n`;
        text += `**Essential Skills (${essentialSkills.length}):**\n`;
        const displayedEssential = essentialSkills.slice(0, 15);
        for (const skill of displayedEssential) {
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
      }, { timeoutMs: 30_000 }),
  });

  registry.register({
    name: "career_compare_skills",
    description:
      "Compare user skills against a specific occupation. Shows per-skill gap analysis with priorities.",
    category: "career",
    tier: "free",
    annotations: { readOnlyHint: true },
    inputSchema: CompareSkillsSchema.shape,
    handler: async (
      { skills, occupationUri }: z.infer<typeof CompareSkillsSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("career_compare_skills", async () => {
        const { getOccupation } = await import(
          "@/lib/career/services/esco-client"
        );
        const { compareSkills } = await import(
          "@/lib/career/services/matching-engine"
        );

        const occupation = await getOccupation(occupationUri);
        if (!occupation) {
          return textResult(
            "**Error: NOT_FOUND**\nOccupation not found.\n**Retryable:** false",
          );
        }

        const result = compareSkills(skills, occupation);

        let text = `**Skill Comparison: ${occupation.title}**\n`;
        text += `**Overall Score:** ${result.score}%\n`;
        text += `**Skills Matched:** ${result.matchedSkills}/${result.totalRequired}\n\n`;

        text += `| Skill | Required | Your Level | Gap | Priority |\n`;
        text += `|-------|----------|------------|-----|----------|\n`;
        for (const gap of result.gaps) {
          text +=
            `| ${gap.skill.title} | ${gap.requiredLevel} | ${gap.userProficiency} | ${gap.gap} | ${gap.priority} |\n`;
        }
        return textResult(text);
      }, { timeoutMs: 30_000 }),
  });

  registry.register({
    name: "career_get_salary",
    description: "Get salary estimates for an occupation in a specific location.",
    category: "career",
    tier: "free",
    annotations: { readOnlyHint: true },
    inputSchema: GetSalarySchema.shape,
    handler: async (
      { occupationTitle, countryCode = "gb" }: z.infer<typeof GetSalarySchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("career_get_salary", async () => {
        const { getSalaryEstimate } = await import(
          "@/lib/career/services/job-search-client"
        );
        const salary = await getSalaryEstimate(occupationTitle, countryCode);

        if (!salary) {
          return textResult(
            "Salary data not available for this occupation/location.",
          );
        }

        return textResult(
          `**Salary: ${occupationTitle}** (${salary.location})\n\n`
            + `**Median:** ${salary.currency}${salary.median.toLocaleString()}\n`
            + `**25th Percentile:** ${salary.currency}${salary.p25.toLocaleString()}\n`
            + `**75th Percentile:** ${salary.currency}${salary.p75.toLocaleString()}\n`
            + `**Source:** ${salary.source}`,
        );
      }, { timeoutMs: 30_000 }),
  });

  registry.register({
    name: "career_get_jobs",
    description: "Search for job listings from Adzuna matching a query and location.",
    category: "career",
    tier: "free",
    annotations: { readOnlyHint: true },
    inputSchema: GetJobsSchema.shape,
    handler: async (
      { query, location, countryCode = "gb", page = 1, limit = 10 }: z.infer<
        typeof GetJobsSchema
      >,
    ): Promise<CallToolResult> =>
      safeToolCall("career_get_jobs", async () => {
        const { searchJobs } = await import(
          "@/lib/career/services/job-search-client"
        );
        const { jobs } = await searchJobs(
          query,
          location,
          countryCode,
          page,
          limit,
        );

        if (jobs.length === 0) {
          return textResult("No job listings found matching your criteria.");
        }

        let text = `**Job Listings (${jobs.length}):**\n\n`;
        for (const job of jobs) {
          text += `- **${job.title}** at ${job.company}\n`;
          text += `  Location: ${job.location}\n`;
          if (job.salary_min !== null || job.salary_max !== null) {
            const salary = job.salary_min && job.salary_max
              ? `${job.currency}${job.salary_min.toLocaleString()} - ${job.currency}${job.salary_max.toLocaleString()}`
              : job.salary_min
              ? `From ${job.currency}${job.salary_min.toLocaleString()}`
              : `Up to ${job.currency}${job.salary_max!.toLocaleString()}`;
            text += `  Salary: ${salary}\n`;
          }
          text += `  [Apply](${job.url})\n\n`;
        }
        return textResult(text);
      }, { timeoutMs: 30_000 }),
  });
}
