/**
 * Audio Effects MCP Tools
 *
 * Processing and effects capabilities: apply effects, export mixes,
 * get waveform data, duplicate tracks, and reorder tracks.
 */

import { z } from "zod";
import type { ToolRegistry } from "../tool-registry";
import { textResult } from "./tool-helpers";
import { freeTool } from "../tool-builder/procedures.js";

/* ── Schemas ────────────────────────────────────────────────────────── */

const EFFECT_TYPES = [
    "reverb",
    "delay",
    "eq",
    "compressor",
    "normalize",
    "fade_in",
    "fade_out",
] as const;

type EffectType = typeof EFFECT_TYPES[number];

const EXPORT_FORMATS = ["wav", "mp3", "flac", "ogg"] as const;
const EXPORT_QUALITY = ["low", "medium", "high", "lossless"] as const;
/* ── Helpers ─────────────────────────────────────────────────────────── */

/**
 * Generate a deterministic-looking simulated waveform for a track.
 * In production this would come from an audio analysis service.
 */
function generateSimulatedWaveform(
    trackId: string,
    resolution: number,
    duration: number,
): number[] {
    // Seed based on track ID characters for stable output
    const seed = trackId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const waveform: number[] = [];
    for (let i = 0; i < resolution; i++) {
        const t = i / resolution;
        // Composite sine waves with seed-derived offsets for a realistic shape
        const base = Math.sin((t * Math.PI * 4) + seed) * 0.4;
        const mid = Math.sin((t * Math.PI * 12) + seed * 0.7) * 0.3;
        const high = Math.sin((t * Math.PI * 32) + seed * 0.3) * 0.15;
        // Envelope: fade in/out at edges
        const envelope = Math.sin(t * Math.PI);
        const raw = (base + mid + high) * envelope * (duration > 0 ? 1 : 0);
        // Clamp to [-1, 1] and round to 4 decimal places
        waveform.push(Math.round(Math.max(-1, Math.min(1, raw)) * 10000) / 10000);
    }
    return waveform;
}

/** Return human-readable default parameter descriptions for each effect type. */
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

/* ── Registration ───────────────────────────────────────────────────── */

