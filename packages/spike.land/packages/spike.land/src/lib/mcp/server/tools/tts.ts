/**
 * Text-to-Speech MCP Tools
 *
 * Convert text to speech using the ElevenLabs API.
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "../tool-registry";
import { safeToolCall, textResult } from "./tool-helpers";

const TtsSynthesizeSchema = z.object({
  text: z.string().min(1).max(5000).describe(
    "Text to convert to speech (max 5000 characters).",
  ),
  voice_id: z.string().optional().describe(
    "ElevenLabs voice ID. Uses default voice if not specified.",
  ),
});

export function registerTtsTools(
  registry: ToolRegistry,
  _userId: string,
): void {
  registry.register({
    name: "tts_synthesize",
    description: "Convert text to speech using ElevenLabs. Returns a URL to the generated audio.",
    category: "tts",
    tier: "free",
    inputSchema: TtsSynthesizeSchema.shape,
    handler: async (
      { text, voice_id }: z.infer<typeof TtsSynthesizeSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("tts_synthesize", async () => {
        const { getCachedTTSUrl, cacheTTSAudio } = await import(
          "@/lib/tts/tts-cache"
        );
        const { synthesizeSpeech } = await import(
          "@/lib/tts/elevenlabs-client"
        );

        // Check cache first
        const cachedUrl = await getCachedTTSUrl(text);
        if (cachedUrl) {
          return textResult(
            `**TTS Result (cached)**\n\n`
              + `**URL:** ${cachedUrl}\n`
              + `**Text length:** ${text.length} characters\n`
              + `**Source:** cache`,
          );
        }

        // Synthesize speech
        const audioBuffer = await synthesizeSpeech(
          text,
          voice_id ? { voiceId: voice_id } : {},
        );

        // Cache the result
        const url = await cacheTTSAudio(text, audioBuffer);

        if (url) {
          return textResult(
            `**TTS Result**\n\n`
              + `**URL:** ${url}\n`
              + `**Text length:** ${text.length} characters\n`
              + `**Audio size:** ${audioBuffer.length} bytes\n`
              + `**Source:** generated`,
          );
        }

        return textResult(
          `**TTS Result**\n\n`
            + `**Text length:** ${text.length} characters\n`
            + `**Audio size:** ${audioBuffer.length} bytes\n`
            + `**Source:** generated\n`
            + `**Note:** Audio generated but R2 caching failed. Audio is available in the current session only.`,
        );
      }),
  });
}
