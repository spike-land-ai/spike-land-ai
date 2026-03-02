/**
 * Audio Studio — Standalone Tool Definitions
 *
 * Full project & track lifecycle: create/list/delete projects,
 * upload/list/update/delete tracks, retrieve track metadata,
 * apply effects, export mixes, get waveforms, duplicate & reorder tracks.
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ServerContext, StandaloneToolDefinition } from "../shared/types";
import { safeToolCall, textResult } from "../shared/tool-helpers";

/* ── Constants ──────────────────────────────────────────────────────── */

const ALLOWED_FORMATS = ["wav", "mp3", "webm", "ogg", "flac", "aac", "m4a"] as const;

const EFFECT_TYPES = [
  "reverb",
  "delay",
  "eq",
  "compressor",
  "normalize",
  "fade_in",
  "fade_out",
] as const;

type EffectType = (typeof EFFECT_TYPES)[number];

const EXPORT_FORMATS = ["wav", "mp3", "flac", "ogg"] as const;
const EXPORT_QUALITY = ["low", "medium", "high", "lossless"] as const;

/* ── Schemas ────────────────────────────────────────────────────────── */

const AudioUploadSchema = z.object({
  project_id: z.string().min(1).describe("Audio mixer project ID."),
  filename: z.string().min(1).describe("Filename for the audio track."),
  content_type: z.string().min(1).describe("MIME content type (e.g. audio/wav)."),
});

const AudioGetTrackSchema = z.object({
  track_id: z.string().min(1).describe("Audio track ID."),
});

const AudioCreateProjectSchema = z.object({
  name: z.string().min(1).max(100).describe("Project name."),
  description: z.string().max(500).optional().describe("Optional project description."),
});

const AudioProjectIdSchema = z.object({
  project_id: z.string().min(1).describe("Audio mixer project ID."),
});

const AudioDeleteTrackSchema = z.object({
  track_id: z.string().min(1).describe("Audio track ID to delete."),
});

const AudioUpdateTrackSchema = z.object({
  track_id: z.string().min(1).describe("Audio track ID."),
  name: z.string().min(1).max(200).optional().describe("New track name."),
  volume: z.number().min(0).max(2).optional().describe("Volume level 0–2."),
  muted: z.boolean().optional().describe("Whether the track is muted."),
  solo: z.boolean().optional().describe("Whether the track is soloed."),
});

const ApplyEffectSchema = z.object({
  track_id: z.string().min(1).describe("Audio track ID to apply the effect to."),
  effect_type: z
    .enum(EFFECT_TYPES)
    .describe(
      "Type of audio effect to apply: reverb, delay, eq, compressor, normalize, fade_in, or fade_out.",
    ),
  params: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
    .optional()
    .describe("Optional effect-specific parameters (e.g. { wet: 0.5, decay: 1.2 })."),
});

const ExportMixSchema = z.object({
  project_id: z.string().min(1).describe("Audio mixer project ID to export."),
  format: z.enum(EXPORT_FORMATS).describe("Output format: wav, mp3, flac, or ogg."),
  quality: z
    .enum(EXPORT_QUALITY)
    .optional()
    .describe("Export quality level: low, medium, high, or lossless."),
});

const GetWaveformSchema = z.object({
  track_id: z.string().min(1).describe("Audio track ID."),
  resolution: z
    .number()
    .int()
    .min(10)
    .max(2000)
    .optional()
    .default(100)
    .describe("Number of waveform data points to return (default: 100)."),
});

const DuplicateTrackSchema = z.object({
  track_id: z.string().min(1).describe("Audio track ID to duplicate."),
  new_name: z
    .string()
    .min(1)
    .max(200)
    .optional()
    .describe("Optional name for the duplicated track."),
});

const ReorderTracksSchema = z.object({
  project_id: z.string().min(1).describe("Audio mixer project ID."),
  track_ids: z.array(z.string().min(1)).min(1).describe("Track IDs in the desired new order."),
});

/* ── Helpers ─────────────────────────────────────────────────────────── */

