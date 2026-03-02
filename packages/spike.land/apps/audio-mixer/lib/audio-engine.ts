/**
 * Audio Engine - Core Web Audio API functionality
 * Resolves #332
 */

import type { AudioTrack, WaveformOptions } from "../types";

export function createAudioContext(): AudioContext {
  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  return new AudioContextClass();
}

export function createMasterGain(context: AudioContext): GainNode {
  const masterGain = context.createGain();
  masterGain.connect(context.destination);
  return masterGain;
}

export function createAnalyser(context: AudioContext): AnalyserNode {
  const analyser = context.createAnalyser();
  analyser.fftSize = 2048;
  return analyser;
}

export async function loadAudioFile(context: AudioContext, file: File): Promise<AudioBuffer> {
  const arrayBuffer = await file.arrayBuffer();
  return context.decodeAudioData(arrayBuffer);
}

export function createTrackNodes(
  context: AudioContext,
  masterGain: GainNode,
  buffer: AudioBuffer,
): { source: AudioBufferSourceNode; gainNode: GainNode } {
  const source = context.createBufferSource();
  source.buffer = buffer;

  const gainNode = context.createGain();
  source.connect(gainNode);
  gainNode.connect(masterGain);

  return { source, gainNode };
}

export function generateWaveformData(buffer: AudioBuffer, samples: number = 100): number[] {
  const channelData = buffer.getChannelData(0);
  const blockSize = Math.floor(channelData.length / samples);
  const waveform: number[] = [];

  for (let i = 0; i < samples; i++) {
    const start = i * blockSize;
    let sum = 0;
    for (let j = 0; j < blockSize; j++) {
      sum += Math.abs(channelData[start + j] || 0);
    }
    waveform.push(sum / blockSize);
  }

  // Normalize
  const max = Math.max(...waveform, 0.01);
  return waveform.map((v) => v / max);
}

export function drawWaveform(
  canvas: HTMLCanvasElement,
  waveformData: number[],
  progress: number,
  options: WaveformOptions,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const { width, height, barWidth, barGap, barColor, progressColor } = options;

  ctx.clearRect(0, 0, width, height);

  const totalBars = waveformData.length;
  const progressIndex = Math.floor(progress * totalBars);

  waveformData.forEach((value, index) => {
    const x = index * (barWidth + barGap);
    const barHeight = value * height * 0.8;
    const y = (height - barHeight) / 2;

    ctx.fillStyle = index < progressIndex ? progressColor : barColor;
    ctx.fillRect(x, y, barWidth, barHeight);
  });
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export async function mixTracksToBlob(
  context: AudioContext,
  tracks: AudioTrack[],
  duration: number,
): Promise<Blob> {
  const sampleRate = context.sampleRate;

  // Calculate total duration considering positions and trims
  const activeTracks = tracks.filter((t) => t.buffer && !t.muted);
  const totalDuration =
    activeTracks.length > 0
      ? Math.max(
          duration,
          ...activeTracks.map((t) => {
            const effectiveTrimEnd = t.trimEnd > 0 ? t.trimEnd : t.duration;
            // Use position (with delay fallback for backward compat)
            const trackPosition = t.position ?? t.delay ?? 0;

            // Handle negative trimStart (lead-in silence)
            if (t.trimStart < 0) {
              // Silence duration + audio duration
              const silenceDuration = Math.abs(t.trimStart);
              const audioDuration = effectiveTrimEnd;
              return Math.max(0, trackPosition) + silenceDuration + audioDuration;
            } else {
              // Normal trim
              const trimmedDuration = effectiveTrimEnd - t.trimStart;
              return Math.max(0, trackPosition) + trimmedDuration;
            }
          }),
        )
      : duration;

  const length = Math.ceil(totalDuration * sampleRate);
  const offlineContext = new OfflineAudioContext(2, length, sampleRate);

  const masterGain = offlineContext.createGain();
  masterGain.connect(offlineContext.destination);

  for (const track of activeTracks) {
    if (track.buffer) {
      const source = offlineContext.createBufferSource();
      source.buffer = track.buffer;

      const gainNode = offlineContext.createGain();
      gainNode.gain.value = track.volume;

      source.connect(gainNode);
      gainNode.connect(masterGain);

      // Calculate effective trim boundaries
      const effectiveTrimEnd = track.trimEnd > 0 ? track.trimEnd : track.duration;

      // Use position (with delay fallback for backward compat)
      const trackPosition = track.position ?? track.delay ?? 0;

      // Handle negative trimStart (lead-in silence)
      let startTime: number;
      let bufferOffset: number;
      let playDuration: number;

      if (track.trimStart < 0) {
        // Negative trimStart: add silence before audio
        const silenceDuration = Math.abs(track.trimStart);
        startTime = Math.max(0, trackPosition) + silenceDuration;
        bufferOffset = 0; // Start from beginning of audio
        playDuration = effectiveTrimEnd;
      } else {
        // Normal positive trimStart
        startTime = Math.max(0, trackPosition);
        bufferOffset = track.trimStart;
        playDuration = Math.max(0, effectiveTrimEnd - track.trimStart);
      }

      if (playDuration <= 0) continue;
      source.start(startTime, bufferOffset, playDuration);
    }
  }

  const renderedBuffer = await offlineContext.startRendering();
  return audioBufferToWav(renderedBuffer);
}

export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitsPerSample = 16;

  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = buffer.length * blockAlign;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const arrayBuffer = new ArrayBuffer(totalSize);
  const view = new DataView(arrayBuffer);

  // WAV header
  writeString(view, 0, "RIFF");
  view.setUint32(4, totalSize - 8, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  // Audio data
  const channels: Float32Array[] = [];
  for (let i = 0; i < numChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  let offset = headerSize;
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch]![i]!));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, intSample, true);
      offset += bytesPerSample;
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

export function createRecorder(stream: MediaStream): MediaRecorder {
  const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
  return new MediaRecorder(stream, { mimeType });
}

export async function blobToAudioBuffer(context: AudioContext, blob: Blob): Promise<AudioBuffer> {
  const arrayBuffer = await blob.arrayBuffer();
  return context.decodeAudioData(arrayBuffer);
}
