/**
 * useProjectManager Hook - Multi-project orchestration
 * Manages project switching, creation, deletion, and cross-project track copying
 */

"use client";

import { useCallback, useState } from "react";
import type { AudioTrack } from "../types";
import type { AudioProject } from "../types/storage";
import { createTrackNodes, generateWaveformData } from "../lib/audio-engine";

interface UseProjectManagerReturn {
  projects: AudioProject[];
  currentProjectId: string;
  isLoading: boolean;
  loadProjectList: () => Promise<void>;
  switchProject: (projectId: string) => Promise<void>;
  createProject: (name: string) => Promise<string>;
  deleteProject: (projectId: string) => Promise<void>;
  renameProject: (projectId: string, name: string) => Promise<void>;
  copyTrackToCurrentProject: (
    sourceProjectId: string,
    trackId: string,
    position: number,
  ) => Promise<void>;
}

interface UseProjectManagerDeps {
  audioStorage: {
    checkSupport: () => Promise<boolean>;
    saveProject: (project: AudioProject) => Promise<{ success: boolean }>;
    loadProject: (
      projectId: string,
    ) => Promise<{ success: boolean; data?: AudioProject | undefined }>;
    listProjects: () => Promise<{
      success: boolean;
      data?: AudioProject[] | undefined;
    }>;
    deleteProject: (projectId: string) => Promise<{ success: boolean }>;
    createProject: (name: string) => Promise<{ success: boolean; data?: AudioProject | undefined }>;
    loadTrackByPath: (
      opfsPath: string,
    ) => Promise<{ success: boolean; data?: Uint8Array | undefined }>;
    saveTrackToPath: (opfsPath: string, data: Uint8Array) => Promise<{ success: boolean }>;
  };
  persistenceState: {
    projectId: string;
  };
  persistenceActions: {
    saveNow: () => void;
    createNewProject: () => string;
  };
  trackManager: {
    tracks: AudioTrack[];
    stopAllTracks: () => void;
    clearTracks: () => void;
    restoreTracks: (tracks: Partial<AudioTrack>[]) => void;
    addRecordedTrack: (
      buffer: AudioBuffer,
      context: AudioContext,
      masterGain: GainNode,
      name?: string,
      opfsPath?: string,
      position?: number,
    ) => Promise<void>;
  };
  audioContext: {
    initialize: () => Promise<{
      context: AudioContext;
      masterGain: GainNode;
    }>;
  };
  timeline: {
    stopPlayheadAnimation: () => void;
    setPlayheadTime: (time: number) => void;
  };
  setMasterVolume: (volume: number) => void;
  setIsPlaying: (playing: boolean) => void;
}

