/** シード付き乱数（mulberry32）。同じシードなら同じ問題になる */
export interface Rng {
  next(): number; // [0,1)
  int(lo: number, hi: number): number; // lo..hi（両端含む）
}

export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { next, int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)) };
}

export const randomSeed = () => (Math.random() * 0xffffffff) >>> 0;
