"use client";
import { RigidBody } from "@react-three/rapier";
import { useMemo } from "react";
import * as THREE from "three";
import { useDicePhysics } from "../../hooks/useDicePhysics";
import type { DiceState } from "../../types/dice";

interface DiceProps {
  state: DiceState;
  onSettle: (id: string, value: number) => void;
}

const DICE_SIZE = 0.5;
const DOT_SPACING = 0.1;

// Dot patterns for each dice face (standard d6 arrangement)
const DOT_PATTERNS: Record<number, Array<[number, number]>> = {
  1: [[0, 0]], // center
  2: [
    [-DOT_SPACING, -DOT_SPACING],
    [DOT_SPACING, DOT_SPACING],
  ], // diagonal
  3: [
    [-DOT_SPACING, -DOT_SPACING],
    [0, 0],
    [DOT_SPACING, DOT_SPACING],
  ], // diagonal + center
  4: [
    [-DOT_SPACING, -DOT_SPACING],
    [DOT_SPACING, -DOT_SPACING],
    [-DOT_SPACING, DOT_SPACING],
    [DOT_SPACING, DOT_SPACING],
  ], // corners
  5: [
    [-DOT_SPACING, -DOT_SPACING],
    [DOT_SPACING, -DOT_SPACING],
    [0, 0],
    [-DOT_SPACING, DOT_SPACING],
    [DOT_SPACING, DOT_SPACING],
  ], // corners + center
  6: [
    [-DOT_SPACING, -DOT_SPACING],
    [DOT_SPACING, -DOT_SPACING],
    [-DOT_SPACING, 0],
    [DOT_SPACING, 0],
    [-DOT_SPACING, DOT_SPACING],
    [DOT_SPACING, DOT_SPACING],
  ], // 2 columns
};

// Create a dice with colored faces and dots using canvas textures
function createDiceMaterials(): THREE.MeshStandardMaterial[] {
  const faceValues = [3, 4, 1, 6, 2, 5]; // Standard dice face order for boxGeometry: +X, -X, +Y, -Y, +Z, -Z

  return faceValues.map((value) => {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d")!;

    // White background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 128, 128);

    // Draw dots
    ctx.fillStyle = "#111111";
    const dots = DOT_PATTERNS[value] || [];
    const center = 64;
    const scale = 400; // Scale factor for dot positions

    dots.forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(center + x * scale, center - y * scale, 12, 0, Math.PI * 2);
      ctx.fill();
    });

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    return new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.3,
    });
  });
}

export function Dice({ state, onSettle }: DiceProps) {
  const { rigidBodyRef } = useDicePhysics(state, onSettle);

  // Create materials once per component instance (memoized to avoid recreating textures)
  const materials = useMemo(() => createDiceMaterials(), []);

  return (
    <RigidBody
      ref={rigidBodyRef}
      position={[state.position.x, state.position.y, state.position.z]}
      colliders="cuboid"
      restitution={0.3}
      friction={0.8}
    >
      <mesh castShadow material={materials}>
        <boxGeometry args={[DICE_SIZE, DICE_SIZE, DICE_SIZE]} />
      </mesh>
    </RigidBody>
  );
}