export function useProjectManager(deps: UseProjectManagerDeps): UseProjectManagerReturn {
  const {
    audioStorage,
    persistenceState,
    persistenceActions,
    trackManager,
    audioContext,
    timeline,
    setMasterVolume,
    setIsPlaying,
  } = deps;

  const [projects, setProjects] = useState<AudioProject[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadProjectList = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await audioStorage.listProjects();
      if (result.success && result.data) {
        setProjects(result.data);
      }
    } finally {
      setIsLoading(false);
    }
  }, [audioStorage]);

  const switchProject = useCallback(
    async (projectId: string) => {
      if (projectId === persistenceState.projectId) return;

      setIsLoading(true);
      try {
        // 1. Save current project to localStorage
        persistenceActions.saveNow();

        // 2. Save current project metadata to OPFS
        const now = new Date().toISOString();
        const currentProject: AudioProject = {
          id: persistenceState.projectId,
          name: "Audio Mixer Project",
          tracks: trackManager.tracks.map((t, i) => ({
            id: t.id,
            name: t.name,
            format: t.type === "recording" ? "webm" : "audio",
            duration: t.duration,
            sizeBytes: 0,
            storageLocation: "opfs" as const,
            opfsPath: t.opfsPath,
            volume: t.volume,
            muted: t.muted,
            solo: t.solo,
            delay: t.delay,
            trimStart: t.trimStart,
            trimEnd: t.trimEnd,
            order: i,
            createdAt: now,
          })),
          masterVolume: 0.8,
          createdAt: now,
          updatedAt: now,
        };
        await audioStorage.saveProject(currentProject);

        // 3. Stop playback
        trackManager.stopAllTracks();
        timeline.stopPlayheadAnimation();
        setIsPlaying(false);

        // 4. Clear current tracks
        trackManager.clearTracks();

        // 5. Load target project from OPFS
        const loadResult = await audioStorage.loadProject(projectId);
        if (!loadResult.success || !loadResult.data) {
          setIsLoading(false);
          return;
        }

        const targetProject = loadResult.data;

        // 6. Initialize audio context for decoding
        const { context, masterGain } = await audioContext.initialize();

        // 7. Decode each track's audio
        const restoredTracks: Partial<AudioTrack>[] = await Promise.all(
          targetProject.tracks.map(async (savedTrack) => {
            let buffer: AudioBuffer | null = null;
            let gainNode: GainNode | null = null;

            if (savedTrack.opfsPath) {
              try {
                const result = await audioStorage.loadTrackByPath(savedTrack.opfsPath);
                if (result.success && result.data) {
                  const arrayBuffer = result.data.buffer.slice(
                    result.data.byteOffset,
                    result.data.byteOffset + result.data.byteLength,
                  ) as ArrayBuffer;
                  buffer = await context.decodeAudioData(arrayBuffer);
                  const nodes = createTrackNodes(context, masterGain, buffer);
                  gainNode = nodes.gainNode;
                  gainNode.gain.value = savedTrack.muted ? 0 : savedTrack.volume;
                }
              } catch (error) {
                console.warn(`Failed to load audio for track ${savedTrack.name}:`, error);
              }
            }

            return {
              id: savedTrack.id,
              name: savedTrack.name,
              volume: savedTrack.volume,
              pan: 0,
              muted: savedTrack.muted,
              solo: savedTrack.solo,
              delay: savedTrack.delay,
              position: savedTrack.delay ?? 0,
              trimStart: savedTrack.trimStart,
              trimEnd: savedTrack.trimEnd,
              duration: savedTrack.duration,
              type: "file" as const,
              waveformData: buffer ? generateWaveformData(buffer, 100) : [],
              opfsPath: savedTrack.opfsPath,
              buffer,
              gainNode,
            };
          }),
        );

        // 8. Restore tracks
        trackManager.restoreTracks(restoredTracks);

        // 9. Update UI state
        timeline.setPlayheadTime(0);
        setMasterVolume(targetProject.masterVolume);

        // Update localStorage to point to new project
        localStorage.setItem("audio-mixer-project-id", projectId);
        localStorage.removeItem("audio-mixer-project-state");
      } finally {
        setIsLoading(false);
      }
    },
    [
      audioStorage,
      persistenceState.projectId,
      persistenceActions,
      trackManager,
      audioContext,
      timeline,
      setMasterVolume,
      setIsPlaying,
    ],
  );

  const createProject = useCallback(
    async (name: string): Promise<string> => {
      const result = await audioStorage.createProject(name);
      if (result.success && result.data) {
        await loadProjectList();
        return result.data.id;
      }
      throw new Error("Failed to create project");
    },
    [audioStorage, loadProjectList],
  );

  const deleteProject = useCallback(
    async (projectId: string) => {
      if (projectId === persistenceState.projectId) return;
      await audioStorage.deleteProject(projectId);
      await loadProjectList();
    },
    [audioStorage, persistenceState.projectId, loadProjectList],
  );

  const renameProject = useCallback(
    async (projectId: string, name: string) => {
      const loadResult = await audioStorage.loadProject(projectId);
      if (loadResult.success && loadResult.data) {
        const updated = {
          ...loadResult.data,
          name,
          updatedAt: new Date().toISOString(),
        };
        await audioStorage.saveProject(updated);
        await loadProjectList();
      }
    },
    [audioStorage, loadProjectList],
  );

  const copyTrackToCurrentProject = useCallback(
    async (sourceProjectId: string, trackId: string, position: number) => {
      // 1. Load source project metadata
      const loadResult = await audioStorage.loadProject(sourceProjectId);
      if (!loadResult.success || !loadResult.data) return;

      // 2. Find the track
      const savedTrack = loadResult.data.tracks.find((t) => t.id === trackId);
      if (!savedTrack?.opfsPath) return;

      // 3. Load audio data
      const audioResult = await audioStorage.loadTrackByPath(savedTrack.opfsPath);
      if (!audioResult.success || !audioResult.data) return;

      // 4. Save to new OPFS path under current project
      const newOpfsPath = `audio-mixer/projects/${persistenceState.projectId}/tracks/${Date.now()}-${savedTrack.name.replace(
        /\s+/g,
        "-",
      )}`;
      await audioStorage.saveTrackToPath(newOpfsPath, audioResult.data);

      // 5. Decode and add to current project
      const { context, masterGain } = await audioContext.initialize();
      const arrayBuffer = audioResult.data.buffer.slice(
        audioResult.data.byteOffset,
        audioResult.data.byteOffset + audioResult.data.byteLength,
      ) as ArrayBuffer;
      const buffer = await context.decodeAudioData(arrayBuffer);

      await trackManager.addRecordedTrack(
        buffer,
        context,
        masterGain,
        savedTrack.name,
        newOpfsPath,
        position,
      );
    },
    [audioStorage, persistenceState.projectId, audioContext, trackManager],
  );

  return {
    projects,
    currentProjectId: persistenceState.projectId,
    isLoading,
    loadProjectList,
    switchProject,
    createProject,
    deleteProject,
    renameProject,
    copyTrackToCurrentProject,
  };
}
