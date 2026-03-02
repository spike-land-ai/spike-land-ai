/**
 * Career Navigator — Standalone MCP Tool Definitions
 *
 * Skills assessment, occupation search, salary data, job listings,
 * resume building, job matching, learning paths, and interview prep.
 * 10 tools total.
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ServerContext, StandaloneToolDefinition } from "../shared/types";
import { safeToolCall, textResult } from "../shared/tool-helpers";

// ─── Schemas (inlined from @/lib/career/schemas) ────────────────────────────

const SkillEntrySchema = z.object({
  title: z.string().describe("Skill name"),
  proficiency: z.number().min(0).max(5).optional().describe("Proficiency level (0–5)"),
});

const AssessSkillsShape = {
  skills: z
    .array(SkillEntrySchema)
    .min(1)
    .describe("List of user skills with optional proficiency"),
  limit: z.number().min(1).max(50).optional().default(10).describe("Max results (default 10)"),
};

const SearchOccupationsShape = {
  query: z.string().min(1).describe("Search keyword"),
  limit: z.number().min(1).max(50).optional().default(20).describe("Max results"),
  offset: z.number().min(0).optional().default(0).describe("Pagination offset"),
};

const GetOccupationShape = {
  uri: z.string().min(1).describe("ESCO occupation URI"),
};

const CompareSkillsShape = {
  skills: z.array(SkillEntrySchema).min(1).describe("User skills"),
  occupationUri: z.string().min(1).describe("ESCO occupation URI to compare against"),
};

const GetSalaryShape = {
  occupationTitle: z.string().min(1).describe("Occupation title"),
  countryCode: z.string().optional().default("gb").describe("ISO country code"),
};

const GetJobsShape = {
  query: z.string().min(1).describe("Job search query"),
  location: z.string().optional().describe("Location filter"),
  countryCode: z.string().optional().default("gb").describe("ISO country code"),
  page: z.number().min(1).optional().default(1).describe("Page number"),
  limit: z.number().min(1).max(50).optional().default(10).describe("Results per page"),
};

// ─── Career Growth schemas ──────────────────────────────────────────────────

const ExperienceEntrySchema = z.object({
  title: z.string().describe("Job title"),
  company: z.string().describe("Company name"),
  duration: z.string().describe("Duration, e.g. '2021–2023' or '18 months'"),
  highlights: z.array(z.string()).describe("Key achievements or responsibilities"),
});

const CreateResumeShape = {
  name: z.string().describe("Full name"),
  email: z.string().email().describe("Contact email address"),
  summary: z.string().describe("Professional summary (2-4 sentences)"),
  skills: z.array(z.string()).min(1).describe("List of skill names"),
  experience: z.array(ExperienceEntrySchema).describe("Work experience entries"),
};

const MatchJobsShape = {
  resume_id: z.string().describe("Resume ID returned by career_create_resume"),
  location: z.string().optional().describe("Preferred job location (city or country)"),
  remote_only: z.boolean().optional().describe("Filter to remote positions only"),
};

const LearningPathShape = {
  current_skills: z.array(z.string()).min(1).describe("Skills the user already has"),
  target_occupation: z.string().describe("Target job title or occupation"),
  time_budget_hours: z
    .number()
    .positive()
    .optional()
    .describe("Total hours available for learning (optional, used to prioritise)"),
};

const InterviewPrepShape = {
  occupation: z.string().describe("Job title to prepare for"),
  level: z.enum(["junior", "mid", "senior", "lead"]).describe("Seniority level"),
  question_count: z
    .number()
    .min(5)
    .max(20)
    .optional()
    .default(10)
    .describe("Number of questions to generate (5–20, default 10)"),
};

// ─── Career Tools (ESCO + Adzuna) ───────────────────────────────────────────

const careerAssessSkills: StandaloneToolDefinition = {
  name: "career_assess_skills",
  description:
    "Match user skills against occupations in the ESCO database. Returns top matching occupations with match scores and skill gaps.",
  category: "career",
  tier: "free",
  annotations: { readOnlyHint: true },
  inputSchema: AssessSkillsShape,
  handler: async (input: never, _ctx: ServerContext): Promise<CallToolResult> => {
    const { skills, limit = 10 } = input as {
      skills: Array<{ title: string; proficiency?: number }>;
      limit?: number;
    };
    return safeToolCall(
      "career_assess_skills",
      async () => {
        const { searchOccupations, getOccupation } = await import(
          "@/lib/career/services/esco-client"
        );
        const { assessSkills } = await import("@/lib/career/services/matching-engine");

        const queries = skills.slice(0, 5).map((s) => s.title);
        const searchResults = await Promise.all(queries.map((q) => searchOccupations(q, 20)));

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
          return textResult("No matching occupations found. Try different skill terms.");
        }

        const occupationDetails = await Promise.all(
          uniqueUris.slice(0, 10).map((uri) => getOccupation(uri).catch(() => null)),
        );
        const occupations = occupationDetails.filter((o): o is NonNullable<typeof o> => o !== null);

        if (occupations.length === 0) {
          return textResult("No matching occupations found. Try different skill terms.");
        }

        const typedSkills = skills.map((s) => ({ ...s, uri: "", proficiency: s.proficiency ?? 3 }));
        const results = assessSkills(typedSkills, occupations).slice(0, limit);

        let text = `**Skills Assessment Results (${results.length} matches):**\n\n`;
        for (const match of results) {
          text += `- **${match.occupation.title}** — Score: ${match.score}%\n`;
          text += `  Matched: ${match.matchedSkills}/${match.totalRequired} skills\n`;
          const highGaps = match.gaps.filter((g: { priority: string }) => g.priority === "high");
          if (highGaps.length > 0) {
            text += `  Key gaps: ${highGaps
              .slice(0, 3)
              .map((g: { skill: { title: string } }) => g.skill.title)
              .join(", ")}\n`;
          }
          text += "\n";
        }
        return textResult(text);
      },
      { timeoutMs: 30_000 },
    );
  },
};

const careerSearchOccupations: StandaloneToolDefinition = {
  name: "career_search_occupations",
  description:
    "Search the ESCO occupation database by keyword. Returns occupation titles, URIs, and descriptions.",
  category: "career",
  tier: "free",
  annotations: { readOnlyHint: true },
  inputSchema: SearchOccupationsShape,
  handler: async (input: never, _ctx: ServerContext): Promise<CallToolResult> => {
    const {
      query,
      limit = 20,
      offset = 0,
    } = input as {
      query: string;
      limit?: number;
      offset?: number;
    };
    return safeToolCall(
      "career_search_occupations",
      async () => {
        const { searchOccupations } = await import("@/lib/career/services/esco-client");
        const { results, total } = await searchOccupations(query, limit, offset);

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
      },
      { timeoutMs: 30_000 },
    );
  },
};

const careerGetOccupation: StandaloneToolDefinition = {
  name: "career_get_occupation",
  description:
    "Get detailed occupation data from ESCO including required skills, ISCO group, and alternative labels.",
  category: "career",
  tier: "free",
  annotations: { readOnlyHint: true },
  inputSchema: GetOccupationShape,
  handler: async (input: never, _ctx: ServerContext): Promise<CallToolResult> => {
    const { uri } = input as { uri: string };
    return safeToolCall(
      "career_get_occupation",
      async () => {
        const { getOccupation } = await import("@/lib/career/services/esco-client");
        const occupation = await getOccupation(uri);

        if (!occupation) {
          return textResult("**Error: NOT_FOUND**\nOccupation not found.\n**Retryable:** false");
        }

        const essentialSkills = occupation.skills.filter(
          (s: { skillType: string }) => s.skillType === "essential",
        );
        const optionalSkills = occupation.skills.filter(
          (s: { skillType: string }) => s.skillType === "optional",
        );

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
      },
      { timeoutMs: 30_000 },
    );
  },
};

const careerCompareSkills: StandaloneToolDefinition = {
  name: "career_compare_skills",
  description:
    "Compare user skills against a specific occupation. Shows per-skill gap analysis with priorities.",
  category: "career",
  tier: "free",
  annotations: { readOnlyHint: true },
  inputSchema: CompareSkillsShape,
  handler: async (input: never, _ctx: ServerContext): Promise<CallToolResult> => {
    const { skills, occupationUri } = input as {
      skills: Array<{ title: string; proficiency?: number }>;
      occupationUri: string;
    };
    return safeToolCall(
      "career_compare_skills",
      async () => {
        const { getOccupation } = await import("@/lib/career/services/esco-client");
        const { compareSkills } = await import("@/lib/career/services/matching-engine");

        const occupation = await getOccupation(occupationUri);
        if (!occupation) {
          return textResult("**Error: NOT_FOUND**\nOccupation not found.\n**Retryable:** false");
        }

        const typedSkills = skills.map((s) => ({ ...s, uri: "", proficiency: s.proficiency ?? 3 }));
        const result = compareSkills(typedSkills, occupation);

        let text = `**Skill Comparison: ${occupation.title}**\n`;
        text += `**Overall Score:** ${result.score}%\n`;
        text += `**Skills Matched:** ${result.matchedSkills}/${result.totalRequired}\n\n`;

        text += `| Skill | Required | Your Level | Gap | Priority |\n`;
        text += `|-------|----------|------------|-----|----------|\n`;
        for (const gap of result.gaps) {
          text += `| ${gap.skill.title} | ${gap.requiredLevel} | ${gap.userProficiency} | ${gap.gap} | ${gap.priority} |\n`;
        }
        return textResult(text);
      },
      { timeoutMs: 30_000 },
    );
  },
};

const careerGetSalary: StandaloneToolDefinition = {
  name: "career_get_salary",
  description: "Get salary estimates for an occupation in a specific location.",
  category: "career",
  tier: "free",
  annotations: { readOnlyHint: true },
  inputSchema: GetSalaryShape,
  handler: async (input: never, _ctx: ServerContext): Promise<CallToolResult> => {
    const { occupationTitle, countryCode = "gb" } = input as {
      occupationTitle: string;
      countryCode?: string;
    };
    return safeToolCall(
      "career_get_salary",
      async () => {
        const { getSalaryEstimate } = await import("@/lib/career/services/job-search-client");
        const salary = await getSalaryEstimate(occupationTitle, countryCode);

        if (!salary) {
          return textResult("Salary data not available for this occupation/location.");
        }

        return textResult(
          `**Salary: ${occupationTitle}** (${salary.location})\n\n` +
            `**Median:** ${salary.currency}${salary.median.toLocaleString()}\n` +
            `**25th Percentile:** ${salary.currency}${salary.p25.toLocaleString()}\n` +
            `**75th Percentile:** ${salary.currency}${salary.p75.toLocaleString()}\n` +
            `**Source:** ${salary.source}`,
        );
      },
      { timeoutMs: 30_000 },
    );
  },
};

const careerGetJobs: StandaloneToolDefinition = {
  name: "career_get_jobs",
  description: "Search for job listings from Adzuna matching a query and location.",
  category: "career",
  tier: "free",
  annotations: { readOnlyHint: true },
  inputSchema: GetJobsShape,
  handler: async (input: never, _ctx: ServerContext): Promise<CallToolResult> => {
    const {
      query,
      location,
      countryCode = "gb",
      page = 1,
      limit = 10,
    } = input as {
      query: string;
      location?: string;
      countryCode?: string;
      page?: number;
      limit?: number;
    };
    return safeToolCall(
      "career_get_jobs",
      async () => {
        const { searchJobs } = await import("@/lib/career/services/job-search-client");
        const { jobs } = await searchJobs(query, location, countryCode, page, limit);

        if (jobs.length === 0) {
          return textResult("No job listings found matching your criteria.");
        }

        let text = `**Job Listings (${jobs.length}):**\n\n`;
        for (const job of jobs) {
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
      },
      { timeoutMs: 30_000 },
    );
  },
};

// ─── Career Growth Tools ────────────────────────────────────────────────────

// In-memory resume store
interface ResumeData {
  id: string;
  name: string;
  email: string;
  summary: string;
  skills: string[];
  experience: Array<{ title: string; company: string; duration: string; highlights: string[] }>;
  createdAt: string;
}

const resumeStore = new Map<string, ResumeData>();

function generateResumeId(): string {
  return `resume_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function scoreResume(resume: ResumeData): number {
  let score = 0;
  if (resume.summary.length >= 100) score += 20;
  else if (resume.summary.length >= 50) score += 10;
  if (resume.skills.length >= 8) score += 20;
  else score += Math.floor((resume.skills.length / 8) * 20);
  if (resume.experience.length >= 3) score += 30;
  else score += Math.floor((resume.experience.length / 3) * 30);
  const highlightedEntries = resume.experience.filter((e) => e.highlights.length >= 2);
  if (highlightedEntries.length === resume.experience.length && resume.experience.length > 0) {
    score += 30;
  } else {
    score += Math.floor((highlightedEntries.length / Math.max(resume.experience.length, 1)) * 30);
  }
  return Math.min(score, 100);
}

function formatResumePreview(resume: ResumeData): string {
  let text = `# ${resume.name}\n`;
  text += `**Email:** ${resume.email}\n\n`;
  text += `**Summary:**\n${resume.summary}\n\n`;
  text += `**Skills:** ${resume.skills.join(", ")}\n\n`;
  text += `**Experience:**\n`;
  for (const entry of resume.experience) {
    text += `\n- **${entry.title}** at ${entry.company} (${entry.duration})\n`;
    for (const highlight of entry.highlights) {
      text += `  - ${highlight}\n`;
    }
  }
  return text;
}

interface MockJob {
  id: string;
  title: string;
  company: string;
  location: string;
  remote: boolean;
  requiredSkills: string[];
  salaryMin: number;
  salaryMax: number;
  currency: string;
}

const SAMPLE_JOBS: MockJob[] = [
  {
    id: "j1",
    title: "Frontend Engineer",
    company: "TechCorp",
    location: "London",
    remote: true,
    requiredSkills: ["TypeScript", "React", "CSS", "HTML", "Git"],
    salaryMin: 60000,
    salaryMax: 85000,
    currency: "GBP",
  },
  {
    id: "j2",
    title: "Full-Stack Developer",
    company: "StartupXYZ",
    location: "Remote",
    remote: true,
    requiredSkills: ["Node.js", "React", "PostgreSQL", "TypeScript", "Docker"],
    salaryMin: 70000,
    salaryMax: 95000,
    currency: "GBP",
  },
  {
    id: "j3",
    title: "Backend Engineer",
    company: "FinTech Ltd",
    location: "Edinburgh",
    remote: false,
    requiredSkills: ["Python", "PostgreSQL", "Redis", "AWS", "Docker"],
    salaryMin: 55000,
    salaryMax: 80000,
    currency: "GBP",
  },
  {
    id: "j4",
    title: "DevOps Engineer",
    company: "CloudOps Inc",
    location: "Manchester",
    remote: true,
    requiredSkills: ["Kubernetes", "Docker", "AWS", "Terraform", "Linux"],
    salaryMin: 65000,
    salaryMax: 90000,
    currency: "GBP",
  },
  {
    id: "j5",
    title: "Data Engineer",
    company: "DataFlow",
    location: "Bristol",
    remote: false,
    requiredSkills: ["Python", "SQL", "Spark", "Kafka", "AWS"],
    salaryMin: 58000,
    salaryMax: 82000,
    currency: "GBP",
  },
];

function computeJobMatchScore(resumeSkills: string[], job: MockJob): number {
  const normalised = resumeSkills.map((s) => s.toLowerCase());
  const matched = job.requiredSkills.filter((s) => normalised.includes(s.toLowerCase()));
  return Math.round((matched.length / job.requiredSkills.length) * 100);
}

interface LearningItem {
  skill: string;
  estimatedHours: number;
  priority: "critical" | "high" | "medium" | "low";
  resources: string[];
}

const SKILL_METADATA: Record<string, { hours: number; resources: string[] }> = {
  typescript: {
    hours: 40,
    resources: ["TypeScript Handbook (typescriptlang.org)", "Execute Program — TypeScript"],
  },
  react: { hours: 60, resources: ["react.dev official docs", "Scrimba React course"] },
  python: { hours: 50, resources: ["Python.org tutorial", "Real Python"] },
  docker: { hours: 20, resources: ["Docker Getting Started guide", "KodeKloud Docker course"] },
  kubernetes: { hours: 35, resources: ["Kubernetes.io tutorials", "KodeKloud CKA prep"] },
  postgresql: { hours: 25, resources: ["PostgreSQL official tutorial", "pgexercises.com"] },
  aws: { hours: 60, resources: ["AWS Skill Builder", "A Cloud Guru"] },
  redis: { hours: 15, resources: ["Redis University", "redis.io documentation"] },
  terraform: { hours: 30, resources: ["HashiCorp Learn", "Gruntwork Terraform tutorial"] },
  "node.js": { hours: 35, resources: ["nodejs.dev docs", "The Odin Project Node path"] },
};

const DEFAULT_SKILL_META = {
  hours: 20,
  resources: ["Official documentation", "Udemy or Coursera courses"],
};

function buildLearningPath(
  currentSkills: string[],
  targetOccupation: string,
  timeBudget?: number,
): LearningItem[] {
  const target = targetOccupation.toLowerCase();
  const candidates: string[] = [];

  if (target.includes("frontend") || target.includes("front-end") || target.includes("ui")) {
    candidates.push("TypeScript", "React", "CSS", "HTML");
  }
  if (target.includes("backend") || target.includes("back-end") || target.includes("server")) {
    candidates.push("Node.js", "PostgreSQL", "Redis", "Docker");
  }
  if (target.includes("full") || target.includes("full-stack")) {
    candidates.push("TypeScript", "React", "Node.js", "PostgreSQL", "Docker");
  }
  if (target.includes("devops") || target.includes("platform") || target.includes("sre")) {
    candidates.push("Docker", "Kubernetes", "AWS", "Terraform");
  }
  if (target.includes("data") || target.includes("ml") || target.includes("machine learning")) {
    candidates.push("Python", "PostgreSQL", "AWS");
  }
  if (candidates.length === 0) {
    candidates.push("Python", "Docker", "PostgreSQL");
  }

  const normalisedCurrent = currentSkills.map((s) => s.toLowerCase());
  const gaps = candidates.filter((c) => !normalisedCurrent.includes(c.toLowerCase()));

  const items: LearningItem[] = gaps.map((skill, index) => {
    const meta = SKILL_METADATA[skill.toLowerCase()] ?? DEFAULT_SKILL_META;
    const priority: LearningItem["priority"] =
      index === 0 ? "critical" : index === 1 ? "high" : index <= 3 ? "medium" : "low";
    return { skill, estimatedHours: meta.hours, priority, resources: meta.resources };
  });

  if (timeBudget !== undefined) {
    let remaining = timeBudget;
    return items.filter((item) => {
      if (remaining >= item.estimatedHours) {
        remaining -= item.estimatedHours;
        return true;
      }
      return false;
    });
  }

  return items;
}

type QuestionCategory = "technical" | "behavioral" | "situational";
type Difficulty = "easy" | "medium" | "hard";

interface InterviewQuestion {
  question: string;
  category: QuestionCategory;
  difficulty: Difficulty;
  sampleAnswerOutline: string;
}

const BEHAVIORAL_QUESTIONS: InterviewQuestion[] = [
  {
    question: "Describe a time you had to learn a new technology quickly under a deadline.",
    category: "behavioral",
    difficulty: "medium",
    sampleAnswerOutline:
      "Use STAR: Situation (project with tight timeline), Task (unfamiliar stack), Action (focused self-study, lean on docs and mentors), Result (delivered on time, lessons learned).",
  },
  {
    question: "Tell me about a conflict with a teammate and how you resolved it.",
    category: "behavioral",
    difficulty: "medium",
    sampleAnswerOutline:
      "STAR: Explain the disagreement, your empathetic approach, the concrete steps taken (1-1 conversation, compromise), and the positive outcome.",
  },
  {
    question: "Give an example of a project where you took ownership beyond your role.",
    category: "behavioral",
    difficulty: "medium",
    sampleAnswerOutline:
      "STAR: Context of the gap, why you stepped up, what you did extra, measurable impact.",
  },
  {
    question: "Describe a situation where you received critical feedback. How did you respond?",
    category: "behavioral",
    difficulty: "easy",
    sampleAnswerOutline:
      "Show receptiveness, curiosity, specific actions taken to improve, and long-term outcome.",
  },
];

const SITUATIONAL_QUESTIONS: InterviewQuestion[] = [
  {
    question:
      "Your PR is blocking three teammates. The reviewer is unavailable for two days. What do you do?",
    category: "situational",
    difficulty: "hard",
    sampleAnswerOutline:
      "Mention seeking another qualified reviewer, splitting the PR into smaller parts, communicating proactively with blocked teammates, and documenting the context.",
  },
  {
    question:
      "Production is down. You have a potential fix but it is untested. What is your process?",
    category: "situational",
    difficulty: "hard",
    sampleAnswerOutline:
      "Triage severity, notify stakeholders, apply fix in staging first if possible, document rollback plan, deploy with monitoring, post-mortem.",
  },
  {
    question: "You are asked to estimate a feature with unclear requirements. How do you proceed?",
    category: "situational",
    difficulty: "medium",
    sampleAnswerOutline:
      "Clarify requirements with stakeholders, break into known and unknown parts, give a range estimate with explicit assumptions, identify spike tasks.",
  },
];

const TECHNICAL_BANKS: Record<string, InterviewQuestion[]> = {
  default: [
    {
      question: "What is the difference between horizontal and vertical scaling?",
      category: "technical",
      difficulty: "easy",
      sampleAnswerOutline:
        "Horizontal: add more nodes (scale out). Vertical: add more resources to one node (scale up). Discuss trade-offs: cost, complexity, statelessness.",
    },
    {
      question: "Explain the CAP theorem in your own words.",
      category: "technical",
      difficulty: "medium",
      sampleAnswerOutline:
        "Consistency, Availability, Partition tolerance — pick at most two. Give examples: Cassandra (AP), PostgreSQL (CP).",
    },
    {
      question: "What is a database index and when should you avoid one?",
      category: "technical",
      difficulty: "medium",
      sampleAnswerOutline:
        "Speed-up reads at cost of write overhead and disk space. Avoid on low-cardinality columns, frequently updated columns, or very small tables.",
    },
    {
      question: "How does TLS/HTTPS protect data in transit?",
      category: "technical",
      difficulty: "easy",
      sampleAnswerOutline:
        "Certificate exchange, asymmetric key negotiation, symmetric session key for bulk encryption, MITM prevention via CA trust chain.",
    },
    {
      question: "Describe eventual consistency. Give a real-world example.",
      category: "technical",
      difficulty: "medium",
      sampleAnswerOutline:
        "Replicas converge over time without guaranteed immediate consistency. Example: DNS propagation, S3 object replication.",
    },
    {
      question: "What is the N+1 query problem and how do you fix it?",
      category: "technical",
      difficulty: "medium",
      sampleAnswerOutline:
        "Fetching a list then issuing one query per item. Fix: eager loading / JOIN, DataLoader batching.",
    },
    {
      question: "How would you design a rate limiter?",
      category: "technical",
      difficulty: "hard",
      sampleAnswerOutline:
        "Token bucket or sliding window counter. Redis with atomic INCR/EXPIRE or Lua scripts. Discuss per-user vs per-IP, distributed consistency.",
    },
  ],
  senior: [
    {
      question:
        "Walk me through how you would design a distributed job queue that guarantees at-least-once delivery.",
      category: "technical",
      difficulty: "hard",
      sampleAnswerOutline:
        "Message broker (e.g. SQS, RabbitMQ), visibility timeout, dead-letter queue, idempotency keys in workers, monitoring.",
    },
    {
      question: "Explain the trade-offs between REST, GraphQL, and gRPC.",
      category: "technical",
      difficulty: "hard",
      sampleAnswerOutline:
        "REST: simple, cacheable, over/under-fetching. GraphQL: flexible queries, client-driven, complex caching. gRPC: binary, efficient, strong contracts, streaming.",
    },
    {
      question: "How do you approach database migrations in a zero-downtime deployment?",
      category: "technical",
      difficulty: "hard",
      sampleAnswerOutline:
        "Expand-contract pattern: add column (nullable), deploy code, backfill, make non-null, deploy, drop old column.",
    },
  ],
  lead: [
    {
      question: "How do you balance technical debt reduction with shipping new features in a team?",
      category: "technical",
      difficulty: "hard",
      sampleAnswerOutline:
        "Debt register, set aside budget (e.g. 20% of sprints), link debt to velocity impact, get product buy-in.",
    },
    {
      question:
        "Describe your approach to defining and enforcing engineering standards across a team.",
      category: "technical",
      difficulty: "hard",
      sampleAnswerOutline:
        "ADRs, style guides, automated linting, code review culture, leading by example, iterative refinement.",
    },
  ],
};

function generateInterviewQuestions(
  occupation: string,
  level: "junior" | "mid" | "senior" | "lead",
  count: number,
): InterviewQuestion[] {
  const techPool: InterviewQuestion[] = [
    ...TECHNICAL_BANKS.default!,
    ...(level === "senior" || level === "lead" ? (TECHNICAL_BANKS.senior ?? []) : []),
    ...(level === "lead" ? (TECHNICAL_BANKS.lead ?? []) : []),
  ];

  if (occupation.toLowerCase().includes("frontend") || occupation.toLowerCase().includes("ui")) {
    techPool.push({
      question: "What techniques do you use to optimise Core Web Vitals?",
      category: "technical",
      difficulty: "medium",
      sampleAnswerOutline:
        "LCP: lazy loading, preload, CDN. CLS: explicit dimensions on images/ads. FID/INP: reduce JS execution, defer non-critical scripts.",
    });
  }
  if (occupation.toLowerCase().includes("data") || occupation.toLowerCase().includes("ml")) {
    techPool.push({
      question: "Explain the difference between a data warehouse and a data lake.",
      category: "technical",
      difficulty: "easy",
      sampleAnswerOutline:
        "Warehouse: structured, schema-on-write, BI-optimised (e.g. Redshift). Lake: raw/unstructured, schema-on-read, cheaper storage.",
    });
  }

  const allQuestions: InterviewQuestion[] = [
    ...techPool,
    ...BEHAVIORAL_QUESTIONS,
    ...SITUATIONAL_QUESTIONS,
  ];
  const technical = techPool.slice(0, Math.ceil(count * 0.5));
  const behavioral = BEHAVIORAL_QUESTIONS.slice(0, Math.ceil(count * 0.3));
  const situational = SITUATIONAL_QUESTIONS.slice(0, Math.ceil(count * 0.2));
  const merged = [...technical, ...behavioral, ...situational];

  if (merged.length < count) {
    const extras = allQuestions.filter((q) => !merged.includes(q));
    merged.push(...extras.slice(0, count - merged.length));
  }

  return merged.slice(0, count);
}

const careerCreateResume: StandaloneToolDefinition = {
  name: "career_create_resume",
  description:
    "Build a structured resume from skills and work experience. Returns a resume ID, formatted preview, and completeness score.",
  category: "career-growth",
  tier: "free",
  alwaysEnabled: true,
  inputSchema: CreateResumeShape,
  handler: async (input: never, _ctx: ServerContext): Promise<CallToolResult> => {
    const typedInput = input as {
      name: string;
      email: string;
      summary: string;
      skills: string[];
      experience: Array<{ title: string; company: string; duration: string; highlights: string[] }>;
    };
    return safeToolCall("career_create_resume", async () => {
      const id = generateResumeId();
      const resume: ResumeData = {
        id,
        name: typedInput.name,
        email: typedInput.email,
        summary: typedInput.summary,
        skills: typedInput.skills,
        experience: typedInput.experience,
        createdAt: new Date().toISOString(),
      };
      resumeStore.set(id, resume);

      const score = scoreResume(resume);
      const preview = formatResumePreview(resume);

      let text = `**Resume Created**\n\n`;
      text += `**ID:** \`${id}\`\n`;
      text += `**Completeness Score:** ${score}/100\n`;
      if (score < 60) {
        text += `**Tip:** Add more experience entries with highlights to raise your score.\n`;
      }
      text += `\n---\n\n`;
      text += preview;
      return textResult(text);
    });
  },
};

const careerMatchJobs: StandaloneToolDefinition = {
  name: "career_match_jobs",
  description:
    "Match a saved resume against available job listings. Returns a ranked list with match score, skill overlap, and salary range.",
  category: "career-growth",
  tier: "free",
  alwaysEnabled: true,
  inputSchema: MatchJobsShape,
  handler: async (input: never, _ctx: ServerContext): Promise<CallToolResult> => {
    const { resume_id, location, remote_only } = input as {
      resume_id: string;
      location?: string;
      remote_only?: boolean;
    };
    return safeToolCall("career_match_jobs", async () => {
      const resume = resumeStore.get(resume_id);
      if (!resume) {
        return textResult(
          `**Error: NOT_FOUND**\nResume \`${resume_id}\` does not exist. Create one first with \`career_create_resume\`.\n**Retryable:** false`,
        );
      }

      let jobs = [...SAMPLE_JOBS];
      if (remote_only === true) {
        jobs = jobs.filter((j) => j.remote);
      }
      if (location) {
        const loc = location.toLowerCase();
        jobs = jobs.filter((j) => j.location.toLowerCase().includes(loc) || j.remote);
      }

      if (jobs.length === 0) {
        return textResult("No jobs found matching your location or remote preference.");
      }

      const ranked = jobs
        .map((job) => ({
          job,
          score: computeJobMatchScore(resume.skills, job),
          matched: job.requiredSkills.filter((s) =>
            resume.skills.map((r) => r.toLowerCase()).includes(s.toLowerCase()),
          ),
        }))
        .sort((a, b) => b.score - a.score);

      let text = `**Job Matches for ${resume.name} (${ranked.length} jobs):**\n\n`;
      for (const { job, score, matched } of ranked) {
        text += `### ${job.title} — ${job.company}\n`;
        text += `**Match Score:** ${score}%\n`;
        text += `**Location:** ${job.location}${job.remote ? " (remote)" : ""}\n`;
        text += `**Salary:** ${job.currency} ${job.salaryMin.toLocaleString()}–${job.salaryMax.toLocaleString()}\n`;
        text += `**Skills Matched:** ${matched.join(", ") || "none"}\n`;
        const missing = job.requiredSkills.filter(
          (s) => !resume.skills.map((r) => r.toLowerCase()).includes(s.toLowerCase()),
        );
        if (missing.length > 0) {
          text += `**Skills to Develop:** ${missing.join(", ")}\n`;
        }
        text += "\n";
      }
      return textResult(text);
    });
  },
};

const careerGetLearningPath: StandaloneToolDefinition = {
  name: "career_get_learning_path",
  description:
    "Generate an ordered learning path from current skills to a target occupation. Returns prioritised skills to learn with resources and estimated hours.",
  category: "career-growth",
  tier: "free",
  alwaysEnabled: true,
  inputSchema: LearningPathShape,
  handler: async (input: never, _ctx: ServerContext): Promise<CallToolResult> => {
    const { current_skills, target_occupation, time_budget_hours } = input as {
      current_skills: string[];
      target_occupation: string;
      time_budget_hours?: number;
    };
    return safeToolCall("career_get_learning_path", async () => {
      const path = buildLearningPath(current_skills, target_occupation, time_budget_hours);

      if (path.length === 0) {
        return textResult(
          `You already have the skills needed for **${target_occupation}**. Consider applying now or deepening expertise in your existing stack.`,
        );
      }

      const totalHours = path.reduce((sum, item) => sum + item.estimatedHours, 0);

      let text = `**Learning Path: ${target_occupation}**\n\n`;
      if (time_budget_hours !== undefined) {
        text += `_Filtered to fit within ${time_budget_hours}h budget._\n\n`;
      }
      text += `**Total Estimated Time:** ~${totalHours} hours\n\n`;
      text += `| # | Skill | Hours | Priority | Resources |\n`;
      text += `|---|-------|-------|----------|-----------|\n`;
      for (const [index, item] of path.entries()) {
        text += `| ${index + 1} | ${item.skill} | ${item.estimatedHours}h | ${item.priority} | ${item.resources.join(
          "; ",
        )} |\n`;
      }
      return textResult(text);
    });
  },
};

const careerInterviewPrep: StandaloneToolDefinition = {
  name: "career_interview_prep",
  description:
    "Generate tailored interview questions for a given occupation and seniority level. Includes technical, behavioral, and situational questions with sample answer outlines.",
  category: "career-growth",
  tier: "free",
  alwaysEnabled: true,
  inputSchema: InterviewPrepShape,
  handler: async (input: never, _ctx: ServerContext): Promise<CallToolResult> => {
    const {
      occupation,
      level,
      question_count = 10,
    } = input as {
      occupation: string;
      level: "junior" | "mid" | "senior" | "lead";
      question_count?: number;
    };
    return safeToolCall("career_interview_prep", async () => {
      const questions = generateInterviewQuestions(occupation, level, question_count);

      let text = `**Interview Prep: ${occupation} (${level})**\n\n`;
      text += `${questions.length} questions generated.\n\n`;

      for (const [index, q] of questions.entries()) {
        text += `---\n\n`;
        text += `**Q${index + 1}.** ${q.question}\n`;
        text += `_Category: ${q.category} | Difficulty: ${q.difficulty}_\n\n`;
        text += `**Sample Answer Outline:**\n${q.sampleAnswerOutline}\n\n`;
      }
      return textResult(text);
    });
  },
};

// ─── Export ──────────────────────────────────────────────────────────────────

export const careerNavigatorTools: StandaloneToolDefinition[] = [
  // ESCO + Adzuna (6)
  careerAssessSkills,
  careerSearchOccupations,
  careerGetOccupation,
  careerCompareSkills,
  careerGetSalary,
  careerGetJobs,
  // Career Growth (4)
  careerCreateResume,
  careerMatchJobs,
  careerGetLearningPath,
  careerInterviewPrep,
];
