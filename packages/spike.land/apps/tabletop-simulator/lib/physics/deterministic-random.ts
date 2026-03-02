export class DeterministicRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed | 0;
  }

  // Mulberry32
  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Range [min, max)
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  // Integer range [min, max]
  rangeInt(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }
}
