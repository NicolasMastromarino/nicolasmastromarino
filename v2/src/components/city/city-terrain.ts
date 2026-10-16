import * as THREE from "three";
import { landL, smooth } from "./city-layout";

// The land beyond the city: farm fields close by, rolling hills, then mountain ranges.
// Pure functions so the terrain mesh, the farms and the highway all agree on the ground.

const hash = (x: number, y: number) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const vnoise = (x: number, y: number) => {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  return lerp(lerp(hash(ix, iy), hash(ix + 1, iy), u), lerp(hash(ix, iy + 1), hash(ix + 1, iy + 1), u), v);
};
export const fbm = (x: number, y: number, oct = 4) => {
  let a = 0.5;
  let f = 1;
  let s = 0;
  for (let i = 0; i < oct; i++) {
    s += a * vnoise(x * f, y * f);
    f *= 2;
    a *= 0.5;
  }
  return s;
};

/** Where the highway enters the city from the west (an extension of the avenue at z = 4). */
export const HIGHWAY_Z = 4;
/** Roads that leave the grid: they follow the avenues at z = 4 + 8n (west) and x = 4 + 8n (south). */
export const ROADS_Z = [-44, HIGHWAY_Z, 68];
export const ROADS_X = [-44, 4];

/** The textured city ground covers this rectangle, so no terrain is needed under it. */
const underCity = (x: number, z: number) => x > -72 && x < 96 && z > -93 && z < 97;

/** rectangles of ground that are flattened (with a soft shoulder) so large structures sit flush */
const FLATS = [
  { x0: -149, x1: -79, z0: 8, z1: 64, fall: 14, h: 0.35 }, // the stadium and its car parks
  { x0: -190, x1: -152, z0: -2, z1: 32, fall: 14, h: 0.45 }, // the gas station on the highway
  { x0: -134, x1: -84, z0: -164, z1: -100, fall: 10, h: 0.5 }, // the beach villas
  { x0: -193, x1: -60, z0: -20, z1: -8, fall: 9, h: 0.45 }, // the railway runs level along the ground and into the mountain
  { x0: -199, x1: -100, z0: -1.5, z1: 9.5, fall: 10, h: 0.35 }, // the highway runs level up to its tunnel
  { x0: -199, x1: -100, z0: 62, z1: 74, fall: 10, h: 0.35 }, // and so does the southern avenue
  { x0: -127, x1: -109, z0: 83, z1: 101, fall: 8, h: 0.35 }, // the landscaping yard in the meadow beside the western farm
  { x0: -122, x1: -106, z0: -68, z1: -52, fall: 7, h: 0.4 }, // the roofers' yard in the northwestern fields
  { x0: -72, x1: -52, z0: 100, z1: 120, fall: 5, h: 0.35 }, // the plumbers' yard
];

