/**
 * useAudioStorage Hook - OPFS-based audio file storage
 * Resolves #332
 */

"use client";

import { useCallback } from "react";
import type { AudioProject, SavedTrack, SaveTrackOptions, StorageResult } from "../types/storage";

// Base path for audio mixer files in OPFS
const AUDIO_MIXER_BASE_PATH = "audio-mixer";

/**
 * Generate a unique ID for tracks/projects
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Get OPFS path for a track
 */
function getTrackPath(projectId: string, trackId: string, format: string): string {
  return `${AUDIO_MIXER_BASE_PATH}/projects/${projectId}/tracks/${trackId}.${format}`;
}

/**
 * Get OPFS path for project metadata
 */
function getProjectMetadataPath(projectId: string): string {
  return `${AUDIO_MIXER_BASE_PATH}/projects/${projectId}/metadata.json`;
}

/**
 * Check if OPFS is available in the browser
 */
async function isOPFSAvailable(): Promise<boolean> {
  try {
    if (typeof navigator === "undefined" || !navigator.storage) {
      return false;
    }
    await navigator.storage.getDirectory();
    return true;
  } catch {
    return false;
  }
}

/**
 * Get or create a directory handle at the given path
 */
async function getDirectoryHandle(
  path: string,
  create = false,
): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  const parts = path.split("/").filter(Boolean);

  let current = root;
  for (const part of parts) {
    current = await current.getDirectoryHandle(part, { create });
  }
  return current;
}

/**
 * Get a file handle at the given path
 */
async function getFileHandle(path: string, create = false): Promise<FileSystemFileHandle> {
  const parts = path.split("/").filter(Boolean);
  const fileName = parts.pop();
  if (!fileName) {
    throw new Error("Invalid file path");
  }

  const dirPath = parts.join("/");
  const dir = await getDirectoryHandle(dirPath, create);
  return dir.getFileHandle(fileName, { create });
}

/**
 * Write data to a file in OPFS
 */
async function writeFile(path: string, data: Uint8Array | string): Promise<void> {
  const handle = await getFileHandle(path, true);
  const writable = await handle.createWritable();
  // Convert Uint8Array to ArrayBuffer for FileSystemWriteChunkType compatibility
  const writeData: FileSystemWriteChunkType =
    typeof data === "string"
      ? data
      : (data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer);
  await writable.write(writeData);
  await writable.close();
}

/**
 * Read data from a file in OPFS
 */
async function readFile(path: string): Promise<Uint8Array> {
  const handle = await getFileHandle(path, false);
  const file = await handle.getFile();
  const buffer = await file.arrayBuffer();
  return new Uint8Array(buffer);
}

/**
 * Read text from a file in OPFS
 */
async function readTextFile(path: string): Promise<string> {
  const handle = await getFileHandle(path, false);
  const file = await handle.getFile();
  return file.text();
}

/**
 * Delete a file from OPFS
 */
async function deleteFile(path: string): Promise<void> {
  const parts = path.split("/").filter(Boolean);
  const fileName = parts.pop();
  if (!fileName) {
    throw new Error("Invalid file path");
  }

  const dirPath = parts.join("/");
  const dir = await getDirectoryHandle(dirPath, false);
  await dir.removeEntry(fileName);
}

/**
 * Delete a directory recursively from OPFS
 */
async function deleteDirectory(path: string): Promise<void> {
  const parts = path.split("/").filter(Boolean);
  const dirName = parts.pop();
  if (!dirName) {
    throw new Error("Invalid directory path");
  }

  const parentPath = parts.join("/");
  if (parentPath) {
    const parent = await getDirectoryHandle(parentPath, false);
    await parent.removeEntry(dirName, { recursive: true });
  } else {
    const root = await navigator.storage.getDirectory();
    await root.removeEntry(dirName, { recursive: true });
  }
}

/**
 * List all directories in OPFS at a given path
 */
async function listDirectories(path: string): Promise<string[]> {
  try {
    const dir = await getDirectoryHandle(path, false);
    const entries: string[] = [];
    // Use type assertion for entries() method which exists in File System Access API
    const dirWithEntries = dir as FileSystemDirectoryHandle & {
      entries(): AsyncIterable<[string, FileSystemHandle]>;
    };
    for await (const [name, handle] of dirWithEntries.entries()) {
      if (handle.kind === "directory") {
        entries.push(name);
      }
    }
    return entries;
  } catch {
    return [];
  }
}

/**
 * Hook for managing audio storage in OPFS
 */