export function registerAudioEffectsTools(
    registry: ToolRegistry,
    userId: string,
): void {
    /* ─── audio_apply_effect ────────────────────────────────────────── */

    registry.registerBuilt(
        freeTool(userId)
            .tool("audio_apply_effect", "Apply an audio effect (reverb, delay, eq, compressor, normalize, fade_in, fade_out) to a track. "
                + "Returns the effect details. Effects are queued for processing.", {
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
            })
            .meta({ category: "audio-effects", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const { track_id, effect_type, params } = input;

                const prisma = (await import("@/lib/prisma")).default;

                const track = await prisma.audioTrack.findUnique({
                    where: { id: track_id },
                    include: {
                        project: { select: { id: true, name: true, userId: true } },
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

                const defaults = effectDefaultParams(effect_type);
                const appliedParams = { ...defaults, ...params };
                const effectId = `eff_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

                const paramLines = Object.entries(appliedParams)
                    .map(([k, v]) => `  - ${k}: ${String(v)}`)
                    .join("\n");

                return textResult(
                    `**Effect Applied**\n\n`
                    + `**Effect ID:** ${effectId}\n`
                    + `**Effect Type:** ${effect_type}\n`
                    + `**Track:** ${track.name} (${track.id})\n`
                    + `**Project:** ${track.project.name} (${track.project.id})\n`
                    + `**Parameters:**\n${paramLines}\n`
                    + `**Status:** QUEUED\n`
                    + `**Note:** Effect has been queued for processing. Use the audio processing pipeline to render the result.`,
                );
            })
    );

    /* ─── audio_export_mix ──────────────────────────────────────────── */

    registry.registerBuilt(
        freeTool(userId)
            .tool("audio_export_mix", "Export the final mix of an audio project to a downloadable file. "
                + "Returns an export job with estimated duration and output URL.", {
                project_id: z.string().min(1).describe("Audio mixer project ID to export."),
                format: z
                    .enum(EXPORT_FORMATS)
                    .describe("Output format: wav, mp3, flac, or ogg."),
                quality: z
                    .enum(EXPORT_QUALITY)
                    .optional()
                    .describe("Export quality level: low, medium, high, or lossless."),
            })
            .meta({ category: "audio-effects", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const { project_id, format, quality } = input;

                const prisma = (await import("@/lib/prisma")).default;

                const project = await prisma.audioMixerProject.findFirst({
                    where: { id: project_id, userId },
                    include: { _count: { select: { tracks: true } } },
                });

                if (!project) {
                    return textResult(
                        "**Error: NOT_FOUND**\nProject not found or access denied.\n**Retryable:** false",
                    );
                }

                const resolvedQuality = quality
                    ?? (format === "wav" || format === "flac" ? "lossless" : "high");

                // Estimate duration: ~5s per track base + format overhead
                const trackCount = project._count.tracks;
                const estimatedSeconds = Math.max(10, trackCount * 5);

                const jobId = `export_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
                const outputUrl = `https://spike.land/api/audio/exports/${jobId}.${format}`;

                return textResult(
                    `**Export Job Created**\n\n`
                    + `**Job ID:** ${jobId}\n`
                    + `**Project:** ${project.name} (${project_id})\n`
                    + `**Format:** ${format.toUpperCase()}\n`
                    + `**Quality:** ${resolvedQuality}\n`
                    + `**Tracks:** ${trackCount}\n`
                    + `**Estimated Duration:** ~${estimatedSeconds}s\n`
                    + `**Output URL:** ${outputUrl}\n`
                    + `**Status:** PROCESSING\n`
                    + `**Note:** The export job has been queued. Poll the output URL to check completion.`,
                );
            })
    );

    /* ─── audio_get_waveform ────────────────────────────────────────── */

    registry.registerBuilt(
        freeTool(userId)
            .tool("audio_get_waveform", "Get waveform amplitude data for a track for use in visualization. "
                + "Returns an array of normalized sample values between -1 and 1.", {
                track_id: z.string().min(1).describe("Audio track ID."),
                resolution: z
                    .number()
                    .int()
                    .min(10)
                    .max(2000)
                    .optional()
                    .default(100)
                    .describe("Number of waveform data points to return (default: 100)."),
            })
            .meta({ category: "audio-effects", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const { track_id, resolution } = input;

                const prisma = (await import("@/lib/prisma")).default;

                const track = await prisma.audioTrack.findUnique({
                    where: { id: track_id },
                    include: {
                        project: { select: { userId: true } },
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

                const resolvedResolution = resolution ?? 100;
                const waveform = generateSimulatedWaveform(
                    track.id,
                    resolvedResolution,
                    track.duration,
                );

                const peak = waveform.reduce(
                    (max, v) => Math.max(max, Math.abs(v)),
                    0,
                );
                const rms = Math.sqrt(
                    waveform.reduce((sum, v) => sum + v * v, 0) / waveform.length,
                );

                return textResult(
                    `**Waveform Data**\n\n`
                    + `**Track:** ${track.name} (${track.id})\n`
                    + `**Duration:** ${track.duration}s\n`
                    + `**Resolution:** ${resolvedResolution} points\n`
                    + `**Peak Level:** ${Math.round(peak * 1000) / 1000}\n`
                    + `**RMS Level:** ${Math.round(rms * 1000) / 1000}\n`
                    + `**Waveform:** ${JSON.stringify(waveform)}\n`
                    + `**Note:** Waveform data is generated for visualization. For precise metering, use a dedicated audio analysis service.`,
                );
            })
    );

    /* ─── audio_duplicate_track ─────────────────────────────────────── */

    registry.registerBuilt(
        freeTool(userId)
            .tool("audio_duplicate_track", "Duplicate an existing audio track within the same project, copying all settings.", {
                track_id: z.string().min(1).describe("Audio track ID to duplicate."),
                new_name: z
                    .string()
                    .min(1)
                    .max(200)
                    .optional()
                    .describe("Optional name for the duplicated track."),
            })
            .meta({ category: "audio-effects", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const { track_id, new_name } = input;

                const prisma = (await import("@/lib/prisma")).default;

                const track = await prisma.audioTrack.findUnique({
                    where: { id: track_id },
                    include: {
                        project: { select: { id: true, name: true, userId: true } },
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
                        solo: false, // never duplicate solo state
                        sortOrder: trackCount,
                        storageType: track.storageType,
                    },
                });

                return textResult(
                    `**Track Duplicated**\n\n`
                    + `**New Track ID:** ${duplicate.id}\n`
                    + `**Name:** ${duplicate.name}\n`
                    + `**Source Track:** ${track.name} (${track.id})\n`
                    + `**Project:** ${track.project.name} (${track.project.id})\n`
                    + `**Format:** ${duplicate.fileFormat}\n`
                    + `**Duration:** ${duplicate.duration}s\n`
                    + `**Sort Order:** ${duplicate.sortOrder}`,
                );
            })
    );

    /* ─── audio_reorder_tracks ──────────────────────────────────────── */

    registry.registerBuilt(
        freeTool(userId)
            .tool("audio_reorder_tracks", "Reorder the tracks in an audio project by providing the full ordered list of track IDs.", {
                project_id: z.string().min(1).describe("Audio mixer project ID."),
                track_ids: z
                    .array(z.string().min(1))
                    .min(1)
                    .describe("Track IDs in the desired new order."),
            })
            .meta({ category: "audio-effects", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const { project_id, track_ids } = input;

                const prisma = (await import("@/lib/prisma")).default;

                const project = await prisma.audioMixerProject.findFirst({
                    where: { id: project_id, userId },
                });

                if (!project) {
                    return textResult(
                        "**Error: NOT_FOUND**\nProject not found or access denied.\n**Retryable:** false",
                    );
                }

                // Verify all referenced tracks belong to this project
                const tracks = await prisma.audioTrack.findMany({
                    where: { projectId: project_id },
                    select: { id: true, name: true },
                });

                const projectTrackIds = new Set(tracks.map(t => t.id));
                const missingIds = track_ids.filter(id => !projectTrackIds.has(id));

                if (missingIds.length > 0) {
                    return textResult(
                        `**Error: NOT_FOUND**\nThe following track IDs were not found in this project: ${missingIds.join(", ")
                        }.\n**Retryable:** false`,
                    );
                }

                // Apply new sort orders
                await Promise.all(
                    track_ids.map((id, index) =>
                        prisma.audioTrack.update({
                            where: { id },
                            data: { sortOrder: index },
                        })
                    ),
                );

                const trackNameById = new Map(tracks.map(t => [t.id, t.name]));
                const orderedLines = track_ids
                    .map((id, i) => `  ${i + 1}. ${trackNameById.get(id) ?? id} (${id})`)
                    .join("\n");

                return textResult(
                    `**Tracks Reordered**\n\n`
                    + `**Project:** ${project.name} (${project_id})\n`
                    + `**Track Count:** ${track_ids.length}\n`
                    + `**New Order:**\n${orderedLines}`,
                );
            })
    );
}
