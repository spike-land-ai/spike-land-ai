/**
 * Audio Storage Types
 * Resolves #332
 */

/**
 * Storage location for audio files
 */
type StorageLocation = "opfs" | "r2";

/**
 * A saved audio track reference
 */
export interface SavedTrack {
  id: string;
  name: string;
  format: string;
  duration: number;
  sizeBytes: number;
  storageLocation: StorageLocation;
  opfsPath?: string | undefined;
  r2Key?: string | undefined;
  r2Url?: string | undefined;
  volume: number;
  muted: boolean;
  solo: boolean;
  /** Track delay/offset in seconds */
  delay: number;
  /** Trim start point in seconds */
  trimStart: number;
  /** Trim end point in seconds */
  trimEnd: number;
  /** Display order of the track */
  order: number;
  createdAt: string;
}

/**
 * An audio project containing multiple tracks
 */
export interface AudioProject {
  id: string;
  name: string;
  description?: string | undefined;
  tracks: SavedTrack[];
  masterVolume: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Result of a storage operation
 */
export interface StorageResult<T = void> {
  success: boolean;
  data?: T | undefined;
  error?: string | undefined;
}

/**
 * Options for saving a track
 */
export interface SaveTrackOptions {
  projectId: string;
  name: string;
  format: string;
  duration: number;
  volume?: number;
  muted?: boolean;
  solo?: boolean;
}