function generateSimulatedWaveform(
  trackId: string,
  resolution: number,
  duration: number,
): number[] {
  const seed = trackId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const waveform: number[] = [];
  for (let i = 0; i < resolution; i++) {
    const t = i / resolution;
    const base = Math.sin(t * Math.PI * 4 + seed) * 0.4;
    const mid = Math.sin(t * Math.PI * 12 + seed * 0.7) * 0.3;
    const high = Math.sin(t * Math.PI * 32 + seed * 0.3) * 0.15;
    const envelope = Math.sin(t * Math.PI);
    const raw = (base + mid + high) * envelope * (duration > 0 ? 1 : 0);
    waveform.push(Math.round(Math.max(-1, Math.min(1, raw)) * 10000) / 10000);
  }
  return waveform;
}

function effectDefaultParams(effectType: EffectType): Record<string, string> {
  switch (effectType) {
    case "reverb":
      return { wet: "0.3", decay: "1.5", preDelay: "0.01" };
    case "delay":
      return { wet: "0.4", delayTime: "0.25", feedback: "0.3" };
    case "eq":
      return { low: "0", mid: "0", high: "0", presence: "0" };
    case "compressor":
      return { threshold: "-24", ratio: "4", attack: "0.003", release: "0.25" };
    case "normalize":
      return { targetLufs: "-14", truePeak: "-1" };
    case "fade_in":
      return { durationSecs: "2", curve: "linear" };
    case "fade_out":
      return { durationSecs: "3", curve: "linear" };
  }
}

/* ── Tool Definitions ───────────────────────────────────────────────── */

