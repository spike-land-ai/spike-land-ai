import { useFrame } from "@react-three/fiber";
import type { RapierRigidBody } from "@react-three/rapier";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { simulateDiceRoll } from "../lib/physics/dice-simulation";
import type { DiceState, DiceType } from "../types/dice";

// D6 face directions and their corresponding values
// Standard die: opposite faces add to 7 (1-6, 2-5, 3-4)
const D6_FACES = [
  { dir: new THREE.Vector3(0, 1, 0), value: 1 }, // top
  { dir: new THREE.Vector3(0, -1, 0), value: 6 }, // bottom
  { dir: new THREE.Vector3(1, 0, 0), value: 3 }, // right
  { dir: new THREE.Vector3(-1, 0, 0), value: 4 }, // left
  { dir: new THREE.Vector3(0, 0, 1), value: 2 }, // front
  { dir: new THREE.Vector3(0, 0, -1), value: 5 }, // back
];

export function getDiceFaceValue(quaternion: THREE.Quaternion, diceType: DiceType): number {
  // For now, only d6 is properly implemented
  // Other dice types will return random values based on their max
  if (diceType !== "d6") {
    const maxValue = parseInt(diceType.slice(1), 10);
    // Use quaternion components to derive a pseudo-deterministic value
    const hash = Math.abs(quaternion.x + quaternion.y * 2 + quaternion.z * 3 + quaternion.w * 4);
    return Math.floor((hash % 1) * maxValue) + 1;
  }

  // For d6, determine which face is pointing up
  const up = new THREE.Vector3(0, 1, 0);
  const invQuat = quaternion.clone().invert();
  const localUp = up.clone().applyQuaternion(invQuat);

  let maxDot = -Infinity;
  let faceValue = 1;

  for (const face of D6_FACES) {
    const dot = localUp.dot(face.dir);
    if (dot > maxDot) {
      maxDot = dot;
      faceValue = face.value;
    }
  }

  return faceValue;
}

export function useDicePhysics(dice: DiceState, onSettle: (id: string, value: number) => void) {
  const rigidBodyRef = useRef<RapierRigidBody | null>(null);
  const isRollingRef = useRef(false);
  const settledRef = useRef(false);
  const settleFrameCount = useRef(0);

  useEffect(() => {
    if (dice.isRolling && rigidBodyRef.current) {
      isRollingRef.current = true;
      settledRef.current = false;
      settleFrameCount.current = 0;

      const { impulse, torque } = simulateDiceRoll(dice.seed, dice.type);

      rigidBodyRef.current.wakeUp();
      rigidBodyRef.current.applyImpulse(impulse, true);
      rigidBodyRef.current.applyTorqueImpulse(torque, true);
    }
  }, [dice.isRolling, dice.seed, dice.type]);

  useFrame(() => {
    if (isRollingRef.current && rigidBodyRef.current && !settledRef.current) {
      const vel = rigidBodyRef.current.linvel();
      const ang = rigidBodyRef.current.angvel();

      // Check if settled (velocity near zero)
      const isStill =
        Math.abs(vel.x) < 0.05 &&
        Math.abs(vel.y) < 0.05 &&
        Math.abs(vel.z) < 0.05 &&
        Math.abs(ang.x) < 0.05 &&
        Math.abs(ang.y) < 0.05 &&
        Math.abs(ang.z) < 0.05;

      if (isStill) {
        settleFrameCount.current++;
        // Wait a few frames to make sure it's really settled
        if (settleFrameCount.current > 10) {
          isRollingRef.current = false;
          settledRef.current = true;

          // Get rotation quaternion from rigid body
          const rotation = rigidBodyRef.current.rotation();
          const quaternion = new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);

          const faceValue = getDiceFaceValue(quaternion, dice.type);
          onSettle(dice.id, faceValue);
        }
      } else {
        settleFrameCount.current = 0;
      }
    }
  });

  return { rigidBodyRef };
}