export function terrainHeight(x: number, z: number): number {
  const r = Math.hypot(x, z);
  let h = -4;
  const L = landL(x, z);
  // terrain is only wanted where the painted ground is absent: the beach, and the strip beyond the last painted block (x < -67.5, z > 69.7)
  if (underCity(x, z) && L > -7 && (L < 16.2 || Math.max(-x, (z - 60) * 1.6 + 52) > 67.5)) h = -0.18;
  if (!underCity(x, z) && L > 0) {
    const wd = Math.max(0, Math.max(-x - 66, z - 98)); // beyond the western / southern edge of town
    // a valley for every road that leaves town
    const cW = x < -60 ? Math.min(...ROADS_Z.map((rz) => smooth(8, 45, Math.abs(z - rz)))) : 1;
    const cS = z > 96 ? Math.min(...ROADS_X.map((rx) => smooth(8, 45, Math.abs(x - rx)))) : 1;
    const corridor = Math.min(cW, cS);
    const f = fbm(x * 0.018, z * 0.018);
    const fields = 0.55 * f;
    const hillM = smooth(40, 120, wd);
    const hills = hillM * 16 * fbm(x * 0.011 + 9, z * 0.011 + 3);
    const ridged = 1 - Math.abs(2 * fbm(x * 0.0065 + 31, z * 0.0065 + 17, 3) - 1);
    // the onset wanders with the land instead of following a straight line, and builds slowly with distance
    const wdn = wd + 55 * (fbm(x * 0.008 + 3, z * 0.006 + 9, 3) - 0.5);
    const mtnM = smooth(60, 320, wdn);
    const mountains = mtnM * 78 * Math.pow(ridged, 1.7) * (0.5 + 0.5 * fbm(x * 0.004, z * 0.004));
    h = (fields + (hills + mountains) * (0.2 + 0.8 * corridor)) * smooth(0, 10, L);
    // the spur the railway tunnels through: it stands right behind the portal and melts into the plain toward the city
    h += 24 * Math.exp(-(((x + 262) / 64) ** 2 + ((z + 6) / 50) ** 2)) * smooth(0, 10, L); // the spur the railway and the highway both tunnel through
    h += 22 * Math.exp(-(((x + 262) / 64) ** 2 + ((z - 68) / 44) ** 2)) * smooth(0, 10, L); // and the one the southern avenue tunnels through
  }
  // distant ranges rising out of the sea on every horizon
  if (r > 300) {
    const far = smooth(300, 430, r);
    const rd = 1 - Math.abs(2 * fbm(x * 0.007 + 5, z * 0.007 + 8, 5) - 1);
    h = Math.max(h, far * (28 + 58 * Math.pow(rd, 2)));
  }
  // building sites are levelled: the stadium and its lots, the gas station by the highway, the beach villas and the railway cutting
  if (L > 0) {  // applied last, so the cutting can also be dug through the far ranges
    for (const f of FLATS) {
      const dx = Math.max(f.x0 - x, 0, x - f.x1);
      const dz = Math.max(f.z0 - z, 0, z - f.z1);
      const w = 1 - smooth(0, f.fall, Math.hypot(dx, dz));
      if (w > 0) h = h * (1 - w) + f.h * w;
    }
  }
  return h;
}

const C = (h: string) => new THREE.Color(h);
const FIELD = ["#3f5f3a", "#4d6b3d", "#6a6b3a", "#7a6b3f", "#35553f", "#56703f"].map(C);
const FOREST = C("#2a4034");
const FOREST2 = C("#31503c");
const ROCK = C("#5b5d78");
const ROCK2 = C("#4a4c66");
const SNOW = C("#cdd5ea");
const SAND = C("#8a7a62");
const SAND2 = C("#b59a72");
const WET = C("#6e6458");

const MEADOW = C("#4f7b3e");
const MEADOW2 = C("#62904a");
const STRAW = C("#8f8d50");

export function terrainColor(x: number, z: number, h: number, out: THREE.Color) {
  const n = fbm(x * 0.05, z * 0.05, 3);
  // large soft patches of meadow, drier grass and straw, no hard cell edges
  const big = fbm(x * 0.012 + 4, z * 0.012 + 9, 3);
  const dry = smooth(0.5, 0.74, fbm(x * 0.02 + 17, z * 0.02 + 3, 3));
  const field = out.copy(MEADOW).lerp(MEADOW2, big).lerp(STRAW, dry * 0.5).multiplyScalar(0.9 + n * 0.22);
  if (h < 28) {
    // meadow climbs into forest floor
    const forest = FOREST.clone().lerp(FOREST2, n).multiplyScalar(0.85 + n * 0.35);
    field.lerp(forest, smooth(1.6, 7, h));
  } else if (h < 78) {
    out.copy(ROCK).lerp(ROCK2, n * 1.2);
    out.lerp(FOREST, smooth(40, 28, h) * 0.6);
  } else {
    out.copy(ROCK).lerp(SNOW, smooth(78, 100, h));
  }
  return out;
}

export function sandColor(out: THREE.Color) {
  return out.copy(SAND);
}
