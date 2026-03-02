"use client";

import { AudioTrackRow } from "./AudioTrackRow";
import type { AudioTrack } from "./AudioTrackRow";
import { useState } from "react";

interface AudioMixerPanelProps {
  tracks: AudioTrack[];
  masterVolume: number;
}

export function AudioMixerPanel({ tracks, masterVolume }: AudioMixerPanelProps) {
  const [trackStates, setTrackStates] = useState<AudioTrack[]>(tracks);

  const handleMuteToggle = (id: string) => {
    setTrackStates((prev) => prev.map((t) => (t.id === id ? { ...t, isMuted: !t.isMuted } : t)));
  };

  const handleSoloToggle = (id: string) => {
    setTrackStates((prev) => prev.map((t) => (t.id === id ? { ...t, isSolo: !t.isSolo } : t)));
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-100 uppercase tracking-wider">Mixer</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">Master</span>
          <div className="flex items-center gap-1.5">
            <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full"
                style={{ width: `${masterVolume}%` }}
                role="progressbar"
                aria-valuenow={masterVolume}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Master volume: ${masterVolume}%`}
              />
            </div>
            <span className="text-xs font-mono text-zinc-300 w-8 text-right">{masterVolume}</span>
          </div>
        </div>
      </div>

      <div className="p-3 space-y-2">
        {trackStates.map((track) => (
          <AudioTrackRow
            key={track.id}
            track={track}
            onMuteToggle={handleMuteToggle}
            onSoloToggle={handleSoloToggle}
          />
        ))}
      </div>
    </div>
  );
}
