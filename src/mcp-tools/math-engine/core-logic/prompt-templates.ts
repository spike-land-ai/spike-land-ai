/**
 * Math Engine — Prompt Templates
 *
 * LLM prompts per agent role for the multi-agent math reasoning system.
 */

import type { AgentRole, Finding, Problem, SessionState } from "./types.js";

function formatFindings(findings: Finding[]): string {
  if (findings.length === 0) return "No findings yet.";
  return findings
    .map(
      (f) =>
        `[${f.agentRole}|iter${f.iteration}|${f.category}|conf:${f.confidence.toFixed(2)}] ${f.content}`,
    )
    .join("\n");
}

function formatCrossPollination(session: SessionState, forRole: AgentRole): string {
  const otherFindings = session.findings.filter((f) => f.agentRole !== forRole);
  if (otherFindings.length === 0) return "";
  return `\n## Cross-pollination (other agents' findings)\n${formatFindings(otherFindings)}`;
}

export function getSystemPrompt(role: AgentRole): string {
  switch (role) {
    case "analyst":
      return `You are a mathematical Analyst agent. Your job is to:
1. Formalize the mathematical structure of problems
2. Define the relevant spaces, maps, and properties precisely
3. Check well-definedness of all constructions
4. Identify what needs to be proved vs what can be assumed
5. Flag any category errors, type mismatches, or ill-defined operations

Be rigorous. Use standard mathematical notation. When you identify structure,
state the precise theorem or definition being invoked. Output findings as
structured observations with confidence levels.`;

    case "constructor":
      return `You are a mathematical Constructor agent. Your job is to:
1. Build proof attempts for the given problem
2. Try multiple strategies: contraction mappings, spectral bounds, Lyapunov functions,
   combinatorial arguments, algebraic methods
3. For each attempt, write explicit step-by-step proofs
4. Identify which steps are rigorous and which have gaps
5. Propose concrete constructions (functions, maps, bounds)

Be creative but honest about gaps. Mark each proof step as [RIGOROUS], [PLAUSIBLE],
or [GAP]. Output structured proof attempts with explicit methods and steps.`;

    case "adversary":
      return `You are a mathematical Adversary agent. Your job is to:
1. Attack every proof attempt and finding from other agents
2. Construct explicit counterexamples when possible
3. Apply Rice's theorem to computability claims
4. Check for Curry-style self-reference and circular reasoning
5. Test boundary cases, degenerate inputs, and limiting regimes
6. Identify hidden assumptions and unjustified steps

Be ruthless but fair. A valid proof should survive your attacks.
When you find a flaw, provide a specific counterexample or cite the
precise theorem that invalidates the claim. Output structured refutations
with confidence levels.`;
  }
}

export function getUserPrompt(role: AgentRole, problem: Problem, session: SessionState): string {
  const crossPollination = formatCrossPollination(session, role);
  const ownFindings = session.findings.filter((f) => f.agentRole === role);

  return `## Problem: ${problem.title}

${problem.description}

## Current State
- Iteration: ${session.iteration} / ${session.maxIterations}
- Status: ${session.status}

## Your Previous Findings
${formatFindings(ownFindings)}
${crossPollination}

## Instructions
Analyze the problem from your role's perspective. Produce findings as JSON array:
\`\`\`json
[
  {
    "category": "structure|proof_step|counterexample|gap|insight",
    "content": "Your detailed finding",
    "confidence": 0.0-1.0
  }
]
\`\`\`

${
  role === "constructor"
    ? `Also produce proof attempts as JSON array:
\`\`\`json
[
  {
    "method": "Method name",
    "steps": ["Step 1...", "Step 2..."],
    "status": "pending|verified|incomplete"
  }
]
\`\`\``
    : ""
}

Respond with your analysis followed by the JSON blocks.`;
}

export function getVerificationPrompt(proofSteps: string[]): string {
  return `Verify the following proof attempt step by step.
For each step, determine if it is:
- VALID: logically sound, follows from premises
- INVALID: contains an error (specify the error)
- INCOMPLETE: missing justification (specify what's needed)

Proof steps:
${proofSteps.map((s, i) => `${i + 1}. ${s}`).join("\n")}

Respond with a JSON array:
\`\`\`json
[
  {"step": 1, "status": "valid|invalid|incomplete", "reason": "explanation"}
]
\`\`\``;
}

export function getBlogGenerationPrompt(session: SessionState, problem: Problem): string {
  return `Generate a blog post in MDX format about the mathematical exploration session.

## Problem
Title: ${problem.title}
Description: ${problem.description}

## Session Results
- Iterations: ${session.iteration}
- Final Status: ${session.status}
- Total Findings: ${session.findings.length}
- Proof Attempts: ${session.proofAttempts.length}

## Key Findings
${formatFindings(session.findings.filter((f) => f.confidence >= 0.7))}

## Instructions
Write an engaging blog post that:
1. Introduces the mathematical problem accessibly
2. Describes the multi-agent exploration approach
3. Presents the key findings and any proof attempts
4. Discusses what was learned and open questions
5. Uses LaTeX math notation where appropriate ($$...$$)

Format as MDX with frontmatter:
\`\`\`mdx
---
title: "..."
date: "${new Date().toISOString().split("T")[0]}"
description: "..."
tags: ["mathematics", "ai-exploration"]
---

... content ...
\`\`\``;
}
