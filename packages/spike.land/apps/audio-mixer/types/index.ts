/**
 * Audio Mixer Types
 * Resolves #332
 */

export interface AudioTrack {
  id: string;
  name: string;
  source: AudioBufferSourceNode | null;
  buffer: AudioBuffer | null;
  gainNode: GainNode | null;
  volume: number;
  pan: number;
  muted: boolean;
  solo: boolean;
  isPlaying: boolean;
  duration: number;
  currentTime: number;
  waveformData: number[];
  type: "file" | "recording";
  file?: File | undefined;
  /** @deprecated Use position instead. Track delay/offset in seconds (-5 to +10) */
  delay: number;
  /** Track position on timeline in seconds (start time). Replaces delay. */
  position: number;
  /** Trim start point in seconds from beginning */
  trimStart: number;
  /** Trim end point in seconds from beginning (defaults to duration) */
  trimEnd: number;
  /** OPFS path where audio data is stored for persistence */
  opfsPath?: string | undefined;
}

export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  mediaRecorder: MediaRecorder | null;
  chunks: Blob[];
}

export interface AudioContextState {
  context: AudioContext | null;
  masterGain: GainNode | null;
  analyser: AnalyserNode | null;
  isInitialized: boolean;
}

export interface WaveformOptions {
  width: number;
  height: number;
  barWidth: number;
  barGap: number;
  barColor: string;
  progressColor: string;
}

export type TrackAction =
  | { type: "ADD_TRACK"; payload: Partial<AudioTrack>; }
  | { type: "REMOVE_TRACK"; payload: string; }
  | {
    type: "UPDATE_TRACK";
    payload: { id: string; updates: Partial<AudioTrack>; };
  }
  | { type: "SET_VOLUME"; payload: { id: string; volume: number; }; }
  | { type: "SET_PAN"; payload: { id: string; pan: number; }; }
  | { type: "SET_DELAY"; payload: { id: string; delay: number; }; }
  | { type: "SET_POSITION"; payload: { id: string; position: number; }; }
  | {
    type: "SET_TRIM";
    payload: { id: string; trimStart: number; trimEnd: number; };
  }
  | { type: "TOGGLE_MUTE"; payload: string; }
  | { type: "TOGGLE_SOLO"; payload: string; }
  | { type: "PLAY_TRACK"; payload: string; }
  | { type: "STOP_TRACK"; payload: string; }
  | { type: "REORDER_TRACKS"; payload: string[]; }
  | { type: "RESTORE_TRACKS"; payload: Partial<AudioTrack>[]; }
  | { type: "CLEAR_TRACKS"; };

export type SnapGrid = 0.1 | 0.25 | 0.5 | 1;

export interface TimelineState {
  /** Pixels per second (default: 50, range: 10-200) */
  zoom: number;
  /** Horizontal scroll offset in pixels */
  scrollOffset: number;
  /** Current playhead time in seconds */
  playheadTime: number;
  /** Currently selected track ID */
  selectedTrackId: string | null;
  /** Whether snap to grid is enabled */
  snapEnabled: boolean;
  /** Snap grid interval in seconds */
  snapGrid: SnapGrid;
}
