// A small seeded random generator (mulberry32) plus a value-noise helper.
// The world, the ring course and the screenshots all draw from one seed, so
// ?seed=N always stages the same islands, rings and weather.
export function createRandom(seed) {
  let a = seed >>> 0;
  function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    range(min, max) {
      return min + next() * (max - min);
    },
    pick(list) {
      return list[Math.floor(next() * list.length)];
    },
  };
}

// Smooth 2D value noise in [-1, 1], built from a seeded hash so the terrain
// is stable for a seed and cheap enough to sample every frame for height.
export function makeNoise2D(seed) {
  const rand = createRandom(seed);
  const perm = new Uint8Array(512);
  const base = new Uint8Array(256);
  for (let i = 0; i < 256; i++) base[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand.next() * (i + 1));
    const t = base[i];
    base[i] = base[j];
    base[j] = t;
  }
  for (let i = 0; i < 512; i++) perm[i] = base[i & 255];

  function fade(t) {
    return t * t * (3 - 2 * t);
  }
  function hash(ix, iz) {
    return perm[(perm[ix & 255] + iz) & 255] / 255;
  }
  return function noise(x, z) {
    const ix = Math.floor(x);
    const iz = Math.floor(z);
    const fx = x - ix;
    const fz = z - iz;
    const a = hash(ix, iz);
    const b = hash(ix + 1, iz);
    const c = hash(ix, iz + 1);
    const d = hash(ix + 1, iz + 1);
    const u = fade(fx);
    const v = fade(fz);
    const top = a + (b - a) * u;
    const bottom = c + (d - c) * u;
    return (top + (bottom - top) * v) * 2 - 1;
  };
}
