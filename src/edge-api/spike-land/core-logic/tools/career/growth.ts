/**
 * Career Growth MCP Tools (CF Workers)
 *
 * Resume building, job matching, learning paths, and interview prep.
 * These are stateless/in-memory tools that don't require DB access.
 */

import { z } from "zod";
import type { ToolRegistryAdapter } from "../../../lazy-imports/types";
import { freeTool } from "../../../lazy-imports/procedures-index.ts";
import { safeToolCall, textResult } from "../../lib/tool-helpers";
import type { DrizzleDB } from "../../../db/db/db-index.ts";

// ─── Schemas ────────────────────────────────────────────────────────────────

const ExperienceEntrySchema = z.object({
  title: z.string().describe("Job title"),
  company: z.string().describe("Company name"),
  duration: z.string().describe("Duration, e.g. '2021-2023' or '18 months'"),
  highlights: z.array(z.string()).describe("Key achievements or responsibilities"),
});

const CreateResumeSchema = z.object({
  name: z.string().describe("Full name"),
  email: z.string().email().describe("Contact email address"),
  summary: z.string().describe("Professional summary (2-4 sentences)"),
  skills: z.array(z.string()).min(1).describe("List of skill names"),
  experience: z.array(ExperienceEntrySchema).describe("Work experience entries"),
});

const MatchJobsSchema = z.object({
  resume_id: z.string().describe("Resume ID returned by career_create_resume"),
  location: z.string().optional().describe("Preferred job location (city or country)"),
  remote_only: z.boolean().optional().describe("Filter to remote positions only"),
});

const LearningPathSchema = z.object({
  current_skills: z.array(z.string()).min(1).describe("Skills the user already has"),
  target_occupation: z.string().describe("Target job title or occupation"),
  time_budget_hours: z
    .number()
    .positive()
    .optional()
    .describe("Total hours available for learning (optional, used to prioritise)"),
});

const InterviewPrepSchema = z.object({
  occupation: z.string().describe("Job title to prepare for"),
  level: z.enum(["junior", "mid", "senior", "lead"]).describe("Seniority level"),
  question_count: z
    .number()
    .min(5)
    .max(20)
    .optional()
    .default(10)
    .describe("Number of questions to generate (5-20, default 10)"),
});

// ─── Types ───────────────────────────────────────────────────────────────────

interface ResumeData {
  id: string;
  name: string;
  email: string;
  summary: string;
  skills: string[];
  experience: z.infer<typeof ExperienceEntrySchema>[];
  createdAt: string;
}

// In-memory store keyed by resume ID.
const resumeStore = new Map<string, ResumeData>();

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

// ─── Job matching helpers ────────────────────────────────────────────────────

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

// ─── Learning path helpers ────────────────────────────────────────────────────

interface LearningItem {
  skill: string;
  estimatedHours: number;
  priority: "critical" | "high" | "medium" | "low";
  resources: string[];
}

const SKILL_METADATA: Record<string, { hours: number; resources: string[] }> = {
  typescript: {
    hours: 40,
    resources: ["TypeScript Handbook (typescriptlang.org)", "Execute Program"],
  },
  react: {
    hours: 60,
    resources: ["react.dev official docs", "Scrimba React course"],
  },
  python: { hours: 50, resources: ["Python.org tutorial", "Real Python"] },
  docker: {
    hours: 20,
    resources: ["Docker Getting Started guide", "KodeKloud Docker course"],
  },
  kubernetes: {
    hours: 35,
    resources: ["Kubernetes.io tutorials", "KodeKloud CKA prep"],
  },
  postgresql: {
    hours: 25,
    resources: ["PostgreSQL official tutorial", "pgexercises.com"],
  },
  aws: { hours: 60, resources: ["AWS Skill Builder", "A Cloud Guru"] },
  redis: {
    hours: 15,
    resources: ["Redis University", "redis.io documentation"],
  },
  terraform: {
    hours: 30,
    resources: ["HashiCorp Learn", "Gruntwork Terraform tutorial"],
  },
  "node.js": {
    hours: 35,
    resources: ["nodejs.dev docs", "The Odin Project Node path"],
  },
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
    return {
      skill,
      estimatedHours: meta.hours,
      priority,
      resources: meta.resources,
    };
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

// ─── Interview question helpers ───────────────────────────────────────────────

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
    sampleAnswerOutline: "Use STAR: Situation, Task, Action, Result.",
  },
  {
    question: "Tell me about a conflict with a teammate and how you resolved it.",
    category: "behavioral",
    difficulty: "medium",
    sampleAnswerOutline:
      "STAR: Explain the disagreement, empathetic approach, compromise, outcome.",
  },
  {
    question: "Give an example of a project where you took ownership beyond your role.",
    category: "behavioral",
    difficulty: "medium",
    sampleAnswerOutline:
      "STAR: Context of gap, why you stepped up, what you did, measurable impact.",
  },
  {
    question: "Describe a situation where you received critical feedback. How did you respond?",
    category: "behavioral",
    difficulty: "easy",
    sampleAnswerOutline: "Show receptiveness, specific actions to improve, long-term outcome.",
  },
];

