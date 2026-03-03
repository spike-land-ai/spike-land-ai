import type { Command } from "commander";
import { GoogleGenAI } from "@google/genai";
import express from "express";
import cors from "cors";

// Fallback to CLAUDE_CODE_OAUTH_TOKEN if GEMINI_API_KEY isn't available
export const ai = new GoogleGenAI(
  process.env.GEMINI_API_KEY ? { apiKey: process.env.GEMINI_API_KEY } : {},
);

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

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
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
        config: {
          systemInstruction:
            "You are an AI code completion engine. You receive the prefix and suffix of a TypeScript/TSX code file. Your task is to output ONLY the code that should be inserted exactly at the cursor position. DO NOT add markdown blocks or explanations.",
          maxOutputTokens: 150,
        },
      });

      const completionText = (response.text || "").trim();
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

export function registerAgentCommand(program: Command): void {
  program
    .command("agent")
    .description("Run the Spike CLI AI Agent that provides code completion")
    .option("--port <port>", "Port for local HTTP completion API", "3005")
    .action((options) => {
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
