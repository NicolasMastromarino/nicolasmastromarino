import * as THREE from "three";

// Shared geometry of the island so the generator, the ground painter and the
// camera rigs all agree on where things are.
export const HALF = 72; // half-size of the city; the W/E/N edges dissolve into mist
export const PITCH = 8; // block pitch: 6 of block + 2 of road
export const BLOCKS = 8; // blocks run from -8..8 on each axis (the beach row is the last one on +z)
/** Extent of the textured city ground (the coast curves inside it). */
export const GROUND = { x0: -HALF, x1: 92, z0: -90, z1: 96 };
export const CASE_Z = -47;
export const CASE_XS = [-40, -24, -8, 8, 24, 40];
export const CRM_C = new THREE.Vector3(-34, 0, 16);
export const AUTO_C = new THREE.Vector3(34, 0, 16);
export const ANT_C = new THREE.Vector3(42, 0, -20);
export const HUB_H = 46;

export function rand(seed: number) {
  // mulberry32 so the city is identical on every visit
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Areas painted as plaza/pad instead of street grid. */
export const ZONES = {
  hub: { x: 0, z: 0, r: 15 },
  crm: { x: CRM_C.x, z: CRM_C.z, r: 11 },
  auto: { x: AUTO_C.x, z: AUTO_C.z, r: 11 },
  ant: { x: ANT_C.x, z: ANT_C.z, r: 8 },
  cases: { x0: -50, x1: 50, z0: -53, z1: -42 },
};

export function inZone(x: number, z: number, pad = 0) {
  const { hub, crm, auto, ant, cases } = ZONES;
  if (landL(x, z) < 12) return true; // sand, dunes, sea
  if (Math.hypot(x - hub.x, z - hub.z) < hub.r + pad) return true;
  if (Math.hypot(x - crm.x, z - crm.z) < crm.r + pad) return true;
  if (Math.hypot(x - auto.x, z - auto.z) < auto.r + pad) return true;
  if (Math.hypot(x - ant.x, z - ant.z) < ant.r + pad) return true;
  if (x > cases.x0 - pad && x < cases.x1 + pad && z > cases.z0 - pad && z < cases.z1 + pad) return true;
  return false;
}

/** Distance from a point to the nearest landmark zone edge (<=0 inside). */
export function zoneDistance(x: number, z: number) {
  const { hub, crm, auto, ant, cases } = ZONES;
  const d = [
    Math.hypot(x - hub.x, z - hub.z) - hub.r,
    Math.hypot(x - crm.x, z - crm.z) - crm.r,
    Math.hypot(x - auto.x, z - auto.z) - auto.r,
    Math.hypot(x - ant.x, z - ant.z) - ant.r,
    Math.max(cases.x0 - x, x - cases.x1, cases.z0 - z, z - cases.z1),
    landL(x, z) - 12,
  ];
  return Math.min(...d);
}


/* ------------------------------------------------------------------ */
/* The coast: one smooth field, shared by the generator, the ground    */
/* painter, the terrain and the sea shader. landL > 0 is land (metres  */
/* from the water), < 0 is sea. Water lies south, east and north; the  */
/* west keeps going as fields and hills.                               */
/* ------------------------------------------------------------------ */

const gauss = (u: number, w: number) => Math.exp(-(u * u) / (w * w));
const zS = (x: number) => 52 + 6 * Math.sin(0.07 * x + 1) + 3.5 * Math.sin(0.19 * x) - 9 * gauss(x - 34, 9) + 6 * gauss(x + 45, 8);
const xE = (z: number) => 70 + 7 * Math.sin(0.06 * z) + 4 * Math.sin(0.16 * z + 2) - 10 * gauss(z + 30, 10) + 5 * gauss(z - 10, 8);
const zN = (x: number) => -74 + 6 * Math.sin(0.05 * x + 3) + 3.5 * Math.sin(0.14 * x) + 8 * gauss(x - 20, 9) - 6 * gauss(x + 30, 8);
const xW = (z: number) => -96 + 10 * Math.sin(0.045 * z + 1) + 5 * Math.sin(0.13 * z);
const smin = (a: number, b: number, k: number) => -Math.log(Math.exp(-k * a) + Math.exp(-k * b)) / k;
const smax = (a: number, b: number, k: number) => Math.log(Math.exp(k * a) + Math.exp(k * b)) / k;

export function landL(x: number, z: number) {
  const city = smin(xE(z) - x, z - zN(x), 0.12); // water only to the east and north
  return smax(city, xW(z) - x, 0.12);
}

/** The same field in GLSL so the sea can draw foam exactly along the shore. */
export const LAND_GLSL = `
  float gauss(float u, float w) { return exp(-(u * u) / (w * w)); }
  float zS(float x) { return 52.0 + 6.0 * sin(0.07 * x + 1.0) + 3.5 * sin(0.19 * x) - 9.0 * gauss(x - 34.0, 9.0) + 6.0 * gauss(x + 45.0, 8.0); }
  float xE(float z) { return 70.0 + 7.0 * sin(0.06 * z) + 4.0 * sin(0.16 * z + 2.0) - 10.0 * gauss(z + 30.0, 10.0) + 5.0 * gauss(z - 10.0, 8.0); }
  float zN(float x) { return -74.0 + 6.0 * sin(0.05 * x + 3.0) + 3.5 * sin(0.14 * x) + 8.0 * gauss(x - 20.0, 9.0) - 6.0 * gauss(x + 30.0, 8.0); }
  float xW(float z) { return -96.0 + 10.0 * sin(0.045 * z + 1.0) + 5.0 * sin(0.13 * z); }
  float smin(float a, float b, float k) { return -log(exp(-k * a) + exp(-k * b)) / k; }
  float smax(float a, float b, float k) { return log(exp(k * a) + exp(k * b)) / k; }
  float landL(vec2 p) {
    float city = smin(xE(p.y) - p.x, p.y - zN(p.x), 0.12);
    return smax(city, xW(p.y) - p.x, 0.12);
  }
`;

/** Walk from (x,z) along (dx,dz) until the water is reached. */
export function findCoast(x: number, z: number, dx: number, dz: number, level = 0) {
  let px = x;
  let pz = z;
  for (let i = 0; i < 800 && landL(px, pz) > level; i++) {
    px += dx * 0.25;
    pz += dz * 0.25;
  }
  return new THREE.Vector3(px, 0, pz);
}
