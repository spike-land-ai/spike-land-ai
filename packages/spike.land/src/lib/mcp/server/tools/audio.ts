/**
 * Audio Mixer MCP Tools
 *
 * Full project & track lifecycle: create/list/delete projects,
 * upload/list/update/delete tracks, and retrieve track metadata.
 */

import { z } from "zod";
import type { ToolRegistry } from "../tool-registry";
import { textResult } from "./tool-helpers";
import { freeTool } from "../tool-builder/procedures";

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
/* ── Registration ───────────────────────────────────────────────────── */

export function registerAudioTools(
    registry: ToolRegistry,
    userId: string,
): void {
    /* ─── audio_upload ─────────────────────────────────────────────── */

    registry.registerBuilt(
        freeTool(userId)
            .tool("audio_upload", "Upload an audio track to a mixer project. Creates a track record and returns track metadata.", {
                project_id: z.string().min(1).describe("Audio mixer project ID."),
                filename: z.string().min(1).describe("Filename for the audio track."),
                content_type: z.string().min(1).describe(
                    "MIME content type (e.g. audio/wav).",
                ),
            })
            .meta({ category: "audio", tier: "free" })
            .handler(async ({ input, ctx }) => {
                const { project_id, filename, content_type } = input;

                const project = await ctx.prisma.audioMixerProject.findFirst({
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
                        `**Error: VALIDATION_ERROR**\nInvalid audio format '${format}'. Allowed: ${ALLOWED_FORMATS.join(", ")
                        }.\n**Retryable:** false`,
                    );
                }

                const trackCount = await ctx.prisma.audioTrack.count({
                    where: { projectId: project_id },
                });

                const track = await ctx.prisma.audioTrack.create({
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
            })
    );

    /* ─── audio_get_track ──────────────────────────────────────────── */

    registry.registerBuilt(
        freeTool(userId)
            .tool("audio_get_track", "Get detailed information about an audio track.", {
                track_id: z.string().min(1).describe("Audio track ID."),
            })
            .meta({ category: "audio", tier: "free" })
            .handler(async ({ input, ctx }) => {
                const { track_id } = input;

                const track = await ctx.prisma.audioTrack.findUnique({
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
            })
    );

    /* ─── audio_list_projects ──────────────────────────────────────── */

    registry.registerBuilt(
        freeTool(userId)
            .tool("audio_list_projects", "List all audio mixer projects for the current user.", {})
            .meta({ category: "audio", tier: "free" })
            .handler(async ({ input: _input, ctx }) => {

                const projects = await ctx.prisma.audioMixerProject.findMany({
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
            })
    );

    /* ─── audio_create_project ─────────────────────────────────────── */

    registry.registerBuilt(
        freeTool(userId)
            .tool("audio_create_project", "Create a new audio mixer project.", {
                name: z.string().min(1).max(100).describe("Project name."),
                description: z.string().max(500).optional().describe(
                    "Optional project description.",
                ),
            })
            .meta({ category: "audio", tier: "free" })
            .handler(async ({ input, ctx }) => {
                const { name, description } = input;

                const project = await ctx.prisma.audioMixerProject.create({
                    data: { name, description: description ?? "", userId },
                });

                return textResult(
                    `**Project Created!**\n\n`
                    + `**ID:** ${project.id}\n`
                    + `**Name:** ${project.name}\n`
                    + `**Created:** ${project.createdAt.toISOString()}`,
                );
            })
    );

    /* ─── audio_delete_project ─────────────────────────────────────── */

    registry.registerBuilt(
        freeTool(userId)
            .tool("audio_delete_project", "Delete an audio mixer project and all its tracks.", {
                project_id: z.string().min(1).describe("Audio mixer project ID."),
            })
            .meta({ category: "audio", tier: "free" })
            .handler(async ({ input, ctx }) => {
                const { project_id } = input;

                const project = await ctx.prisma.audioMixerProject.findFirst({
                    where: { id: project_id, userId },
                });
                if (!project) {
                    return textResult(
                        "**Error: NOT_FOUND**\nProject not found or access denied.\n**Retryable:** false",
                    );
                }

                // Delete tracks first, then the project
                await ctx.prisma.audioTrack.deleteMany({
                    where: { projectId: project_id },
                });
                await ctx.prisma.audioMixerProject.delete({ where: { id: project_id } });

                return textResult(
                    `**Project Deleted**\n\n`
                    + `**Name:** ${project.name}\n`
                    + `**ID:** ${project_id}`,
                );
            })
    );

    /* ─── audio_list_tracks ────────────────────────────────────────── */

    registry.registerBuilt(
        freeTool(userId)
            .tool("audio_list_tracks", "List all tracks in an audio mixer project.", {
                project_id: z.string().min(1).describe("Audio mixer project ID."),
            })
            .meta({ category: "audio", tier: "free" })
            .handler(async ({ input, ctx }) => {
                const { project_id } = input;

                const project = await ctx.prisma.audioMixerProject.findFirst({
                    where: { id: project_id, userId },
                });
                if (!project) {
                    return textResult(
                        "**Error: NOT_FOUND**\nProject not found or access denied.\n**Retryable:** false",
                    );
                }

                const tracks = await ctx.prisma.audioTrack.findMany({
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
            })
    );

    /* ─── audio_delete_track ───────────────────────────────────────── */

    registry.registerBuilt(
        freeTool(userId)
            .tool("audio_delete_track", "Delete an audio track from a project.", {
                track_id: z.string().min(1).describe("Audio track ID to delete."),
            })
            .meta({ category: "audio", tier: "free" })
            .handler(async ({ input, ctx }) => {
                const { track_id } = input;

                const track = await ctx.prisma.audioTrack.findUnique({
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

                await ctx.prisma.audioTrack.delete({ where: { id: track_id } });

                return textResult(
                    `**Track Deleted**\n\n`
                    + `**Name:** ${track.name}\n`
                    + `**ID:** ${track_id}\n`
                    + `**Project:** ${track.project.name}`,
                );
            })
    );

    /* ─── audio_update_track ───────────────────────────────────────── */

    registry.registerBuilt(
        freeTool(userId)
            .tool("audio_update_track", "Update audio track settings (name, volume, muted, solo).", {
                track_id: z.string().min(1).describe("Audio track ID."),
                name: z.string().min(1).max(200).optional().describe("New track name."),
                volume: z.number().min(0).max(2).optional().describe("Volume level 0–2."),
                muted: z.boolean().optional().describe("Whether the track is muted."),
                solo: z.boolean().optional().describe("Whether the track is soloed."),
            })
            .meta({ category: "audio", tier: "free" })
            .handler(async ({ input, ctx }) => {
                const { track_id, name, volume, muted, solo } = input;

                const existing = await ctx.prisma.audioTrack.findUnique({
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

                const updated = await ctx.prisma.audioTrack.update({
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
            })
    );
}
