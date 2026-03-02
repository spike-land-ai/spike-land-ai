"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Mic, Play, Square, Trash2, Upload, Volume2, VolumeX } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";

interface Track {
  id: string;
  name: string;
  url: string;
  volume: number;
  isMuted: boolean;
  audioElement: HTMLAudioElement;
}

export default function MusicCreatorPage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tracksRef = useRef<Track[]>([]);

  // Keep tracksRef in sync with tracks state
  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Stop recording if active
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      }

      // Cleanup tracks
      tracksRef.current.forEach((track) => {
        track.audioElement.pause();
        URL.revokeObjectURL(track.url);
      });
    };
  }, []);

  // Helper to create a new track
  const addTrack = useCallback((name: string, blob: Blob | File) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.preload = "metadata";

    const newTrack: Track = {
      id: crypto.randomUUID(),
      name,
      url,
      volume: 1,
      isMuted: false,
      audioElement: audio,
    };

    setTracks((prev) => [...prev, newTrack]);
  }, []);

  // Handle file upload
  const handleFileUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        addTrack(file.name, file);
      }
      // Reset input
      if (event.target) event.target.value = "";
    },
    [addTrack],
  );

  // Playback Logic
  const playAll = useCallback(() => {
    tracksRef.current.forEach((track) => {
      track.audioElement.currentTime = 0; // Simple start from beginning
      if (!track.isMuted) {
        track.audioElement.play().catch((e) => console.error("Play error", e));
      }
    });
    setIsPlaying(true);
  }, []);

  const stopAll = useCallback(() => {
    tracksRef.current.forEach((track) => {
      track.audioElement.pause();
      track.audioElement.currentTime = 0;
    });
    setIsPlaying(false);
  }, []);

  // Recording Logic
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        addTrack(`Recording ${new Date().toLocaleTimeString()}`, blob);

        // Stop all tracks in the stream
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Play other tracks while recording?
      // User might want to listen while recording.
      // If we are vibe coding, yes, let's play if not already playing.
      if (!isPlaying && tracks.length > 0) {
        playAll();
      }

      recordingTimerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Could not access microphone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }

      // Stop playback if we started it
      if (isPlaying) {
        stopAll();
      }
    }
  };

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      stopAll();
    } else {
      playAll();
    }
  }, [isPlaying, playAll, stopAll]);

  // Track Controls
  const toggleMute = useCallback((id: string) => {
    const track = tracksRef.current.find((t) => t.id === id);
    if (track) {
      track.audioElement.muted = !track.isMuted;
    }

    setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, isMuted: !t.isMuted } : t)));
  }, []);

  const setVolume = useCallback((id: string, volume: number) => {
    const track = tracksRef.current.find((t) => t.id === id);
    if (track) {
      track.audioElement.volume = volume;
    }

    setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, volume } : t)));
  }, []);

  const removeTrack = useCallback((id: string) => {
    const trackToRemove = tracksRef.current.find((t) => t.id === id);
    if (trackToRemove) {
      trackToRemove.audioElement.pause();
      URL.revokeObjectURL(trackToRemove.url);
    }

    setTracks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Update loop for progress bar (optional, kept simple for now)
  // We can just rely on basic controls for this MVP.

  return (
    <div className="min-h-[calc(100dvh-3.5rem)] bg-zinc-950 text-white p-6 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="grid gap-6">
          {/* Global Controls */}
          <Card className="bg-white/5 border-white/10 backdrop-blur-sm overflow-hidden">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Mixer Controls
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <Button
                  size="lg"
                  onClick={togglePlay}
                  variant={isPlaying ? "destructive" : "default"}
                  className={`flex-1 sm:flex-none font-bold h-12 px-8 transition-all ${
                    !isPlaying &&
                    "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20"
                  }`}
                  aria-label={isPlaying ? "Stop" : "Play"}
                >
                  {isPlaying ? (
                    <Square className="fill-current h-5 w-5" />
                  ) : (
                    <Play className="fill-current h-5 w-5" />
                  )}
                  <span className="ml-2">{isPlaying ? "Stop" : "Play All"}</span>
                </Button>

                <Button
                  size="lg"
                  onClick={isRecording ? stopRecording : startRecording}
                  variant={isRecording ? "destructive" : "outline"}
                  className={`flex-1 sm:flex-none h-12 px-8 border-white/10 ${
                    isRecording
                      ? "animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.4)]"
                      : "hover:bg-white/5"
                  }`}
                  aria-label={isRecording ? "Stop Recording" : "Record"}
                >
                  <Mic className={isRecording ? "fill-current h-5 w-5" : "h-5 w-5"} />
                  <span className="ml-2">{isRecording ? `${recordingTime}s` : "Record"}</span>
                </Button>
              </div>

              <div className="flex gap-4 w-full sm:w-auto">
                <input
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                />
                <Button
                  variant="secondary"
                  className="w-full sm:w-auto bg-zinc-800 hover:bg-zinc-700 text-white border-white/5"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="mr-2 h-4 w-4 opacity-70" />
                  Add Track
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Tracks List */}
          <div className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-500 px-1">
              Active Tracks ({tracks.length})
            </h2>

            {tracks.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-white/5 rounded-3xl text-zinc-500 gap-4">
                <div className="h-16 w-16 rounded-full bg-white/5 flex items-center justify-center">
                  <VolumeX className="h-8 w-8 text-zinc-700" />
                </div>
                <div className="text-center">
                  <p className="font-medium text-zinc-400">Empty Studio</p>
                  <p className="text-sm text-zinc-600 mt-1">
                    Upload or record audio to get started.
                  </p>
                </div>
              </div>
            )}

            {tracks.map((track) => (
              <Card
                key={track.id}
                className="bg-white/[0.03] border-white/5 hover:bg-white/[0.05] transition-colors group"
              >
                <CardContent className="p-4 flex flex-col sm:flex-row items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <Volume2 className="h-5 w-5 text-emerald-500" />
                  </div>

                  <div className="flex-1 min-w-0 text-center sm:text-left">
                    <h3 className="font-bold text-sm truncate" title={track.name}>
                      {track.name}
                    </h3>
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-black mt-0.5">
                      Track Asset
                    </p>
                  </div>

                  <div className="flex items-center gap-6 w-full sm:w-auto bg-black/20 p-2 rounded-xl border border-white/5">
                    {/* Volume Control */}
                    <div className="flex items-center gap-3 flex-1 sm:w-32">
                      <Volume2 className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                      <Slider
                        value={[track.volume]}
                        max={1}
                        step={0.01}
                        onValueChange={(vals) => setVolume(track.id, vals[0] ?? 1)}
                        className="w-full"
                        aria-label={`Volume for ${track.name}`}
                      />
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-8 w-8 transition-colors ${
                          track.isMuted
                            ? "text-red-400 bg-red-500/10"
                            : "text-zinc-400 hover:text-white"
                        }`}
                        onClick={() => toggleMute(track.id)}
                        aria-label={track.isMuted ? "Unmute" : "Mute"}
                      >
                        {track.isMuted ? (
                          <VolumeX className="h-4 w-4" />
                        ) : (
                          <Volume2 className="h-4 w-4" />
                        )}
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removeTrack(track.id)}
                        aria-label={`Delete ${track.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
