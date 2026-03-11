declare module "*.html" {
  const content: string;
  export default content;
}
declare module "*.wasm?url" {
  const url: string;
  export default url;
}
declare module "esbuild-wasm/*.wasm?url" {
  const url: string;
  export default url;
}
declare module "esbuild-wasm/*.wasm" {
  const module: WebAssembly.Module;
  export default module;
}

// Ambient declarations for uninstalled optional 3D packages

declare module "three" {
  export class Object3D {
    [key: string]: unknown;
  }
  export class Mesh extends Object3D {
    [key: string]: unknown;
  }
  export class Group extends Object3D {
    [key: string]: unknown;
  }
  export class Material {
    dispose(): void;
    [key: string]: unknown;
  }
  export class MeshStandardMaterial extends Material {
    color: unknown;
    emissive: unknown;
    emissiveIntensity: number;
    roughness: number;
    metalness: number;
    transparent: boolean;
    opacity: number;
    constructor(params?: Record<string, unknown>);
  }
  export class SphereGeometry {
    dispose(): void;
    constructor(radius?: number, widthSegments?: number, heightSegments?: number);
  }
  export class Vector3 {
    x: number;
    y: number;
    z: number;
    constructor(x?: number, y?: number, z?: number);
    set(x: number, y: number, z: number): this;
  }
}

declare module "@react-three/fiber" {
  import type { FC, ReactNode } from "react";
  interface CanvasProps {
    children?: ReactNode;
    dpr?: [number, number];
    camera?: Record<string, unknown>;
    gl?: Record<string, unknown>;
    frameloop?: string;
    [key: string]: unknown;
  }
  export const Canvas: FC<CanvasProps>;
  interface FrameState {
    clock: { getElapsedTime(): number };
    [key: string]: unknown;
  }
  export function useFrame(callback: (state: FrameState) => void): void;
  export function useThree(): unknown;
}

declare module "@react-three/rapier" {
  import type { FC, ReactNode } from "react";
  interface RigidBodyProps {
    children?: ReactNode;
    ref?: unknown;
    position?: [number, number, number];
    colliders?: string;
    restitution?: number;
    friction?: number;
    linearDamping?: number;
    angularDamping?: number;
    [key: string]: unknown;
  }
  export interface RapierRigidBody {
    applyImpulse(impulse: unknown, wakeUp: boolean): void;
    [key: string]: unknown;
  }
  export const Physics: FC<{
    children?: ReactNode;
    gravity?: [number, number, number];
    [key: string]: unknown;
  }>;
  export const RigidBody: FC<RigidBodyProps>;
  export const CuboidCollider: FC<{
    position?: [number, number, number];
    args?: [number, number, number];
    [key: string]: unknown;
  }>;
  export const BallCollider: FC<{ [key: string]: unknown }>;
}

// Ambient declarations for packages that lack TypeScript type definitions
declare module "recordrtc" {
  interface RecordRTCOptions {
    type?: string;
    mimeType?: string;
    recorderType?: unknown;
    numberOfAudioChannels?: number;
    desiredSampRate?: number;
    bufferSize?: number;
    [key: string]: unknown;
  }
  interface RecordRTCInstance {
    startRecording(): void;
    stopRecording(callback?: (blobURL: string) => void): void;
    getBlob(): Blob;
    reset(): void;
    destroy(): void;
    [key: string]: unknown;
  }
  interface RecordRTCConstructor {
    new (stream: MediaStream, options?: RecordRTCOptions): RecordRTCInstance;
    StereoAudioRecorder: unknown;
    [key: string]: unknown;
  }
  const RecordRTC: RecordRTCConstructor;
  export default RecordRTC;
}

declare module "react-syntax-highlighter" {
  import type { FC, ReactNode } from "react";
  interface SyntaxHighlighterProps {
    language?: string;
    style?: Record<string, Record<string, unknown>>;
    children?: ReactNode;
    useInlineStyles?: boolean;
    showLineNumbers?: boolean;
    wrapLines?: boolean;
    [key: string]: unknown;
  }
  const SyntaxHighlighter: FC<SyntaxHighlighterProps>;
  export default SyntaxHighlighter;
  export const Prism: FC<SyntaxHighlighterProps>;
  export const PrismLight: FC<SyntaxHighlighterProps>;
  export const PrismAsync: FC<SyntaxHighlighterProps>;
  export const PrismAsyncLight: FC<SyntaxHighlighterProps>;
  export const Light: FC<SyntaxHighlighterProps>;
  export const LightAsync: FC<SyntaxHighlighterProps>;
}

declare module "react-syntax-highlighter/dist/esm/styles/prism" {
  type PrismStyle = Record<string, Record<string, string | number | undefined>>;
  const styles: PrismStyle;
  export default styles;
  export const dracula: PrismStyle;
  export const vscDarkPlus: PrismStyle;
  export const tomorrow: PrismStyle;
  export const oneDark: PrismStyle;
  export const atomDark: PrismStyle;
  export const okaidia: PrismStyle;
}
