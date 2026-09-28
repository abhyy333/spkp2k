/**
 * Pure Deterministic Pseudo-Random Number Generator (PRNG)
 * Uses Mulberry32 algorithm with customizable seed.
 * Ensures 100% reproducible runs for academic defense and algorithm benchmarking.
 */

export class PRNG {
  private s: number;

  constructor(seed: number = 42) {
    this.s = Math.floor(seed) >>> 0;
  }

  /**
   * Return a float in range [0, 1)
   */
  public next(): number {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Return an integer in range [min, max] inclusive
   */
  public nextInt(min: number, max: number): number {
    if (min >= max) return min;
    const range = max - min + 1;
    return min + Math.floor(this.next() * range);
  }

  /**
   * Pick random item from an array
   */
  public choice<T>(array: T[]): T {
    if (array.length === 0) {
      throw new Error('Cannot pick from empty array');
    }
    const idx = Math.floor(this.next() * array.length);
    return array[idx];
  }

  /**
   * Shuffle an array immutably (Fisher-Yates)
   */
  public shuffle<T>(array: T[]): T[] {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const temp = copy[i];
      copy[i] = copy[j];
      copy[j] = temp;
    }
    return copy;
  }

  /**
   * Sample k distinct items from array
   */
  public sample<T>(array: T[], k: number): T[] {
    const shuffled = this.shuffle(array);
    return shuffled.slice(0, Math.min(k, shuffled.length));
  }
}
