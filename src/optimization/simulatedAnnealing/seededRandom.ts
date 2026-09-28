/**
 * Mulberry32 Seeded Pseudo-Random Number Generator.
 * Provides deterministic pseudo-random sequence for reproducible Simulated Annealing runs.
 */
export class SeededRandom {
  private state: number;
  private readonly initialSeed: number;

  constructor(seed: number = 42) {
    this.initialSeed = Math.floor(Math.abs(seed)) || 1;
    this.state = this.initialSeed;
  }

  /**
   * Resets generator back to initial seed
   */
  reset(): void {
    this.state = this.initialSeed;
  }

  /**
   * Returns pseudo-random float in [0, 1)
   */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t >>> 0) / 4294967296);
  }

  /**
   * Returns pseudo-random integer in [min, max] inclusive
   */
  nextInt(min: number, max: number): number {
    if (min > max) {
      const temp = min;
      min = max;
      max = temp;
    }
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /**
   * Picks a random element from a non-empty array
   */
  choice<T>(items: readonly T[] | T[]): T {
    if (!items || items.length === 0) {
      throw new Error('SeededRandom.choice: Cannot pick from empty array');
    }
    const idx = Math.floor(this.next() * items.length);
    return items[idx];
  }

  /**
   * Randomly shuffles an array in place (Fisher-Yates)
   */
  shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const temp = array[i];
      array[i] = array[j];
      array[j] = temp;
    }
    return array;
  }
}
