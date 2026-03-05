import { PERSONAS } from "../src/code/@/lib/onboarding/personas.ts";
import { spawnClaude } from "./bazdmeg/agent.ts";
import { getOrCreateTab, getPageSnapshot, cleanup } from "../src/qa-studio/browser-session.ts";
import { narrate } from "../src/qa-studio/narrate.ts";
import * as fs from "node:fs";

async function main() {
  console.log("🚀 Starting Multi-Agent User Test for spike.land...");
  
  // 1. Get initial page narration
  let homepageNarration = "";
  try {
    const { page } = await getOrCreateTab(0);
    console.log("  [Browser] Navigating to https://spike.land...");
    await page.goto("https://spike.land", { waitUntil: "networkidle" });
    const snapshot = await getPageSnapshot();
    if (snapshot?.tree) {
      const result = narrate(snapshot.tree, snapshot.title, snapshot.url);
      homepageNarration = result.text;
    } else {
      throw new Error("Failed to get page snapshot.");
    }
  } catch (err) {
    console.error("❌ Browser initialization failed:", err);
    process.exit(1);
  } finally {
    await cleanup();
  }

  const results: string[] = [];
  const findings: any[] = [];

  // 2. Run test for each of the 16 personas
  for (const persona of PERSONAS) {
    console.log(`  [Agent] Running test for persona: ${persona.name} (${persona.slug})...`);
    
    const prompt = {
      id: `user-test-${persona.slug}`,
      role: "user-tester",
      render: (ctx: any) => `
You are a real user visiting spike.land for the first time.
YOUR PERSONA:
- Name: ${persona.name}
- Description: ${persona.description}
- Goal: ${persona.heroText}
- Recommended Apps: ${persona.recommendedAppSlugs.join(", ")}

CONTEXT:
You just landed on the homepage of https://spike.land.
The following is the narration of the page as seen by a screen reader (using accessibility tree):

--- START NARRATION ---
${ctx.narration}
--- END NARRATION ---

TASK:
1. Analyze your reaction to this page based on your persona. Does it speak to you?
2. How proactively would you explore this site? What would you click next?
3. List any issues, concerns, or confusion you have in a flat bulleted list.

Output your response in this format:

# Persona: ${persona.name}
## Reaction
<your qualitative reaction>

## Proactivity
<how you would explore and what you would click next>

## Issues & Concerns
- <issue 1>
- <issue 2>
...
`
    };

    const output = spawnClaude(prompt as any, { narration: homepageNarration } as any);
    results.push(output);
    
    // Simple parsing for summary
    const issuesMatch = output.match(/## Issues & Concerns\n([\s\S]+)/);
    if (issuesMatch) {
      findings.push({
        persona: persona.name,
        issues: issuesMatch[1].trim().split("\n").map(line => line.replace(/^- /, "").trim())
      });
    }
  }

  // 3. Generate summary markdown
  console.log("📊 Generating USER_TEST_FINDINGS.md...");
  
  let summary = `# spike.land User Test Findings Summary\n\n`;
  summary += `Tested with 16 diverse AI agent personas on ${new Date().toLocaleDateString()}.\n\n`;
  
  summary += `## Overview\n`;
  summary += `The agents explored the homepage of spike.land and provided feedback based on their specific professional and personal backgrounds.\n\n`;
  
  summary += `## Aggregate Issues & Concerns\n`;
  const allIssues = new Set<string>();
  findings.forEach(f => f.issues.forEach((i: string) => allIssues.add(i)));
  
  allIssues.forEach(issue => {
    summary += `- ${issue}\n`;
  });
  
  summary += `\n## Individual Persona Reports\n\n`;
  summary += results.join("\n\n---\n\n");

  fs.writeFileSync("USER_TEST_FINDINGS.md", summary);
  console.log("✅ Done! Findings saved to USER_TEST_FINDINGS.md");
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