const SITUATIONAL_QUESTIONS: InterviewQuestion[] = [
  {
    question:
      "Your PR is blocking three teammates. The reviewer is unavailable for two days. What do you do?",
    category: "situational",
    difficulty: "hard",
    sampleAnswerOutline: "Seek another reviewer, split PR, communicate proactively.",
  },
  {
    question:
      "Production is down. You have a potential fix but it is untested. What is your process?",
    category: "situational",
    difficulty: "hard",
    sampleAnswerOutline: "Triage, notify, staging first, rollback plan, deploy with monitoring.",
  },
  {
    question: "You are asked to estimate a feature with unclear requirements. How do you proceed?",
    category: "situational",
    difficulty: "medium",
    sampleAnswerOutline: "Clarify requirements, break into known/unknown, range estimate.",
  },
];

const TECHNICAL_BANKS: Record<string, InterviewQuestion[]> = {
  default: [
    {
      question: "What is the difference between horizontal and vertical scaling?",
      category: "technical",
      difficulty: "easy",
      sampleAnswerOutline:
        "Horizontal: add nodes. Vertical: add resources. Trade-offs: cost, complexity.",
    },
    {
      question: "Explain the CAP theorem in your own words.",
      category: "technical",
      difficulty: "medium",
      sampleAnswerOutline: "Consistency, Availability, Partition tolerance — pick two.",
    },
    {
      question: "What is a database index and when should you avoid one?",
      category: "technical",
      difficulty: "medium",
      sampleAnswerOutline: "Speeds reads, costs writes. Avoid on low-cardinality or small tables.",
    },
    {
      question: "How does TLS/HTTPS protect data in transit?",
      category: "technical",
      difficulty: "easy",
      sampleAnswerOutline: "Certificate exchange, key negotiation, symmetric encryption, CA trust.",
    },
    {
      question: "Describe eventual consistency. Give a real-world example.",
      category: "technical",
      difficulty: "medium",
      sampleAnswerOutline: "Replicas converge over time. Example: DNS propagation.",
    },
    {
      question: "What is the N+1 query problem and how do you fix it?",
      category: "technical",
      difficulty: "medium",
      sampleAnswerOutline: "Fetching list then per-item queries. Fix: eager loading / DataLoader.",
    },
    {
      question: "How would you design a rate limiter?",
      category: "technical",
      difficulty: "hard",
      sampleAnswerOutline: "Token bucket or sliding window. Redis atomic ops. Per-user vs per-IP.",
    },
  ],
  senior: [
    {
      question: "Walk me through designing a distributed job queue with at-least-once delivery.",
      category: "technical",
      difficulty: "hard",
      sampleAnswerOutline: "Message broker, visibility timeout, DLQ, idempotency keys.",
    },
    {
      question: "Explain the trade-offs between REST, GraphQL, and gRPC.",
      category: "technical",
      difficulty: "hard",
      sampleAnswerOutline:
        "REST: simple, cacheable. GraphQL: flexible, complex caching. gRPC: binary, streaming.",
    },
    {
      question: "How do you approach database migrations in a zero-downtime deployment?",
      category: "technical",
      difficulty: "hard",
      sampleAnswerOutline: "Expand-contract pattern: add column, deploy, backfill, drop old.",
    },
  ],
  lead: [
    {
      question: "How do you balance technical debt reduction with shipping new features?",
      category: "technical",
      difficulty: "hard",
      sampleAnswerOutline: "Debt register, budget allocation, link to velocity, product buy-in.",
    },
    {
      question: "Describe your approach to defining and enforcing engineering standards.",
      category: "technical",
      difficulty: "hard",
      sampleAnswerOutline: "ADRs, style guides, automated linting, code review culture.",
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
        "LCP: lazy loading, preload. CLS: explicit dimensions. FID/INP: defer scripts.",
    });
  }
  if (occupation.toLowerCase().includes("data") || occupation.toLowerCase().includes("ml")) {
    techPool.push({
      question: "Explain the difference between a data warehouse and a data lake.",
      category: "technical",
      difficulty: "easy",
      sampleAnswerOutline: "Warehouse: structured, schema-on-write. Lake: raw, schema-on-read.",
    });
  }

  const technical = techPool.slice(0, Math.ceil(count * 0.5));
  const behavioral = BEHAVIORAL_QUESTIONS.slice(0, Math.ceil(count * 0.3));
  const situational = SITUATIONAL_QUESTIONS.slice(0, Math.ceil(count * 0.2));
  const merged = [...technical, ...behavioral, ...situational];

  if (merged.length < count) {
    const allQuestions = [...techPool, ...BEHAVIORAL_QUESTIONS, ...SITUATIONAL_QUESTIONS];
    const extras = allQuestions.filter((q) => !merged.includes(q));
    merged.push(...extras.slice(0, count - merged.length));
  }

  return merged.slice(0, count);
}