export function useAudioStorage() {
  /**
   * Check if OPFS is supported
   */
  const checkSupport = useCallback(async (): Promise<boolean> => {
    return isOPFSAvailable();
  }, []);

  /**
   * Save an audio track to OPFS
   */
  const saveTrack = useCallback(
    async (
      audioData: Uint8Array,
      options: SaveTrackOptions,
    ): Promise<StorageResult<SavedTrack>> => {
      try {
        const trackId = generateId();
        const trackPath = getTrackPath(options.projectId, trackId, options.format);

        // Write the audio file
        await writeFile(trackPath, audioData);

        const savedTrack: SavedTrack = {
          id: trackId,
          name: options.name,
          format: options.format,
          duration: options.duration,
          sizeBytes: audioData.length,
          storageLocation: "opfs",
          opfsPath: trackPath,
          volume: options.volume ?? 1.0,
          muted: options.muted ?? false,
          solo: options.solo ?? false,
          delay: 0,
          trimStart: 0,
          trimEnd: options.duration,
          order: 0,
          createdAt: new Date().toISOString(),
        };

        return { success: true, data: savedTrack };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to save track",
        };
      }
    },
    [],
  );

  /**
   * Load an audio track from OPFS
   */
  const loadTrack = useCallback(async (track: SavedTrack): Promise<StorageResult<Uint8Array>> => {
    try {
      if (!track.opfsPath) {
        return { success: false, error: "Track has no OPFS path" };
      }

      const data = await readFile(track.opfsPath);
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to load track",
      };
    }
  }, []);

  /**
   * Delete a track from OPFS
   */
  const deleteTrack = useCallback(async (track: SavedTrack): Promise<StorageResult> => {
    try {
      if (!track.opfsPath) {
        return { success: false, error: "Track has no OPFS path" };
      }

      await deleteFile(track.opfsPath);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete track",
      };
    }
  }, []);

  /**
   * Load audio data directly from an OPFS path
   */
  const loadTrackByPath = useCallback(
    async (opfsPath: string): Promise<StorageResult<Uint8Array>> => {
      try {
        const data = await readFile(opfsPath);
        return { success: true, data };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to load track from path",
        };
      }
    },
    [],
  );

  /**
   * Save audio data directly to an OPFS path
   */
  const saveTrackToPath = useCallback(
    async (opfsPath: string, audioData: Uint8Array): Promise<StorageResult> => {
      try {
        await writeFile(opfsPath, audioData);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to save track to path",
        };
      }
    },
    [],
  );

  /**
   * Save project metadata to OPFS
   */
  const saveProject = useCallback(async (project: AudioProject): Promise<StorageResult> => {
    try {
      const metadataPath = getProjectMetadataPath(project.id);

      // Write metadata as JSON
      const metadata = JSON.stringify(project, null, 2);
      await writeFile(metadataPath, metadata);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to save project",
      };
    }
  }, []);

  /**
   * Load project metadata from OPFS
   */
  const loadProject = useCallback(
    async (projectId: string): Promise<StorageResult<AudioProject>> => {
      try {
        const metadataPath = getProjectMetadataPath(projectId);
        const data = await readTextFile(metadataPath);
        const project = JSON.parse(data) as AudioProject;

        return { success: true, data: project };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to load project",
        };
      }
    },
    [],
  );

  /**
   * List all projects from OPFS
   */
  const listProjects = useCallback(async (): Promise<StorageResult<AudioProject[]>> => {
    try {
      const projectDirs = await listDirectories(`${AUDIO_MIXER_BASE_PATH}/projects`);

      const projects: AudioProject[] = [];
      for (const projectId of projectDirs) {
        try {
          const metadataPath = getProjectMetadataPath(projectId);
          const data = await readTextFile(metadataPath);
          const project = JSON.parse(data) as AudioProject;
          projects.push(project);
        } catch {
          // Skip corrupted metadata files
          console.warn(`Failed to load project metadata for ${projectId}`);
        }
      }

      // Sort by updatedAt descending
      projects.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

      return { success: true, data: projects };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to list projects",
      };
    }
  }, []);

  /**
   * Delete a project and all its tracks from OPFS
   */
  const deleteProject = useCallback(async (projectId: string): Promise<StorageResult> => {
    try {
      const projectPath = `${AUDIO_MIXER_BASE_PATH}/projects/${projectId}`;
      await deleteDirectory(projectPath);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete project",
      };
    }
  }, []);

  /**
   * Create a new empty project
   */
  const createProject = useCallback(
    async (name: string, description?: string): Promise<StorageResult<AudioProject>> => {
      try {
        const now = new Date().toISOString();
        const project: AudioProject = {
          id: generateId(),
          name,
          description,
          tracks: [],
          masterVolume: 0.8,
          createdAt: now,
          updatedAt: now,
        };

        const saveResult = await saveProject(project);
        if (!saveResult.success) {
          return { success: false, error: saveResult.error };
        }

        return { success: true, data: project };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to create project",
        };
      }
    },
    [saveProject],
  );

  return {
    checkSupport,
    saveTrack,
    loadTrack,
    loadTrackByPath,
    saveTrackToPath,
    deleteTrack,
    saveProject,
    loadProject,
    listProjects,
    deleteProject,
    createProject,
  };
}
