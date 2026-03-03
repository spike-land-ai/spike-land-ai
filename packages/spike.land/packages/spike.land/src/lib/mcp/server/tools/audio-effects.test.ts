import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock Prisma before any imports that transitively import it
const mockPrisma = vi.hoisted(() => ({
  audioTrack: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  audioMixerProject: {
    findFirst: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

import { createMockRegistry, getText, isError, type MockRegistry } from "../__test-utils__";
import { registerAudioEffectsTools } from "./audio-effects";

// ── Fixtures ──────────────────────────────────────────────────────────────

const USER_ID = "test-user-123";
const OTHER_USER_ID = "other-user-456";

const PROJECT = { id: "proj-1", name: "My Mix", userId: USER_ID };

const TRACK = {
  id: "track-1",
  name: "vocals.wav",
  fileUrl: null,
  fileR2Key: null,
  fileFormat: "wav",
  duration: 120,
  fileSizeBytes: 5_000_000,
  volume: 1.0,
  muted: false,
  solo: false,
  sortOrder: 0,
  storageType: "R2",
  projectId: "proj-1",
  createdAt: new Date("2024-06-15T12:00:00Z"),
  updatedAt: new Date("2024-06-15T12:00:00Z"),
  project: { id: "proj-1", name: "My Mix", userId: USER_ID },
};

// ── Suite ─────────────────────────────────────────────────────────────────

describe("audio-effects tools", () => {
  let registry: MockRegistry;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerAudioEffectsTools(registry, USER_ID);
  });

  // ── Registration ──────────────────────────────────────────────────────

  it("should register exactly 5 audio-effects tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(5);
  });

  it("should register each tool with category 'audio-effects'", () => {
    const calls = (registry.register as ReturnType<typeof vi.fn>).mock.calls as Array<
      [{ name: string; category: string; }]
    >;
    for (const [def] of calls) {
      expect(def.category).toBe("audio-effects");
    }
  });

  // ── audio_apply_effect ───────────────────────────────────────────────

  describe("audio_apply_effect", () => {
    it("should apply a reverb effect and return effect details", async () => {
      mockPrisma.audioTrack.findUnique.mockResolvedValue(TRACK);

      const handler = registry.handlers.get("audio_apply_effect")!;
      const result = await handler({ track_id: "track-1", effect_type: "reverb" });

      const text = getText(result);
      expect(text).toContain("Effect Applied");
      expect(text).toContain("reverb");
      expect(text).toContain("track-1");
      expect(text).toContain("vocals.wav");
      expect(text).toContain("My Mix");
      expect(text).toContain("QUEUED");
      expect(isError(result)).toBe(false);
    });

    it("should merge caller-supplied params with defaults", async () => {
      mockPrisma.audioTrack.findUnique.mockResolvedValue(TRACK);

      const handler = registry.handlers.get("audio_apply_effect")!;
      const result = await handler({
        track_id: "track-1",
        effect_type: "delay",
        params: { wet: 0.8, feedback: 0.5 },
      });

      const text = getText(result);
      expect(text).toContain("delay");
      expect(text).toContain("0.8");
      expect(text).toContain("0.5");
    });

    it("should return NOT_FOUND when track does not exist", async () => {
      mockPrisma.audioTrack.findUnique.mockResolvedValue(null);

      const handler = registry.handlers.get("audio_apply_effect")!;
      const result = await handler({ track_id: "no-such-track", effect_type: "eq" });

      expect(getText(result)).toContain("NOT_FOUND");
    });

    it("should return PERMISSION_DENIED when track belongs to another user", async () => {
      mockPrisma.audioTrack.findUnique.mockResolvedValue({
        ...TRACK,
        project: { ...TRACK.project, userId: OTHER_USER_ID },
      });

      const handler = registry.handlers.get("audio_apply_effect")!;
      const result = await handler({ track_id: "track-1", effect_type: "normalize" });

      expect(getText(result)).toContain("PERMISSION_DENIED");
    });

    it("should work for all supported effect types", async () => {
      mockPrisma.audioTrack.findUnique.mockResolvedValue(TRACK);
      const handler = registry.handlers.get("audio_apply_effect")!;

      for (
        const effectType of [
          "reverb",
          "delay",
          "eq",
          "compressor",
          "normalize",
          "fade_in",
          "fade_out",
        ]
      ) {
        vi.clearAllMocks();
        mockPrisma.audioTrack.findUnique.mockResolvedValue(TRACK);
        const result = await handler({ track_id: "track-1", effect_type: effectType });
        expect(getText(result)).toContain("Effect Applied");
        expect(getText(result)).toContain(effectType);
      }
    });
  });

  // ── audio_export_mix ─────────────────────────────────────────────────

  describe("audio_export_mix", () => {
    it("should create an export job with correct details", async () => {
      mockPrisma.audioMixerProject.findFirst.mockResolvedValue({
        ...PROJECT,
        _count: { tracks: 4 },
      });

      const handler = registry.handlers.get("audio_export_mix")!;
      const result = await handler({ project_id: "proj-1", format: "mp3" });

      const text = getText(result);
      expect(text).toContain("Export Job Created");
      expect(text).toContain("MP3");
      expect(text).toContain("proj-1");
      expect(text).toContain("My Mix");
      expect(text).toContain("PROCESSING");
      expect(text).toContain("spike.land");
      expect(isError(result)).toBe(false);
    });

    it("should resolve quality to lossless for wav format when not specified", async () => {
      mockPrisma.audioMixerProject.findFirst.mockResolvedValue({
        ...PROJECT,
        _count: { tracks: 2 },
      });

      const handler = registry.handlers.get("audio_export_mix")!;
      const result = await handler({ project_id: "proj-1", format: "wav" });

      expect(getText(result)).toContain("lossless");
    });

    it("should respect explicit quality override", async () => {
      mockPrisma.audioMixerProject.findFirst.mockResolvedValue({
        ...PROJECT,
        _count: { tracks: 2 },
      });

      const handler = registry.handlers.get("audio_export_mix")!;
      const result = await handler({ project_id: "proj-1", format: "mp3", quality: "low" });

      expect(getText(result)).toContain("low");
    });

    it("should return NOT_FOUND when project does not exist", async () => {
      mockPrisma.audioMixerProject.findFirst.mockResolvedValue(null);

      const handler = registry.handlers.get("audio_export_mix")!;
      const result = await handler({ project_id: "no-proj", format: "flac" });

      expect(getText(result)).toContain("NOT_FOUND");
    });

    it("should include the output URL in the correct format", async () => {
      mockPrisma.audioMixerProject.findFirst.mockResolvedValue({
        ...PROJECT,
        _count: { tracks: 1 },
      });

      const handler = registry.handlers.get("audio_export_mix")!;
      const result = await handler({ project_id: "proj-1", format: "ogg" });

      const text = getText(result);
      expect(text).toMatch(/\.ogg/);
    });
  });

  // ── audio_get_waveform ───────────────────────────────────────────────

  describe("audio_get_waveform", () => {
    it("should return waveform data with default resolution of 100 points", async () => {
      mockPrisma.audioTrack.findUnique.mockResolvedValue({
        ...TRACK,
        project: { userId: USER_ID },
      });

      const handler = registry.handlers.get("audio_get_waveform")!;
      const result = await handler({ track_id: "track-1" });

      const text = getText(result);
      expect(text).toContain("Waveform Data");
      expect(text).toContain("vocals.wav");
      expect(text).toContain("120s");
      expect(text).toContain("100 points");
      expect(text).toContain("Peak Level");
      expect(text).toContain("RMS Level");
      expect(isError(result)).toBe(false);

      // Verify the waveform JSON array in the response
      const waveformMatch = text.match(/\*\*Waveform:\*\* (\[.+?\])/);
      expect(waveformMatch).not.toBeNull();
      const parsed = JSON.parse(waveformMatch![1]!) as unknown[];
      expect(parsed).toHaveLength(100);
    });

    it("should honour a custom resolution", async () => {
      mockPrisma.audioTrack.findUnique.mockResolvedValue({
        ...TRACK,
        project: { userId: USER_ID },
      });

      const handler = registry.handlers.get("audio_get_waveform")!;
      const result = await handler({ track_id: "track-1", resolution: 50 });

      const text = getText(result);
      expect(text).toContain("50 points");

      const waveformMatch = text.match(/\*\*Waveform:\*\* (\[.+?\])/);
      expect(waveformMatch).not.toBeNull();
      const parsed = JSON.parse(waveformMatch![1]!) as unknown[];
      expect(parsed).toHaveLength(50);
    });

    it("should return NOT_FOUND when track does not exist", async () => {
      mockPrisma.audioTrack.findUnique.mockResolvedValue(null);

      const handler = registry.handlers.get("audio_get_waveform")!;
      const result = await handler({ track_id: "ghost" });

      expect(getText(result)).toContain("NOT_FOUND");
    });

    it("should return PERMISSION_DENIED for another user's track", async () => {
      mockPrisma.audioTrack.findUnique.mockResolvedValue({
        ...TRACK,
        project: { userId: OTHER_USER_ID },
      });

      const handler = registry.handlers.get("audio_get_waveform")!;
      const result = await handler({ track_id: "track-1" });

      expect(getText(result)).toContain("PERMISSION_DENIED");
    });
  });

  // ── audio_duplicate_track ────────────────────────────────────────────

  describe("audio_duplicate_track", () => {
    it("should duplicate a track with a '(copy)' suffix by default", async () => {
      mockPrisma.audioTrack.findUnique.mockResolvedValue(TRACK);
      mockPrisma.audioTrack.count.mockResolvedValue(1);
      mockPrisma.audioTrack.create.mockResolvedValue({
        ...TRACK,
        id: "track-2",
        name: "vocals.wav (copy)",
        solo: false,
        sortOrder: 1,
      });

      const handler = registry.handlers.get("audio_duplicate_track")!;
      const result = await handler({ track_id: "track-1" });

      const text = getText(result);
      expect(text).toContain("Track Duplicated");
      expect(text).toContain("track-2");
      expect(text).toContain("vocals.wav (copy)");
      expect(text).toContain("vocals.wav");
      expect(text).toContain("My Mix");
      expect(isError(result)).toBe(false);

      expect(mockPrisma.audioTrack.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: "vocals.wav (copy)",
            solo: false,
            sortOrder: 1,
          }),
        }),
      );
    });

    it("should use the provided new_name when given", async () => {
      mockPrisma.audioTrack.findUnique.mockResolvedValue(TRACK);
      mockPrisma.audioTrack.count.mockResolvedValue(3);
      mockPrisma.audioTrack.create.mockResolvedValue({
        ...TRACK,
        id: "track-3",
        name: "lead-vocals",
        sortOrder: 3,
      });

      const handler = registry.handlers.get("audio_duplicate_track")!;
      const result = await handler({ track_id: "track-1", new_name: "lead-vocals" });

      expect(getText(result)).toContain("lead-vocals");
      expect(mockPrisma.audioTrack.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: "lead-vocals" }),
        }),
      );
    });

    it("should return NOT_FOUND when source track does not exist", async () => {
      mockPrisma.audioTrack.findUnique.mockResolvedValue(null);

      const handler = registry.handlers.get("audio_duplicate_track")!;
      const result = await handler({ track_id: "ghost" });

      expect(getText(result)).toContain("NOT_FOUND");
      expect(mockPrisma.audioTrack.create).not.toHaveBeenCalled();
    });

    it("should return PERMISSION_DENIED when track belongs to another user", async () => {
      mockPrisma.audioTrack.findUnique.mockResolvedValue({
        ...TRACK,
        project: { ...TRACK.project, userId: OTHER_USER_ID },
      });

      const handler = registry.handlers.get("audio_duplicate_track")!;
      const result = await handler({ track_id: "track-1" });

      expect(getText(result)).toContain("PERMISSION_DENIED");
      expect(mockPrisma.audioTrack.create).not.toHaveBeenCalled();
    });
  });

  // ── audio_reorder_tracks ─────────────────────────────────────────────

  describe("audio_reorder_tracks", () => {
    it("should reorder tracks and update sort orders", async () => {
      mockPrisma.audioMixerProject.findFirst.mockResolvedValue(PROJECT);
      mockPrisma.audioTrack.findMany.mockResolvedValue([
        { id: "t1", name: "bass.wav" },
        { id: "t2", name: "drums.mp3" },
        { id: "t3", name: "vocals.flac" },
      ]);
      mockPrisma.audioTrack.update.mockResolvedValue({});

      const handler = registry.handlers.get("audio_reorder_tracks")!;
      const result = await handler({
        project_id: "proj-1",
        track_ids: ["t3", "t1", "t2"],
      });

      const text = getText(result);
      expect(text).toContain("Tracks Reordered");
      expect(text).toContain("My Mix");
      expect(text).toContain("3");
      expect(text).toContain("vocals.flac");
      expect(text).toContain("bass.wav");
      expect(text).toContain("drums.mp3");
      expect(isError(result)).toBe(false);

      // Each track should have been updated with the correct new sort order
      expect(mockPrisma.audioTrack.update).toHaveBeenCalledWith({
        where: { id: "t3" },
        data: { sortOrder: 0 },
      });
      expect(mockPrisma.audioTrack.update).toHaveBeenCalledWith({
        where: { id: "t1" },
        data: { sortOrder: 1 },
      });
      expect(mockPrisma.audioTrack.update).toHaveBeenCalledWith({
        where: { id: "t2" },
        data: { sortOrder: 2 },
      });
    });

    it("should return NOT_FOUND when project does not exist", async () => {
      mockPrisma.audioMixerProject.findFirst.mockResolvedValue(null);

      const handler = registry.handlers.get("audio_reorder_tracks")!;
      const result = await handler({ project_id: "no-proj", track_ids: ["t1"] });

      expect(getText(result)).toContain("NOT_FOUND");
      expect(mockPrisma.audioTrack.update).not.toHaveBeenCalled();
    });

    it("should return NOT_FOUND when a track ID does not belong to the project", async () => {
      mockPrisma.audioMixerProject.findFirst.mockResolvedValue(PROJECT);
      mockPrisma.audioTrack.findMany.mockResolvedValue([
        { id: "t1", name: "bass.wav" },
        { id: "t2", name: "drums.mp3" },
      ]);

      const handler = registry.handlers.get("audio_reorder_tracks")!;
      const result = await handler({
        project_id: "proj-1",
        track_ids: ["t1", "t2", "t-unknown"],
      });

      const text = getText(result);
      expect(text).toContain("NOT_FOUND");
      expect(text).toContain("t-unknown");
      expect(mockPrisma.audioTrack.update).not.toHaveBeenCalled();
    });

    it("should handle a single-track reorder without errors", async () => {
      mockPrisma.audioMixerProject.findFirst.mockResolvedValue(PROJECT);
      mockPrisma.audioTrack.findMany.mockResolvedValue([
        { id: "t1", name: "solo.wav" },
      ]);
      mockPrisma.audioTrack.update.mockResolvedValue({});

      const handler = registry.handlers.get("audio_reorder_tracks")!;
      const result = await handler({ project_id: "proj-1", track_ids: ["t1"] });

      expect(getText(result)).toContain("Tracks Reordered");
      expect(mockPrisma.audioTrack.update).toHaveBeenCalledTimes(1);
      expect(mockPrisma.audioTrack.update).toHaveBeenCalledWith({
        where: { id: "t1" },
        data: { sortOrder: 0 },
      });
    });
  });
});
