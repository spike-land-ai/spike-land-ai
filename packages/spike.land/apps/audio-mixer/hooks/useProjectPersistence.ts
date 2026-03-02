/**
 * useProjectPersistence Hook - Auto-save and restore project state
 * Resolves #332
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AudioTrack } from "../types";

const AUTO_SAVE_DEBOUNCE_MS = 2000;
const LOCAL_STORAGE_PROJECT_KEY = "audio-mixer-project-state";
const LOCAL_STORAGE_PROJECT_ID_KEY = "audio-mixer-project-id";

/**
 * Serialized track state for persistence
 */
interface SerializedTrack {
  id: string;
  name: string;
  volume: number;
  pan: number;
  muted: boolean;
  solo: boolean;
  /** @deprecated Use position instead */
  delay: number;
  /** Track position on timeline in seconds */
  position: number;
  trimStart: number;
  trimEnd: number;
  duration: number;
  type: "file" | "recording";
  waveformData: number[];
  /** OPFS path where audio data is stored */
  opfsPath?: string | undefined;
}

/**
 * Serialized project state for persistence
 */
interface SerializedProjectState {
  id: string;
  name: string;
  masterVolume: number;
  tracks: SerializedTrack[];
  updatedAt: string;
}

function generateProjectId(): string {
  return `project-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function serializeTrack(track: AudioTrack): SerializedTrack {
  return {
    id: track.id,
    name: track.name,
    volume: track.volume,
    pan: track.pan,
    muted: track.muted,
    solo: track.solo,
    delay: track.delay,
    position: track.position ?? track.delay ?? 0,
    trimStart: track.trimStart,
    trimEnd: track.trimEnd,
    duration: track.duration,
    type: track.type,
    waveformData: track.waveformData,
    opfsPath: track.opfsPath,
  };
}

interface ProjectPersistenceState {
  projectId: string;
  isLoading: boolean;
  isSaving: boolean;
  lastSavedAt: Date | null;
  hasUnsavedChanges: boolean;
}

interface ProjectPersistenceActions {
  saveNow: () => void;
  loadProject: () => SerializedProjectState | null;
  clearProject: () => void;
  createNewProject: () => string;
}

export function useProjectPersistence(
  tracks: AudioTrack[],
  masterVolume: number,
): [ProjectPersistenceState, ProjectPersistenceActions] {
  const [projectId, setProjectId] = useState<string>(() => {
    if (typeof window === "undefined") return generateProjectId();
    return localStorage.getItem(LOCAL_STORAGE_PROJECT_ID_KEY) || generateProjectId();
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedStateRef = useRef<string>("");

  // Serialize current state
  const serializeState = useCallback((): SerializedProjectState => {
    return {
      id: projectId,
      name: "Audio Mixer Project",
      masterVolume,
      tracks: tracks.map(serializeTrack),
      updatedAt: new Date().toISOString(),
    };
  }, [projectId, tracks, masterVolume]);

  // Save to localStorage
  const saveToStorage = useCallback((state: SerializedProjectState) => {
    try {
      const stateJson = JSON.stringify(state);

      // Only save if state has changed
      if (stateJson === lastSavedStateRef.current) {
        return;
      }

      setIsSaving(true);
      localStorage.setItem(LOCAL_STORAGE_PROJECT_KEY, stateJson);
      localStorage.setItem(LOCAL_STORAGE_PROJECT_ID_KEY, state.id);
      lastSavedStateRef.current = stateJson;
      setLastSavedAt(new Date());
      setHasUnsavedChanges(false);
      setIsSaving(false);
    } catch (error) {
      console.error("Failed to save project:", error);
      setIsSaving(false);
    }
  }, []);

  // Manual save
  const saveNow = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    const state = serializeState();
    saveToStorage(state);
  }, [serializeState, saveToStorage]);

  // Load project from storage
  const loadProject = useCallback((): SerializedProjectState | null => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_PROJECT_KEY);
      if (stored) {
        return JSON.parse(stored) as SerializedProjectState;
      }
    } catch (error) {
      console.error("Failed to load project:", error);
    }
    return null;
  }, []);

  // Clear project from storage
  const clearProject = useCallback(() => {
    localStorage.removeItem(LOCAL_STORAGE_PROJECT_KEY);
    localStorage.removeItem(LOCAL_STORAGE_PROJECT_ID_KEY);
    lastSavedStateRef.current = "";
    setLastSavedAt(null);
    setHasUnsavedChanges(false);
  }, []);

  // Create new project
  const createNewProject = useCallback(() => {
    const newId = generateProjectId();
    setProjectId(newId);
    clearProject();
    return newId;
  }, [clearProject]);

  // Auto-save on state changes (debounced)
  useEffect(() => {
    // Skip auto-save during initial loading
    if (isLoading) return;

    // Skip if no tracks (don't save empty state)
    if (tracks.length === 0) return;

    setHasUnsavedChanges(true);

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      const state = serializeState();
      saveToStorage(state);
    }, AUTO_SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [tracks, masterVolume, isLoading, serializeState, saveToStorage]);

  // Mark as loaded after initial mount
  useEffect(() => {
    // Small delay to allow initial state to settle
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  // Persist project ID to localStorage when it changes
  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_PROJECT_ID_KEY, projectId);
  }, [projectId]);

  return [
    {
      projectId,
      isLoading,
      isSaving,
      lastSavedAt,
      hasUnsavedChanges,
    },
    {
      saveNow,
      loadProject,
      clearProject,
      createNewProject,
    },
  ];
}
