import { vi } from 'vitest';

vi.mock('remotion', () => ({
  useCurrentFrame: vi.fn(() => 0),
  useVideoConfig: vi.fn(() => ({
    width: 1920,
    height: 1080,
    fps: 30,
    durationInFrames: 300,
  })),
  interpolate: vi.fn((frame, input, output) => {
    if (frame <= input[0]) return output[0];
    if (frame >= input[input.length - 1]) return output[output.length - 1];
    return output[0];
  }),
  spring: vi.fn(() => 0),
  Easing: {
    out: vi.fn((x) => x),
    in: vi.fn((x) => x),
    inOut: vi.fn((x) => x),
    bezier: vi.fn(() => (x: any) => x),
  },
  AbsoluteFill: ({ children, style }: any) => {
    const React = require('react');
    return React.createElement('div', { style }, children);
  },
  Sequence: ({ children }: any) => {
    const React = require('react');
    return React.createElement(React.Fragment, null, children);
  },
  Audio: () => null,
  Video: () => null,
  Img: () => null,
  Series: Object.assign(
    ({ children }: any) => {
      const React = require('react');
      return React.createElement(React.Fragment, null, children);
    },
    {
      Sequence: ({ children }: any) => {
        const React = require('react');
        return React.createElement(React.Fragment, null, children);
      },
    }
  ),
  staticFile: (path: string) => path,
}));

vi.mock('@remotion/transitions', () => ({
  TransitionSeries: Object.assign(
    ({ children }: any) => {
      const React = require('react');
      return React.createElement(React.Fragment, null, children);
    },
    {
      Sequence: ({ children }: any) => {
        const React = require('react');
        return React.createElement(React.Fragment, null, children);
      },
      Transition: () => null,
    }
  ),
  linearTiming: vi.fn(),
}));

vi.mock('@remotion/transitions/fade', () => ({
  fade: vi.fn(),
}));
