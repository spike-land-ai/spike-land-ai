import type { Command } from "commander";
import express from "express";
import cors from "cors";

export function startCompletionServer(port: number) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.post("/completion", async (req, res) => {
    try {
      const { prefix, suffix } = req.body;

      if (!prefix) {
        res.status(400).json({ error: "Missing prefix" });
        return;
      }

      const apiKey = process.env.GEMINI_API_KEY || process.env.CLAUDE_CODE_OAUTH_TOKEN;
      if (!apiKey) {
        res.status(500).json({ error: "GEMINI_API_KEY is not configured" });
        return;
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: `<prefix>\n${prefix}\n</prefix>\n<suffix>\n${
                      suffix || ""
                    }\n</suffix>\n\nComplete the code exactly where prefix ends and suffix begins. Output only the missing code.`,
                  },
                ],
              },
            ],
            systemInstruction: {
              parts: [
                {
                  text: "You are an AI code completion engine. You receive the prefix and suffix of a TypeScript/TSX code file. Your task is to output ONLY the code that should be inserted exactly at the cursor position. DO NOT add markdown blocks or explanations.",
                },
              ],
            },
            generationConfig: {
              maxOutputTokens: 150,
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Google API returned ${response.status}: ${await response.text()}`);
      }

      const data = await response.json() as unknown as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
      const completionText = (data.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
      
      res.json({ completion: completionText });
    } catch (error) {
      console.error("[Agent] Completion error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return app.listen(port, () => {
    console.log(`[Agent] Completion API server listening on port ${port}`);
  });
}

interface AgentCommandOptions {
  port: string;
}

export function registerAgentCommand(program: Command): void {
  program
    .command("agent")
    .description("Run the Spike CLI AI Agent that provides code completion")
    .option("--port <port>", "Port for local HTTP completion API", "3005")
    .action((options: AgentCommandOptions) => {
      if (!process.env.GEMINI_API_KEY && !process.env.CLAUDE_CODE_OAUTH_TOKEN) {
        console.error("Error: GEMINI_API_KEY is not set.");
        process.exit(1);
      }

      console.log("Starting Spike Agent with Gemini...");
      startCompletionServer(parseInt(options.port, 10));

      // Keep process alive
      setInterval(() => {}, 1000 * 60 * 60);
    });
}