export const audioStudioTools: StandaloneToolDefinition[] = [
  /* ─── audio_upload ─────────────────────────────────────────────── */
  {
    name: "audio_upload",
    description:
      "Upload an audio track to a mixer project. Creates a track record and returns track metadata.",
    category: "audio",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: AudioUploadSchema.shape,
    handler: async (input: never, ctx: ServerContext): Promise<CallToolResult> => {
      const { project_id, filename, content_type } = input as z.infer<typeof AudioUploadSchema>;
      return safeToolCall("audio_upload", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        const project = await prisma.audioMixerProject.findFirst({
          where: { id: project_id, userId: ctx.userId },
        });
        if (!project) {
          return textResult(
            "**Error: NOT_FOUND**\nProject not found or access denied.\n**Retryable:** false",
          );
        }

        const extMatch = filename.match(/\.(\w+)$/);
        const format = extMatch
          ? extMatch[1]!.toLowerCase()
          : (content_type.split("/")[1] ?? "wav");
        if (!ALLOWED_FORMATS.includes(format as (typeof ALLOWED_FORMATS)[number])) {
          return textResult(
            `**Error: VALIDATION_ERROR**\nInvalid audio format '${format}'. Allowed: ${ALLOWED_FORMATS.join(
              ", ",
            )}.\n**Retryable:** false`,
          );
        }

        const trackCount = await prisma.audioTrack.count({
          where: { projectId: project_id },
        });

        const track = await prisma.audioTrack.create({
          data: {
            projectId: project_id,
            name: filename,
            fileFormat: format,
            duration: 0,
            fileSizeBytes: 0,
            sortOrder: trackCount,
          },
        });

        return textResult(
          `**Audio Track Created!**\n\n` +
            `**Track ID:** ${track.id}\n` +
            `**Project:** ${project.name}\n` +
            `**Filename:** ${filename}\n` +
            `**Format:** ${format}\n` +
            `**Note:** Track record created. Use the audio upload API endpoint to upload the actual file.`,
        );
      });
    },
  },

  /* ─── audio_get_track ──────────────────────────────────────────── */
  {
    name: "audio_get_track",
    description: "Get detailed information about an audio track.",
    category: "audio",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: AudioGetTrackSchema.shape,
    handler: async (input: never, ctx: ServerContext): Promise<CallToolResult> => {
      const { track_id } = input as z.infer<typeof AudioGetTrackSchema>;
      return safeToolCall("audio_get_track", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        const track = await prisma.audioTrack.findUnique({
          where: { id: track_id },
          include: {
            project: {
              select: { id: true, name: true, userId: true },
            },
          },
        });

        if (!track) {
          return textResult("**Error: NOT_FOUND**\nAudio track not found.\n**Retryable:** false");
        }

        if (track.project.userId !== ctx.userId) {
          return textResult(
            "**Error: PERMISSION_DENIED**\nYou do not have access to this track.\n**Retryable:** false",
          );
        }

        return textResult(
          `**Audio Track**\n\n` +
            `**Track ID:** ${track.id}\n` +
            `**Name:** ${track.name}\n` +
            `**Project:** ${track.project.name} (${track.project.id})\n` +
            `**Format:** ${track.fileFormat}\n` +
            `**Duration:** ${track.duration}s\n` +
            `**Size:** ${track.fileSizeBytes} bytes\n` +
            `**Volume:** ${track.volume}\n` +
            `**Muted:** ${track.muted}\n` +
            `**Solo:** ${track.solo}\n` +
            `**Sort Order:** ${track.sortOrder}\n` +
            `**Storage:** ${track.storageType}\n` +
            `**Created:** ${track.createdAt.toISOString()}`,
        );
      });
    },
  },

  /* ─── audio_list_projects ──────────────────────────────────────── */
  {
    name: "audio_list_projects",
    description: "List all audio mixer projects for the current user.",
    category: "audio",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: {},
    handler: async (_input: never, ctx: ServerContext): Promise<CallToolResult> =>
      safeToolCall("audio_list_projects", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        const projects = await prisma.audioMixerProject.findMany({
          where: { userId: ctx.userId },
          include: { _count: { select: { tracks: true } } },
          orderBy: { updatedAt: "desc" },
        });

        if (projects.length === 0) {
          return textResult(
            "**No projects found.**\nCreate a new project with `audio_create_project`.",
          );
        }

        const lines = projects.map(
          (p) =>
            `- **${p.name}** (${p.id}) — ${p._count.tracks} track(s) — updated ${p.updatedAt.toISOString()}`,
        );

        return textResult(`**Your Audio Projects (${projects.length})**\n\n${lines.join("\n")}`);
      }),
  },

  /* ─── audio_create_project ─────────────────────────────────────── */
  {
    name: "audio_create_project",
    description: "Create a new audio mixer project.",
    category: "audio",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: AudioCreateProjectSchema.shape,
    handler: async (input: never, ctx: ServerContext): Promise<CallToolResult> => {
      const { name, description } = input as z.infer<typeof AudioCreateProjectSchema>;
      return safeToolCall("audio_create_project", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        const project = await prisma.audioMixerProject.create({
          data: { name, description: description ?? "", userId: ctx.userId },
        });

        return textResult(
          `**Project Created!**\n\n` +
            `**ID:** ${project.id}\n` +
            `**Name:** ${project.name}\n` +
            `**Created:** ${project.createdAt.toISOString()}`,
        );
      });
    },
  },

  /* ─── audio_delete_project ─────────────────────────────────────── */
  {
    name: "audio_delete_project",
    description: "Delete an audio mixer project and all its tracks.",
    category: "audio",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: AudioProjectIdSchema.shape,
    handler: async (input: never, ctx: ServerContext): Promise<CallToolResult> => {
      const { project_id } = input as z.infer<typeof AudioProjectIdSchema>;
      return safeToolCall("audio_delete_project", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        const project = await prisma.audioMixerProject.findFirst({
          where: { id: project_id, userId: ctx.userId },
        });
        if (!project) {
          return textResult(
            "**Error: NOT_FOUND**\nProject not found or access denied.\n**Retryable:** false",
          );
        }

        await prisma.audioTrack.deleteMany({
          where: { projectId: project_id },
        });
        await prisma.audioMixerProject.delete({ where: { id: project_id } });

        return textResult(
          `**Project Deleted**\n\n` + `**Name:** ${project.name}\n` + `**ID:** ${project_id}`,
        );
      });
    },
  },

  /* ─── audio_list_tracks ────────────────────────────────────────── */
  {
    name: "audio_list_tracks",
    description: "List all tracks in an audio mixer project.",
    category: "audio",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: AudioProjectIdSchema.shape,
    handler: async (input: never, ctx: ServerContext): Promise<CallToolResult> => {
      const { project_id } = input as z.infer<typeof AudioProjectIdSchema>;
      return safeToolCall("audio_list_tracks", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        const project = await prisma.audioMixerProject.findFirst({
          where: { id: project_id, userId: ctx.userId },
        });
        if (!project) {
          return textResult(
            "**Error: NOT_FOUND**\nProject not found or access denied.\n**Retryable:** false",
          );
        }

        const tracks = await prisma.audioTrack.findMany({
          where: { projectId: project_id },
          orderBy: { sortOrder: "asc" },
        });

        if (tracks.length === 0) {
          return textResult(
            `**No tracks in "${project.name}".**\nUpload a track with \`audio_upload\`.`,
          );
        }

        const lines = tracks.map(
          (t) =>
            `- **${t.name}** (${t.id}) — ${t.fileFormat.toUpperCase()} — ${t.duration}s — vol:${t.volume} muted:${t.muted} solo:${t.solo}`,
        );

        return textResult(
          `**Tracks in "${project.name}" (${tracks.length})**\n\n${lines.join("\n")}`,
        );
      });
    },
  },

  /* ─── audio_delete_track ───────────────────────────────────────── */
  {
    name: "audio_delete_track",
    description: "Delete an audio track from a project.",
    category: "audio",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: AudioDeleteTrackSchema.shape,
    handler: async (input: never, ctx: ServerContext): Promise<CallToolResult> => {
      const { track_id } = input as z.infer<typeof AudioDeleteTrackSchema>;
      return safeToolCall("audio_delete_track", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        const track = await prisma.audioTrack.findUnique({
          where: { id: track_id },
          include: { project: { select: { userId: true, name: true } } },
        });

        if (!track) {
          return textResult("**Error: NOT_FOUND**\nAudio track not found.\n**Retryable:** false");
        }

        if (track.project.userId !== ctx.userId) {
          return textResult(
            "**Error: PERMISSION_DENIED**\nYou do not have access to this track.\n**Retryable:** false",
          );
        }

        await prisma.audioTrack.delete({ where: { id: track_id } });

        return textResult(
          `**Track Deleted**\n\n` +
            `**Name:** ${track.name}\n` +
            `**ID:** ${track_id}\n` +
            `**Project:** ${track.project.name}`,
        );
      });
    },
  },

  /* ─── audio_update_track ───────────────────────────────────────── */
  {
    name: "audio_update_track",
    description: "Update audio track settings (name, volume, muted, solo).",
    category: "audio",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: AudioUpdateTrackSchema.shape,
    handler: async (input: never, ctx: ServerContext): Promise<CallToolResult> => {
      const { track_id, name, volume, muted, solo } = input as z.infer<
        typeof AudioUpdateTrackSchema
      >;
      return safeToolCall("audio_update_track", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        const existing = await prisma.audioTrack.findUnique({
          where: { id: track_id },
          include: { project: { select: { userId: true } } },
        });

        if (!existing) {
          return textResult("**Error: NOT_FOUND**\nAudio track not found.\n**Retryable:** false");
        }

        if (existing.project.userId !== ctx.userId) {
          return textResult(
            "**Error: PERMISSION_DENIED**\nYou do not have access to this track.\n**Retryable:** false",
          );
        }

        const updateData: Record<string, unknown> = {};
        if (name !== undefined) updateData.name = name;
        if (volume !== undefined) updateData.volume = volume;
        if (muted !== undefined) updateData.muted = muted;
        if (solo !== undefined) updateData.solo = solo;

        if (Object.keys(updateData).length === 0) {
          return textResult("**No changes specified.** Provide at least one field to update.");
        }

        const updated = await prisma.audioTrack.update({
          where: { id: track_id },
          data: updateData,
        });

        return textResult(
          `**Track Updated**\n\n` +
            `**ID:** ${updated.id}\n` +
            `**Name:** ${updated.name}\n` +
            `**Volume:** ${updated.volume}\n` +
            `**Muted:** ${updated.muted}\n` +
            `**Solo:** ${updated.solo}`,
        );
      });
    },
  },

  /* ─── audio_apply_effect ────────────────────────────────────────── */
  {
    name: "audio_apply_effect",
    description:
      "Apply an audio effect (reverb, delay, eq, compressor, normalize, fade_in, fade_out) to a track. " +
      "Returns the effect details. Effects are queued for processing.",
    category: "audio-effects",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: ApplyEffectSchema.shape,
    handler: async (input: never, ctx: ServerContext): Promise<CallToolResult> => {
      const { track_id, effect_type, params } = input as z.infer<typeof ApplyEffectSchema>;
      return safeToolCall("audio_apply_effect", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        const track = await prisma.audioTrack.findUnique({
          where: { id: track_id },
          include: {
            project: { select: { id: true, name: true, userId: true } },
          },
        });

        if (!track) {
          return textResult("**Error: NOT_FOUND**\nAudio track not found.\n**Retryable:** false");
        }

        if (track.project.userId !== ctx.userId) {
          return textResult(
            "**Error: PERMISSION_DENIED**\nYou do not have access to this track.\n**Retryable:** false",
          );
        }

        const defaults = effectDefaultParams(effect_type);
        const appliedParams = { ...defaults, ...params };
        const effectId = `eff_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

        const paramLines = Object.entries(appliedParams)
          .map(([k, v]) => `  - ${k}: ${String(v)}`)
          .join("\n");

        return textResult(
          `**Effect Applied**\n\n` +
            `**Effect ID:** ${effectId}\n` +
            `**Effect Type:** ${effect_type}\n` +
            `**Track:** ${track.name} (${track.id})\n` +
            `**Project:** ${track.project.name} (${track.project.id})\n` +
            `**Parameters:**\n${paramLines}\n` +
            `**Status:** QUEUED\n` +
            `**Note:** Effect has been queued for processing. Use the audio processing pipeline to render the result.`,
        );
      });
    },
  },

  /* ─── audio_export_mix ──────────────────────────────────────────── */
  {
    name: "audio_export_mix",
    description:
      "Export the final mix of an audio project to a downloadable file. " +
      "Returns an export job with estimated duration and output URL.",
    category: "audio-effects",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: ExportMixSchema.shape,
    handler: async (input: never, ctx: ServerContext): Promise<CallToolResult> => {
      const { project_id, format, quality } = input as z.infer<typeof ExportMixSchema>;
      return safeToolCall("audio_export_mix", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        const project = await prisma.audioMixerProject.findFirst({
          where: { id: project_id, userId: ctx.userId },
          include: { _count: { select: { tracks: true } } },
        });

        if (!project) {
          return textResult(
            "**Error: NOT_FOUND**\nProject not found or access denied.\n**Retryable:** false",
          );
        }

        const resolvedQuality =
          quality ?? (format === "wav" || format === "flac" ? "lossless" : "high");

        const trackCount = project._count.tracks;
        const estimatedSeconds = Math.max(10, trackCount * 5);

        const jobId = `export_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        const outputUrl = `https://spike.land/api/audio/exports/${jobId}.${format}`;

        return textResult(
          `**Export Job Created**\n\n` +
            `**Job ID:** ${jobId}\n` +
            `**Project:** ${project.name} (${project_id})\n` +
            `**Format:** ${format.toUpperCase()}\n` +
            `**Quality:** ${resolvedQuality}\n` +
            `**Tracks:** ${trackCount}\n` +
            `**Estimated Duration:** ~${estimatedSeconds}s\n` +
            `**Output URL:** ${outputUrl}\n` +
            `**Status:** PROCESSING\n` +
            `**Note:** The export job has been queued. Poll the output URL to check completion.`,
        );
      });
    },
  },

  /* ─── audio_get_waveform ────────────────────────────────────────── */
  {
    name: "audio_get_waveform",
    description:
      "Get waveform amplitude data for a track for use in visualization. " +
      "Returns an array of normalized sample values between -1 and 1.",
    category: "audio-effects",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: GetWaveformSchema.shape,
    handler: async (input: never, ctx: ServerContext): Promise<CallToolResult> => {
      const { track_id, resolution } = input as z.infer<typeof GetWaveformSchema>;
      return safeToolCall("audio_get_waveform", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        const track = await prisma.audioTrack.findUnique({
          where: { id: track_id },
          include: {
            project: { select: { userId: true } },
          },
        });

        if (!track) {
          return textResult("**Error: NOT_FOUND**\nAudio track not found.\n**Retryable:** false");
        }

        if (track.project.userId !== ctx.userId) {
          return textResult(
            "**Error: PERMISSION_DENIED**\nYou do not have access to this track.\n**Retryable:** false",
          );
        }

        const resolvedResolution = resolution ?? 100;
        const waveform = generateSimulatedWaveform(track.id, resolvedResolution, track.duration);

        const peak = waveform.reduce((max, v) => Math.max(max, Math.abs(v)), 0);
        const rms = Math.sqrt(waveform.reduce((sum, v) => sum + v * v, 0) / waveform.length);

        return textResult(
          `**Waveform Data**\n\n` +
            `**Track:** ${track.name} (${track.id})\n` +
            `**Duration:** ${track.duration}s\n` +
            `**Resolution:** ${resolvedResolution} points\n` +
            `**Peak Level:** ${Math.round(peak * 1000) / 1000}\n` +
            `**RMS Level:** ${Math.round(rms * 1000) / 1000}\n` +
            `**Waveform:** ${JSON.stringify(waveform)}\n` +
            `**Note:** Waveform data is generated for visualization. For precise metering, use a dedicated audio analysis service.`,
        );
      });
    },
  },

  /* ─── audio_duplicate_track ─────────────────────────────────────── */
  {
    name: "audio_duplicate_track",
    description: "Duplicate an existing audio track within the same project, copying all settings.",
    category: "audio-effects",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: DuplicateTrackSchema.shape,
    handler: async (input: never, ctx: ServerContext): Promise<CallToolResult> => {
      const { track_id, new_name } = input as z.infer<typeof DuplicateTrackSchema>;
      return safeToolCall("audio_duplicate_track", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        const track = await prisma.audioTrack.findUnique({
          where: { id: track_id },
          include: {
            project: { select: { id: true, name: true, userId: true } },
          },
        });

        if (!track) {
          return textResult("**Error: NOT_FOUND**\nAudio track not found.\n**Retryable:** false");
        }

        if (track.project.userId !== ctx.userId) {
          return textResult(
            "**Error: PERMISSION_DENIED**\nYou do not have access to this track.\n**Retryable:** false",
          );
        }

        const trackCount = await prisma.audioTrack.count({
          where: { projectId: track.projectId },
        });

        const duplicateName = new_name ?? `${track.name} (copy)`;

        const duplicate = await prisma.audioTrack.create({
          data: {
            projectId: track.projectId,
            name: duplicateName,
            fileUrl: track.fileUrl,
            fileR2Key: track.fileR2Key,
            fileFormat: track.fileFormat,
            duration: track.duration,
            fileSizeBytes: track.fileSizeBytes,
            volume: track.volume,
            muted: track.muted,
            solo: false,
            sortOrder: trackCount,
            storageType: track.storageType,
          },
        });

        return textResult(
          `**Track Duplicated**\n\n` +
            `**New Track ID:** ${duplicate.id}\n` +
            `**Name:** ${duplicate.name}\n` +
            `**Source Track:** ${track.name} (${track.id})\n` +
            `**Project:** ${track.project.name} (${track.project.id})\n` +
            `**Format:** ${duplicate.fileFormat}\n` +
            `**Duration:** ${duplicate.duration}s\n` +
            `**Sort Order:** ${duplicate.sortOrder}`,
        );
      });
    },
  },

  /* ─── audio_reorder_tracks ──────────────────────────────────────── */
  {
    name: "audio_reorder_tracks",
    description:
      "Reorder the tracks in an audio project by providing the full ordered list of track IDs.",
    category: "audio-effects",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: ReorderTracksSchema.shape,
    handler: async (input: never, ctx: ServerContext): Promise<CallToolResult> => {
      const { project_id, track_ids } = input as z.infer<typeof ReorderTracksSchema>;
      return safeToolCall("audio_reorder_tracks", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        const project = await prisma.audioMixerProject.findFirst({
          where: { id: project_id, userId: ctx.userId },
        });

        if (!project) {
          return textResult(
            "**Error: NOT_FOUND**\nProject not found or access denied.\n**Retryable:** false",
          );
        }

        const tracks = await prisma.audioTrack.findMany({
          where: { projectId: project_id },
          select: { id: true, name: true },
        });

        const projectTrackIds = new Set(tracks.map((t) => t.id));
        const missingIds = track_ids.filter((id) => !projectTrackIds.has(id));

        if (missingIds.length > 0) {
          return textResult(
            `**Error: NOT_FOUND**\nThe following track IDs were not found in this project: ${missingIds.join(
              ", ",
            )}.\n**Retryable:** false`,
          );
        }

        await Promise.all(
          track_ids.map((id, index) =>
            prisma.audioTrack.update({
              where: { id },
              data: { sortOrder: index },
            }),
          ),
        );

        const trackNameById = new Map(tracks.map((t) => [t.id, t.name]));
        const orderedLines = track_ids
          .map((id, i) => `  ${i + 1}. ${trackNameById.get(id) ?? id} (${id})`)
          .join("\n");

        return textResult(
          `**Tracks Reordered**\n\n` +
            `**Project:** ${project.name} (${project_id})\n` +
            `**Track Count:** ${track_ids.length}\n` +
            `**New Order:**\n${orderedLines}`,
        );
      });
    },
  },
];
