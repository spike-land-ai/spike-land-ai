import type { Command } from "commander";
import { GoogleGenAI } from "@google/genai";
import { DbConnection } from "@spike-land-ai/spacetimedb-platform/dist/module_bindings/index.js";
import express from "express";
import cors from "cors";

// Fallback to CLAUDE_CODE_OAUTH_TOKEN if GEMINI_API_KEY isn't available
export const ai = new GoogleGenAI(
  process.env.GEMINI_API_KEY ? { apiKey: process.env.GEMINI_API_KEY } : {}
);

export let stdbConn: DbConnection | null = null;

export function initSpacetimeDB(baseUrl: string, moduleName: string) {
  DbConnection.builder()
    .withUri(baseUrl)
    .withDatabaseName(moduleName)
    .onConnect((conn, identity) => {
      console.log("[Agent] Connected to SpacetimeDB with identity:", identity.toHexString());
      stdbConn = conn;

      conn.db.code_session.onInsert((ctx, row) => {
        handleSessionUpdate(row);
      });

      conn.db.code_session.onUpdate((ctx, oldRow, newRow) => {
        handleSessionUpdate(newRow);
      });

      conn.subscriptionBuilder().onApplied(() => {
        console.log("[Agent] Subscribed to CodeSession");
      }).subscribe("SELECT * FROM code_session");
    })
    .onDisconnect(() => {
      console.log("[Agent] Disconnected from SpacetimeDB");
      stdbConn = null;
    })
    .onConnectError((_conn, err) => {
      console.error("[Agent] Connection error:", err);
    })
    .build();
}

const processingSessions = new Set<string>();

export async function handleSessionUpdate(session: any) {
  if (processingSessions.has(session.codeSpace)) return;
  
  try {
    let messages: any[] = [];
    if (session.messagesJson) {
      messages = JSON.parse(session.messagesJson);
    }
    
    if (messages.length === 0) return;
    
    const lastMessage = messages[messages.length - 1];
    
    // Only respond if the last message is from the user
    if (lastMessage.role === "user") {
      processingSessions.add(session.codeSpace);
      console.log(`[Agent] Processing request for ${session.codeSpace}: ${lastMessage.content}`);
      
      const systemPrompt = `You are an expert AI programming assistant. 
You are helping the user with their code in the SpacetimeDB-backed Monaco editor.
The user is currently working on the following code:
\`\`\`typescript
${session.code}
\`\`\`
Provide helpful, concise code modifications.`;

      const formattedContents = messages.map(m => {
        const text = typeof m.content === "string" ? m.content : JSON.stringify(m.content);
        return {
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text }]
        };
      });

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: formattedContents,
        config: {
          systemInstruction: systemPrompt,
          maxOutputTokens: 4000,
        }
      });

      const replyContent = response.text || "I couldn't process that.";
      
      const newMessages = [...messages, {
        id: Math.random().toString(36).substring(7),
        role: "assistant",
        content: replyContent
      }];
      
      if (stdbConn) {
        stdbConn.reducers.update_code_session(
          session.codeSpace,
          session.code,
          session.html,
          session.css,
          session.transpiled,
          JSON.stringify(newMessages)
        );
      }
      
      console.log(`[Agent] Replied to ${session.codeSpace}`);
    }
  } catch (error) {
    console.error(`[Agent] Error processing session ${session.codeSpace}:`, error);
  } finally {
    processingSessions.delete(session.codeSpace);
  }
}

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
            parts: [{ text: `<prefix>\n${prefix}\n</prefix>\n<suffix>\n${suffix || ""}\n</suffix>\n\nComplete the code exactly where prefix ends and suffix begins. Output only the missing code.` }]
          }
        ],
        config: {
          systemInstruction: "You are an AI code completion engine. You receive the prefix and suffix of a TypeScript/TSX code file. Your task is to output ONLY the code that should be inserted exactly at the cursor position. DO NOT add markdown blocks or explanations.",
          maxOutputTokens: 150,
        }
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
    .description("Run the Spike CLI AI Agent that connects to SpacetimeDB and replies to chats")
    .option("--stdb-url <url>", "SpacetimeDB URL", "ws://localhost:3000")
    .option("--stdb-module <module>", "SpacetimeDB Module Name", "rightful-dirt-5033")
    .option("--port <port>", "Port for local HTTP completion API", "3005")
    .action((options) => {
      if (!process.env.GEMINI_API_KEY && !process.env.CLAUDE_CODE_OAUTH_TOKEN) {
        console.error("Error: GEMINI_API_KEY is not set.");
        process.exit(1);
      }
      
      console.log("Starting Spike Agent with Gemini...");
      initSpacetimeDB(options.stdbUrl, options.stdbModule);
      startCompletionServer(parseInt(options.port, 10));
      
      // Keep process alive
      setInterval(() => {}, 1000 * 60 * 60);
    });
}
