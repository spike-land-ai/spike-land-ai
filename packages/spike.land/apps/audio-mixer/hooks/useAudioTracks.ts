/**
 * useAudioTracks - Hook for managing audio tracks
 * Resolves #332
 */

"use client";

import { useCallback, useReducer, useRef } from "react";
import { createTrackNodes, generateWaveformData, loadAudioFile } from "../lib/audio-engine";
import type { AudioTrack, TrackAction } from "../types";

function generateId(): string {
  return `track-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function tracksReducer(state: AudioTrack[], action: TrackAction): AudioTrack[] {
  switch (action.type) {
    case "ADD_TRACK":
      return [
        ...state,
        {
          id: generateId(),
          name: "New Track",
          source: null,
          buffer: null,
          gainNode: null,
          volume: 0.8,
          pan: 0,
          muted: false,
          solo: false,
          isPlaying: false,
          duration: 0,
          currentTime: 0,
          waveformData: [],
          type: "file",
          delay: 0,
          position: 0,
          trimStart: 0,
          trimEnd: 0,
          ...action.payload,
        },
      ];
    case "REMOVE_TRACK":
      return state.filter((track) => track.id !== action.payload);
    case "UPDATE_TRACK":
      return state.map((track) =>
        track.id === action.payload.id ? { ...track, ...action.payload.updates } : track,
      );
    case "SET_VOLUME":
      return state.map((track) =>
        track.id === action.payload.id ? { ...track, volume: action.payload.volume } : track,
      );
    case "SET_PAN":
      return state.map((track) =>
        track.id === action.payload.id ? { ...track, pan: action.payload.pan } : track,
      );
    case "SET_DELAY":
      return state.map((track) =>
        track.id === action.payload.id
          ? {
              ...track,
              delay: Math.max(-5, Math.min(10, action.payload.delay)),
            }
          : track,
      );
    case "SET_POSITION":
      return state.map((track) =>
        track.id === action.payload.id
          ? { ...track, position: Math.max(0, action.payload.position) }
          : track,
      );
    case "SET_TRIM":
      return state.map((track) =>
        track.id === action.payload.id
          ? {
              ...track,
              // Allow negative trimStart for lead-in silence (up to -30s)
              trimStart: Math.max(-30, action.payload.trimStart),
              trimEnd: Math.min(track.duration || Infinity, action.payload.trimEnd),
            }
          : track,
      );
    case "TOGGLE_MUTE":
      return state.map((track) =>
        track.id === action.payload ? { ...track, muted: !track.muted } : track,
      );
    case "TOGGLE_SOLO":
      return state.map((track) =>
        track.id === action.payload ? { ...track, solo: !track.solo } : track,
      );
    case "PLAY_TRACK":
      return state.map((track) =>
        track.id === action.payload ? { ...track, isPlaying: true } : track,
      );
    case "STOP_TRACK":
      return state.map((track) =>
        track.id === action.payload ? { ...track, isPlaying: false, currentTime: 0 } : track,
      );
    case "REORDER_TRACKS": {
      const orderMap = new Map(action.payload.map((id, index) => [id, index]));
      return [...state].sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));
    }
    case "RESTORE_TRACKS":
      return action.payload.map((trackData) => ({
        id: trackData.id || generateId(),
        name: trackData.name || "Restored Track",
        source: null,
        buffer: trackData.buffer || null,
        gainNode: trackData.gainNode || null,
        volume: trackData.volume ?? 0.8,
        pan: trackData.pan ?? 0,
        muted: trackData.muted ?? false,
        solo: trackData.solo ?? false,
        isPlaying: false,
        duration: trackData.duration ?? 0,
        currentTime: 0,
        waveformData: trackData.waveformData ?? [],
        type: trackData.type ?? "file",
        file: trackData.file,
        delay: trackData.delay ?? 0,
        // Migration: use position if present, otherwise fall back to delay
        position: trackData.position ?? trackData.delay ?? 0,
        trimStart: trackData.trimStart ?? 0,
        trimEnd: trackData.trimEnd ?? 0,
      }));
    case "CLEAR_TRACKS":
      return [];
    default:
      return state;
  }
}

export function useAudioTracks() {
  const [tracks, dispatch] = useReducer(tracksReducer, []);
  const sourceRefs = useRef<Map<string, AudioBufferSourceNode>>(new Map());
  const activeGainRefs = useRef<Map<string, GainNode>>(new Map());
  const startTimeRefs = useRef<Map<string, number>>(new Map());
  const onAllEndedRef = useRef<(() => void) | null>(null);

  const addTrack = useCallback(
    async (
      file: File,
      context: AudioContext,
      masterGain: GainNode,
      opfsPath?: string,
    ): Promise<AudioTrack> => {
      const buffer = await loadAudioFile(context, file);
      const waveformData = generateWaveformData(buffer, 100);
      const { gainNode } = createTrackNodes(context, masterGain, buffer);

      // Generate ID upfront so we can return it
      const trackId = generateId();

      const track: Partial<AudioTrack> = {
        id: trackId,
        name: file.name.replace(/\.[^.]+$/, ""),
        buffer,
        gainNode,
        duration: buffer.duration,
        waveformData,
        type: "file",
        file,
        opfsPath,
        trimEnd: buffer.duration,
      };

      dispatch({ type: "ADD_TRACK", payload: track });

      return {
        id: trackId,
        source: null,
        volume: 0.8,
        pan: 0,
        muted: false,
        solo: false,
        isPlaying: false,
        currentTime: 0,
        delay: 0,
        position: 0,
        trimStart: 0,
        trimEnd: buffer.duration,
        ...track,
      } as AudioTrack;
    },
    [],
  );

  const addRecordedTrack = useCallback(
    async (
      buffer: AudioBuffer,
      context: AudioContext,
      masterGain: GainNode,
      name: string = "Recording",
      opfsPath?: string,
      position: number = 0,
    ): Promise<void> => {
      const waveformData = generateWaveformData(buffer, 100);
      const { gainNode } = createTrackNodes(context, masterGain, buffer);

      dispatch({
        type: "ADD_TRACK",
        payload: {
          name,
          buffer,
          gainNode,
          duration: buffer.duration,
          waveformData,
          type: "recording",
          opfsPath,
          trimEnd: buffer.duration,
          position,
        },
      });
    },
    [],
  );

  const removeTrack = useCallback((id: string) => {
    const source = sourceRefs.current.get(id);
    if (source) {
      try {
        source.stop();
      } catch {
        // Already stopped
      }
      sourceRefs.current.delete(id);
    }
    activeGainRefs.current.delete(id);
    startTimeRefs.current.delete(id);
    dispatch({ type: "REMOVE_TRACK", payload: id });
  }, []);

  const setVolume = useCallback(
    (id: string, volume: number) => {
      // Prefer the active playback gain node, fall back to the track's stored one
      const activeGain = activeGainRefs.current.get(id);
      if (activeGain) {
        activeGain.gain.value = volume;
      } else {
        const track = tracks.find((t) => t.id === id);
        if (track?.gainNode) {
          track.gainNode.gain.value = volume;
        }
      }
      dispatch({ type: "SET_VOLUME", payload: { id, volume } });
    },
    [tracks],
  );

  const toggleMute = useCallback(
    (id: string) => {
      const track = tracks.find((t) => t.id === id);
      if (track) {
        const gainNode = activeGainRefs.current.get(id) ?? track.gainNode;
        if (gainNode) {
          gainNode.gain.value = track.muted ? track.volume : 0;
        }
      }
      dispatch({ type: "TOGGLE_MUTE", payload: id });
    },
    [tracks],
  );

  const toggleSolo = useCallback(
    (id: string) => {
      dispatch({ type: "TOGGLE_SOLO", payload: id });

      // Immediately update active gain nodes for live solo changes
      // Compute the new solo state after the toggle
      const toggledTrack = tracks.find((t) => t.id === id);
      if (!toggledTrack) return;

      const newSoloValue = !toggledTrack.solo;
      const hasSoloAfter = tracks.some((t) => (t.id === id ? newSoloValue : t.solo));

      for (const track of tracks) {
        const gain = activeGainRefs.current.get(track.id);
        if (!gain) continue;

        const isSolo = track.id === id ? newSoloValue : track.solo;
        const isMuted = track.muted;

        if (hasSoloAfter) {
          gain.gain.value = isSolo && !isMuted ? track.volume : 0;
        } else {
          gain.gain.value = isMuted ? 0 : track.volume;
        }
      }
    },
    [tracks],
  );

  const setDelay = useCallback((id: string, delay: number) => {
    dispatch({ type: "SET_DELAY", payload: { id, delay } });
  }, []);

  const setPosition = useCallback((id: string, position: number) => {
    dispatch({ type: "SET_POSITION", payload: { id, position } });
  }, []);

  const setTrim = useCallback((id: string, trimStart: number, trimEnd: number) => {
    dispatch({ type: "SET_TRIM", payload: { id, trimStart, trimEnd } });
  }, []);

  const reorderTracks = useCallback((newOrder: string[]) => {
    dispatch({ type: "REORDER_TRACKS", payload: newOrder });
  }, []);

  const restoreTracks = useCallback((trackStates: Partial<AudioTrack>[]) => {
    dispatch({ type: "RESTORE_TRACKS", payload: trackStates });
  }, []);

  const playTrack = useCallback(
    (id: string, context: AudioContext, masterGain: GainNode, startFromTime: number = 0) => {
      const track = tracks.find((t) => t.id === id);
      if (!track?.buffer) return;

      // Stop existing playback
      const existingSource = sourceRefs.current.get(id);
      if (existingSource) {
        try {
          existingSource.stop();
        } catch {
          // Already stopped
        }
      }

      const source = context.createBufferSource();
      source.buffer = track.buffer;

      const gainNode = context.createGain();
      gainNode.gain.value = track.muted ? 0 : track.volume;

      source.connect(gainNode);
      gainNode.connect(masterGain);

      source.onended = () => {
        // Guard: if source was replaced, this is a stale callback
        if (sourceRefs.current.get(id) !== source) return;
        dispatch({ type: "STOP_TRACK", payload: id });
        sourceRefs.current.delete(id);
        activeGainRefs.current.delete(id);
        // When all sources have finished, fire the completion callback
        if (sourceRefs.current.size === 0 && onAllEndedRef.current) {
          onAllEndedRef.current();
          onAllEndedRef.current = null;
        }
      };

      const trackPosition = track.position ?? track.delay ?? 0;
      const effectiveTrimEnd = track.trimEnd > 0 ? track.trimEnd : track.duration;

      // Calculate relative start time
      // This is how far into the timeline play has started
      // vs where the track sits on the timeline
      const transform = startFromTime - trackPosition;

      // Check if the track has already finished playing at this point
      // If we start playing at time X, and the track ends before X, skip it
      const trackEnd =
        trackPosition +
        (effectiveTrimEnd - track.trimStart) +
        (track.trimStart < 0 ? Math.abs(track.trimStart) : 0);

      if (startFromTime >= trackEnd) {
        return;
      }

      // Handle playback scheduling
      if (transform < 0) {
        // Track starts in the future relative to the playhead
        const waitTime = Math.abs(transform);

        if (track.trimStart < 0) {
          // Negative trimStart (silence padding) logic
          const silenceDuration = Math.abs(track.trimStart);
          const totalPreDelay = waitTime + silenceDuration;

          source.start(context.currentTime + totalPreDelay, 0, effectiveTrimEnd);
        } else {
          // Normal start
          source.start(
            context.currentTime + waitTime,
            track.trimStart,
            effectiveTrimEnd - track.trimStart,
          );
        }
      } else {
        // Track should have already started, so we start mid-way
        // transform is positive here, meaning we are 'transform' seconds into the track

        if (track.trimStart < 0) {
          // Negative trimStart logic
          const silenceDuration = Math.abs(track.trimStart);

          if (transform < silenceDuration) {
            // We are still within the silence period
            const remainingSilence = silenceDuration - transform;
            source.start(context.currentTime + remainingSilence, 0, effectiveTrimEnd);
          } else {
            // We are past the silence period, into the audio
            const audioOffset = transform - silenceDuration;
            const duration = Math.max(0, effectiveTrimEnd - audioOffset);
            if (duration <= 0) return;
            source.start(context.currentTime, audioOffset, duration);
          }
        } else {
          // Normal start: we are `transform` seconds into the track
          // So we offset the buffer usage by `track.trimStart + transform`
          const startOffset = track.trimStart + transform;
          const duration = Math.max(0, effectiveTrimEnd - startOffset);
          if (duration <= 0) return;
          source.start(context.currentTime, startOffset, duration);
        }
      }

      sourceRefs.current.set(id, source);
      activeGainRefs.current.set(id, gainNode);
      startTimeRefs.current.set(id, context.currentTime);

      dispatch({ type: "PLAY_TRACK", payload: id });
    },
    [tracks],
  );

  const stopTrack = useCallback((id: string) => {
    const source = sourceRefs.current.get(id);
    if (source) {
      source.onended = null;
      try {
        source.stop();
      } catch {
        // Already stopped
      }
      sourceRefs.current.delete(id);
    }
    activeGainRefs.current.delete(id);
    startTimeRefs.current.delete(id);
    dispatch({ type: "STOP_TRACK", payload: id });
  }, []);

  const stopAllTracks = useCallback(() => {
    onAllEndedRef.current = null;
    tracks.forEach((track) => {
      stopTrack(track.id);
    });
  }, [tracks, stopTrack]);

  const playAllTracks = useCallback(
    (
      context: AudioContext,
      masterGain: GainNode,
      startFromTime: number = 0,
      onComplete?: () => void,
    ) => {
      onAllEndedRef.current = onComplete ?? null;
      const hasSolo = tracks.some((t) => t.solo);

      tracks.forEach((track) => {
        if (track.buffer) {
          const shouldPlay = hasSolo ? track.solo : !track.muted;
          if (shouldPlay) {
            playTrack(track.id, context, masterGain, startFromTime);
          }
        }
      });

      // If no tracks were actually started, fire completion immediately
      if (sourceRefs.current.size === 0 && onComplete) {
        onComplete();
        onAllEndedRef.current = null;
      }
    },
    [tracks, playTrack],
  );

  const playSoloTrack = useCallback(
    (
      id: string,
      context: AudioContext,
      masterGain: GainNode,
      startFromTime: number = 0,
      onComplete?: () => void,
    ) => {
      stopAllTracks();
      onAllEndedRef.current = onComplete ?? null;
      playTrack(id, context, masterGain, startFromTime);
      // If no sources were started (e.g. track already ended), fire completion immediately
      if (sourceRefs.current.size === 0 && onComplete) {
        onComplete();
        onAllEndedRef.current = null;
      }
    },
    [stopAllTracks, playTrack],
  );

  const clearTracks = useCallback(() => {
    stopAllTracks();
    sourceRefs.current.clear();
    activeGainRefs.current.clear();
    startTimeRefs.current.clear();
    dispatch({ type: "CLEAR_TRACKS" });
  }, [stopAllTracks]);

  return {
    tracks,
    addTrack,
    addRecordedTrack,
    removeTrack,
    setVolume,
    toggleMute,
    toggleSolo,
    setDelay,
    setPosition,
    setTrim,
    reorderTracks,
    restoreTracks,
    playTrack,
    playSoloTrack,
    stopTrack,
    playAllTracks,
    stopAllTracks,
    clearTracks,
  };
}
