import { PERSONAS } from "../src/mcp-tools/bazdmeg/core-logic/personas.js";
import { spawnClaude } from "./bazdmeg/agent.js";
import * as fs from "node:fs";
import * as https from "node:https";

async function fetchTools(): Promise<string> {
  return new Promise((resolve, reject) => {
    // Retesting against local environment
    https
      .get("https://local.spike.land:5173/mcp/tools", { rejectUnauthorized: false }, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`Failed to fetch tools: ${res.statusCode}`));
          return;
        }
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(data));
      })
      .on("error", reject);
  });
}

async function main() {
  console.log("🚀 Starting TARGETED Multi-Agent MCP User Retest for local.spike.land...");

  let toolsList = "";
  try {
    console.log("  [API] Fetching tools from https://local.spike.land:5173/mcp/tools...");
    const rawData = await fetchTools();
    const data = JSON.parse(rawData);

    // Format tools for the prompt
    toolsList = data.tools
      .map(
        (t: any) => `
- **${t.name}** [Category: ${t.category || "uncategorized"}]
  Description: ${t.description}
  Input Schema: ${JSON.stringify(t.inputSchema || {})}
`,
      )
      .join("\n");
    console.log(`  [API] Successfully fetched ${data.tools.length} tools.`);
  } catch (err) {
    console.error("❌ Failed to fetch tools from local. Verify local server is running.");
    process.exit(1);
  }

  const results: string[] = [];
  const findings: any[] = [];

  const personaList = Object.values(PERSONAS);

  for (const persona of personaList) {
    console.log(`  [Agent] TARGETED retest for persona: ${persona.name} (${persona.archetype})...`);

    const prompt = {
      id: `mcp-retest-${persona.id}`,
      role: "mcp-user-tester-targeted",
      render: (ctx: any) => `
You are a real user conducting a TARGETED retest of spike.land's MCP capabilities on a LOCAL environment.
YOUR PERSONA:
- Name: ${persona.name}
- Archetype: ${persona.archetype}
- Experience Level: ${persona.level}
- Primary Focus: ${persona.focus}

CONTEXT:
We previously identified several issues in production. Your task is to verify if these issues persist in the local environment by attempting to "reason through" a call or simulating the execution logic.

--- START TOOLS LIST ---
${ctx.toolsList}
--- END TOOLS LIST ---

TASK:
1. Identify the 3 most critical "distinct issues" from the previous report (e.g., schema lies, missing tools, misleading descriptions) that relate to your persona.
2. For each issue, perform a "targeted test": explain what you would call, with what parameters, and what you expect to see vs. what the schema actually says.
3. Determine if the issue is "CONFIRMED" (still present in local schema), "FIXED" (schema/docs updated), or "BEHAVIORAL" (requires a live call to verify, which you should simulate based on the tool's description).

Output your response in this exact format:

# Persona: ${persona.name} (Targeted Retest)
## Targeted Findings

### Issue 1: <Name of Issue>
- **Targeted Test**: <how you would test it>
- **Result**: <CONFIRMED | FIXED | BEHAVIORAL>
- **Detail**: <technical details from the local schema>

### Issue 2: <Name of Issue>
...

### Issue 3: <Name of Issue>
...

## Summary of Local delta
<Any changes noticed between prod and local schema>
`,
    };

    try {
      const output = spawnClaude(prompt as any, { toolsList } as any);
      results.push(output);

      const findingsMatch = output.match(/## Targeted Findings\n([\s\S]+)/);
      if (findingsMatch) {
        findings.push({
          persona: persona.name,
          report: findingsMatch[1].trim()
        });
      }
    } catch (err) {
      console.error(`❌ Failed to run targeted test for ${persona.name}:`, err);
    }
  }

  console.log("📊 Updating MCP_USER_TEST_FINDINGS.md with Targeted Retest results...");

  let summary = `# spike.land MCP TARGETED User Test Findings (Local vs Prod)\n\n`;
  summary += `Tested with 16 diverse AI agent personas against https://local.spike.land:5173/ on ${new Date().toLocaleDateString()}.\n\n`;

  summary += `## Overview\n`;
  summary += `This report focuses on verifying previously reported issues against the local development environment.\n\n`;

  summary += `## Retest Result Summary\n`;
  results.forEach(r => {
    const lines = r.split('\n');
    const personaLine = lines.find(l => l.startsWith('# Persona:'));
    if (personaLine) {
        summary += `### ${personaLine.replace('# ', '')}\n`;
        const sections = r.split('### Issue');
        sections.slice(1).forEach(s => {
            const title = s.split('\n')[0].trim();
            const result = s.match(/- \*\*Result\*\*: (.*)/)?.[1] || "UNKNOWN";
            summary += `- **Issue ${title}**: ${result}\n`;
        });
        summary += '\n';
    }
  });

  summary += `\n## Detailed Targeted Reports\n\n`;
  summary += results.join("\n\n---\n\n");

  fs.writeFileSync("MCP_USER_TEST_FINDINGS.md", summary);
  console.log("✅ Done! Findings updated in MCP_USER_TEST_FINDINGS.md");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
