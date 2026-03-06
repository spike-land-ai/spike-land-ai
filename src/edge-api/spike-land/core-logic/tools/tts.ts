/**
 * Text-to-Speech MCP Tools (CF Workers)
 *
 * Convert text to speech using direct fetch to the ElevenLabs API.
 * Returns audio as base64-encoded text (no R2/cache — stateless worker).
 * Ported from spike.land — no ElevenLabs SDK, no R2 cache.
 */

import { z } from "zod";
import type { ToolRegistry } from "../../lazy-imports/registry";
import { freeTool, textResult } from "../../lazy-imports/procedures-index.ts";
import { McpError, McpErrorCode, safeToolCall } from "../lib/tool-helpers";
import type { DrizzleDB } from "../../db/db/db-index.ts";
import type { Env } from "../env";

const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // Rachel

export function registerTtsTools(
  registry: ToolRegistry,
  userId: string,
  db: DrizzleDB,
  env: Env,
): void {
  registry.registerBuilt(
    freeTool(userId, db)
      .tool(
        "tts_synthesize",
        "Convert text to speech using ElevenLabs. Returns base64-encoded audio.",
        {
          text: z
            .string()
            .min(1)
            .max(5000)
            .describe("Text to convert to speech (max 5000 characters)."),
          voice_id: z
            .string()
            .optional()
            .describe("ElevenLabs voice ID. Uses default voice if not specified."),
        },
      )
      .meta({ category: "tts", tier: "free" })
      .handler(async ({ input }) => {
        const { text, voice_id } = input;
        return safeToolCall("tts_synthesize", async () => {
          const apiKey = env.ELEVENLABS_API_KEY;
          if (!apiKey) {
            throw new McpError(
              "ELEVENLABS_API_KEY not configured.",
              McpErrorCode.AUTH_ERROR,
              false,
            );
          }

          const voiceId = voice_id ?? DEFAULT_VOICE_ID;

          const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "xi-api-key": apiKey,
            },
            body: JSON.stringify({
              text,
              model_id: "eleven_monolingual_v1",
              voice_settings: {
                stability: 0.5,
                similarity_boost: 0.5,
              },
            }),
          });

          if (!response.ok) {
            const errorText = await response.text().catch(() => "Unknown error");
            throw new McpError(
              `ElevenLabs API error (${response.status}): ${errorText}`,
              response.status === 429
                ? McpErrorCode.RATE_LIMITED
                : McpErrorCode.UPSTREAM_SERVICE_ERROR,
              response.status === 429,
            );
          }

          const audioBuffer = await response.arrayBuffer();
          const bytes = new Uint8Array(audioBuffer);
          // Convert to base64 in chunks to avoid stack overflow
          let binary = "";
          for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]!);
          }
          const base64Audio = btoa(binary);

          return textResult(
            `**TTS Result**\n\n` +
              `**Text length:** ${text.length} characters\n` +
              `**Audio size:** ${audioBuffer.byteLength} bytes\n` +
              `**Format:** audio/mpeg (base64)\n` +
              `**Source:** generated\n\n` +
              `**Base64 Audio:**\n${base64Audio}`,
          );
        });
      }),
  );

  registry.registerBuilt(
    freeTool(userId, db)
      .tool(
        "tts_list_voices",
        "List available text-to-speech voices with their IDs. Use a voice_id with tts_synthesize.",
        {},
      )
      .meta({ category: "tts", tier: "free" })
      .handler(async () => {
        const voices = [
          { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", accent: "American", gender: "Female", style: "Calm, narration" },
          { id: "29vD33N1CtxCmqQRPOHJ", name: "Drew", accent: "American", gender: "Male", style: "Well-rounded" },
          { id: "2EiwWnXFnvU5JabPnv8n", name: "Clyde", accent: "American", gender: "Male", style: "War veteran, deep" },
          { id: "AZnzlk1XvdvUeBnXmlld", name: "Domi", accent: "American", gender: "Female", style: "Strong, authoritative" },
          { id: "EXAVITQu4vr4xnSDxMaL", name: "Bella", accent: "American", gender: "Female", style: "Soft, warm" },
          { id: "ErXwobaYiN019PkySvjV", name: "Antoni", accent: "American", gender: "Male", style: "Well-rounded" },
          { id: "MF3mGyEYCl7XYWbV9V6O", name: "Elli", accent: "American", gender: "Female", style: "Emotional, expressive" },
          { id: "TxGEqnHWrfWFTfGW9XjX", name: "Josh", accent: "American", gender: "Male", style: "Deep, narrative" },
          { id: "VR6AewLTigWG4xSOukaG", name: "Arnold", accent: "American", gender: "Male", style: "Crisp, authoritative" },
          { id: "yoZ06aMxZJJ28mfd3POQ", name: "Sam", accent: "American", gender: "Male", style: "Raspy, dynamic" },
        ];

        let text = `**Available TTS Voices (${voices.length})**\n\n`;
        text += `_Default voice: Rachel (${DEFAULT_VOICE_ID})_\n\n`;
        for (const v of voices) {
          text += `- **${v.name}** — ${v.gender}, ${v.accent}\n  ID: \`${v.id}\` | Style: ${v.style}\n\n`;
        }
        text += `Use a voice ID with \`tts_synthesize\` via the \`voice_id\` parameter.`;

        return textResult(text);
      }),
  );
}
