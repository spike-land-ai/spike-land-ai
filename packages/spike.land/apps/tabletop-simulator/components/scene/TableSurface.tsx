"use client";
import { useLoader } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { useMemo } from "react";
import * as THREE from "three";

export function TableSurface() {
  const [feltAlbedo, feltNormal, woodAlbedo, woodNormal] = useLoader(THREE.TextureLoader, [
    "/textures/table/felt_albedo.png",
    "/textures/table/felt_normal.png",
    "/textures/table/wood_albedo.png",
    "/textures/table/wood_normal.png",
  ]);

  // Configure texture repeating
  useMemo(() => {
    [feltAlbedo, feltNormal].forEach((t) => {
      if (t) {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(16, 16);
      }
    });
    [woodAlbedo, woodNormal].forEach((t) => {
      if (t) {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(16, 2);
      }
    });
  }, [feltAlbedo, feltNormal, woodAlbedo, woodNormal]);

  return (
    <RigidBody type="fixed" friction={0.7} restitution={0.2} colliders={false}>
      {/* Table Top with felt texture */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
        <boxGeometry args={[12, 12, 0.1]} />
        <meshStandardMaterial
          {...(woodAlbedo ? { map: woodAlbedo } : {})}
          {...(feltNormal ? { normalMap: feltNormal } : {})}
          roughness={0.8}
          metalness={0.1}
          color="#ffffff" // Let texture drive the color
        />
      </mesh>

      {/* Decorative table edge/border - wooden rim */}
      <mesh position={[0, -0.03, -6.05]} receiveShadow>
        <boxGeometry args={[12.2, 0.15, 0.15]} />
        <meshStandardMaterial
          {...(woodAlbedo ? { map: woodAlbedo } : {})}
          {...(woodNormal ? { normalMap: woodNormal } : {})}
          color="#8B4513"
          roughness={0.4}
          metalness={0.1}
        />
      </mesh>
      <mesh position={[0, -0.03, 6.05]} receiveShadow>
        <boxGeometry args={[12.2, 0.15, 0.15]} />
        <meshStandardMaterial
          {...(woodAlbedo ? { map: woodAlbedo } : {})}
          {...(woodNormal ? { normalMap: woodNormal } : {})}
          color="#8B4513"
          roughness={0.4}
          metalness={0.1}
        />
      </mesh>
      <mesh position={[-6.05, -0.03, 0]} receiveShadow>
        <boxGeometry args={[0.15, 0.15, 12]} />
        <meshStandardMaterial
          {...(woodAlbedo ? { map: woodAlbedo } : {})}
          {...(woodNormal ? { normalMap: woodNormal } : {})}
          color="#8B4513"
          roughness={0.4}
          metalness={0.1}
        />
      </mesh>
      <mesh position={[6.05, -0.03, 0]} receiveShadow>
        <boxGeometry args={[0.15, 0.15, 12]} />
        <meshStandardMaterial
          {...(woodAlbedo ? { map: woodAlbedo } : {})}
          {...(woodNormal ? { normalMap: woodNormal } : {})}
          color="#8B4513"
          roughness={0.4}
          metalness={0.1}
        />
      </mesh>

      {/* Table surface collider */}
      <CuboidCollider args={[6, 0.05, 6]} position={[0, -0.05, 0]} />

      {/* Invisible walls to keep dice on table */}
      <CuboidCollider args={[6, 1, 0.1]} position={[0, 1, -6]} />
      <CuboidCollider args={[6, 1, 0.1]} position={[0, 1, 6]} />
      <CuboidCollider args={[0.1, 1, 6]} position={[-6, 1, 0]} />
      <CuboidCollider args={[0.1, 1, 6]} position={[6, 1, 0]} />
    </RigidBody>
  );
}
