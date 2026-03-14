#!/usr/bin/env node
/**
 * Math Engine MCP Server — AI-powered mathematical reasoning with multi-agent architecture.
 *
 * 7 tools: solve, verify, explore, audit_gap, list, generate_blog, agent_status
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  wrapServerWithLogging,
  registerFeedbackTool,
  createErrorShipper,
} from "@spike-land-ai/mcp-server-base";
import { z } from "zod";
import { errorResult, jsonResult, tryCatch } from "./types.js";
import {
  getAllProblems,
  getProblemById,
  getProblemsByCategory,
} from "../core-logic/problem-registry.js";
import { runMultiAgentSolve, getSession, listSessions } from "../core-logic/agent-orchestrator.js";
import { verifyProof } from "../core-logic/proof-verifier.js";
import { exploreConjecture } from "../core-logic/conjecture-explorer.js";
import { analyzeConvergence } from "../core-logic/convergence-prover.js";
import { checkComputability } from "../core-logic/computability-checker.js";
import { resolveGap as resolveCurryGap } from "../core-logic/curry-resolver.js";
import { generateBlogPost } from "../core-logic/blog-generator.js";
import type { LLMProvider, LLMCallOptions } from "../core-logic/types.js";

const server = new McpServer({
  name: "math-engine",
  version: "0.1.0",
});

const shipper = createErrorShipper();
process.on("uncaughtException", (err) =>
  shipper.shipError({
    service_name: "math-engine",
    message: err.message,
    stack_trace: err.stack,
    severity: "high",
  }),
);
process.on("unhandledRejection", (err: unknown) =>
  shipper.shipError({
    service_name: "math-engine",
    message: err instanceof Error ? err.message : String(err),
    stack_trace: err instanceof Error ? err.stack : undefined,
    severity: "high",
  }),
);

wrapServerWithLogging(server, "math-engine");

// ─── LLM Provider ───

function createLLMProvider(): LLMProvider {
  const apiKey =
    process.env.ANTHROPIC_API_KEY || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
  const provider = process.env.ANTHROPIC_API_KEY
    ? "anthropic"
    : process.env.GEMINI_API_KEY
      ? "google"
      : process.env.OPENAI_API_KEY
        ? "openai"
        : null;

  if (!apiKey || !provider) {
    throw new Error(
      "No LLM API key found. Set ANTHROPIC_API_KEY, GEMINI_API_KEY, or OPENAI_API_KEY.",
    );
  }

  return {
    async complete(options: LLMCallOptions): Promise<string> {
      switch (provider) {
        case "anthropic":
          return callAnthropic(apiKey, options);
        case "google":
          return callGoogle(apiKey, options);
        case "openai":
          return callOpenAI(apiKey, options);
        default:
          throw new Error(`Unknown provider: ${provider}`);
      }
    },
  };
}

async function callAnthropic(apiKey: string, options: LLMCallOptions): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: options.maxTokens,
      temperature: options.temperature,
      system: options.systemPrompt,
      messages: [{ role: "user", content: options.userPrompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as { content: Array<{ type: string; text?: string }> };
  const textBlock = data.content.find((b) => b.type === "text");
  return textBlock?.text ?? "";
}

async function callGoogle(apiKey: string, options: LLMCallOptions): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: options.systemPrompt }] },
        contents: [{ parts: [{ text: options.userPrompt }] }],
        generationConfig: {
          temperature: options.temperature,
          maxOutputTokens: options.maxTokens,
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Google API error: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

async function callOpenAI(apiKey: string, options: LLMCallOptions): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      max_tokens: options.maxTokens,
      temperature: options.temperature,
      messages: [
        { role: "system", content: options.systemPrompt },
        { role: "user", content: options.userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content ?? "";
}

// ─── Initialize ───

const llm = createLLMProvider();

// ─── Tool 1: math_solve_problem ───

server.tool(
  "math_solve_problem",
  "Run multi-agent mathematical problem solving with cross-pollination (Analyst + Constructor + Adversary)",
  {
    problem_id: z.string().describe("Problem ID from the registry"),
    max_iterations: z.number().int().min(1).max(20).default(5).describe("Maximum iteration rounds"),
  },
  async ({ problem_id, max_iterations }) => {
    const result = await tryCatch(runMultiAgentSolve(problem_id, max_iterations, llm));
    if (!result.ok) {
      return errorResult("ORCHESTRATION_ERROR", result.error.message, true);
    }
    const session = result.data;
    return jsonResult({
      sessionId: session.sessionId,
      status: session.status,
      iterations: session.iteration,
      totalFindings: session.findings.length,
      proofAttempts: session.proofAttempts.length,
      verifiedProofs: session.proofAttempts.filter((p) => p.status === "verified").length,
      topFindings: session.findings
        .filter((f) => f.confidence >= 0.7)
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 10),
    });
  },
);

// ─── Tool 2: math_verify_proof ───

server.tool(
  "math_verify_proof",
  "Verify a mathematical proof attempt step by step",
  {
    method: z.string().describe("Name of the proof method"),
    steps: z.array(z.string()).min(1).describe("Proof steps to verify"),
  },
  async ({ method, steps }) => {
    const proof = {
      id: `manual-${Date.now()}`,
      problemId: "manual",
      agentRole: "constructor" as const,
      iteration: 0,
      method,
      steps,
      status: "pending" as const,
    };
    const result = await tryCatch(verifyProof(proof, llm));
    if (!result.ok) {
      return errorResult("LLM_ERROR", result.error.message, true);
    }
    return jsonResult(result.data);
  },
);

// ─── Tool 3: math_explore_conjecture ───

server.tool(
  "math_explore_conjecture",
  "AI-assisted exploration of an Erdos conjecture or open problem",
  {
    conjecture_id: z.string().describe("Conjecture ID from the registry"),
    max_iterations: z.number().int().min(1).max(10).default(3).describe("Exploration rounds"),
  },
  async ({ conjecture_id, max_iterations }) => {
    const problem = getProblemById(conjecture_id);
    if (!problem) {
      return errorResult("PROBLEM_NOT_FOUND", `Unknown conjecture: ${conjecture_id}`, false);
    }

    const { createSessionState } = await import("../core-logic/types.js");
    const session = createSessionState(`explore-${Date.now()}`, conjecture_id, max_iterations);

    const allFindings = [];
    for (let i = 0; i < max_iterations; i++) {
      session.iteration = i + 1;
      const findings = await exploreConjecture(problem, session, llm);
      session.findings.push(...findings);
      allFindings.push(...findings);
    }

    return jsonResult({
      conjecture: problem.title,
      iterations: max_iterations,
      totalFindings: allFindings.length,
      findings: allFindings.sort((a, b) => b.confidence - a.confidence).slice(0, 15),
    });
  },
);

// ─── Tool 4: math_audit_gap ───

server.tool(
  "math_audit_gap",
  "Address one of the 3 fatal audit gaps (convergence, uncomputability, curry_paradox)",
  {
    gap_id: z
      .enum(["convergence", "uncomputability", "curry_paradox"])
      .describe("Which audit gap to address"),
    max_iterations: z.number().int().min(1).max(10).default(3).describe("Analysis rounds"),
  },
  async ({ gap_id, max_iterations }) => {
    const problemId = gap_id === "curry_paradox" ? "curry_paradox" : gap_id;
    const problem = getProblemById(problemId);
    if (!problem) {
      return errorResult("PROBLEM_NOT_FOUND", `Unknown gap: ${gap_id}`, false);
    }

    const { createSessionState } = await import("../core-logic/types.js");
    const session = createSessionState(`gap-${Date.now()}`, problemId, max_iterations);

    const allFindings = [];
    for (let i = 0; i < max_iterations; i++) {
      session.iteration = i + 1;

      let findings;
      switch (gap_id) {
        case "convergence":
          findings = await analyzeConvergence(problem, session, llm);
          break;
        case "uncomputability":
          findings = await checkComputability(problem, session, llm);
          break;
        case "curry_paradox":
          findings = await resolveCurryGap(session, llm);
          break;
      }

      session.findings.push(...findings);
      allFindings.push(...findings);
    }

    return jsonResult({
      gap: gap_id,
      problem: problem.title,
      iterations: max_iterations,
      totalFindings: allFindings.length,
      findings: allFindings.sort((a, b) => b.confidence - a.confidence).slice(0, 15),
    });
  },
);

// ─── Tool 5: math_list_problems ───

server.tool(
  "math_list_problems",
  "List available problems by category and status",
  {
    category: z
      .enum(["audit_gap", "erdos_conjecture", "open_problem", "all"])
      .default("all")
      .describe("Filter by category"),
  },
  async ({ category }) => {
    const problems = category === "all" ? getAllProblems() : getProblemsByCategory(category);
    return jsonResult({
      count: problems.length,
      problems: problems.map((p) => ({
        id: p.id,
        title: p.title,
        category: p.category,
        status: p.status,
        description: p.description.slice(0, 200),
      })),
    });
  },
);

// ─── Tool 6: math_generate_blog ───

server.tool(
  "math_generate_blog",
  "Generate an MDX blog post from a session's results",
  {
    session_id: z.string().describe("Session ID from a previous solve or explore"),
  },
  async ({ session_id }) => {
    const session = getSession(session_id);
    if (!session) {
      return errorResult("SESSION_NOT_FOUND", `No session: ${session_id}`, false);
    }

    const result = await tryCatch(generateBlogPost(session, llm));
    if (!result.ok) {
      return errorResult("LLM_ERROR", result.error.message, true);
    }

    const post = result.data;
    return jsonResult({
      filename: post.filename,
      frontmatter: post.frontmatter,
      contentPreview: post.content.slice(0, 500),
      fullMdx: post.fullMdx,
    });
  },
);

// ─── Tool 7: math_agent_status ───

server.tool(
  "math_agent_status",
  "Check status of running or completed math sessions",
  {
    session_id: z.string().optional().describe("Specific session ID (omit for all sessions)"),
  },
  async ({ session_id }) => {
    if (session_id) {
      const session = getSession(session_id);
      if (!session) {
        return errorResult("SESSION_NOT_FOUND", `No session: ${session_id}`, false);
      }
      return jsonResult({
        sessionId: session.sessionId,
        problemId: session.problemId,
        status: session.status,
        iteration: session.iteration,
        maxIterations: session.maxIterations,
        totalFindings: session.findings.length,
        proofAttempts: session.proofAttempts.length,
        agents: Object.fromEntries(
          Object.entries(session.agents).map(([role, state]) => [
            role,
            { findings: state.findings.length, proofAttempts: state.proofAttempts.length },
          ]),
        ),
        startedAt: new Date(session.startedAt).toISOString(),
        updatedAt: new Date(session.updatedAt).toISOString(),
      });
    }

    const all = listSessions();
    return jsonResult({
      activeSessions: all.length,
      sessions: all.map((s) => ({
        sessionId: s.sessionId,
        problemId: s.problemId,
        status: s.status,
        iteration: s.iteration,
        findings: s.findings.length,
      })),
    });
  },
);

// ─── Feedback ───

registerFeedbackTool(server, { serviceName: "math-engine", toolName: "math_feedback" });

// ─── Start ───

const transport = new StdioServerTransport();
await server.connect(transport);

process.stderr.write("Math Engine MCP Server running on stdio.\n");
