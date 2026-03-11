import type { Command } from "commander";
import express from "express";
import cors from "cors";

// Completion server is localhost-only; restrict CORS to same origin to prevent
// cross-origin requests from other browser tabs (CWE-942 / OWASP A05:2021).
const LOCALHOST_CORS_OPTIONS: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no Origin header (curl, MCP clients) or explicit localhost origins
    if (!origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      callback(null, true);
    } else {
      callback(new Error("CORS: origin not allowed"));
    }
  },
  methods: ["POST"],
  allowedHeaders: ["Content-Type"],
};

// 64 KiB body cap — code snippets don't need more; prevents memory exhaustion (CWE-770)
const MAX_BODY_SIZE = "64kb";

export function startCompletionServer(port: number) {
  const app = express();
  app.use(cors(LOCALHOST_CORS_OPTIONS));
  app.use(express.json({ limit: MAX_BODY_SIZE }));

  app.post("/completion", async (req, res) => {
    try {
      const { prefix, suffix } = req.body;

      if (!prefix) {
        res.status(400).json({ error: "Missing prefix" });
        return;
      }

      // Only use GEMINI_API_KEY for the Google API call — do not fall back to
      // CLAUDE_CODE_OAUTH_TOKEN which is a different credential for a different service.
      const apiKey = process.env["GEMINI_API_KEY"];
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
        },
      );

      if (!response.ok) {
        throw new Error(`Google API returned ${response.status}: ${await response.text()}`);
      }

      const data = (await response.json()) as unknown as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const completionText = (data.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();

      res.json({ completion: completionText });
    } catch (error) {
      console.error("[Agent] Completion error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Bind explicitly to loopback only — no network exposure (defense in depth)
  return app.listen(port, "127.0.0.1", () => {
    console.log(`[Agent] Completion API server listening on 127.0.0.1:${port}`);
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
      if (!process.env["GEMINI_API_KEY"]) {
        console.error("Error: GEMINI_API_KEY is not set.");
        process.exit(1);
      }

      console.log("Starting Spike Agent with Gemini...");
      startCompletionServer(parseInt(options.port, 10));

      // Keep process alive
      setInterval(() => {}, 1000 * 60 * 60);
    });
}
