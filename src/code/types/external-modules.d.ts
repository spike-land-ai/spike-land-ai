declare module "@spacetime-db/sdk" {
  export class SpacetimeClient {
    connect(baseUrl: string, moduleName: string, token: string | null): void;
    disconnect(): void;
    onConnect(callback: (identity: { toHexString(): string }, token?: { string: string }) => void): void;
    onDisconnect(callback: () => void): void;
    onConnectError(callback: (err: string) => void): void;
  }
}

declare module "@react-three/fiber" {
  import type { FC, ReactNode } from "react";
  export function useFrame(callback: (state: { clock: { getElapsedTime(): number } }) => void): void;
  export const Canvas: FC<{
    dpr?: [number, number];
    camera?: { position: [number, number, number]; fov: number };
    gl?: Record<string, unknown>;
    frameloop?: "always" | "demand" | "never";
    children?: ReactNode;
  }>;
}

declare module "@react-three/rapier" {
  import type { FC, ReactNode, RefObject } from "react";
  export interface RapierRigidBody {
    applyImpulse(impulse: { x: number; y: number; z: number }, wake: boolean): void;
  }
  export const Physics: FC<{ gravity?: [number, number, number]; children?: ReactNode }>;
  export const RigidBody: FC<{
    ref?: RefObject<RapierRigidBody | null>;
    position?: [number, number, number];
    colliders?: string;
    restitution?: number;
    friction?: number;
    linearDamping?: number;
    angularDamping?: number;
    children?: ReactNode;
  }>;
  export const CuboidCollider: FC<{
    position?: [number, number, number];
    args?: [number, number, number];
  }>;
}

declare module "three" {
  export class Vector3 {
    constructor(x?: number, y?: number, z?: number);
    x: number;
    y: number;
    z: number;
    set(x: number, y: number, z: number): this;
  }
  export class MeshStandardMaterial {
    constructor(params?: Record<string, unknown>);
    dispose(): void;
  }
  export class SphereGeometry {
    constructor(radius?: number, widthSegments?: number, heightSegments?: number);
    dispose(): void;
  }
  export type Material = MeshStandardMaterial;
}
