import React from 'react';
import { vi } from 'vitest';

export const useCurrentFrame = vi.fn(() => 0);
export const useVideoConfig = vi.fn(() => ({
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 300,
}));

export const interpolate = vi.fn((frame, input, output) => {
  if (frame <= input[0]) return output[0];
  if (frame >= input[input.length - 1]) return output[output.length - 1];
  return output[0]; // Simple mock
});

export const spring = vi.fn(() => 0);

export const AbsoluteFill = ({ children, style }: any) => <div style={style}>{children}</div>;
export const Sequence = ({ children }: any) => <>{children}</>;
export const Audio = () => null;
export const staticFile = (path: string) => path;

export const TransitionSeries = Object.assign(
  ({ children }: any) => <>{children}</>,
  {
    Sequence: ({ children }: any) => <>{children}</>,
    Transition: () => null,
  }
);
