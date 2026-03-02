/**
 * useAudioContext - Hook for managing Web Audio API context
 * Resolves #332
 */

"use client";

import { useCallback, useRef, useState } from "react";
import { createAnalyser, createAudioContext, createMasterGain } from "../lib/audio-engine";
import type { AudioContextState } from "../types";

export function useAudioContext() {
  const [state, setState] = useState<AudioContextState>({
    context: null,
    masterGain: null,
    analyser: null,
    isInitialized: false,
  });

  const contextRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const initialize = useCallback(async () => {
    if (contextRef.current) {
      return {
        context: contextRef.current,
        masterGain: masterGainRef.current!,
        analyser: analyserRef.current!,
      };
    }

    const context = createAudioContext();

    // Resume context if suspended (browser autoplay policy)
    if (context.state === "suspended") {
      await context.resume();
    }

    const masterGain = createMasterGain(context);
    const analyser = createAnalyser(context);
    masterGain.connect(analyser);

    contextRef.current = context;
    masterGainRef.current = masterGain;
    analyserRef.current = analyser;

    setState({
      context,
      masterGain,
      analyser,
      isInitialized: true,
    });

    return { context, masterGain, analyser };
  }, []);

  const setMasterVolume = useCallback((volume: number) => {
    if (masterGainRef.current) {
      masterGainRef.current.gain.value = Math.max(0, Math.min(1, volume));
    }
  }, []);

  const getAnalyserData = useCallback((): Uint8Array => {
    if (!analyserRef.current) {
      return new Uint8Array(0);
    }
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    return dataArray;
  }, []);

  const cleanup = useCallback(() => {
    if (contextRef.current) {
      contextRef.current.close();
      contextRef.current = null;
      masterGainRef.current = null;
      analyserRef.current = null;
      setState({
        context: null,
        masterGain: null,
        analyser: null,
        isInitialized: false,
      });
    }
  }, []);

  return {
    ...state,
    initialize,
    setMasterVolume,
    getAnalyserData,
    cleanup,
  };
}