// ─── Tool Registration ────────────────────────────────────────────────────────

export function registerCareerGrowthTools(
  registry: ToolRegistryAdapter,
  userId: string,
  db: DrizzleDB,
): void {
  const t = freeTool(userId, db);

  // career_create_resume
  registry.registerBuilt(
    t
      .tool(
        "career_create_resume",
        "Build a structured resume from skills and work experience. Returns a resume ID, formatted preview, and completeness score.",
        CreateResumeSchema.shape,
      )
      .meta({ category: "career-growth", tier: "free" })
      .handler(async ({ input }) => {
        return safeToolCall("career_create_resume", async () => {
          const id = `resume_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          const resume: ResumeData = {
            id,
            name: input.name,
            email: input.email,
            summary: input.summary,
            skills: input.skills,
            experience: input.experience,
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
      }),
  );

  // career_match_jobs
  registry.registerBuilt(
    t
      .tool(
        "career_match_jobs",
        "Match a saved resume against available job listings. Returns a ranked list with match score, skill overlap, and salary range.",
        MatchJobsSchema.shape,
      )
      .meta({ category: "career-growth", tier: "free" })
      .handler(async ({ input }) => {
        return safeToolCall("career_match_jobs", async () => {
          const resume = resumeStore.get(input.resume_id);
          if (!resume) {
            return textResult(
              `**Error: NOT_FOUND**\nResume \`${input.resume_id}\` does not exist. Create one first with \`career_create_resume\`.\n**Retryable:** false`,
            );
          }

          let jobs = [...SAMPLE_JOBS];
          if (input.remote_only === true) {
            jobs = jobs.filter((j) => j.remote);
          }
          if (input.location) {
            const loc = input.location.toLowerCase();
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
            text += `**Salary:** ${job.currency} ${job.salaryMin.toLocaleString()}-${job.salaryMax.toLocaleString()}\n`;
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
      }),
  );

  // career_get_learning_path
  registry.registerBuilt(
    t
      .tool(
        "career_get_learning_path",
        "Generate an ordered learning path from current skills to a target occupation. Returns prioritised skills with resources and estimated hours.",
        LearningPathSchema.shape,
      )
      .meta({ category: "career-growth", tier: "free" })
      .handler(async ({ input }) => {
        return safeToolCall("career_get_learning_path", async () => {
          const path = buildLearningPath(
            input.current_skills,
            input.target_occupation,
            input.time_budget_hours,
          );

          if (path.length === 0) {
            return textResult(
              `You already have the skills needed for **${input.target_occupation}**. Consider applying now or deepening expertise.`,
            );
          }

          const totalHours = path.reduce((sum, item) => sum + item.estimatedHours, 0);

          let text = `**Learning Path: ${input.target_occupation}**\n\n`;
          if (input.time_budget_hours !== undefined) {
            text += `_Filtered to fit within ${input.time_budget_hours}h budget._\n\n`;
          }
          text += `**Total Estimated Time:** ~${totalHours} hours\n\n`;
          text += `| # | Skill | Hours | Priority | Resources |\n`;
          text += `|---|-------|-------|----------|-----------|\n`;
          for (const [index, item] of path.entries()) {
            text += `| ${
              index + 1
            } | ${item.skill} | ${item.estimatedHours}h | ${item.priority} | ${item.resources.join(
              "; ",
            )} |\n`;
          }
          return textResult(text);
        });
      }),
  );

  // career_interview_prep
  registry.registerBuilt(
    t
      .tool(
        "career_interview_prep",
        "Generate tailored interview questions for a given occupation and seniority level. Includes technical, behavioral, and situational questions with sample answer outlines.",
        InterviewPrepSchema.shape,
      )
      .meta({ category: "career-growth", tier: "free" })
      .handler(async ({ input }) => {
        return safeToolCall("career_interview_prep", async () => {
          const questions = generateInterviewQuestions(
            input.occupation,
            input.level,
            input.question_count,
          );

          let text = `**Interview Prep: ${input.occupation} (${input.level})**\n\n`;
          text += `${questions.length} questions generated.\n\n`;

          for (const [index, q] of questions.entries()) {
            text += `---\n\n`;
            text += `**Q${index + 1}.** ${q.question}\n`;
            text += `_Category: ${q.category} | Difficulty: ${q.difficulty}_\n\n`;
            text += `**Sample Answer Outline:**\n${q.sampleAnswerOutline}\n\n`;
          }
          return textResult(text);
        });
      }),
  );
}
