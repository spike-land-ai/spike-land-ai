import { DeterministicRandom } from "./deterministic-random";

export interface DiceSimulationResult {
  result: number;
  impulse: { x: number; y: number; z: number };
  torque: { x: number; y: number; z: number };
}

export function simulateDiceRoll(seed: number, _dieType: string = "d6"): DiceSimulationResult {
  const rng = new DeterministicRandom(seed);

  const impulse = {
    x: rng.range(-2, 2),
    y: rng.range(5, 8),
    z: rng.range(-2, 2),
  };

  const torque = {
    x: rng.range(-1, 1),
    y: rng.range(-1, 1),
    z: rng.range(-1, 1),
  };

  // Placeholder logic for result mapping
  // In a real physics sim, this would be determined by the end state
  // But for ensuring consistency if physics diverges, we might use this "target"
  const result = rng.rangeInt(1, 6);

  return { result, impulse, torque };
}
