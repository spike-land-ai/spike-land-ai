/**
 * Audio Mixer MCP Tools
 *
 * Full project & track lifecycle: create/list/delete projects,
 * upload/list/update/delete tracks, and retrieve track metadata.
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "../tool-registry";
import { safeToolCall, textResult } from "./tool-helpers";

const ALLOWED_FORMATS = [
  "wav",
  "mp3",
  "webm",
  "ogg",
  "flac",
  "aac",
  "m4a",
] as const;

/* ── Schemas ────────────────────────────────────────────────────────── */

const AudioUploadSchema = z.object({
  project_id: z.string().min(1).describe("Audio mixer project ID."),
  filename: z.string().min(1).describe("Filename for the audio track."),
  content_type: z.string().min(1).describe(
    "MIME content type (e.g. audio/wav).",
  ),
});

const AudioGetTrackSchema = z.object({
  track_id: z.string().min(1).describe("Audio track ID."),
});

const AudioCreateProjectSchema = z.object({
  name: z.string().min(1).max(100).describe("Project name."),
  description: z.string().max(500).optional().describe(
    "Optional project description.",
  ),
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

/* ── Registration ───────────────────────────────────────────────────── */

export function registerAudioTools(
  registry: ToolRegistry,
  userId: string,
): void {
  /* ─── audio_upload ─────────────────────────────────────────────── */

  registry.register({
    name: "audio_upload",
    description:
      "Upload an audio track to a mixer project. Creates a track record and returns track metadata.",
    category: "audio",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: AudioUploadSchema.shape,
    handler: async (
      { project_id, filename, content_type }: z.infer<typeof AudioUploadSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("audio_upload", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        const project = await prisma.audioMixerProject.findFirst({
          where: { id: project_id, userId },
        });
        if (!project) {
          return textResult(
            "**Error: NOT_FOUND**\nProject not found or access denied.\n**Retryable:** false",
          );
        }

        const extMatch = filename.match(/\.(\w+)$/);
        const format = extMatch
          ? extMatch[1]!.toLowerCase()
          : content_type.split("/")[1] ?? "wav";
        if (
          !ALLOWED_FORMATS.includes(format as typeof ALLOWED_FORMATS[number])
        ) {
          return textResult(
            `**Error: VALIDATION_ERROR**\nInvalid audio format '${format}'. Allowed: ${
              ALLOWED_FORMATS.join(", ")
            }.\n**Retryable:** false`,
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
          `**Audio Track Created!**\n\n`
            + `**Track ID:** ${track.id}\n`
            + `**Project:** ${project.name}\n`
            + `**Filename:** ${filename}\n`
            + `**Format:** ${format}\n`
            + `**Note:** Track record created. Use the audio upload API endpoint to upload the actual file.`,
        );
      }),
  });

  /* ─── audio_get_track ──────────────────────────────────────────── */

  registry.register({
    name: "audio_get_track",
    description: "Get detailed information about an audio track.",
    category: "audio",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: AudioGetTrackSchema.shape,
    handler: async (
      { track_id }: z.infer<typeof AudioGetTrackSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("audio_get_track", async () => {
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
          return textResult(
            "**Error: NOT_FOUND**\nAudio track not found.\n**Retryable:** false",
          );
        }

        if (track.project.userId !== userId) {
          return textResult(
            "**Error: PERMISSION_DENIED**\nYou do not have access to this track.\n**Retryable:** false",
          );
        }

        return textResult(
          `**Audio Track**\n\n`
            + `**Track ID:** ${track.id}\n`
            + `**Name:** ${track.name}\n`
            + `**Project:** ${track.project.name} (${track.project.id})\n`
            + `**Format:** ${track.fileFormat}\n`
            + `**Duration:** ${track.duration}s\n`
            + `**Size:** ${track.fileSizeBytes} bytes\n`
            + `**Volume:** ${track.volume}\n`
            + `**Muted:** ${track.muted}\n`
            + `**Solo:** ${track.solo}\n`
            + `**Sort Order:** ${track.sortOrder}\n`
            + `**Storage:** ${track.storageType}\n`
            + `**Created:** ${track.createdAt.toISOString()}`,
        );
      }),
  });

  /* ─── audio_list_projects ──────────────────────────────────────── */

  registry.register({
    name: "audio_list_projects",
    description: "List all audio mixer projects for the current user.",
    category: "audio",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: {},
    handler: async (): Promise<CallToolResult> =>
      safeToolCall("audio_list_projects", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        const projects = await prisma.audioMixerProject.findMany({
          where: { userId },
          include: { _count: { select: { tracks: true } } },
          orderBy: { updatedAt: "desc" },
        });

        if (projects.length === 0) {
          return textResult(
            "**No projects found.**\nCreate a new project with `audio_create_project`.",
          );
        }

        const lines = projects.map(p =>
          `- **${p.name}** (${p.id}) — ${p._count.tracks} track(s) — updated ${p.updatedAt.toISOString()}`
        );

        return textResult(
          `**Your Audio Projects (${projects.length})**\n\n${lines.join("\n")}`,
        );
      }),
  });

  /* ─── audio_create_project ─────────────────────────────────────── */

  registry.register({
    name: "audio_create_project",
    description: "Create a new audio mixer project.",
    category: "audio",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: AudioCreateProjectSchema.shape,
    handler: async (
      { name, description }: z.infer<typeof AudioCreateProjectSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("audio_create_project", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        const project = await prisma.audioMixerProject.create({
          data: { name, description: description ?? "", userId },
        });

        return textResult(
          `**Project Created!**\n\n`
            + `**ID:** ${project.id}\n`
            + `**Name:** ${project.name}\n`
            + `**Created:** ${project.createdAt.toISOString()}`,
        );
      }),
  });

  /* ─── audio_delete_project ─────────────────────────────────────── */

  registry.register({
    name: "audio_delete_project",
    description: "Delete an audio mixer project and all its tracks.",
    category: "audio",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: AudioProjectIdSchema.shape,
    handler: async (
      { project_id }: z.infer<typeof AudioProjectIdSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("audio_delete_project", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        const project = await prisma.audioMixerProject.findFirst({
          where: { id: project_id, userId },
        });
        if (!project) {
          return textResult(
            "**Error: NOT_FOUND**\nProject not found or access denied.\n**Retryable:** false",
          );
        }

        // Delete tracks first, then the project
        await prisma.audioTrack.deleteMany({
          where: { projectId: project_id },
        });
        await prisma.audioMixerProject.delete({ where: { id: project_id } });

        return textResult(
          `**Project Deleted**\n\n`
            + `**Name:** ${project.name}\n`
            + `**ID:** ${project_id}`,
        );
      }),
  });

  /* ─── audio_list_tracks ────────────────────────────────────────── */

  registry.register({
    name: "audio_list_tracks",
    description: "List all tracks in an audio mixer project.",
    category: "audio",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: AudioProjectIdSchema.shape,
    handler: async (
      { project_id }: z.infer<typeof AudioProjectIdSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("audio_list_tracks", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        const project = await prisma.audioMixerProject.findFirst({
          where: { id: project_id, userId },
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

        const lines = tracks.map(t =>
          `- **${t.name}** (${t.id}) — ${t.fileFormat.toUpperCase()} — ${t.duration}s — vol:${t.volume} muted:${t.muted} solo:${t.solo}`
        );

        return textResult(
          `**Tracks in "${project.name}" (${tracks.length})**\n\n${lines.join("\n")}`,
        );
      }),
  });

  /* ─── audio_delete_track ───────────────────────────────────────── */

  registry.register({
    name: "audio_delete_track",
    description: "Delete an audio track from a project.",
    category: "audio",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: AudioDeleteTrackSchema.shape,
    handler: async (
      { track_id }: z.infer<typeof AudioDeleteTrackSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("audio_delete_track", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        const track = await prisma.audioTrack.findUnique({
          where: { id: track_id },
          include: { project: { select: { userId: true, name: true } } },
        });

        if (!track) {
          return textResult(
            "**Error: NOT_FOUND**\nAudio track not found.\n**Retryable:** false",
          );
        }

        if (track.project.userId !== userId) {
          return textResult(
            "**Error: PERMISSION_DENIED**\nYou do not have access to this track.\n**Retryable:** false",
          );
        }

        await prisma.audioTrack.delete({ where: { id: track_id } });

        return textResult(
          `**Track Deleted**\n\n`
            + `**Name:** ${track.name}\n`
            + `**ID:** ${track_id}\n`
            + `**Project:** ${track.project.name}`,
        );
      }),
  });

  /* ─── audio_update_track ───────────────────────────────────────── */

  registry.register({
    name: "audio_update_track",
    description: "Update audio track settings (name, volume, muted, solo).",
    category: "audio",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: AudioUpdateTrackSchema.shape,
    handler: async (
      { track_id, name, volume, muted, solo }: z.infer<
        typeof AudioUpdateTrackSchema
      >,
    ): Promise<CallToolResult> =>
      safeToolCall("audio_update_track", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        const existing = await prisma.audioTrack.findUnique({
          where: { id: track_id },
          include: { project: { select: { userId: true } } },
        });

        if (!existing) {
          return textResult(
            "**Error: NOT_FOUND**\nAudio track not found.\n**Retryable:** false",
          );
        }

        if (existing.project.userId !== userId) {
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
          return textResult(
            "**No changes specified.** Provide at least one field to update.",
          );
        }

        const updated = await prisma.audioTrack.update({
          where: { id: track_id },
          data: updateData,
        });

        return textResult(
          `**Track Updated**\n\n`
            + `**ID:** ${updated.id}\n`
            + `**Name:** ${updated.name}\n`
            + `**Volume:** ${updated.volume}\n`
            + `**Muted:** ${updated.muted}\n`
            + `**Solo:** ${updated.solo}`,
        );
      }),
  });
}
