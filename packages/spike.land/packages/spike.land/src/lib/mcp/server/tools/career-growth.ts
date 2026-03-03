/**
 * Career Growth MCP Tools
 *
 * Resume building, job matching, learning paths, and interview prep.
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "../tool-registry";
import { safeToolCall, textResult } from "./tool-helpers";

// ─── Schemas ────────────────────────────────────────────────────────────────

const ExperienceEntrySchema = z.object({
  title: z.string().describe("Job title"),
  company: z.string().describe("Company name"),
  duration: z.string().describe("Duration, e.g. '2021–2023' or '18 months'"),
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
  time_budget_hours: z.number().positive().optional().describe(
    "Total hours available for learning (optional, used to prioritise)",
  ),
});

const InterviewPrepSchema = z.object({
  occupation: z.string().describe("Job title to prepare for"),
  level: z.enum(["junior", "mid", "senior", "lead"]).describe("Seniority level"),
  question_count: z.number().min(5).max(20).optional().default(10).describe(
    "Number of questions to generate (5–20, default 10)",
  ),
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

// In-memory store keyed by resume ID.  A real implementation would
// persist to the database via Prisma.
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
  const highlightedEntries = resume.experience.filter(e => e.highlights.length >= 2);
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
  const normalised = resumeSkills.map(s => s.toLowerCase());
  const matched = job.requiredSkills.filter(s => normalised.includes(s.toLowerCase()));
  return Math.round((matched.length / job.requiredSkills.length) * 100);
}

// ─── Learning path helpers ────────────────────────────────────────────────────

interface LearningItem {
  skill: string;
  estimatedHours: number;
  priority: "critical" | "high" | "medium" | "low";
  resources: string[];
}

const SKILL_METADATA: Record<string, { hours: number; resources: string[]; }> = {
  typescript: {
    hours: 40,
    resources: ["TypeScript Handbook (typescriptlang.org)", "Execute Program — TypeScript"],
  },
  react: {
    hours: 60,
    resources: ["react.dev official docs", "Scrimba React course"],
  },
  python: {
    hours: 50,
    resources: ["Python.org tutorial", "Real Python"],
  },
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
  aws: {
    hours: 60,
    resources: ["AWS Skill Builder", "A Cloud Guru"],
  },
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
  // Derive needed skills from target occupation title keywords
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

  const normalisedCurrent = currentSkills.map(s => s.toLowerCase());
  const gaps = candidates.filter(c => !normalisedCurrent.includes(c.toLowerCase()));

  const items: LearningItem[] = gaps.map((skill, index) => {
    const meta = SKILL_METADATA[skill.toLowerCase()] ?? DEFAULT_SKILL_META;
    const priority: LearningItem["priority"] = index === 0
      ? "critical"
      : index === 1
      ? "high"
      : index <= 3
      ? "medium"
      : "low";
    return { skill, estimatedHours: meta.hours, priority, resources: meta.resources };
  });

  if (timeBudget !== undefined) {
    let remaining = timeBudget;
    return items.filter(item => {
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

  // Add occupation-specific questions
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

  // Interleave categories: roughly 50% technical, 30% behavioral, 20% situational
  const technical = techPool.slice(0, Math.ceil(count * 0.5));
  const behavioral = BEHAVIORAL_QUESTIONS.slice(0, Math.ceil(count * 0.3));
  const situational = SITUATIONAL_QUESTIONS.slice(0, Math.ceil(count * 0.2));
  const merged = [...technical, ...behavioral, ...situational];

  // If we still have fewer than count, fill from the full pool
  if (merged.length < count) {
    const extras = allQuestions.filter(q => !merged.includes(q));
    merged.push(...extras.slice(0, count - merged.length));
  }

  return merged.slice(0, count);
}

// ─── Tool Registration ────────────────────────────────────────────────────────

export function registerCareerGrowthTools(
  registry: ToolRegistry,
  _userId: string,
): void {
  // 1. career_create_resume
  registry.register({
    name: "career_create_resume",
    description:
      "Build a structured resume from skills and work experience. Returns a resume ID, formatted preview, and completeness score.",
    category: "career-growth",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: CreateResumeSchema.shape,
    handler: async (
      input: z.infer<typeof CreateResumeSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("career_create_resume", async () => {
        const id = generateResumeId();
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
      }),
  });

  // 2. career_match_jobs
  registry.register({
    name: "career_match_jobs",
    description:
      "Match a saved resume against available job listings. Returns a ranked list with match score, skill overlap, and salary range.",
    category: "career-growth",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: MatchJobsSchema.shape,
    handler: async (
      { resume_id, location, remote_only }: z.infer<typeof MatchJobsSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("career_match_jobs", async () => {
        const resume = resumeStore.get(resume_id);
        if (!resume) {
          return textResult(
            `**Error: NOT_FOUND**\nResume \`${resume_id}\` does not exist. Create one first with \`career_create_resume\`.\n**Retryable:** false`,
          );
        }

        let jobs = [...SAMPLE_JOBS];
        if (remote_only === true) {
          jobs = jobs.filter(j => j.remote);
        }
        if (location) {
          const loc = location.toLowerCase();
          jobs = jobs.filter(
            j => j.location.toLowerCase().includes(loc) || j.remote,
          );
        }

        if (jobs.length === 0) {
          return textResult("No jobs found matching your location or remote preference.");
        }

        const ranked = jobs
          .map(job => ({
            job,
            score: computeJobMatchScore(resume.skills, job),
            matched: job.requiredSkills.filter(s =>
              resume.skills.map(r => r.toLowerCase()).includes(s.toLowerCase())
            ),
          }))
          .sort((a, b) => b.score - a.score);

        let text = `**Job Matches for ${resume.name} (${ranked.length} jobs):**\n\n`;
        for (const { job, score, matched } of ranked) {
          text += `### ${job.title} — ${job.company}\n`;
          text += `**Match Score:** ${score}%\n`;
          text += `**Location:** ${job.location}${job.remote ? " (remote)" : ""}\n`;
          text +=
            `**Salary:** ${job.currency} ${job.salaryMin.toLocaleString()}–${job.salaryMax.toLocaleString()}\n`;
          text += `**Skills Matched:** ${matched.join(", ") || "none"}\n`;
          const missing = job.requiredSkills.filter(
            s => !resume.skills.map(r => r.toLowerCase()).includes(s.toLowerCase()),
          );
          if (missing.length > 0) {
            text += `**Skills to Develop:** ${missing.join(", ")}\n`;
          }
          text += "\n";
        }
        return textResult(text);
      }),
  });

  // 3. career_get_learning_path
  registry.register({
    name: "career_get_learning_path",
    description:
      "Generate an ordered learning path from current skills to a target occupation. Returns prioritised skills to learn with resources and estimated hours.",
    category: "career-growth",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: LearningPathSchema.shape,
    handler: async (
      { current_skills, target_occupation, time_budget_hours }: z.infer<
        typeof LearningPathSchema
      >,
    ): Promise<CallToolResult> =>
      safeToolCall("career_get_learning_path", async () => {
        const path = buildLearningPath(
          current_skills,
          target_occupation,
          time_budget_hours,
        );

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
          text += `| ${index + 1} | ${item.skill} | ${item.estimatedHours}h | ${item.priority} | ${
            item.resources.join("; ")
          } |\n`;
        }
        return textResult(text);
      }),
  });

  // 4. career_interview_prep
  registry.register({
    name: "career_interview_prep",
    description:
      "Generate tailored interview questions for a given occupation and seniority level. Includes technical, behavioral, and situational questions with sample answer outlines.",
    category: "career-growth",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: InterviewPrepSchema.shape,
    handler: async (
      { occupation, level, question_count = 10 }: z.infer<typeof InterviewPrepSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("career_interview_prep", async () => {
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
      }),
  });
}
