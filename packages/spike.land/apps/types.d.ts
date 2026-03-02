// Type declarations for third-party modules used by apps/
// These packages are loaded at runtime but don't ship their own types
// or aren't installed as direct dependencies.

declare module "qrcode" {
  interface QRCodeToDataURLOptions {
    width?: number;
    margin?: number;
    color?: {
      dark?: string;
      light?: string;
    };
  }
  const QRCode: {
    toDataURL(text: string, options?: QRCodeToDataURLOptions): Promise<string>;
  };
  export default QRCode;
}

declare module "@react-three/drei" {
  import type { ReactNode } from "react";

  export function Environment(props: {
    files?: string;
    background?: boolean;
    blur?: number;
  }): ReactNode;
  export function OrbitControls(props: {
    makeDefault?: boolean;
    enabled?: boolean;
    maxPolarAngle?: number;
    minDistance?: number;
    maxDistance?: number;
    target?: [number, number, number];
  }): ReactNode;
  export function ContactShadows(props: {
    resolution?: number;
    scale?: number;
    blur?: number;
    opacity?: number;
    far?: number;
    color?: string;
  }): ReactNode;
  export function Html(props: {
    position?: [number, number, number];
    center?: boolean;
    distanceFactor?: number;
    style?: React.CSSProperties;
    occlude?: boolean;
    transform?: boolean;
    children?: ReactNode;
  }): ReactNode;
}

declare module "@react-spring/three" {
  import type { ReactNode } from "react";

  export function useSpring<T extends Record<string, unknown>>(props: T): Record<string, unknown>;
  export const animated: {
    group: React.FC<Record<string, unknown> & { children?: ReactNode }>;
    mesh: React.FC<Record<string, unknown> & { children?: ReactNode }>;
  };
}

declare module "@use-gesture/react" {
  interface DragState {
    active: boolean;
    event: Event;
    tap: boolean;
    first: boolean;
    last: boolean;
  }
  interface DragOptions {
    filterTaps?: boolean;
    delay?: boolean | number;
  }
  export function useDrag(
    handler: (state: DragState) => void,
    options?: DragOptions,
  ): () => Record<string, unknown>;
}

declare module "yjs" {
  export class Doc {
    getMap<T>(name: string): Map<T>;
    getArray<T>(name: string): Array<T>;
    transact(fn: () => void): void;
    on<T extends (...args: never[]) => void>(event: string, callback: T): void;
    off<T extends (...args: never[]) => void>(event: string, callback: T): void;
  }
  export class Map<T> {
    get(key: string): T | undefined;
    set(key: string, value: T): void;
    values(): IterableIterator<T>;
    observe(fn: () => void): void;
    unobserve(fn: () => void): void;
  }
  // Named Array to match Y.Array<T> usage in app code
  export class Array<T> {
    length: number;
    get(index: number): T;
    push(items: T[]): void;
    insert(index: number, items: T[]): void;
    delete(index: number, length: number): void;
    toArray(): T[];
    observe(fn: () => void): void;
    unobserve(fn: () => void): void;
  }
  export function encodeStateAsUpdate(doc: Doc): Uint8Array;
  export function applyUpdate(doc: Doc, update: Uint8Array, origin?: string): void;
}

declare module "y-indexeddb" {
  import type { Doc } from "yjs";

  export class IndexeddbPersistence {
    constructor(roomId: string, doc: Doc);
    on(event: "synced", callback: () => void): void;
    destroy(): void;
  }
}
