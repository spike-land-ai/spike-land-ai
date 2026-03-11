// Minimal JSX intrinsic extensions for react-three-fiber Three.js elements.
// These are needed because @react-three/fiber, @react-three/rapier, and three
// are optional peer dependencies not installed in this environment.
// When these packages are installed, their own type declarations take over.

import type React from "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      mesh: {
        scale?: number | [number, number, number];
        geometry?: unknown;
        material?: unknown;
        position?: [number, number, number];
        ref?: React.Ref<unknown>;
        [key: string]: unknown;
      };
      ambientLight: {
        intensity?: number;
        [key: string]: unknown;
      };
      pointLight: {
        position?: [number, number, number];
        intensity?: number;
        [key: string]: unknown;
      };
      directionalLight: {
        position?: [number, number, number];
        intensity?: number;
        [key: string]: unknown;
      };
      hemisphereLight: { [key: string]: unknown };
    }
  }
}
