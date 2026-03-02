/**
 * Text-to-Speech MCP Tools (CF Workers)
 *
 * Convert text to speech using direct fetch to the ElevenLabs API.
 * Returns audio as base64-encoded text (no R2/cache — stateless worker).
 * Ported from spike.land — no ElevenLabs SDK, no R2 cache.
 */

import { z } from "zod";
import type { ToolRegistry } from "../mcp/registry";
import { freeTool, textResult } from "../procedures/index";
import { safeToolCall, McpError, McpErrorCode } from "./tool-helpers";
import type { DrizzleDB } from "../db/index";
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
}
