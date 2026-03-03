import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = {
  audioMixerProject: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
  audioTrack: {
    count: vi.fn(),
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    update: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

import { createMockRegistry, getText } from "../__test-utils__";
import { registerAudioTools } from "./audio";

describe("audio tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerAudioTools(registry, userId);
  });

  it("should register 8 audio tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(8);
  });

  // ─── audio_upload ───────────────────────────────────────────────────

  describe("audio_upload", () => {
    it("should create an audio track", async () => {
      mockPrisma.audioMixerProject.findFirst.mockResolvedValue({
        id: "p1",
        name: "My Project",
        userId,
      });
      mockPrisma.audioTrack.count.mockResolvedValue(2);
      mockPrisma.audioTrack.create.mockResolvedValue({ id: "t1" });
      const handler = registry.handlers.get("audio_upload")!;
      const result = await handler({
        project_id: "p1",
        filename: "track.wav",
        content_type: "audio/wav",
      });
      expect(getText(result)).toContain("Audio Track Created!");
      expect(getText(result)).toContain("t1");
      expect(getText(result)).toContain("My Project");
      expect(getText(result)).toContain("track.wav");
      expect(getText(result)).toContain("wav");
      expect(mockPrisma.audioTrack.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            projectId: "p1",
            name: "track.wav",
            fileFormat: "wav",
            sortOrder: 2,
          }),
        }),
      );
    });

    it("should return NOT_FOUND when project does not exist", async () => {
      mockPrisma.audioMixerProject.findFirst.mockResolvedValue(null);
      const handler = registry.handlers.get("audio_upload")!;
      const result = await handler({
        project_id: "nope",
        filename: "track.mp3",
        content_type: "audio/mp3",
      });
      expect(getText(result)).toContain("NOT_FOUND");
      expect(mockPrisma.audioTrack.create).not.toHaveBeenCalled();
    });

    it("should reject invalid audio format", async () => {
      mockPrisma.audioMixerProject.findFirst.mockResolvedValue({
        id: "p1",
        name: "My Project",
        userId,
      });
      const handler = registry.handlers.get("audio_upload")!;
      const result = await handler({
        project_id: "p1",
        filename: "track.exe",
        content_type: "audio/exe",
      });
      expect(getText(result)).toContain("VALIDATION_ERROR");
      expect(getText(result)).toContain("exe");
      expect(getText(result)).toContain("wav, mp3, webm, ogg, flac, aac, m4a");
      expect(mockPrisma.audioTrack.create).not.toHaveBeenCalled();
    });

    it("should extract format from content_type when filename has no extension", async () => {
      mockPrisma.audioMixerProject.findFirst.mockResolvedValue({
        id: "p1",
        name: "My Project",
        userId,
      });
      mockPrisma.audioTrack.count.mockResolvedValue(0);
      mockPrisma.audioTrack.create.mockResolvedValue({ id: "t2" });
      const handler = registry.handlers.get("audio_upload")!;
      const result = await handler({
        project_id: "p1",
        filename: "noextension",
        content_type: "audio/mp3",
      });
      expect(getText(result)).toContain("Audio Track Created!");
      expect(getText(result)).toContain("mp3");
    });

    it("should extract format from filename extension over content_type", async () => {
      mockPrisma.audioMixerProject.findFirst.mockResolvedValue({
        id: "p1",
        name: "My Project",
        userId,
      });
      mockPrisma.audioTrack.count.mockResolvedValue(0);
      mockPrisma.audioTrack.create.mockResolvedValue({ id: "t3" });
      const handler = registry.handlers.get("audio_upload")!;
      const result = await handler({
        project_id: "p1",
        filename: "song.ogg",
        content_type: "audio/wav",
      });
      expect(getText(result)).toContain("Audio Track Created!");
      expect(getText(result)).toContain("ogg");
    });

    it("should fall back to 'wav' when filename has no extension and content_type has no subtype", async () => {
      mockPrisma.audioMixerProject.findFirst.mockResolvedValue({
        id: "p1",
        name: "My Project",
        userId,
      });
      mockPrisma.audioTrack.count.mockResolvedValue(0);
      mockPrisma.audioTrack.create.mockResolvedValue({ id: "t5" });
      const handler = registry.handlers.get("audio_upload")!;
      const result = await handler({
        project_id: "p1",
        filename: "noextension",
        content_type: "audio",
      });
      expect(getText(result)).toContain("Audio Track Created!");
      expect(mockPrisma.audioTrack.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ fileFormat: "wav" }),
        }),
      );
    });

    it("should handle database error via safeToolCall", async () => {
      mockPrisma.audioMixerProject.findFirst.mockRejectedValue(
        new Error("Database connection failed"),
      );
      const handler = registry.handlers.get("audio_upload")!;
      const result = await handler({
        project_id: "p1",
        filename: "track.wav",
        content_type: "audio/wav",
      });
      expect(getText(result)).toContain("Error");
      expect(getText(result)).toContain("Database connection failed");
    });

    it("should use sortOrder based on existing track count", async () => {
      mockPrisma.audioMixerProject.findFirst.mockResolvedValue({
        id: "p1",
        name: "My Project",
        userId,
      });
      mockPrisma.audioTrack.count.mockResolvedValue(5);
      mockPrisma.audioTrack.create.mockResolvedValue({ id: "t4" });
      const handler = registry.handlers.get("audio_upload")!;
      await handler({
        project_id: "p1",
        filename: "track.flac",
        content_type: "audio/flac",
      });
      expect(mockPrisma.audioTrack.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ sortOrder: 5 }),
        }),
      );
    });
  });

  // ─── audio_get_track ────────────────────────────────────────────────

  describe("audio_get_track", () => {
    it("should return track details", async () => {
      mockPrisma.audioTrack.findUnique.mockResolvedValue({
        id: "t1",
        name: "track.wav",
        fileFormat: "wav",
        duration: 120,
        fileSizeBytes: 5000000,
        volume: 0.8,
        muted: false,
        solo: true,
        sortOrder: 0,
        storageType: "R2",
        createdAt: new Date("2024-06-15T12:00:00Z"),
        project: { id: "p1", name: "My Project", userId },
      });
      const handler = registry.handlers.get("audio_get_track")!;
      const result = await handler({ track_id: "t1" });
      expect(getText(result)).toContain("Audio Track");
      expect(getText(result)).toContain("t1");
      expect(getText(result)).toContain("track.wav");
      expect(getText(result)).toContain("My Project");
      expect(getText(result)).toContain("wav");
      expect(getText(result)).toContain("120s");
      expect(getText(result)).toContain("5000000 bytes");
      expect(getText(result)).toContain("0.8");
      expect(getText(result)).toContain("false");
      expect(getText(result)).toContain("true");
      expect(getText(result)).toContain("R2");
    });

    it("should return NOT_FOUND when track does not exist", async () => {
      mockPrisma.audioTrack.findUnique.mockResolvedValue(null);
      const handler = registry.handlers.get("audio_get_track")!;
      const result = await handler({ track_id: "nope" });
      expect(getText(result)).toContain("NOT_FOUND");
    });

    it("should return PERMISSION_DENIED when track belongs to another user", async () => {
      mockPrisma.audioTrack.findUnique.mockResolvedValue({
        id: "t1",
        name: "track.wav",
        fileFormat: "wav",
        duration: 60,
        fileSizeBytes: 1000,
        volume: 1,
        muted: false,
        solo: false,
        sortOrder: 0,
        storageType: "R2",
        createdAt: new Date(),
        project: { id: "p2", name: "Other Project", userId: "other-user-456" },
      });
      const handler = registry.handlers.get("audio_get_track")!;
      const result = await handler({ track_id: "t1" });
      expect(getText(result)).toContain("PERMISSION_DENIED");
    });
  });

  // ─── audio_list_projects ────────────────────────────────────────────

  describe("audio_list_projects", () => {
    it("should list user projects with track counts", async () => {
      mockPrisma.audioMixerProject.findMany.mockResolvedValue([
        {
          id: "p1",
          name: "Project A",
          _count: { tracks: 3 },
          updatedAt: new Date("2024-06-15T12:00:00Z"),
        },
        {
          id: "p2",
          name: "Project B",
          _count: { tracks: 0 },
          updatedAt: new Date("2024-06-14T12:00:00Z"),
        },
      ]);
      const handler = registry.handlers.get("audio_list_projects")!;
      const result = await handler({});
      expect(getText(result)).toContain("Your Audio Projects (2)");
      expect(getText(result)).toContain("Project A");
      expect(getText(result)).toContain("3 track(s)");
      expect(getText(result)).toContain("Project B");
    });

    it("should return empty message when no projects exist", async () => {
      mockPrisma.audioMixerProject.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("audio_list_projects")!;
      const result = await handler({});
      expect(getText(result)).toContain("No projects found");
      expect(getText(result)).toContain("audio_create_project");
    });
  });

  // ─── audio_create_project ───────────────────────────────────────────

  describe("audio_create_project", () => {
    it("should create a project", async () => {
      mockPrisma.audioMixerProject.create.mockResolvedValue({
        id: "p-new",
        name: "My New Mix",
        createdAt: new Date("2024-06-15T12:00:00Z"),
      });
      const handler = registry.handlers.get("audio_create_project")!;
      const result = await handler({ name: "My New Mix" });
      expect(getText(result)).toContain("Project Created!");
      expect(getText(result)).toContain("p-new");
      expect(getText(result)).toContain("My New Mix");
      expect(mockPrisma.audioMixerProject.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: "My New Mix", userId }),
        }),
      );
    });

    it("should create a project with description", async () => {
      mockPrisma.audioMixerProject.create.mockResolvedValue({
        id: "p-desc",
        name: "Podcast",
        createdAt: new Date(),
      });
      const handler = registry.handlers.get("audio_create_project")!;
      const result = await handler({
        name: "Podcast",
        description: "Weekly podcast",
      });
      expect(getText(result)).toContain("Project Created!");
      expect(mockPrisma.audioMixerProject.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ description: "Weekly podcast" }),
        }),
      );
    });
  });

  // ─── audio_delete_project ───────────────────────────────────────────

  describe("audio_delete_project", () => {
    it("should delete a project and its tracks", async () => {
      mockPrisma.audioMixerProject.findFirst.mockResolvedValue({
        id: "p1",
        name: "Old Project",
        userId,
      });
      mockPrisma.audioTrack.deleteMany.mockResolvedValue({ count: 3 });
      mockPrisma.audioMixerProject.delete.mockResolvedValue({ id: "p1" });
      const handler = registry.handlers.get("audio_delete_project")!;
      const result = await handler({ project_id: "p1" });
      expect(getText(result)).toContain("Project Deleted");
      expect(getText(result)).toContain("Old Project");
      expect(mockPrisma.audioTrack.deleteMany).toHaveBeenCalledWith({
        where: { projectId: "p1" },
      });
      expect(mockPrisma.audioMixerProject.delete).toHaveBeenCalledWith({
        where: { id: "p1" },
      });
    });

    it("should return NOT_FOUND for non-existent project", async () => {
      mockPrisma.audioMixerProject.findFirst.mockResolvedValue(null);
      const handler = registry.handlers.get("audio_delete_project")!;
      const result = await handler({ project_id: "nope" });
      expect(getText(result)).toContain("NOT_FOUND");
      expect(mockPrisma.audioMixerProject.delete).not.toHaveBeenCalled();
    });
  });

  // ─── audio_list_tracks ──────────────────────────────────────────────

  describe("audio_list_tracks", () => {
    it("should list tracks in a project", async () => {
      mockPrisma.audioMixerProject.findFirst.mockResolvedValue({
        id: "p1",
        name: "My Project",
        userId,
      });
      mockPrisma.audioTrack.findMany.mockResolvedValue([
        {
          id: "t1",
          name: "vocals.wav",
          fileFormat: "wav",
          duration: 120,
          volume: 1,
          muted: false,
          solo: false,
        },
        {
          id: "t2",
          name: "guitar.mp3",
          fileFormat: "mp3",
          duration: 90,
          volume: 0.8,
          muted: true,
          solo: false,
        },
      ]);
      const handler = registry.handlers.get("audio_list_tracks")!;
      const result = await handler({ project_id: "p1" });
      expect(getText(result)).toContain("Tracks in");
      expect(getText(result)).toContain("vocals.wav");
      expect(getText(result)).toContain("WAV");
      expect(getText(result)).toContain("guitar.mp3");
      expect(getText(result)).toContain("MP3");
    });

    it("should return empty message when no tracks exist", async () => {
      mockPrisma.audioMixerProject.findFirst.mockResolvedValue({
        id: "p1",
        name: "Empty Project",
        userId,
      });
      mockPrisma.audioTrack.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("audio_list_tracks")!;
      const result = await handler({ project_id: "p1" });
      expect(getText(result)).toContain("No tracks");
      expect(getText(result)).toContain("audio_upload");
    });

    it("should return NOT_FOUND for non-existent project", async () => {
      mockPrisma.audioMixerProject.findFirst.mockResolvedValue(null);
      const handler = registry.handlers.get("audio_list_tracks")!;
      const result = await handler({ project_id: "nope" });
      expect(getText(result)).toContain("NOT_FOUND");
    });
  });

  // ─── audio_delete_track ─────────────────────────────────────────────

  describe("audio_delete_track", () => {
    it("should delete a track", async () => {
      mockPrisma.audioTrack.findUnique.mockResolvedValue({
        id: "t1",
        name: "old.wav",
        project: { userId, name: "My Project" },
      });
      mockPrisma.audioTrack.delete.mockResolvedValue({ id: "t1" });
      const handler = registry.handlers.get("audio_delete_track")!;
      const result = await handler({ track_id: "t1" });
      expect(getText(result)).toContain("Track Deleted");
      expect(getText(result)).toContain("old.wav");
      expect(mockPrisma.audioTrack.delete).toHaveBeenCalledWith({
        where: { id: "t1" },
      });
    });

    it("should return NOT_FOUND for non-existent track", async () => {
      mockPrisma.audioTrack.findUnique.mockResolvedValue(null);
      const handler = registry.handlers.get("audio_delete_track")!;
      const result = await handler({ track_id: "nope" });
      expect(getText(result)).toContain("NOT_FOUND");
    });

    it("should return PERMISSION_DENIED for other user's track", async () => {
      mockPrisma.audioTrack.findUnique.mockResolvedValue({
        id: "t1",
        name: "track.wav",
        project: { userId: "other-user", name: "Other" },
      });
      const handler = registry.handlers.get("audio_delete_track")!;
      const result = await handler({ track_id: "t1" });
      expect(getText(result)).toContain("PERMISSION_DENIED");
      expect(mockPrisma.audioTrack.delete).not.toHaveBeenCalled();
    });
  });

  // ─── audio_update_track ─────────────────────────────────────────────

  describe("audio_update_track", () => {
    it("should update track volume", async () => {
      mockPrisma.audioTrack.findUnique.mockResolvedValue({
        id: "t1",
        project: { userId },
      });
      mockPrisma.audioTrack.update.mockResolvedValue({
        id: "t1",
        name: "track.wav",
        volume: 0.5,
        muted: false,
        solo: false,
      });
      const handler = registry.handlers.get("audio_update_track")!;
      const result = await handler({ track_id: "t1", volume: 0.5 });
      expect(getText(result)).toContain("Track Updated");
      expect(getText(result)).toContain("0.5");
      expect(mockPrisma.audioTrack.update).toHaveBeenCalledWith({
        where: { id: "t1" },
        data: { volume: 0.5 },
      });
    });

    it("should update multiple fields", async () => {
      mockPrisma.audioTrack.findUnique.mockResolvedValue({
        id: "t1",
        project: { userId },
      });
      mockPrisma.audioTrack.update.mockResolvedValue({
        id: "t1",
        name: "renamed.wav",
        volume: 1,
        muted: true,
        solo: false,
      });
      const handler = registry.handlers.get("audio_update_track")!;
      const result = await handler({
        track_id: "t1",
        name: "renamed.wav",
        muted: true,
      });
      expect(getText(result)).toContain("Track Updated");
      expect(getText(result)).toContain("renamed.wav");
      expect(mockPrisma.audioTrack.update).toHaveBeenCalledWith({
        where: { id: "t1" },
        data: { name: "renamed.wav", muted: true },
      });
    });

    it("should update solo field", async () => {
      mockPrisma.audioTrack.findUnique.mockResolvedValue({
        id: "t1",
        project: { userId },
      });
      mockPrisma.audioTrack.update.mockResolvedValue({
        id: "t1",
        name: "track.wav",
        volume: 1,
        muted: false,
        solo: true,
      });
      const handler = registry.handlers.get("audio_update_track")!;
      const result = await handler({ track_id: "t1", solo: true });
      expect(getText(result)).toContain("Track Updated");
      expect(mockPrisma.audioTrack.update).toHaveBeenCalledWith({
        where: { id: "t1" },
        data: { solo: true },
      });
    });

    it("should return error when no fields specified", async () => {
      mockPrisma.audioTrack.findUnique.mockResolvedValue({
        id: "t1",
        project: { userId },
      });
      const handler = registry.handlers.get("audio_update_track")!;
      const result = await handler({ track_id: "t1" });
      expect(getText(result)).toContain("No changes specified");
      expect(mockPrisma.audioTrack.update).not.toHaveBeenCalled();
    });

    it("should return NOT_FOUND for non-existent track", async () => {
      mockPrisma.audioTrack.findUnique.mockResolvedValue(null);
      const handler = registry.handlers.get("audio_update_track")!;
      const result = await handler({ track_id: "nope", volume: 0.5 });
      expect(getText(result)).toContain("NOT_FOUND");
    });

    it("should return PERMISSION_DENIED for other user's track", async () => {
      mockPrisma.audioTrack.findUnique.mockResolvedValue({
        id: "t1",
        project: { userId: "other-user" },
      });
      const handler = registry.handlers.get("audio_update_track")!;
      const result = await handler({ track_id: "t1", volume: 0.5 });
      expect(getText(result)).toContain("PERMISSION_DENIED");
    });
  });
});
