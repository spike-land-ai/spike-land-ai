/**
 * AudioMixer Component - Main mixer interface
 * Resolves #332
 */

"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  Check,
  ChevronDown,
  Circle,
  Download,
  FolderPlus,
  HelpCircle,
  Loader2,
  Music,
  Pause,
  Play,
  Plus,
  SkipBack,
  SkipForward,
  Square,
  Trash2,
  Volume2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  useAudioContext,
  useAudioRecording,
  useAudioStorage,
  useAudioTracks,
  useProjectManager,
  useProjectPersistence,
  useTimeline,
} from "../hooks";
import { blobToAudioBuffer, mixTracksToBlob } from "../lib/audio-engine";
import { KeyboardShortcutsPanel, ShortcutToast } from "./KeyboardShortcutsPanel";
import { RecordingPanel } from "./RecordingPanel";
import { SplashScreen } from "./SplashScreen";
import { Timeline } from "./Timeline";

export function AudioMixer() {
  const [hasUserGesture, setHasUserGesture] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [masterVolume, setMasterVolume] = useState(0.8);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [shortcutToast, setShortcutToast] = useState<string | null>(null);
  const [soloPreviewTrackId, setSoloPreviewTrackId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const recordingStartTimeRef = useRef<number>(0);
  const seekCounterRef = useRef<number>(0);

  const audioContext = useAudioContext();
  const recording = useAudioRecording();
  const trackManager = useAudioTracks();
  const audioStorage = useAudioStorage();
  const timeline = useTimeline();

  // Scrub audio ref for playing snippets
  const scrubSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Persistence
  const [persistenceState, persistenceActions] = useProjectPersistence(
    trackManager.tracks,
    masterVolume,
  );

  // Project manager
  const projectManager = useProjectManager({
    audioStorage,
    persistenceState,
    persistenceActions,
    trackManager,
    audioContext,
    timeline,
    setMasterVolume,
    setIsPlaying,
  });

  // Show toast and auto-hide
  const showToast = useCallback((message: string) => {
    setShortcutToast(message);
    setTimeout(() => setShortcutToast(null), 1000);
  }, []);

  // Handle splash screen click
  const handleStart = useCallback(() => {
    setHasUserGesture(true);
  }, []);

  // Load saved project on mount
  useEffect(() => {
    if (!hasUserGesture) return;

    const loadSavedProject = async () => {
      const savedProject = persistenceActions.loadProject();
      if (!savedProject || savedProject.tracks.length === 0) return;

      // Restore master volume
      setMasterVolume(savedProject.masterVolume);

      // Check if OPFS is supported
      const opfsSupported = await audioStorage.checkSupport();

      // Initialize audio context for decoding
      const { context, masterGain } = await audioContext.initialize();
      setIsInitialized(true);

      // Restore tracks with audio data from OPFS
      const restoredTracks = await Promise.all(
        savedProject.tracks.map(async (track) => {
          let buffer: AudioBuffer | null = null;

          // Try to load audio from OPFS if path exists
          if (opfsSupported && track.opfsPath) {
            try {
              const result = await audioStorage.loadTrackByPath(track.opfsPath);
              if (result.success && result.data) {
                // Decode the audio data - slice to get proper ArrayBuffer
                const arrayBuffer = result.data.buffer.slice(
                  result.data.byteOffset,
                  result.data.byteOffset + result.data.byteLength,
                ) as ArrayBuffer;
                buffer = await context.decodeAudioData(arrayBuffer);
              }
            } catch (error) {
              console.warn(`Failed to load audio for track ${track.name}:`, error);
            }
          }

          return {
            id: track.id,
            name: track.name,
            volume: track.volume,
            pan: track.pan,
            muted: track.muted,
            solo: track.solo,
            delay: track.delay,
            // Migration: use position if present, otherwise fall back to delay
            position: track.position ?? track.delay ?? 0,
            trimStart: track.trimStart,
            trimEnd: track.trimEnd,
            duration: track.duration,
            type: track.type,
            waveformData: track.waveformData,
            opfsPath: track.opfsPath,
            buffer,
            gainNode: buffer
              ? (() => {
                  const gainNode = context.createGain();
                  gainNode.gain.value = track.muted ? 0 : track.volume;
                  gainNode.connect(masterGain);
                  return gainNode;
                })()
              : null,
          };
        }),
      );

      trackManager.restoreTracks(restoredTracks);
    };

    loadSavedProject();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Only run once on mount after user gesture. audioContext, trackManager, setIsInitialized, and setMasterVolume are stable refs from hooks.
  }, [hasUserGesture]);

  // Initialize audio context on first interaction
  const handleInitialize = useCallback(async () => {
    if (!isInitialized) {
      await audioContext.initialize();
      setIsInitialized(true);
    }
  }, [isInitialized, audioContext]);

  // Update master volume
  useEffect(() => {
    if (audioContext.isInitialized) {
      audioContext.setMasterVolume(masterVolume);
    }
  }, [masterVolume, audioContext]);

  // Handle file upload
  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files?.length) return;

      await handleInitialize();

      const { context, masterGain } = await audioContext.initialize();
      const opfsSupported = await audioStorage.checkSupport();

      for (const file of files) {
        if (file.type.startsWith("audio/")) {
          let opfsPath: string | undefined;

          // Save audio to OPFS first for persistence
          if (opfsSupported) {
            try {
              const arrayBuffer = await file.arrayBuffer();
              opfsPath = `audio-mixer/projects/${persistenceState.projectId}/tracks/${Date.now()}-${file.name}`;
              await audioStorage.saveTrackToPath(opfsPath, new Uint8Array(arrayBuffer));
            } catch (error) {
              console.warn("Failed to save track to OPFS:", error);
              opfsPath = undefined;
            }
          }

          // Add track with OPFS path
          await trackManager.addTrack(file, context, masterGain, opfsPath);
        }
      }

      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [handleInitialize, audioContext, trackManager, audioStorage, persistenceState.projectId],
  );

  // Handle recording
  const handleStartRecording = useCallback(async () => {
    await handleInitialize();
    recordingStartTimeRef.current = timeline.state.playheadTime;
    return recording.startRecording();
  }, [handleInitialize, recording, timeline.state.playheadTime]);

  const handleStopRecording = useCallback(async () => {
    const { context, masterGain } = await audioContext.initialize();
    const blob = await recording.stopRecording();

    if (blob) {
      const buffer = await blobToAudioBuffer(context, blob);
      const recordingNumber = trackManager.tracks.filter((t) => t.type === "recording").length + 1;
      const recordingName = `Recording ${recordingNumber}`;

      // Save recording to OPFS for persistence
      let opfsPath: string | undefined;
      const opfsSupported = await audioStorage.checkSupport();
      if (opfsSupported) {
        try {
          const arrayBuffer = await blob.arrayBuffer();
          opfsPath = `audio-mixer/projects/${persistenceState.projectId}/recordings/${Date.now()}-${recordingName.replace(
            /\s+/g,
            "-",
          )}.webm`;
          await audioStorage.saveTrackToPath(opfsPath, new Uint8Array(arrayBuffer));
        } catch (error) {
          console.warn("Failed to save recording to OPFS:", error);
          opfsPath = undefined;
        }
      }

      await trackManager.addRecordedTrack(
        buffer,
        context,
        masterGain,
        recordingName,
        opfsPath,
        recordingStartTimeRef.current,
      );
    }
  }, [audioContext, recording, trackManager, audioStorage, persistenceState.projectId]);

  // Play all tracks
  const handlePlayAll = useCallback(async () => {
    setSoloPreviewTrackId(null);
    const { context, masterGain } = await audioContext.initialize();
    trackManager.playAllTracks(context, masterGain, timeline.state.playheadTime, () => {
      // All tracks finished — stop playback state
      setIsPlaying(false);
      timeline.stopPlayheadAnimation();
    });
    setIsPlaying(true);
    // Start playhead animation from current position, synced to AudioContext clock
    timeline.startPlayheadAnimation(timeline.state.playheadTime, context);
  }, [audioContext, trackManager, timeline]);

  // Stop all tracks
  const handleStopAll = useCallback(() => {
    trackManager.stopAllTracks();
    setIsPlaying(false);
    timeline.stopPlayheadAnimation();
  }, [trackManager, timeline]);

  // Toggle play/pause
  const handleTogglePlayPause = useCallback(async () => {
    if (isPlaying) {
      handleStopAll();
      showToast("⏸ Paused");
    } else {
      await handlePlayAll();
      showToast("▶ Playing");
    }
  }, [isPlaying, handleStopAll, handlePlayAll, showToast]);

  // Handle playhead seek
  const handlePlayheadSeek = useCallback(
    (time: number) => {
      timeline.setPlayheadTime(time);
      // If playing, restart from new position
      if (isPlaying) {
        trackManager.stopAllTracks();
        const seekId = ++seekCounterRef.current;
        audioContext.initialize().then(({ context, masterGain }) => {
          // Abandon stale seeks from rapid scrubbing
          if (seekCounterRef.current !== seekId) return;
          trackManager.playAllTracks(context, masterGain, time, () => {
            setIsPlaying(false);
            timeline.stopPlayheadAnimation();
          });
          timeline.startPlayheadAnimation(time, context);
        });
      }
    },
    [timeline, isPlaying, trackManager, audioContext],
  );

  // Handle scrub audio feedback
  const handleScrubAudio = useCallback(
    async (time: number) => {
      // Stop previous scrub snippet
      if (scrubSourceRef.current) {
        try {
          scrubSourceRef.current.stop();
        } catch {
          // Already stopped
        }
        scrubSourceRef.current = null;
      }

      const { context, masterGain } = await audioContext.initialize();

      // Play a short snippet from each track at the scrub position
      const hasSolo = trackManager.tracks.some((t) => t.solo);

      trackManager.tracks.forEach((track) => {
        if (!track.buffer || track.muted) return;
        if (hasSolo && !track.solo) return;

        const trackPosition = track.position ?? track.delay ?? 0;
        const effectiveTrimEnd = track.trimEnd > 0 ? track.trimEnd : track.duration;

        // Position within track's timeline
        const timelinePosition = time - trackPosition;

        // Calculate actual buffer offset, accounting for negative trimStart (silence)
        let bufferOffset: number;
        if (track.trimStart < 0) {
          const silenceDuration = Math.abs(track.trimStart);
          // During silence period, don't play anything
          if (timelinePosition < silenceDuration) {
            return; // In silence region, nothing to scrub
          }
          bufferOffset = timelinePosition - silenceDuration;
        } else {
          bufferOffset = track.trimStart + timelinePosition;
        }

        // Only play if within valid buffer bounds
        if (bufferOffset >= 0 && bufferOffset < effectiveTrimEnd) {
          const source = context.createBufferSource();
          source.buffer = track.buffer;

          const gainNode = context.createGain();
          gainNode.gain.value = track.volume * 0.5; // Reduce volume for scrub
          source.connect(gainNode);
          gainNode.connect(masterGain);

          // Play 50ms snippet
          source.start(0, bufferOffset, 0.05);
          scrubSourceRef.current = source;
        }
      });
    },
    [audioContext, trackManager.tracks],
  );

  // Solo preview — click a track block to play only that track
  const handleSoloPreview = useCallback(
    async (trackId: string) => {
      const track = trackManager.tracks.find((t) => t.id === trackId);
      if (!track?.buffer) return;

      // Stop any current playback
      if (isPlaying) {
        trackManager.stopAllTracks();
        timeline.stopPlayheadAnimation();
      }

      const { context, masterGain } = await audioContext.initialize();

      trackManager.playSoloTrack(trackId, context, masterGain, timeline.state.playheadTime, () => {
        setIsPlaying(false);
        setSoloPreviewTrackId(null);
        timeline.stopPlayheadAnimation();
      });

      setIsPlaying(true);
      setSoloPreviewTrackId(trackId);
      timeline.startPlayheadAnimation(timeline.state.playheadTime, context);
    },
    [trackManager, isPlaying, audioContext, timeline],
  );

  // Export mix
  const handleExport = useCallback(async () => {
    if (trackManager.tracks.length === 0) return;

    setIsExporting(true);
    showToast("📦 Exporting...");

    try {
      const { context } = await audioContext.initialize();
      const maxDuration = Math.max(...trackManager.tracks.map((t) => t.duration));
      const blob = await mixTracksToBlob(context, trackManager.tracks, maxDuration);

      // Download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mix-${Date.now()}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast("✓ Export complete");
    } catch (error) {
      console.error("Export failed:", error);
      showToast("✗ Export failed");
    } finally {
      setIsExporting(false);
    }
  }, [audioContext, trackManager, showToast]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!hasUserGesture) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const key = e.key.toLowerCase();
      const isMeta = e.metaKey || e.ctrlKey;

      // Toggle shortcuts panel
      if (key === "?" || (key === "/" && e.shiftKey)) {
        e.preventDefault();
        setShowShortcuts((prev) => !prev);
        return;
      }

      // Close shortcuts panel or deselect
      if (key === "escape") {
        if (showShortcuts) {
          setShowShortcuts(false);
        } else {
          timeline.setSelectedTrackId(null);
          showToast("Deselected");
        }
        return;
      }

      // Playback controls
      if (key === " ") {
        e.preventDefault();
        handleTogglePlayPause();
        return;
      }

      if (key === "s" && !isMeta) {
        e.preventDefault();
        handleStopAll();
        showToast("⏹ Stopped");
        return;
      }

      // Seek controls
      if (key === "home") {
        e.preventDefault();
        handlePlayheadSeek(0);
        showToast("⏮ Start");
        return;
      }

      if (key === "end") {
        e.preventDefault();
        const maxTime = Math.max(
          ...trackManager.tracks.map((t) => {
            const effectiveTrimEnd = t.trimEnd > 0 ? t.trimEnd : t.duration;
            return (t.position ?? t.delay ?? 0) + effectiveTrimEnd - t.trimStart;
          }),
          0,
        );
        handlePlayheadSeek(maxTime);
        showToast("⏭ End");
        return;
      }

      if (key === "arrowleft" && !isMeta) {
        e.preventDefault();
        const delta = e.shiftKey ? 5 : 1;
        const newTime = Math.max(0, timeline.state.playheadTime - delta);
        handlePlayheadSeek(newTime);
        showToast(`⏪ -${delta}s`);
        return;
      }

      if (key === "arrowright" && !isMeta) {
        e.preventDefault();
        const delta = e.shiftKey ? 5 : 1;
        handlePlayheadSeek(timeline.state.playheadTime + delta);
        showToast(`⏩ +${delta}s`);
        return;
      }

      // Track selection
      if (key === "arrowup") {
        e.preventDefault();
        const tracks = trackManager.tracks;
        if (tracks.length === 0) return;
        const currentIndex = timeline.state.selectedTrackId
          ? tracks.findIndex((t) => t.id === timeline.state.selectedTrackId)
          : tracks.length;
        const newIndex = Math.max(0, currentIndex - 1);
        const nextTrack = tracks[newIndex];
        if (nextTrack) {
          timeline.setSelectedTrackId(nextTrack.id);
          showToast(`Track ${newIndex + 1}`);
        }
        return;
      }

      if (key === "arrowdown") {
        e.preventDefault();
        const tracks = trackManager.tracks;
        if (tracks.length === 0) return;
        const currentIndex = timeline.state.selectedTrackId
          ? tracks.findIndex((t) => t.id === timeline.state.selectedTrackId)
          : -1;
        const newIndex = Math.min(tracks.length - 1, currentIndex + 1);
        const nextTrack = tracks[newIndex];
        if (nextTrack) {
          timeline.setSelectedTrackId(nextTrack.id);
          showToast(`Track ${newIndex + 1}`);
        }
        return;
      }

      // Track controls (require selected track)
      const selectedTrack = timeline.state.selectedTrackId
        ? trackManager.tracks.find((t) => t.id === timeline.state.selectedTrackId)
        : null;

      if (key === "m" && !isMeta) {
        e.preventDefault();
        if (selectedTrack) {
          trackManager.toggleMute(selectedTrack.id);
          showToast(selectedTrack.muted ? "🔊 Unmuted" : "🔇 Muted");
        }
        return;
      }

      if (key === "o" && !isMeta) {
        e.preventDefault();
        if (selectedTrack) {
          trackManager.toggleSolo(selectedTrack.id);
          showToast(selectedTrack.solo ? "Solo off" : "🎧 Solo");
        }
        return;
      }

      if (key === "delete" || key === "backspace") {
        e.preventDefault();
        if (selectedTrack) {
          trackManager.removeTrack(selectedTrack.id);
          timeline.setSelectedTrackId(null);
          showToast("🗑 Deleted");
        }
        return;
      }

      // Volume controls
      if (key === "[") {
        e.preventDefault();
        if (e.shiftKey) {
          // Master volume
          const newVolume = Math.max(0, masterVolume - 0.1);
          setMasterVolume(newVolume);
          showToast(`Master ${Math.round(newVolume * 100)}%`);
        } else if (selectedTrack) {
          const newVolume = Math.max(0, selectedTrack.volume - 0.1);
          trackManager.setVolume(selectedTrack.id, newVolume);
          showToast(`Volume ${Math.round(newVolume * 100)}%`);
        }
        return;
      }

      if (key === "]") {
        e.preventDefault();
        if (e.shiftKey) {
          // Master volume
          const newVolume = Math.min(1, masterVolume + 0.1);
          setMasterVolume(newVolume);
          showToast(`Master ${Math.round(newVolume * 100)}%`);
        } else if (selectedTrack) {
          const newVolume = Math.min(1, selectedTrack.volume + 0.1);
          trackManager.setVolume(selectedTrack.id, newVolume);
          showToast(`Volume ${Math.round(newVolume * 100)}%`);
        }
        return;
      }

      // Zoom controls
      if (key === "=" || key === "+") {
        e.preventDefault();
        timeline.setZoom(Math.min(200, timeline.state.zoom * 1.25));
        showToast("🔍 Zoom in");
        return;
      }

      if (key === "-") {
        e.preventDefault();
        timeline.setZoom(Math.max(10, timeline.state.zoom / 1.25));
        showToast("🔍 Zoom out");
        return;
      }

      if (key === "0" && !isMeta) {
        e.preventDefault();
        timeline.setZoom(50);
        showToast("🔍 Reset zoom");
        return;
      }

      // Snap toggle
      if (key === "g") {
        e.preventDefault();
        timeline.setSnapEnabled(!timeline.state.snapEnabled);
        showToast(timeline.state.snapEnabled ? "Grid snap off" : "Grid snap on");
        return;
      }

      // Recording
      if (key === "r" && !isMeta) {
        e.preventDefault();
        if (recording.isRecording) {
          handleStopRecording();
          showToast("⏹ Recording stopped");
        } else {
          handleStartRecording();
          showToast("⏺ Recording...");
        }
        return;
      }

      // File operations
      if (key === "o" && isMeta) {
        e.preventDefault();
        fileInputRef.current?.click();
        return;
      }

      if (key === "e" && isMeta) {
        e.preventDefault();
        handleExport();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    hasUserGesture,
    showShortcuts,
    isPlaying,
    masterVolume,
    timeline,
    trackManager,
    recording,
    handleTogglePlayPause,
    handleStopAll,
    handlePlayheadSeek,
    handleStartRecording,
    handleStopRecording,
    handleExport,
    showToast,
  ]);

  // Show splash screen if no user gesture
  if (!hasUserGesture) {
    return <SplashScreen onStart={handleStart} />;
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="h-screen flex flex-col overflow-hidden bg-gradient-page text-white">
        {/* Top Bar - 36px */}
        <div className="h-9 flex-shrink-0 flex items-center justify-between px-4 bg-black/40 border-b border-white/5">
          <div className="flex items-center gap-3">
            {/* Project Dropdown */}
            <DropdownMenu
              onOpenChange={(open) => {
                if (open) projectManager.loadProjectList();
              }}
            >
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 text-sm font-bold text-white/80 hover:text-white transition-colors">
                  {projectManager.projects.find((p) => p.id === projectManager.currentProjectId)
                    ?.name ?? "Audio Mixer"}
                  <ChevronDown className="w-3 h-3 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                {/* Active project */}
                {projectManager.projects
                  .filter((p) => p.id === projectManager.currentProjectId)
                  .map((project) => (
                    <DropdownMenuItem
                      key={project.id}
                      className="bg-primary/10 font-medium"
                      disabled
                    >
                      <Music className="w-4 h-4 mr-2 text-primary" />
                      {project.name}
                      <Badge variant="outline" className="ml-auto text-[9px] h-4 px-1.5">
                        Active
                      </Badge>
                    </DropdownMenuItem>
                  ))}

                {/* Other projects */}
                {projectManager.projects
                  .filter((p) => p.id !== projectManager.currentProjectId)
                  .map((project) => (
                    <DropdownMenuSub key={project.id}>
                      <DropdownMenuSubTrigger className="flex items-center">
                        <Music className="w-4 h-4 mr-2 opacity-60" />
                        <span className="flex-1 truncate">{project.name}</span>
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="w-56">
                        <DropdownMenuItem
                          onClick={() => {
                            if (recording.isRecording) {
                              showToast("Stop recording first");
                              return;
                            }
                            projectManager.switchProject(project.id);
                          }}
                        >
                          <Play className="w-4 h-4 mr-2" />
                          Switch to Project
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {/* Track list for cross-project drag */}
                        {project.tracks.length > 0 && (
                          <>
                            <div className="px-2 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                              Tracks (drag to timeline)
                            </div>
                            {project.tracks.map((track) => (
                              <DropdownMenuItem
                                key={track.id}
                                className="text-xs cursor-grab"
                                draggable
                                onDragStart={(e) => {
                                  e.dataTransfer.setData(
                                    "application/x-audio-track",
                                    JSON.stringify({
                                      sourceProjectId: project.id,
                                      trackId: track.id,
                                      trackName: track.name,
                                    }),
                                  );
                                  e.dataTransfer.effectAllowed = "copy";
                                }}
                              >
                                <Music className="w-3 h-3 mr-2 opacity-40" />
                                <span className="truncate">{track.name}</span>
                                <span className="ml-auto text-[10px] text-muted-foreground font-mono">
                                  {Math.floor(track.duration / 60)}:
                                  {String(Math.floor(track.duration % 60)).padStart(2, "0")}
                                </span>
                              </DropdownMenuItem>
                            ))}
                            <DropdownMenuSeparator />
                          </>
                        )}
                        <DropdownMenuItem
                          onClick={() => projectManager.deleteProject(project.id)}
                          className="text-red-400 focus:text-red-400"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete Project
                        </DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  ))}

                {projectManager.projects.length > 0 && <DropdownMenuSeparator />}

                {/* New Project */}
                <DropdownMenuItem
                  onClick={async () => {
                    if (recording.isRecording) {
                      showToast("Stop recording first");
                      return;
                    }
                    try {
                      const newId = await projectManager.createProject(
                        `Project ${projectManager.projects.length + 1}`,
                      );
                      await projectManager.switchProject(newId);
                      showToast("New project created");
                    } catch {
                      showToast("Failed to create project");
                    }
                  }}
                >
                  <FolderPlus className="w-4 h-4 mr-2" />
                  New Project
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {/* Save Status */}
            {persistenceState.isSaving && (
              <Badge
                variant="outline"
                className="flex items-center gap-1 h-5 px-2 text-[10px] glass-1 border-white/10 text-gray-400"
              >
                <Loader2 className="w-3 h-3 animate-spin" />
                Saving
              </Badge>
            )}
            {!persistenceState.isSaving &&
              persistenceState.lastSavedAt &&
              !persistenceState.hasUnsavedChanges && (
                <Badge
                  variant="outline"
                  className="flex items-center gap-1 h-5 px-2 text-[10px] glass-1 border-white/10 text-green-400"
                >
                  <Check className="w-3 h-3" />
                  Saved
                </Badge>
              )}
            {!persistenceState.isSaving && persistenceState.hasUnsavedChanges && (
              <Badge
                variant="outline"
                className="h-5 px-2 text-[10px] glass-1 border-white/10 text-yellow-400"
              >
                Unsaved
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-4">
            {/* Master Volume */}
            <div className="flex items-center gap-2 bg-white/5 px-3 py-1 rounded-lg">
              <Volume2 className="w-4 h-4 text-primary" />
              <div className="w-20">
                <Slider
                  min={0}
                  max={1}
                  step={0.01}
                  value={[masterVolume]}
                  onValueChange={(vals) => setMasterVolume(vals[0] ?? 0.8)}
                  aria-label="Master volume"
                />
              </div>
              <span className="text-[10px] font-mono text-primary/80 w-8">
                {Math.round(masterVolume * 100)}%
              </span>
            </div>
            {/* Recording Indicator */}
            {recording.isRecording && (
              <div className="flex items-center gap-2 text-red-400">
                <Circle className="w-3 h-3 fill-current animate-pulse" />
                <span className="text-xs font-mono">REC</span>
              </div>
            )}
            {/* Shortcuts */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setShowShortcuts(true)}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-all"
                  aria-label="Keyboard Shortcuts"
                >
                  <HelpCircle className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Keyboard Shortcuts (?)</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Transport Bar - 40px */}
        <div className="h-10 flex-shrink-0 flex items-center gap-3 px-4 bg-black/20 border-b border-white/5">
          {/* Transport Controls */}
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handlePlayheadSeek(0)}
                  disabled={trackManager.tracks.length === 0}
                  className="h-8 w-8 p-0 rounded-lg hover:bg-white/10"
                >
                  <SkipBack className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Go to Start (Home)</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant={isPlaying ? "default" : "ghost"}
                  onClick={handleTogglePlayPause}
                  disabled={trackManager.tracks.length === 0}
                  className={cn(
                    "h-8 w-8 p-0 rounded-lg",
                    isPlaying ? "bg-emerald-600 hover:bg-emerald-700" : "hover:bg-white/10",
                  )}
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {isPlaying ? "Pause (Space)" : "Play (Space)"}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleStopAll}
                  disabled={trackManager.tracks.length === 0}
                  className="h-8 w-8 p-0 rounded-lg hover:bg-white/10"
                >
                  <Square className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Stop (S)</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    const maxTime = Math.max(
                      ...trackManager.tracks.map((t) => {
                        const effectiveTrimEnd = t.trimEnd > 0 ? t.trimEnd : t.duration;
                        return (t.position ?? t.delay ?? 0) + effectiveTrimEnd - t.trimStart;
                      }),
                      0,
                    );
                    handlePlayheadSeek(maxTime);
                  }}
                  disabled={trackManager.tracks.length === 0}
                  className="h-8 w-8 p-0 rounded-lg hover:bg-white/10"
                >
                  <SkipForward className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Go to End (End)</TooltipContent>
            </Tooltip>
          </div>

          {/* Playhead Time */}
          <div className="px-3 py-1 bg-black/40 rounded-lg font-mono text-sm text-primary">
            {Math.floor(timeline.state.playheadTime / 60)}:
            {String(Math.floor(timeline.state.playheadTime % 60)).padStart(2, "0")}.
            {String(Math.floor((timeline.state.playheadTime % 1) * 10)).padStart(1, "0")}
          </div>

          {/* Solo Preview Indicator */}
          {soloPreviewTrackId && (
            <Badge
              variant="outline"
              className="h-5 px-2 text-[10px] glass-1 border-yellow-400/30 text-yellow-400"
            >
              Solo: {trackManager.tracks.find((t) => t.id === soloPreviewTrackId)?.name ?? "Track"}
            </Badge>
          )}

          <div className="flex-1" />

          {/* Import Button */}
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            multiple
            onChange={handleFileUpload}
            className="hidden"
            id="audio-file-input"
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                asChild
                size="sm"
                variant="ghost"
                className="h-8 px-3 rounded-lg hover:bg-white/10"
              >
                <label
                  htmlFor="audio-file-input"
                  className="cursor-pointer flex items-center gap-2"
                >
                  <Plus className="w-4 h-4 text-cyan-400" />
                  Import
                </label>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Import Tracks (⌘O)</TooltipContent>
          </Tooltip>

          {/* Recording */}
          <RecordingPanel
            isRecording={recording.isRecording}
            isPaused={recording.isPaused}
            duration={recording.duration}
            permissionError={recording.error}
            onStart={handleStartRecording}
            onPause={recording.pauseRecording}
            onResume={recording.resumeRecording}
            onStop={handleStopRecording}
            onCancel={recording.cancelRecording}
          />

          {/* Export */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleExport}
                disabled={trackManager.tracks.length === 0 || isExporting}
                className="h-8 px-3 rounded-lg hover:bg-white/10"
              >
                {isExporting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-1.5 text-purple-400" />
                    Export
                  </>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Export Mix (⌘E)</TooltipContent>
          </Tooltip>

          {/* Track Count */}
          <Badge variant="secondary" className="h-6 px-2 text-xs glass-1 border-white/10">
            {trackManager.tracks.length} {trackManager.tracks.length === 1 ? "Track" : "Tracks"}
          </Badge>
        </div>

        {/* Timeline - fills remaining space */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <Timeline
            tracks={trackManager.tracks}
            playheadTime={timeline.state.playheadTime}
            isPlaying={isPlaying}
            zoom={timeline.state.zoom}
            snapEnabled={timeline.state.snapEnabled}
            snapGrid={timeline.state.snapGrid}
            selectedTrackId={timeline.state.selectedTrackId}
            onTrackPositionChange={trackManager.setPosition}
            onPlayheadSeek={handlePlayheadSeek}
            onZoomChange={timeline.setZoom}
            onSnapToggle={timeline.setSnapEnabled}
            onSnapGridChange={timeline.setSnapGrid}
            onSelectTrack={timeline.setSelectedTrackId}
            onVolumeChange={trackManager.setVolume}
            onMuteToggle={trackManager.toggleMute}
            onSoloToggle={trackManager.toggleSolo}
            onTrimChange={trackManager.setTrim}
            onRemoveTrack={trackManager.removeTrack}
            onScrubAudio={handleScrubAudio}
            onSoloPreview={handleSoloPreview}
            onCrossProjectDrop={projectManager.copyTrackToCurrentProject}
            isRecording={recording.isRecording}
            recordingDuration={recording.duration}
            recordingStartPosition={0}
          />
        </div>

        {/* Keyboard Shortcuts Panel */}
        <KeyboardShortcutsPanel isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />

        {/* Shortcut Toast */}
        <ShortcutToast action={shortcutToast} />
      </div>
    </TooltipProvider>
  );
}
