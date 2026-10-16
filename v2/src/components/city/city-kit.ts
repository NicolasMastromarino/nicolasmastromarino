import * as THREE from "three";
import {
  BLOCKS,
  CASE_XS,
  CASE_Z,
  GROUND,
  HALF,
  PITCH,
  findCoast,
  landL,
  ZONES,
  inZone,
  rand,
  smooth,
  zoneDistance,
} from "./city-layout";
import { INDUSTRIES } from "./industries";
import { addPalm } from "./city-palm";
import {
  dayU,
  makeBoardTexture,
  makeFoliageMaterial,
  makeGlowMaterial,
  makeSignTexture,
  makeTrimMaterial,
  makeWallMaterial,
  type Uniform,
} from "./city-materials";

type Rng = () => number;
const col = (h: string) => new THREE.Color(h);

/* ------------------------------------------------------------------ */
/* Palettes: dusk concrete, brick, plaster, glass. Muted on purpose.   */
/* ------------------------------------------------------------------ */

const FACADE = {
  concrete: ["#6c7388", "#767c91", "#848a9c", "#5f667c", "#4f6b78", "#587480"].map(col),
  brick: ["#8e5b52", "#9b6a58", "#7f5049", "#a0705f"].map(col),
  plaster: ["#b3a58f", "#a89a86", "#bdae98", "#9c9382"].map(col),
  glass: ["#3d4d70", "#445680", "#37476a", "#4b5d85"].map(col),
  pastel: ["#b98d84", "#a7b3a0", "#b8a577", "#8f9fb8", "#b38fa6"].map(col),
  sand: ["#c2a77a", "#b89f73", "#d6c9a8", "#c9b48a"].map(col),
  terra: ["#a85f4a", "#b0705a", "#9a5a48"].map(col),
  teal: ["#3f7a7a", "#2f6a7a", "#3a6f86", "#2f7f78"].map(col),
  white: ["#d8d6d0", "#e2dfd6", "#cfcfd6"].map(col),
};
const ROOF = ["#4d5470", "#3f4559", "#8a4f45", "#5a5f78"].map(col);
const AWNING = ["#d8694f", "#4fa3a5", "#d4a24c", "#8b5a8c", "#6a86d6"].map(col);
const TRIM = col("#2c3040");
const SLAB = col("#8e93a6");
const METAL = ["#7a8094", "#646a7e", "#8a8fa0"].map(col);
const TREE = ["#3f6b4f", "#4f7d5a", "#2f5a45", "#5a8a62", "#46745a"].map(col);
const AUTUMN = ["#b0703f", "#c28442"].map(col);
const TRUNK = col("#5a4538");
const NEON = ["#ff4f9a", "#4fd8ff", "#ffb84f", "#6dffb0", "#b98aff"];
const SIGN_TEXT = ["BAR", "OPEN", "HOTEL", "RAMEN", "CAFE", "24H", "PIZZA", "MOTEL", "NOODLES", "DELI", "GUESTHOUSE", "PIER", "SUSHI", "BOOKS", "PHARMACY", "TACOS", "VINYL", "ARCADE", "BANK", "COFFEE", "BURGERS", "LAUNDRY", "TATTOO", "DINER", "BAKERY", "FLORIST", "GYM", "PUB", "CINEMA", "TAXI", "NOODLE BAR", "RECORDS", "HOSPITAL", "EMERGENCY", "SCHOOL", "WORKSHOP", "GAS"];

const pick = <T,>(r: Rng, a: T[]) => a[Math.floor(r() * a.length)];

/* ------------------------------------------------------------------ */
/* Geometry                                                            */
/* ------------------------------------------------------------------ */

function flat<T extends THREE.BufferGeometry>(g: T) {
  const n = g.toNonIndexed();
  n.computeVertexNormals();
  return n as unknown as T;
}

function gableGeometry() {
  const A = [-0.5, 0, -0.5], B = [0.5, 0, -0.5], C = [0.5, 0, 0.5], D = [-0.5, 0, 0.5];
  const R1 = [-0.5, 1, 0], R2 = [0.5, 1, 0];
  const tris = [A, R1, R2, A, R2, B, D, C, R2, D, R2, R1, A, D, R1, B, R2, C, A, B, C, A, C, D];
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(tris.flat(), 3));
  g.computeVertexNormals();
  return g;
}

export const GEO = {
  box: () => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0),
  cyl: () => flat(new THREE.CylinderGeometry(0.5, 0.5, 1, 8).translate(0, 0.5, 0)),
  cone: () => flat(new THREE.ConeGeometry(0.5, 1, 6).translate(0, 0.5, 0)),
  ico: () => flat(new THREE.IcosahedronGeometry(0.5, 0)),
  gable: gableGeometry,
};

/* ------------------------------------------------------------------ */
/* Instanced bucket: collect parts, then build one InstancedMesh        */
/* ------------------------------------------------------------------ */

const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

export class Bucket {
  items: { m: THREE.Matrix4; c: THREE.Color; i: [number, number, number] }[] = [];
  constructor(
    private geo: THREE.BufferGeometry,
    private mat: THREE.Material,
    private o: { cast?: boolean; receive?: boolean; info?: boolean } = {},
  ) {}

  add(
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    c: THREE.Color,
    ry = 0,
    info: [number, number, number] = [0, 0, 0],
    rx = 0,
    rz = 0,
  ) {
    _e.set(rx, ry, rz, "YXZ");
    _q.setFromEuler(_e);
    const m = new THREE.Matrix4().compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
    this.items.push({ m, c, i: info });
  }

  build(parent: THREE.Object3D) {
    if (!this.items.length) return null;
    const geo = this.o.info ? this.geo.clone() : this.geo;
    const mesh = new THREE.InstancedMesh(geo, this.mat, this.items.length);
    const infoArr = new Float32Array(this.items.length * 3);
    this.items.forEach((it, k) => {
      mesh.setMatrixAt(k, it.m);
      mesh.setColorAt(k, it.c);
      infoArr.set(it.i, k * 3);
    });
    if (this.o.info) geo.setAttribute("aInfo", new THREE.InstancedBufferAttribute(infoArr, 3));
    mesh.castShadow = this.o.cast ?? true;
    mesh.receiveShadow = this.o.receive ?? true;
    mesh.frustumCulled = false;
    parent.add(mesh);
    return mesh;
  }
}

/* ------------------------------------------------------------------ */
/* The plan: what the ground painter needs to know                      */
/* ------------------------------------------------------------------ */

export type BlockType = "tower" | "mid" | "shops" | "houses" | "park" | "plaza" | "green" | "hero" | "shore" | "none";
export type Plan = {
  blocks: { cx: number; cz: number; type: BlockType }[];
  lamps: { x: number; z: number }[];
  ponds: { x: number; z: number; r: number }[];
  /** coloured light spilling from neon onto the street */
  spills: { x: number; z: number; color: string }[];
  steam: { x: number; z: number }[];
  cranes: { x: number; z: number; h: number }[];
  /** lights that should shimmer on the water */
  seaLights: { x: number; z: number; color: string; i: number }[];
  piers: { x: number; z: number; axis: "x" | "z" }[];
  lights: { x: number; y: number; z: number; color: number; intensity: number; distance: number }[];
};

export type City = {
  group: THREE.Group;
  plan: Plan;
  tick: (t: number) => void;
};

/* ------------------------------------------------------------------ */
/* Builder                                                             */
/* ------------------------------------------------------------------ */

export function buildCity(time: Uniform, mobile: boolean): City {
  const r = rand(20240611);
  const group = new THREE.Group();
  const trimMat = makeTrimMaterial();
  const glowMat = makeGlowMaterial(1.9);
  const wallMat = makeWallMaterial({ time });

  const walls = new Bucket(GEO.box(), wallMat, { info: true });
  const wallsCyl = new Bucket(GEO.cyl(), wallMat, { info: true });
  const trims = new Bucket(GEO.box(), trimMat);
  const glows = new Bucket(GEO.box(), glowMat, { cast: false, receive: false });
  const cyls = new Bucket(GEO.cyl(), trimMat);
  const cones = new Bucket(GEO.cone(), trimMat);
  const icos = new Bucket(GEO.ico(), trimMat);
  const leaves = new Bucket(GEO.ico(), makeFoliageMaterial());
  const gables = new Bucket(GEO.gable(), trimMat);

  // neon signs: one instanced mesh per text so each keeps its own texture
  const signTextures = SIGN_TEXT.map((t, i) => makeSignTexture(t, NEON[i % NEON.length]));
  const signMats = signTextures.map((tex) => new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.5, 1.5, 1.5) }));
  const signGeo = new THREE.BoxGeometry(1, 1, 1);
  const signs = signMats.map((m) => new Bucket(signGeo, m, { cast: false, receive: false }));
  const GENERIC_SIGNS = SIGN_TEXT.indexOf("RECORDS") + 1;
  const SIGN_OK = signs.map((_, i) => i).filter((i) => i < GENERIC_SIGNS && i !== 10 && i !== 11); // GUESTHOUSE and PIER sit at fixed places
  const sp = (name: string) => signs[SIGN_TEXT.indexOf(name)];
  // big LED billboards: ads for the business itself
  const BOARDS: [string, string, string, string][] = [
    ["ONE SYSTEM", "CRM + AUTOMATION", "#ff5b3d", "#b02a6a"],
    ["AUTOMATE", "EVERY FOLLOW-UP", "#1fb5a8", "#1b4f9a"],
    ["NEVER LOSE", "A LEAD AGAIN", "#8a4fd8", "#3a2a8a"],
    ["BOOK NOW", "WE ANSWER IN 5 MIN", "#f2a53a", "#d8503a"],
    ["ZAPIER + GHL", "WIRED TOGETHER", "#38b36a", "#1d5f7a"],
  ];
  const boards = BOARDS.map(([h, sub, c1, c2]) => new Bucket(signGeo, new THREE.MeshBasicMaterial({ map: makeBoardTexture(h, sub, c1, c2), color: new THREE.Color(1.25, 1.25, 1.25) }), { cast: false, receive: false }));
  const leaseTex = makeSignTexture("LEASE", "#4fe0c8", true);
  const leaseMat = new THREE.MeshBasicMaterial({ map: leaseTex, color: new THREE.Color(1.5, 1.5, 1.5) });
  const vertSigns = new Bucket(signGeo, leaseMat, { cast: false, receive: false });

  const plan: Plan = { blocks: [], lamps: [], ponds: [], spills: [], steam: [], cranes: [], lights: [], seaLights: [], piers: [] };
  let seedN = 1;
  const nextSeed = () => (seedN = (seedN * 7 + 3) % 97);

  /* ---------------------------- small parts --------------------------- */

  const parapet = (x: number, y: number, z: number, w: number, d: number, c = SLAB) => {
    const t = 0.16;
    trims.add(x, y, z - d / 2, w + t, 0.34, t, c);
    trims.add(x, y, z + d / 2, w + t, 0.34, t, c);
    trims.add(x - w / 2, y, z, t, 0.34, d - t, c);
    trims.add(x + w / 2, y, z, t, 0.34, d - t, c);
  };

  const tree = (x: number, z: number, s = 1, y = 0) => {
    const c = r() < 0.1 ? pick(r, AUTUMN) : pick(r, TREE);
    cyls.add(x, y, z, 0.16 * s, 0.9 * s, 0.16 * s, TRUNK);
    leaves.add(x, y + 1.35 * s, z, 1.7 * s, 1.5 * s, 1.7 * s, c, r() * 3);
    leaves.add(x + 0.18 * s, y + 2.05 * s, z - 0.1 * s, 1.2 * s, 1.1 * s, 1.2 * s, c.clone().multiplyScalar(1.12), r() * 3);
    leaves.add(x - 0.3 * s, y + 1.0 * s, z + 0.2 * s, 1.2 * s, 0.95 * s, 1.2 * s, c.clone().multiplyScalar(0.88), r() * 3);
  };

  const lamp = (x: number, z: number, dx: number, dz: number) => {
    cyls.add(x, 0, z, 0.1, 3.4, 0.1, TRIM);
    const bx = x + dx * 0.9;
    const bz = z + dz * 0.9;
    const along = Math.abs(dx) > 0 ? 0 : Math.PI / 2;
    trims.add(x + dx * 0.45, 3.3, z + dz * 0.45, Math.abs(dx) > 0 ? 0.95 : 0.08, 0.08, Math.abs(dz) > 0 ? 0.95 : 0.08, TRIM, along * 0);
    glows.add(bx, 3.2, bz, 0.34, 0.1, 0.34, col("#ffc98a"));
    plan.lamps.push({ x: bx, z: bz });
  };

  const acUnit = (x: number, y: number, z: number, s = 1) => {
    trims.add(x, y, z, 0.9 * s, 0.55 * s, 0.7 * s, pick(r, METAL), r() * 1.5);
    trims.add(x, y + 0.55 * s, z, 0.62 * s, 0.06 * s, 0.5 * s, TRIM);
  };

  const waterTank = (x: number, y: number, z: number) => {
    for (const [dx, dz] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]]) trims.add(x + dx, y, z + dz, 0.07, 1.0, 0.07, TRIM);
    cyls.add(x, y + 1.0, z, 1.15, 1.2, 1.15, col("#5b5266"));
    cones.add(x, y + 2.2, z, 1.3, 0.55, 1.3, col("#40384c"));
  };

  const dish = (x: number, y: number, z: number, ry: number) => {
    cyls.add(x, y, z, 0.06, 0.5, 0.06, TRIM);
    trims.add(x, y + 0.45, z, 0.75, 0.08, 0.75, col("#b8bccb"), ry, [0, 0, 0], -0.7);
  };

  const antenna = (x: number, y: number, z: number, h: number, blink = true) => {
    cyls.add(x, y, z, 0.07, h, 0.07, TRIM);
    if (blink) glows.add(x, y + h, z, 0.22, 0.22, 0.22, col("#ff5a4a"));
  };

  const roofKit = (x: number, y: number, z: number, w: number, d: number, tall: boolean) => {
    parapet(x, y, z, w, d);
    const rooms = Math.floor(r() * 3);
    for (let i = 0; i < 1 + rooms; i++) {
      const rx = x + (r() - 0.5) * (w - 1.3);
      const rz = z + (r() - 0.5) * (d - 1.3);
      acUnit(rx, y, rz, 0.8 + r() * 0.5);
    }
    if (w > 2.4 && d > 2.4) {
      const q = r();
      if (q < 0.28) waterTank(x + (r() - 0.5) * (w - 1.8), y, z + (r() - 0.5) * (d - 1.8));
      else if (q < 0.5) trims.add(x + w * 0.2, y, z - d * 0.2, 1.0, 0.8, 1.0, pick(r, FACADE.concrete));
      else if (q < 0.64) dish(x - w * 0.2, y, z + d * 0.2, r() * 3);
      else if (q < 0.78) {
        for (let k = 0; k < 3; k++) trims.add(x - 0.7 + k * 0.7, y + 0.05, z + d * 0.18, 0.62, 0.06, 1.1, col("#2b3a63"), 0, [0, 0, 0], -0.45);
      }
    }
    if (tall && r() < 0.6) antenna(x + (r() - 0.5) * w * 0.4, y, z + (r() - 0.5) * d * 0.4, 2.5 + r() * 3);
    if (w > 2.4 && d > 2.4) {
      const q2 = r();
      if (q2 < 0.1) {
        // roof garden
        trims.add(x, y + 0.02, z, w * 0.7, 0.18, d * 0.7, col("#4a6b3f"));
        for (let k = 0; k < 3; k++) icos.add(x + (r() - 0.5) * w * 0.5, y + 0.55, z + (r() - 0.5) * d * 0.5, 0.8, 0.7, 0.8, pick(r, TREE), r() * 3);
      } else if (q2 < 0.18 && tall) {
        // helipad
        cyls.add(x, y, z, Math.min(w, d) * 0.7, 0.1, Math.min(w, d) * 0.7, col("#3a3f50"));
        glows.add(x, y + 0.11, z, 0.9, 0.03, 0.14, col("#e8e0d0"));
        glows.add(x - 0.35, y + 0.11, z, 0.14, 0.03, 0.9, col("#e8e0d0"));
        glows.add(x + 0.35, y + 0.11, z, 0.14, 0.03, 0.9, col("#e8e0d0"));
      } else if (q2 < 0.24) {
        // little wind turbine
        cyls.add(x, y, z, 0.08, 2.4, 0.08, col("#c9ced9"));
        for (let b = 0; b < 3; b++) trims.add(x, y + 2.4, z, 0.06, 1.0, 0.04, col("#e9ecf4"), 0, [0, 0, 0], 0, (b * Math.PI * 2) / 3);
      }
    }
  };

  const awning = (x: number, z: number, w: number, d: number, side: "x+" | "x-" | "z+" | "z-", y = 3.0) => {
    const c = pick(r, AWNING);
    const reach = 0.75;
    if (side === "x+") trims.add(x + w / 2 + reach / 2, y, z, reach, 0.1, d * 0.84, c, 0, [0, 0, 0], 0, -0.22);
    else if (side === "x-") trims.add(x - w / 2 - reach / 2, y, z, reach, 0.1, d * 0.84, c, 0, [0, 0, 0], 0, 0.22);
    else if (side === "z+") trims.add(x, y, z + d / 2 + reach / 2, w * 0.84, 0.1, reach, c, 0, [0, 0, 0], 0.22, 0);
    else trims.add(x, y, z - d / 2 - reach / 2, w * 0.84, 0.1, reach, c, 0, [0, 0, 0], -0.22, 0);
  };

  const sign = (x: number, y: number, z: number, ry: number, big = false) => {
    const k = SIGN_OK[Math.floor(r() * SIGN_OK.length)];
    const w = big ? 2.4 : 1.7;
    signs[k].add(x, y, z, w, w * 0.31, 0.12, new THREE.Color(1, 1, 1), ry);
  };

  /** a sign that sticks out from the wall, the way shopfronts do */
  const bladeSign = (x: number, y: number, z: number, ry = Math.PI / 2) => {
    const k = SIGN_OK[Math.floor(r() * SIGN_OK.length)];
    trims.add(x, y + 0.02, z, ry ? 0.05 : 0.7, 0.06, ry ? 0.7 : 0.05, TRIM);
    signs[k].add(x + (ry ? 0.34 : 0), y - 0.15, z + (ry ? 0 : 0.34), 1.1, 0.34, 0.1, new THREE.Color(1, 1, 1), ry);
  };

  /** a big LED billboard on a catwalk frame, lit from above, readable from both sides */
  const megaBoard = (x: number, y: number, z: number, ry: number, width = 6.4) => {
    const k = Math.floor(r() * boards.length);
    const h = width * 0.44;
    const cs = Math.cos(ry);
    const sn = Math.sin(ry);
    for (const dx of [-width * 0.42, width * 0.42]) cyls.add(x + cs * dx, y, z - sn * dx, 0.28, h + 1.6, 0.28, TRIM);
    trims.add(x, y + 0.9, z, width * 0.9, 0.14, 0.7, SLAB, ry);
    boards[k].add(x + sn * 0.16, y + 1.1 + h / 2, z + cs * 0.16, width, h, 0.28, new THREE.Color(1, 1, 1), ry);
    boards[k].add(x - sn * 0.16, y + 1.1 + h / 2, z - cs * 0.16, width, h, 0.28, new THREE.Color(1, 1, 1), ry + Math.PI);
    for (const dx of [-width * 0.36, 0, width * 0.36]) glows.add(x + cs * dx + sn * 0.5, y + h + 1.45, z - sn * dx + cs * 0.5, 0.4, 0.22, 0.4, col("#fff3d0"));
  };

  const neonStrip = (x: number, y: number, z: number, sx: number, sy: number, sz: number) => {
    const c = col(pick(r, NEON)).multiplyScalar(0.8);
    glows.add(x, y, z, sx, sy, sz, c);
  };

  /** the foot of a big building, dressed like the case-study bases: a stone plinth with joints and a lit ledge, a step, planters, lamps and (on towers) a flag */
  const BASE_TINTS = ["#ff7a5c", "#7f8cd6", "#86b08a", "#d6b980", "#8b6f98", "#a9c3d6"].map((h) => col(h));
  const basework = (cx: number, cz: number, w: number, d: number, tall: boolean) => {
    const STONE = col("#4a5068");
    const LEDGE = col("#7b829c");
    const JOINT = col("#2c3040");
    const tint = pick(r, BASE_TINTS);
    const sx = w / 2;
    const sz = d / 2;
    const hb = tall ? 0.45 : 0.32;
    trims.add(cx, 0, cz, w + 0.46, hb, d + 0.46, STONE);
    trims.add(cx, hb, cz, w + 0.58, 0.1, d + 0.58, LEDGE);
    glows.add(cx, hb + 0.1, cz + sz + 0.31, w + 0.5, 0.04, 0.04, tint.clone().multiplyScalar(0.7));
    glows.add(cx + sx + 0.31, hb + 0.1, cz, 0.04, 0.04, d + 0.5, tint.clone().multiplyScalar(0.45));
    // stone joints on the two street faces
    for (let k = -sx; k <= sx + 0.01; k += 1.1) trims.add(cx + k, 0, cz + sz + 0.25, 0.05, hb, 0.04, JOINT);
    for (let k = -sz; k <= sz + 0.01; k += 1.1) trims.add(cx + sx + 0.25, 0, cz + k, 0.04, hb, 0.05, JOINT);
    trims.add(cx, hb * 0.5, cz + sz + 0.25, w + 0.4, 0.04, 0.04, JOINT);
    // a step up to the door and a lit lintel over it
    trims.add(cx - 1.2, 0, cz + sz + 0.5, Math.min(2.2, w * 0.45), 0.24, 0.26, LEDGE);
    glows.add(cx - 1.2, hb + 1.5, cz + sz + 0.28, Math.min(2.0, w * 0.4), 0.06, 0.05, tint.clone().multiplyScalar(0.8));
    // planters at the corners, with a bush and a little uplight
    for (const sgn of [-1, 1]) {
      const px = cx + sgn * (sx - 0.1);
      const pz = cz + sz + 0.55;
      trims.add(px, 0, pz, 0.7, 0.5, 0.6, STONE);
      trims.add(px, 0.5, pz, 0.78, 0.08, 0.68, LEDGE);
      icos.add(px, 0.62, pz, 0.7, 0.6, 0.6, pick(r, TREE), r() * 3);
      glows.add(px, 0.1, pz + 0.34, 0.2, 0.06, 0.05, tint.clone().multiplyScalar(0.8));
    }
    if (tall || r() < 0.4) {
      // a lamp post at the front corner
      const lx = cx + sx + 0.4;
      const lz = cz + sz + 0.4;
      cyls.add(lx, 0.1, lz, 0.1, 2.8, 0.1, TRIM);
      glows.add(lx, 2.9, lz, 0.34, 0.12, 0.34, col("#ffc98a"));
      plan.lamps.push({ x: lx, z: lz });
    }
    if (tall && r() < 0.6) {
      // a flag on a short pole at the back corner
      const fx = cx - sx - 0.1;
      const fz = cz - sz + 0.1;
      cyls.add(fx, hb, fz, 0.07, 4.2, 0.07, TRIM);
      trims.add(fx + 0.5, hb + 3.5, fz, 0.9, 0.5, 0.04, tint);
    }
  };

  /* --------------------------- building types ------------------------- */

  const capFor = (cx: number, cz: number) => {
    // keep landmarks readable: nearby blocks stay low, then rise away from them
    const zd = zoneDistance(cx, cz);
    let cap = 5 + Math.max(0, zd) * 0.8;
    // the strip right in front of the showcase plaza would hide it
    if (cz > -43 && cz < -34) cap = Math.min(cap, 6.5);
    const far = Math.max(-cx, cz - 22);
    if (far > 6) cap = Math.min(cap, 5 + 23 * (1 - smooth(8, 46, far)));
    // the hero corner at block (2,2) needs open sky around it, especially toward the camera
    const hd = Math.hypot(cx - 16, cz - 16) - 6;
    if (hd < 22) cap = Math.min(cap, 3.6 + Math.max(0, hd) * 0.75);
    return cap;
  };

  const tower = (cx: number, cz: number, d: number, glassKind?: "crystal" | "round") => {
    const cap = glassKind ? 60 : capFor(cx, cz);
    const w = 3.2 + r() * 1.0;
    const dd = 3.2 + r() * 1.0;
    const spike = d > 26 && r() < 0.14;
    const hRaw = spike ? 40 + r() * 16 : 12 + r() * (11 + 9 * (1 - smooth(0, 38, d)));
    const h = glassKind ? 38 + r() * 4 : Math.max(7, Math.min(cap, hRaw));
    const seed = nextSeed();
    const q = r();
    type Arch = "setback" | "needle" | "deco" | "twin" | "diamond" | "octagon" | "slab";
    type ArchG = Arch | "crystal" | "round";
    let arch: ArchG = glassKind ?? (q < 0.24 ? "setback" : q < 0.36 ? "needle" : q < 0.48 ? "deco" : q < 0.58 ? "twin" : q < 0.69 ? "diamond" : q < 0.8 ? "octagon" : "slab");
    if (h < 16 && (arch === "needle" || arch === "deco")) arch = "setback";
    if (h < 12 && arch === "twin") arch = "slab";
    const glassy = glassKind ? true : arch === "needle" || arch === "twin" || arch === "diamond" ? r() < 0.85 : arch === "deco" ? false : r() < 0.45;
    const palette = glassy
      ? pick(r, [FACADE.glass, FACADE.glass, FACADE.teal])
      : arch === "deco"
        ? pick(r, [FACADE.sand, FACADE.terra, FACADE.white])
        : pick(r, [FACADE.concrete, FACADE.concrete, FACADE.plaster, FACADE.sand, FACADE.white, FACADE.terra]);
    const c = pick(r, palette);
    const style = glassKind ? 4 : glassy ? 3 : 0;

    // podium: three floors of shops with awnings and a neon sign
    const pw = 5.4, pd = 5.4, ph = 3.4;
    walls.add(cx, 0, cz, pw, ph, pd, pick(r, FACADE.brick), 0, [seed, 2, 0]);
    basework(cx, cz, pw, pd, true);
    trims.add(cx, ph, cz, pw + 0.3, 0.2, pd + 0.3, SLAB);
    awning(cx, cz, pw, pd, "x+");
    awning(cx, cz, pw, pd, "z+");
    awning(cx, cz, pw, pd, "x-");
    awning(cx, cz, pw, pd, "z-");
    sign(cx + 0.3, 3.7, cz + pd / 2 + 0.28, 0);
    if (r() < 0.6) sign(cx + pw / 2 + 0.28, 3.7, cz - 0.2, Math.PI / 2);
    if (r() < 0.5) sign(cx - pw / 2 - 0.28, 3.7, cz + 0.6, -Math.PI / 2);
    if (r() < 0.5) bladeSign(cx + pw / 2 + 0.05, 3.1, cz + pd / 2 - 0.5);

    const y0 = ph + 0.2;
    const total = h - y0;
    let topY = h;
    let topW = w;
    let topD = dd;

    if (arch === "crystal") {
      // a faceted crystal: three tiers, each turned against the last, all curtain glass
      const t1 = total * 0.52;
      const t2 = total * 0.3;
      const t3 = total - t1 - t2 - 0.4;
      walls.add(cx, y0, cz, 3.9, t1, 3.9, c, 0, [seed, 4, 0]);
      trims.add(cx, y0 + t1, cz, 4.0, 0.14, 4.0, col("#9fb4d8"));
      walls.add(cx, y0 + t1 + 0.14, cz, 3.1, t2, 3.1, c.clone().multiplyScalar(1.06), Math.PI / 4, [seed + 1, 4, 0]);
      trims.add(cx, y0 + t1 + t2 + 0.14, cz, 3.2, 0.14, 3.2, col("#9fb4d8"), Math.PI / 4);
      walls.add(cx, y0 + t1 + t2 + 0.28, cz, 2.2, t3, 2.2, c.clone().multiplyScalar(1.1), 0, [seed + 2, 4, 0]);
      cones.add(cx, h - 0.1, cz, 1.4, 6.5, 1.4, col("#9fb4d8"));
      glows.add(cx, h + 6.2, cz, 0.24, 0.24, 0.24, col("#ff5a4a"));
      for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) glows.add(cx + sx * 1.96, y0, cz + sz * 1.96, 0.08, t1, 0.08, col("#4fd8ff").multiplyScalar(0.55));
      topY = h;
      topW = 2.2;
      topD = 2.2;
    } else if (arch === "round") {
      // a glass cylinder with a domed crown and a lit ring
      const lower = total * 0.72;
      wallsCyl.add(cx, y0, cz, 4.4, lower, 4.4, c, 0, [seed, 4, 0]);
      cyls.add(cx, y0 + lower, cz, 4.6, 0.18, 4.6, col("#9fb4d8"));
      glows.add(cx, y0 + lower + 0.18, cz, 4.7, 0.07, 4.7, col("#4fd8ff").multiplyScalar(0.6));
      wallsCyl.add(cx, y0 + lower + 0.18, cz, 3.3, total - lower - 0.18, 3.3, c.clone().multiplyScalar(1.08), 0, [seed + 1, 4, 0]);
      icos.add(cx, h, cz, 3.4, 2.2, 3.4, col("#6fa0d8"));
      cones.add(cx, h + 0.9, cz, 0.3, 4.5, 0.3, col("#c9ced9"));
      glows.add(cx, h + 5.2, cz, 0.22, 0.22, 0.22, col("#ff5a4a"));
      topY = h;
      topW = 3.3;
      topD = 3.3;
    } else if (arch === "setback") {
      const tiers = h > 18 ? (r() < 0.55 ? 3 : 2) : 1;
      let y = y0;
      let tw = w, td = dd;
      for (let t = 0; t < tiers; t++) {
        const th = t === tiers - 1 ? Math.max(2, total - (total / tiers) * t) : total / tiers;
        walls.add(cx, y, cz, tw, th, td, c.clone().multiplyScalar(1 - t * 0.04), 0, [seed, style, 0]);
        trims.add(cx, y + th, cz, tw + 0.2, 0.18, td + 0.2, SLAB);
        y += th + 0.18;
        tw *= 0.78;
        td *= 0.78;
      }
      topY = y;
      topW = tw / 0.78;
      topD = td / 0.78;
      roofKit(cx, y, cz, topW, topD, true);
      facadeUnits(cx, cz, w, dd, ph + 1, h - 1, 5 + Math.floor(h / 5));
      if (spike) cones.add(cx, y + 2.6, cz, tw * 0.55, 7, td * 0.55, pick(r, METAL));
    } else if (arch === "needle") {
      // a single slim shaft that narrows into a lit spire
      const nw = w * 0.72, nd = dd * 0.72;
      walls.add(cx, y0, cz, nw, total * 0.82, nd, c, 0, [seed, style, 0]);
      walls.add(cx, y0 + total * 0.82, cz, nw * 0.62, total * 0.18, nd * 0.62, c.clone().multiplyScalar(0.96), 0, [seed, style, 0]);
      trims.add(cx, h, cz, nw * 0.62 + 0.2, 0.18, nd * 0.62 + 0.2, SLAB);
      cones.add(cx, h + 0.18, cz, nw * 0.34, 8 + r() * 4, nd * 0.34, pick(r, METAL));
      glows.add(cx, h + 8.4, cz, 0.24, 0.24, 0.24, col("#ff5a4a"));
      for (const [sx, sz] of [[1, 1], [-1, -1]]) glows.add(cx + (sx * nw) / 2, y0, cz + (sz * nd) / 2, 0.1, total * 0.82, 0.1, col(pick(r, NEON)).multiplyScalar(0.6));
      topW = nw;
      topD = nd;
    } else if (arch === "deco") {
      // art-deco wedding cake: five tiers, uplit ledges, a gilded spire
      const scales = [1, 0.84, 0.68, 0.52, 0.38];
      const fr = [0.36, 0.26, 0.2, 0.12, 0.06];
      let y = y0;
      for (let k = 0; k < 5; k++) {
        const th = total * fr[k];
        const tw = w * scales[k];
        const td = dd * scales[k];
        walls.add(cx, y, cz, tw, th, td, c.clone().multiplyScalar(1 - k * 0.03), 0, [seed, 0, 0]);
        trims.add(cx, y + th, cz, tw + 0.22, 0.16, td + 0.22, k % 2 ? col("#b89a5a") : SLAB);
        glows.add(cx, y + th - 0.1, cz, tw + 0.28, 0.08, td + 0.28, col("#ffcf8a").multiplyScalar(0.5));
        y += th + 0.16;
      }
      cones.add(cx, y, cz, 0.7, 6 + r() * 3, 0.7, col("#d4b26a"));
      glows.add(cx, y + 6.4, cz, 0.22, 0.22, 0.22, col("#ff5a4a"));
      topY = y;
      topW = w * 0.38;
      topD = dd * 0.38;
    } else if (arch === "twin") {
      // two slim towers joined by a lit sky bridge
      const tw = w * 0.5, td = dd * 0.62;
      for (const sx of [-1, 1]) {
        const hh = Math.max(10, sx < 0 ? h : h * 0.84);
        walls.add(cx + sx * 1.75, y0, cz, tw, hh - y0, td, c.clone().multiplyScalar(sx < 0 ? 1 : 0.96), 0, [seed + (sx < 0 ? 0 : 1), style, 0]);
        trims.add(cx + sx * 1.75, hh, cz, tw + 0.2, 0.18, td + 0.2, SLAB);
        roofKit(cx + sx * 1.75, hh + 0.18, cz, tw, td, true);
      }
      const by = y0 + total * 0.6;
      walls.add(cx, by, cz, 3.7 - tw + 0.3, 1.5, td * 0.7, col("#5b6478"), 0, [seed, 3, 0]);
      glows.add(cx, by + 0.4, cz + td * 0.35 + 0.03, 3.7 - tw, 0.5, 0.04, col("#ffcf8a").multiplyScalar(0.7));
      topW = tw;
      topD = td;
    } else if (arch === "diamond") {
      // the whole tower is turned 45 degrees, with a smaller turned crown
      const sq = Math.min(w, dd) * 0.95 + 0.3;
      const lower = total * 0.72;
      walls.add(cx, y0, cz, sq, lower, sq, c, Math.PI / 4, [seed, style, 0]);
      trims.add(cx, y0 + lower, cz, sq + 0.2, 0.18, sq + 0.2, SLAB, Math.PI / 4);
      walls.add(cx, y0 + lower + 0.18, cz, sq * 0.7, total - lower - 0.18, sq * 0.7, c.clone().multiplyScalar(0.95), Math.PI / 4, [seed, style, 0]);
      trims.add(cx, h, cz, sq * 0.7 + 0.2, 0.18, sq * 0.7 + 0.2, SLAB, Math.PI / 4);
      glows.add(cx, h - 0.6, cz, sq * 0.7 + 0.06, 0.1, sq * 0.7 + 0.06, col(pick(r, NEON)).multiplyScalar(0.55), Math.PI / 4);
      roofKit(cx, h + 0.18, cz, sq * 0.5, sq * 0.5, true);
      topW = sq * 0.5;
      topD = sq * 0.5;
    } else if (arch === "octagon") {
      // a round (octagonal) tower with a domed crown
      const dia = Math.min(w, dd) + 0.9;
      const lower = total * 0.78;
      wallsCyl.add(cx, y0, cz, dia, lower, dia, c, 0, [seed, 0, 0]);
      cyls.add(cx, y0 + lower, cz, dia + 0.25, 0.2, dia + 0.25, SLAB);
      glows.add(cx, y0 + lower + 0.2, cz, dia + 0.3, 0.07, dia + 0.3, col(pick(r, NEON)).multiplyScalar(0.5));
      wallsCyl.add(cx, y0 + lower + 0.2, cz, dia * 0.72, total - lower - 0.2, dia * 0.72, c.clone().multiplyScalar(0.94), 0, [seed, 0, 0]);
      icos.add(cx, h, cz, dia * 0.74, dia * 0.5, dia * 0.74, pick(r, [col("#4f8d8a"), col("#8a6f52"), col("#7a8094")]));
      cones.add(cx, h + dia * 0.18, cz, 0.3, 3, 0.3, pick(r, METAL));
    } else {
      // wide hotel slab: horizontal light bands, a billboard and a roof terrace
      const along = r() < 0.5;
      const sw = along ? 5.0 : 2.7;
      const sd = along ? 2.7 : 5.0;
      const hh = Math.max(8, h * 0.78);
      walls.add(cx, y0, cz, sw, hh - y0, sd, c, 0, [seed, style, 0]);
      trims.add(cx, hh, cz, sw + 0.2, 0.18, sd + 0.2, SLAB);
      const band = col(pick(r, NEON)).multiplyScalar(0.45);
      for (let y = y0 + 3; y < hh - 1; y += 3.4) {
        glows.add(cx, y, cz + sd / 2 + 0.03, sw * 0.96, 0.07, 0.04, band);
        glows.add(cx + sw / 2 + 0.03, y, cz, 0.04, 0.07, sd * 0.96, band);
      }
      roofKit(cx, hh + 0.18, cz, sw, sd, false);
      if (r() < 0.6) billboard(cx, hh + 0.18, cz, 0);
      facadeUnits(cx, cz, sw, sd, ph + 1, hh - 1, 4 + Math.floor(hh / 5));
      topY = hh;
      topW = sw;
      topD = sd;
    }
    entrance(cx - 1.2, cz, pd);
    if (h > 14 && r() < 0.18 && (arch === "setback" || arch === "slab" || arch === "diamond")) megaBoard(cx, topY + 0.2, cz, r() < 0.5 ? 0 : Math.PI / 2, Math.min(7, Math.max(4.6, topW * 1.5)));
    if (r() < 0.4 && arch !== "needle" && arch !== "deco") {
      // glowing crown band
      glows.add(cx, topY - 1.4, cz, topW + 0.05, 0.12, topD + 0.05, col(pick(r, NEON)).multiplyScalar(0.55));
    }
    if (h > 16 && r() < 0.5 && (arch === "setback" || arch === "slab")) {
      vertSigns.add(cx + w / 2 + 0.12, ph + 1.6, cz + (r() - 0.5) * 0.6, 0.9, 4.2, 0.12, new THREE.Color(1, 1, 1), 0);
    }
    if (r() < 0.25 && arch === "setback") neonStrip(cx + w / 2 + 0.04, ph + 0.5, cz - dd / 2 + 0.04, 0.08, h - ph - 1.2, 0.08);
  };

  const mid = (cx: number, cz: number, d: number) => {
    const cap = capFor(cx, cz);
    const layout = r();
    const spots: { x: number; z: number; w: number; dd: number }[] = [];
    if (layout < 0.55) {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) spots.push({ x: cx + sx * 1.55, z: cz + sz * 1.55, w: 2.5 + r() * 0.3, dd: 2.5 + r() * 0.3 });
    } else if (layout < 0.8) {
      spots.push({ x: cx, z: cz - 1.55, w: 5.4, dd: 2.6 }, { x: cx, z: cz + 1.55, w: 5.4, dd: 2.6 });
    } else {
      spots.push({ x: cx - 1.55, z: cz, w: 2.6, dd: 5.4 }, { x: cx + 1.55, z: cz, w: 2.6, dd: 5.4 });
    }
    spots.forEach((s) => {
      const h = Math.min(cap, 4 + r() * 6 + (1 - smooth(10, 50, d)) * 3);
      const style = r() < 0.4 ? 2 : r() < 0.6 ? 1 : 0;
      const palette = style === 1 ? FACADE.pastel : pick(r, [FACADE.brick, FACADE.concrete, FACADE.plaster, FACADE.sand, FACADE.terra, FACADE.white]);
      const c = pick(r, palette);
      const seed = nextSeed();
      walls.add(s.x, 0, s.z, s.w, h, s.dd, c, 0, [seed, style, 0]);
      if (h > 6) basework(s.x, s.z, s.w, s.dd, false);
      trims.add(s.x, h, s.z, s.w + 0.14, 0.16, s.dd + 0.14, SLAB);
      const rq = r();
      if (rq < 0.2 && style !== 2) {
        // pitched roof on an older building, with a chimney
        const rot = r() < 0.5 ? 0 : Math.PI / 2;
        gables.add(s.x, h + 0.16, s.z, (rot ? s.dd : s.w) + 0.3, 1.5 + r() * 0.8, (rot ? s.w : s.dd) + 0.3, pick(r, ROOF), rot);
        trims.add(s.x + (r() - 0.5) * s.w * 0.4, h + 1.2, s.z, 0.34, 1.0, 0.34, pick(r, FACADE.brick));
      } else if (rq < 0.32) {
        // copper mansard
        cones.add(s.x, h + 0.16, s.z, Math.max(s.w, s.dd) * 1.15, 1.9, Math.max(s.w, s.dd) * 1.15, col(pick(r, ["#5a8f7a", "#4f7d6a", "#6a9a86"])));
        glows.add(s.x, h + 0.9, s.z + s.dd / 2 * 0.62, 0.34, 0.4, 0.06, col("#ffcf8a"));
      } else roofKit(s.x, h + 0.16, s.z, s.w, s.dd, h > 8);
      if (h > 8 && r() < 0.12 && s.w < 3 && s.dd < 3) {
        // corner turret
        wallsCyl.add(s.x + s.w / 2 - 0.2, 0, s.z - s.dd / 2 + 0.2, 1.3, h + 1.6, 1.3, c.clone().multiplyScalar(0.94), 0, [seed, 0, 0]);
        cones.add(s.x + s.w / 2 - 0.2, h + 1.6, s.z - s.dd / 2 + 0.2, 1.6, 1.8, 1.6, col(pick(r, ["#5a8f7a", "#4d5470", "#8a4f45"])));
      }
      facadeUnits(s.x, s.z, s.w, s.dd, 2.4, h - 0.6, 2 + Math.floor(h / 4));
      if (style === 1 && h > 6) balconies(s.x, s.z, s.w, s.dd, h);
      if (style === 0 && h > 6 && palette === FACADE.brick) fireEscape(s.x, s.z, s.w, s.dd, h);
      if (h > 7 && r() < 0.14) billboard(s.x, h + 0.16, s.z, 0);
      else if (h > 7 && r() < 0.08) megaBoard(s.x, h + 0.16, s.z, r() < 0.5 ? 0 : Math.PI / 2, Math.max(4.4, Math.max(s.w, s.dd) * 1.2));
      if (style !== 2 && s.z >= cz) entrance(s.x, s.z, s.dd);
      if (r() < 0.38) sign(s.x + (r() - 0.5) * 0.8, 3.4, s.z + s.dd / 2 + 0.3, 0);
      if (r() < 0.3) bladeSign(s.x + s.w / 2 + 0.05, 4.0, s.z + s.dd / 2 - 0.5);
      if (style === 2) {
        const sxDir = s.x > cx + 0.2 ? "x+" : s.x < cx - 0.2 ? "x-" : null;
        if (sxDir) awning(s.x, s.z, s.w, s.dd, sxDir);
        const szDir = s.z > cz + 0.2 ? "z+" : s.z < cz - 0.2 ? "z-" : null;
        if (szDir) awning(s.x, s.z, s.w, s.dd, szDir);
        if (r() < 0.6) sign(s.x + (r() - 0.5), 3.5, s.z + s.dd / 2 + 0.3, 0);
      }
      if (r() < 0.25) {
        // balcony band on a residential block
        trims.add(s.x, h * 0.55, s.z + s.dd / 2 + 0.2, s.w * 0.7, 0.1, 0.5, SLAB);
      }
    });
  };

  const shops = (cx: number, cz: number) => {
    const cap = capFor(cx, cz);
    for (const sz of [-1, 1]) {
      const x = cx + (r() - 0.5) * 0.2;
      const z = cz + sz * 1.6;
      const w = 5.4;
      const dd = 2.6;
      const h = Math.min(cap, 3.6 + r() * 2.8);
      const seed = nextSeed();
      walls.add(x, 0, z, w, h, dd, pick(r, [...FACADE.brick, ...FACADE.plaster]), 0, [seed, 2, 0]);
      basework(x, z, w, dd, false);
      trims.add(x, h, z, w + 0.14, 0.16, dd + 0.14, SLAB);
      awning(x, z, w, dd, sz > 0 ? "z+" : "z-");
      awning(x, z, w, dd, "x+");
      if (sz > 0) sign(x + (r() - 0.5) * 1.2, 3.55, z + dd / 2 + 0.32, 0, true);
      else sign(x + (r() - 0.5) * 1.2, 3.55, z - dd / 2 - 0.32, Math.PI, true);
      roofKit(x, h + 0.16, z, w, dd, false);
      facadeUnits(x, z, w, dd, 3.6, h - 0.4, 2);
      entrance(x + 1.6, z, dd);
      if (r() < 0.45) bladeSign(x + w / 2 + 0.05, 3.6, z + (sz > 0 ? dd / 2 - 0.5 : -dd / 2 + 0.5));
      if (r() < 0.3) billboard(x, h + 0.16, z, 0);
      else if (r() < 0.1) megaBoard(x, h + 0.16, z, 0, 5.2);
    }
    if (r() < 0.7) tree(cx - 2.3, cz, 0.7);
  };

  /* ----------------------- street life and extra building types ----------------------- */

  const CARCOL = ["#b3363a", "#d9a441", "#cfd3dc", "#3f6fb0", "#6b7488", "#2f3548", "#4a9a8a"].map(col);
  const parkedCar = (x: number, z: number, ry: number) => {
    const c = pick(r, CARCOL);
    trims.add(x, 0.12, z, 1.7, 0.36, 0.82, c, ry);
    trims.add(x - Math.cos(ry) * 0.1, 0.48, z + Math.sin(ry) * 0.1, 0.95, 0.32, 0.7, col("#20253a"), ry);
    glows.add(x - Math.cos(ry) * 0.86, 0.26, z + Math.sin(ry) * 0.86, 0.05, 0.12, 0.5, col("#ff4a3a"), ry);
  };

  const busShelter = (x: number, z: number, ry: number) => {
    for (const dz of [-0.9, 0.9]) cyls.add(x + Math.sin(ry) * dz, 0, z + Math.cos(ry) * dz, 0.07, 2.5, 0.07, TRIM);
    trims.add(x, 2.5, z, ry ? 1.2 : 0.9, 0.1, ry ? 0.9 : 2.2, col("#4d5470"));
    glows.add(x + (ry ? 0 : 0.34), 0.6, z + (ry ? 0.34 : 0), ry ? 1.7 : 0.05, 1.5, ry ? 0.05 : 1.7, col("#9ec8ff").multiplyScalar(0.7));
  };

  const kiosk = (x: number, z: number) => {
    trims.add(x, 0, z, 1.2, 2.2, 1.2, pick(r, AWNING));
    trims.add(x, 2.2, z, 1.5, 0.12, 1.5, SLAB);
    glows.add(x, 0.9, z + 0.62, 0.8, 0.7, 0.04, col("#ffcf8a"));
  };

  const bench = (x: number, z: number, ry: number) => {
    trims.add(x, 0.3, z, 1.3, 0.1, 0.4, col("#6b5a48"), ry);
    trims.add(x - Math.sin(ry) * 0.2, 0.55, z - Math.cos(ry) * 0.2, 1.3, 0.35, 0.06, col("#6b5a48"), ry);
  };

  const trashCan = (x: number, z: number) => {
    cyls.add(x, 0, z, 0.4, 0.7, 0.4, col("#3a4a5a"));
    trims.add(x, 0.7, z, 0.46, 0.06, 0.46, TRIM);
  };
  const mailbox = (x: number, z: number) => {
    trims.add(x, 0, z, 0.5, 1.0, 0.5, col("#2f5f8a"));
    trims.add(x, 1.0, z, 0.5, 0.14, 0.5, col("#264b6b"));
  };
  const newsBox = (x: number, z: number) => {
    trims.add(x, 0, z, 0.5, 0.9, 0.45, pick(r, AWNING));
    glows.add(x, 0.55, z + 0.24, 0.3, 0.25, 0.03, col("#9ec8ff"));
  };
  const bikeRack = (x: number, z: number) => {
    trims.add(x, 0, z, 1.5, 0.4, 0.06, col("#8e93a6"));
    for (let k = 0; k < 3; k++) {
      cyls.add(x - 0.5 + k * 0.5, 0.2, z - 0.1, 0.5, 0.04, 0.5, TRIM, 0, [0, 0, 0], Math.PI / 2);
      cyls.add(x - 0.5 + k * 0.5, 0.2, z + 0.3, 0.5, 0.04, 0.5, TRIM, 0, [0, 0, 0], Math.PI / 2);
      trims.add(x - 0.5 + k * 0.5, 0.45, z + 0.1, 0.05, 0.05, 0.5, pick(r, AWNING));
    }
  };
  const cafeSet = (x: number, z: number) => {
    const awn = pick(r, AWNING);
    cyls.add(x, 0, z, 0.7, 0.75, 0.7, col("#8a7a62"));
    trims.add(x - 0.75, 0, z, 0.4, 0.45, 0.4, col("#6b5a48"));
    trims.add(x + 0.75, 0, z, 0.4, 0.45, 0.4, col("#6b5a48"));
    cyls.add(x, 0.75, z, 0.08, 1.5, 0.08, col("#e8e0d0"));
    cones.add(x, 2.1, z, 2.2, 0.55, 2.2, awn);
    glows.add(x, 0.78, z, 0.12, 0.1, 0.12, col("#ffcf8a"));
  };
  const planter = (x: number, z: number) => {
    trims.add(x, 0, z, 0.9, 0.55, 0.9, col("#8a4f45"));
    leaves.add(x, 0.55, z, 0.8, 0.8, 0.8, pick(r, TREE), r() * 3);
  };
  const phoneBooth = (x: number, z: number) => {
    trims.add(x, 0, z, 0.9, 2.3, 0.9, col("#b3363a"));
    glows.add(x, 0.4, z + 0.46, 0.6, 1.5, 0.03, col("#ffe6b0"));
  };
  const streetClock = (x: number, z: number) => {
    cyls.add(x, 0, z, 0.2, 3.6, 0.2, TRIM);
    trims.add(x, 3.4, z, 1.0, 1.0, 0.25, col("#2c3040"));
    glows.add(x, 3.5, z + 0.14, 0.8, 0.8, 0.04, col("#fff3d0"));
    glows.add(x, 3.9, z + 0.16, 0.04, 0.3, 0.03, col("#2c3040"));
  };
  const foodCart = (x: number, z: number) => {
    const awn = pick(r, AWNING);
    trims.add(x, 0.2, z, 1.4, 0.9, 0.8, col("#cfd3dc"));
    cyls.add(x - 0.5, 1.1, z, 0.06, 1.4, 0.06, col("#e8e0d0"));
    cones.add(x - 0.5, 2.3, z, 1.8, 0.45, 1.8, awn);
    glows.add(x + 0.1, 0.85, z + 0.42, 0.9, 0.18, 0.03, col("#ffcf8a"));
  };

  const streetLife = (cx: number, cz: number, type: BlockType) => {
    if (type === "park") {
      bench(cx - 1, cz + 2.2, 0);
      bench(cx + 1.4, cz - 2.2, 0);
      trashCan(cx + 2.4, cz + 2.2);
      if (r() < 0.4) foodCart(cx - 2, cz - 1.5);
      return;
    }
    if (r() < 0.5) parkedCar(cx + 3.2, cz + (r() - 0.5) * 4, Math.PI / 2);
    if (r() < 0.45) parkedCar(cx - 3.2, cz + (r() - 0.5) * 4, Math.PI / 2);
    if (r() < 0.35) parkedCar(cx + (r() - 0.5) * 4, cz - 3.2, 0);
    if (r() < 0.1) busShelter(cx + 3.15, cz + (r() - 0.5) * 2, 0);
    if (r() < 0.08) kiosk(cx - 3.0, cz + 3.0);
    // sidewalk life: bins, mailboxes, news racks, bikes, cafe tables, planters and the odd landmark
    if (type !== "houses") {
      if (r() < 0.6) trashCan(cx + 2.9, cz + (r() - 0.5) * 4);
      if (r() < 0.4) trashCan(cx - 2.9, cz + (r() - 0.5) * 4);
      if (r() < 0.35) mailbox(cx + 2.9, cz + (r() - 0.5) * 3);
      if (r() < 0.3) newsBox(cx - 2.9, cz + (r() - 0.5) * 3);
      if (r() < 0.28) bikeRack(cx + (r() - 0.5) * 3, cz + 3.0);
      if (r() < 0.3 && (type === "shops" || type === "mid" || type === "tower")) cafeSet(cx + (r() < 0.5 ? -1.4 : 1.4), cz + 3.5);
      if (r() < 0.25) planter(cx + (r() - 0.5) * 4, cz - 3.0);
      if (r() < 0.07) phoneBooth(cx - 2.9, cz - 2.4);
      if (r() < 0.05) streetClock(cx + 2.9, cz - 3.0);
      if (r() < 0.07) foodCart(cx + (r() - 0.5) * 3, cz + 3.5);
    }
  };

  /* ------------------------------ civic and service buildings ------------------------------ */

  const ambulance = (x: number, z: number, ry: number) => {
    trims.add(x, 0.12, z, 1.7, 0.85, 0.8, col("#eef0f4"), ry);
    trims.add(x, 0.45, z, 1.72, 0.16, 0.82, col("#c92a2a"), ry);
    trims.add(x + Math.cos(ry) * 0.7, 0.4, z - Math.sin(ry) * 0.7, 0.5, 0.45, 0.78, col("#cfd3dc"), ry);
    glows.add(x, 1.0, z, 0.5, 0.08, 0.22, col("#4fd8ff"), ry);
    glows.add(x - Math.cos(ry) * 0.84, 0.5, z + Math.sin(ry) * 0.84, 0.05, 0.14, 0.4, col("#ff4a3a"), ry);
  };

  const hospital = (cx: number, cz: number) => {
    const seed = nextSeed();
    const white = col("#d8dde8");
    // an H of two tall wings joined by a lower link
    walls.add(cx - 1.7, 0, cz - 0.3, 1.9, 8.6, 4.4, white, 0, [seed, 0, 0]);
    walls.add(cx + 1.7, 0, cz - 0.3, 1.9, 8.6, 4.4, white, 0, [seed + 1, 0, 0]);
    walls.add(cx, 0, cz - 0.3, 1.5, 5.4, 2.0, col("#c9d0de"), 0, [seed + 2, 3, 0]);
    for (const sx of [-1, 1]) trims.add(cx + sx * 1.7, 8.6, cz - 0.3, 2.1, 0.18, 4.6, SLAB);
    trims.add(cx, 5.4, cz - 0.3, 1.7, 0.16, 2.2, SLAB);
    // red cross, lit, on the front of one wing and on the roof of the other
    glows.add(cx + 1.7, 5.8, cz + 1.93, 1.0, 0.3, 0.05, col("#ff3a3a"));
    glows.add(cx + 1.7, 5.45, cz + 1.93, 0.3, 1.0, 0.05, col("#ff3a3a"));
    glows.add(cx - 1.7, 9.4, cz - 0.3, 1.2, 0.3, 0.3, col("#ff3a3a"));
    glows.add(cx - 1.7, 9.05, cz - 0.3, 0.3, 1.0, 0.3, col("#ff3a3a"));
    sp("HOSPITAL").add(cx - 1.7, 7.4, cz + 1.95, 1.8, 0.56, 0.12, new THREE.Color(1, 1, 1), 0);
    // helipad on the left wing
    cyls.add(cx - 1.7, 9.0, cz - 0.3, 1.5, 0.1, 1.5, col("#3a3f50"));
    glows.add(cx - 1.7, 9.12, cz - 0.3, 0.7, 0.03, 0.12, col("#e8e0d0"));
    glows.add(cx - 1.95, 9.12, cz - 0.3, 0.12, 0.03, 0.7, col("#e8e0d0"));
    glows.add(cx - 1.45, 9.12, cz - 0.3, 0.12, 0.03, 0.7, col("#e8e0d0"));
    antenna(cx + 1.7, 8.7, cz - 1.8, 2.6);
    // emergency bay with a canopy, two ambulances and a sign
    trims.add(cx, 2.7, cz + 2.55, 4.6, 0.14, 1.3, col("#e8e0d0"));
    for (const sx of [-1, 1]) cyls.add(cx + sx * 2.2, 0, cz + 3.0, 0.12, 2.7, 0.12, TRIM);
    glows.add(cx, 2.62, cz + 2.55, 4.2, 0.05, 1.0, col("#ffe6b0").multiplyScalar(0.7));
    sp("EMERGENCY").add(cx, 3.2, cz + 3.0, 2.2, 0.68, 0.12, new THREE.Color(1, 1, 1), 0);
    ambulance(cx - 1.0, cz + 2.7, 0);
    ambulance(cx + 1.3, cz + 2.7, 0);
    entrance(cx - 0.1, cz - 0.3, 4.4);
    for (const [dx, dz] of [[-2.7, 2.7], [2.7, 2.7], [2.7, -2.6]]) tree(cx + dx, cz + dz, 0.8);
    plan.spills.push({ x: cx, z: cz + 2.8, color: "255,70,70" });
  };

  const hotel = (cx: number, cz: number) => {
    const seed = nextSeed();
    const glass = pick(r, FACADE.teal);
    // podium with a porte-cochere and a grand awning
    walls.add(cx, 0, cz, 5.4, 3.4, 5.4, col("#b3a58f"), 0, [seed, 2, 0]);
    trims.add(cx, 3.4, cz, 5.7, 0.2, 5.7, SLAB);
    trims.add(cx, 2.8, cz + 3.0, 4.2, 0.16, 1.6, col("#e8e0d0"));
    for (const sx of [-1, 1]) cyls.add(cx + sx * 1.9, 0, cz + 3.6, 0.16, 2.8, 0.16, col("#e8e0d0"));
    glows.add(cx, 2.7, cz + 3.0, 3.8, 0.05, 1.4, col("#ffe6b0").multiplyScalar(0.8));
    glows.add(cx, 0.15, cz + 2.73, 2.2, 1.9, 0.05, col("#ffbf78"));
    // the tower: long glass slab with balcony bands
    const h = 15;
    walls.add(cx, 3.6, cz - 0.4, 4.6, h - 3.6, 3.4, glass, 0, [seed, 3, 0]);
    for (let y = 6.8; y < h; y += 3.2) {
      trims.add(cx, y, cz + 1.34, 4.7, 0.1, 0.35, SLAB);
      trims.add(cx + 2.34, y, cz - 0.4, 0.35, 0.1, 3.5, SLAB);
    }
    trims.add(cx, h, cz - 0.4, 4.8, 0.2, 3.6, SLAB);
    // rooftop pool and a big lit HOTEL sign facing both streets
    glows.add(cx - 0.6, h + 0.2, cz - 0.4, 2.2, 0.06, 1.4, col("#5fd0ff").multiplyScalar(0.7));
    trims.add(cx - 0.6, h + 0.2, cz - 0.4, 2.5, 0.2, 1.7, col("#e8e0d0"));
    signs[2].add(cx, h + 1.9, cz - 0.4, 4.6, 1.43, 0.14, new THREE.Color(1, 1, 1), 0);
    signs[2].add(cx + 2.5, h + 1.9, cz - 0.4, 3.6, 1.12, 0.14, new THREE.Color(1, 1, 1), Math.PI / 2);
    for (const sx of [-1, 1]) cyls.add(cx + sx * 2.0, h, cz - 0.4, 0.12, 1.2, 0.12, TRIM);
    // flags, valet cars, planters, lamps
    for (const sx of [-1, 1]) {
      cyls.add(cx + sx * 2.9, 0, cz + 3.1, 0.07, 3.2, 0.07, col("#e8e0d0"));
      trims.add(cx + sx * 2.9 + 0.35, 2.6, cz + 3.1, 0.7, 0.45, 0.04, sx > 0 ? col("#b3363a") : col("#3f6fb0"));
    }
    parkedCar(cx - 1.0, cz + 3.5, Math.PI / 2);
    parkedCar(cx + 1.2, cz + 3.6, Math.PI / 2);
    tree(cx - 2.8, cz - 2.6, 0.8);
    tree(cx + 2.8, cz - 2.6, 0.8);
    antenna(cx + 1.8, h, cz - 1.6, 3);
    plan.spills.push({ x: cx, z: cz + 3.0, color: "255,190,120" });
  };

  const school = (cx: number, cz: number) => {
    const seed = nextSeed();
    const brick = pick(r, FACADE.brick);
    // three wings round a courtyard, with a clock tower at the back
    walls.add(cx - 2.2, 0, cz - 0.6, 1.4, 4.4, 3.4, brick, 0, [seed, 1, 0]);
    walls.add(cx + 2.2, 0, cz - 0.6, 1.4, 4.4, 3.4, brick, 0, [seed + 1, 1, 0]);
    walls.add(cx, 0, cz - 2.2, 5.8, 4.4, 1.5, brick, 0, [seed + 2, 1, 0]);
    for (const [x, z, w, d] of [[-2.2, -0.6, 1.5, 3.5], [2.2, -0.6, 1.5, 3.5], [0, -2.2, 5.9, 1.6]] as const) trims.add(cx + x, 4.4, cz + z, w, 0.16, d, SLAB);
    walls.add(cx, 4.5, cz - 2.2, 1.3, 3.4, 1.3, col("#a89a86"), 0, [seed + 3, 0, 0]);
    cones.add(cx, 7.9, cz - 2.2, 1.6, 1.8, 1.6, col("#4d5470"));
    glows.add(cx, 6.2, cz - 1.53, 0.8, 0.8, 0.05, col("#fff3d0"));
    sp("SCHOOL").add(cx, 3.5, cz - 1.38, 2.4, 0.74, 0.12, new THREE.Color(1, 1, 1), 0);
    for (let k = -1; k <= 1; k++) glows.add(cx + k * 1.4, 1.5, cz - 1.45, 0.5, 0.7, 0.05, col("#ffbf78").multiplyScalar(0.8));
    entrance(cx, cz - 2.2, 1.5);
    // playground: a basketball hoop, a slide, swings, a flag and a yellow bus
    cyls.add(cx + 2.4, 0, cz + 1.8, 0.08, 2.6, 0.08, TRIM);
    trims.add(cx + 2.4, 2.2, cz + 1.8, 0.8, 0.6, 0.05, col("#e8e0d0"));
    glows.add(cx + 2.4, 2.0, cz + 1.55, 0.3, 0.05, 0.3, col("#ff8a3a"));
    trims.add(cx - 2.4, 0.2, cz + 1.8, 0.5, 1.2, 0.4, col("#d9a441"));
    trims.add(cx - 2.4, 0.9, cz + 2.4, 0.4, 0.06, 1.2, col("#4fa3a5"), 0, [0, 0, 0], 0.7, 0);
    for (const sx of [-0.6, 0.6]) cyls.add(cx - 0.8 + sx, 0, cz + 2.0, 0.06, 1.6, 0.06, TRIM);
    trims.add(cx - 0.8, 1.6, cz + 2.0, 1.4, 0.06, 0.06, TRIM);
    cyls.add(cx + 0.2, 0, cz + 0.9, 0.07, 3.4, 0.07, col("#e8e0d0"));
    trims.add(cx + 0.55, 2.8, cz + 0.9, 0.7, 0.45, 0.04, col("#b3363a"));
    trims.add(cx + 0.9, 0.12, cz + 2.7, 2.4, 0.85, 0.95, col("#e6b422"));
    glows.add(cx + 0.9, 0.6, cz + 3.19, 2.1, 0.3, 0.04, col("#ffe6b0").multiplyScalar(0.8));
    for (let k = -2; k <= 2; k++) trims.add(cx + k * 1.2, 0, cz + 2.95, 0.05, 0.6, 0.05, TRIM);
    tree(cx - 2.8, cz + 0.9, 0.8);
    tree(cx + 2.9, cz + 0.4, 0.8);
  };

  const workshop = (cx: number, cz: number) => {
    const seed = nextSeed();
    // a long shed with three roll-up doors, a gabled roof and an office corner
    walls.add(cx, 0, cz - 1.4, 5.4, 3.4, 2.8, col("#8e93a6"), 0, [seed, 2, 0]);
    gables.add(cx, 3.4, cz - 1.4, 5.8, 1.1, 3.2, col("#4d5470"), 0);
    trims.add(cx + 2.2, 3.9, cz - 1.9, 0.5, 0.8, 0.5, col("#7f5049"));
    for (const dx of [-1.7, 0, 1.7]) {
      glows.add(cx + dx, 0.1, cz - 0.01, 1.3, 2.0, 0.05, col("#ffbf78").multiplyScalar(0.8));
      for (let k = 0; k < 5; k++) trims.add(cx + dx, 0.4 + k * 0.38, cz + 0.03, 1.32, 0.05, 0.04, col("#6b7088"));
    }
    sp("WORKSHOP").add(cx, 3.1, cz + 0.06, 2.6, 0.8, 0.12, new THREE.Color(1, 1, 1), 0);
    // a car up on a lift, tyre stacks, oil drums, a tow truck and a parked pair
    for (const sx of [-0.7, 0.7]) trims.add(cx - 1.7 + sx, 0, cz + 1.4, 0.12, 1.5, 0.12, col("#e6b422"));
    parkedCar(cx - 1.7, cz + 1.4, 0);
    trims.add(cx - 1.7, 1.6, cz + 1.4, 1.9, 0.12, 0.9, col("#e6b422"));
    for (let k = 0; k < 4; k++) cyls.add(cx + 2.4, k * 0.3, cz + 1.2, 0.7, 0.28, 0.7, TRIM);
    for (let k = 0; k < 3; k++) cyls.add(cx + 2.2 + (k % 2) * 0.5, 0, cz + 2.1 + k * 0.3, 0.5, 0.8, 0.5, k ? col("#b3363a") : col("#3f6fb0"));
    trims.add(cx + 0.3, 0.12, cz + 2.4, 1.8, 0.7, 0.85, col("#d9a441"));
    trims.add(cx + 0.9, 0.5, cz + 2.4, 0.8, 0.5, 0.8, col("#20253a"));
    trims.add(cx - 0.4, 0.3, cz + 2.4, 0.9, 0.08, 0.1, TRIM, 0, [0, 0, 0], 0, -0.6);
    glows.add(cx + 0.3, 0.95, cz + 2.4, 0.2, 0.1, 0.2, col("#ff8a3a"));
    parkedCar(cx - 1.8, cz + 2.6, 0);
    glows.add(cx - 2.6, 2.7, cz + 0.05, 0.5, 0.5, 0.05, col("#ffd36a"));
    plan.spills.push({ x: cx, z: cz + 1.4, color: "255,190,120" });
    lamp(cx + 3.0, cz + 2.8, 0, -1);
  };

  const church = (cx: number, cz: number) => {
    const seed = nextSeed();
    walls.add(cx - 0.6, 0, cz + 0.4, 3.2, 3.8, 5.0, col("#b3a58f"), 0, [seed, 1, 0]);
    gables.add(cx - 0.6, 3.8, cz + 0.4, 3.7, 2.0, 5.5, col("#454b63"), Math.PI / 2);
    walls.add(cx + 1.6, 0, cz - 1.8, 1.9, 7.5, 1.9, col("#a89a86"), 0, [seed, 1, 0]);
    cones.add(cx + 1.6, 7.5, cz - 1.8, 2.2, 3.4, 2.2, col("#4d5470"));
    trims.add(cx + 1.6, 10.9, cz - 1.8, 0.1, 0.9, 0.1, SLAB);
    trims.add(cx + 1.6, 11.4, cz - 1.8, 0.5, 0.1, 0.1, SLAB);
    glows.add(cx + 1.6, 6.2, cz - 0.84, 0.5, 0.9, 0.04, col("#ffcf8a"));
    for (const [dx, c] of [[-1.8, "#ff7a7a"], [-0.6, "#7ab0ff"], [0.6, "#ffd36a"]] as const) glows.add(cx + dx - 0.6, 1.2, cz + 2.92, 0.5, 1.4, 0.04, col(c).multiplyScalar(0.7));
    tree(cx - 2.4, cz - 1.8, 1.0);
    tree(cx - 2.0, cz + 2.6, 0.9);
  };

  const gasStation = (cx: number, cz: number) => {
    for (const [dx, dz] of [[-2, -1.2], [2, -1.2], [-2, 1.2], [2, 1.2]]) cyls.add(cx + dx, 0, cz + dz, 0.12, 3.4, 0.12, TRIM);
    trims.add(cx, 3.4, cz, 5.2, 0.3, 3.4, col("#d8dbe6"));
    glows.add(cx, 3.35, cz, 5.0, 0.06, 3.2, col("#ffdf9a").multiplyScalar(0.8));
    for (const dx of [-1, 1]) {
      trims.add(cx + dx, 0, cz, 0.5, 1.2, 0.5, col("#b3363a"));
      glows.add(cx + dx, 0.8, cz + 0.28, 0.3, 0.3, 0.04, col("#9affc0"));
    }
    walls.add(cx - 0.2, 0, cz - 2.4, 4.0, 2.6, 1.6, col("#8e93a6"), 0, [nextSeed(), 2, 0]);
    vertSigns.add(cx + 3.0, 2.4, cz + 2.0, 0.9, 4.2, 0.12, new THREE.Color(1, 1, 1), 0);
    parkedCar(cx + 0.2, cz + 0.2, 0);
    plan.spills.push({ x: cx, z: cz, color: "255,223,154" });
  };

  const construction = (cx: number, cz: number) => {
    walls.add(cx, 0, cz, 4.4, 4.4, 4.4, col("#7a7f93"), 0, [nextSeed(), 0, 0]);
    for (let f = 0; f < 3; f++) {
      const y = 4.6 + f * 3;
      trims.add(cx, y, cz, 4.5, 0.25, 4.5, SLAB);
      for (const [dx, dz] of [[-2.1, -2.1], [2.1, -2.1], [-2.1, 2.1], [2.1, 2.1]]) trims.add(cx + dx, y, cz + dz, 0.22, 3.0, 0.22, col("#9aa0b4"));
    }
    glows.add(cx, 13.5, cz, 4.0, 0.05, 4.0, col("#ffb15c").multiplyScalar(0.5));
    // hoarding with warning lights
    for (const [dx, dz, sx, sz] of [[0, -2.9, 6, 0.1], [0, 2.9, 6, 0.1], [-2.9, 0, 0.1, 6], [2.9, 0, 0.1, 6]] as const) trims.add(cx + dx, 0, cz + dz, sx, 1.4, sz, col("#cdbb5a"));
    for (const [dx, dz] of [[-2.9, -2.9], [2.9, -2.9], [-2.9, 2.9], [2.9, 2.9]]) glows.add(cx + dx, 1.5, cz + dz, 0.2, 0.2, 0.2, col("#ff8a3a"));
    plan.cranes.push({ x: cx + 1.6, z: cz - 1.6, h: 22 });
    trims.add(cx + 3.6, 0, cz + 2.4, 1.3, 0.9, 1.3, col("#6b5a48"));
  };

  const houses = (cx: number, cz: number) => {
    const cap = Math.max(3.4, capFor(cx, cz));
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        if (r() < 0.1) {
          tree(cx + sx * 1.6, cz + sz * 1.6, 1.0);
          continue;
        }
        const x = cx + sx * 1.62 + (r() - 0.5) * 0.3;
        const z = cz + sz * 1.62 + (r() - 0.5) * 0.3;
        const w = 2.1 + r() * 0.5;
        const dd = 2.0 + r() * 0.4;
        const kind = r();
        const floors = kind < 0.4 ? 2 : 1;
        const h = Math.min(cap, 2.4 * floors + 0.3);
        const seed = nextSeed();
        const wallC = pick(r, FACADE.pastel);
        const roofC = pick(r, ROOF);
        walls.add(x, 0, z, w, h, dd, wallC, 0, [seed, 1, 0]);
        if (kind < 0.7) {
          // gabled roof, ridge along one axis
          const rotate = r() < 0.5 ? 0 : Math.PI / 2;
          gables.add(x, h, z, (rotate ? dd : w) + 0.5, 1.15, (rotate ? w : dd) + 0.45, roofC, rotate);
        } else {
          // hip roof
          cones.add(x, h, z, w * 1.55, 1.3, dd * 1.55, roofC);
        }
        // chimney, some with smoke
        if (r() < 0.6) {
          const chx = x + (r() - 0.5) * 0.6;
          const chz = z + (r() - 0.5) * 0.6;
          trims.add(chx, h + 0.6, chz, 0.32, 0.9, 0.32, pick(r, FACADE.brick));
          if (r() < 0.35) plan.steam.push({ x: chx, z: chz });
        }
        // porch: light, door, little roof
        const dirx = sx > 0 ? 1 : -1;
        glows.add(x + dirx * (w / 2 + 0.03), 0.3, z + 0.3, 0.05, 0.95, 0.45, col("#ffb870"));
        glows.add(x + dirx * (w / 2 + 0.12), 1.55, z + 0.3, 0.1, 0.12, 0.12, col("#ffd9a0"));
        trims.add(x + dirx * (w / 2 + 0.35), 1.7, z + 0.3, 0.7, 0.07, 1.0, roofC);
        // garage with a driveway car on the two-storey ones
        if (floors === 2 && r() < 0.7) {
          trims.add(x, 0, z + dd / 2 + 0.03, 1.4, 1.1, 0.05, col("#9aa0b4"));
          if (r() < 0.6) parkedCar(x + dirx * (w / 2 + 1.4), z - sz * 0.2, Math.PI / 2);
        } else if (r() < 0.4) parkedCar(x + dirx * (w / 2 + 1.5), z + 0.6, Math.PI / 2);
        // picket fence and mailbox toward the street
        for (let k = 0; k < 5; k++) trims.add(x + sx * 2.45, 0, z - 1.0 + k * 0.5, 0.05, 0.5, 0.06, col("#d8d2c4"));
        trims.add(x + sx * 2.45, 0.38, z, 0.04, 0.05, 2.1, col("#d8d2c4"));
        cyls.add(x + sx * 2.7, 0, z - 1.4, 0.05, 0.9, 0.05, TRIM);
        trims.add(x + sx * 2.7, 0.9, z - 1.4, 0.28, 0.2, 0.18, col("#4f8f8a"));
        // garden lights and a tree
        glows.add(x - dirx * 0.2, 0.15, z + sz * (dd / 2 + 0.5), 0.12, 0.12, 0.12, col("#ffd9a0"));
        if (r() < 0.65) tree(x + sx * 1.15, z + sz * 1.15, 0.7 + r() * 0.45);
        if (r() < 0.1) {
          cyls.add(x - sx * 1.3, 0, z + sz * 1.5, 0.9, 0.5, 0.9, col("#3d86b8")); // swimming pool glow
          glows.add(x - sx * 1.3, 0.5, z + sz * 1.5, 0.9, 0.04, 0.9, col("#5fd0ff").multiplyScalar(0.5));
        }
      }
    }
  };

  const park = (cx: number, cz: number, withPond: boolean) => {
    const n = 8 + Math.floor(r() * 5);
    for (let i = 0; i < n; i++) {
      const x = cx + (r() - 0.5) * 5.0;
      const z = cz + (r() - 0.5) * 5.0;
      if (withPond && Math.hypot(x - cx, z - cz) < 1.5) continue;
      tree(x, z, 0.9 + r() * 0.6);
    }
    if (withPond) plan.ponds.push({ x: cx, z: cz, r: 1.5 });
    // a little pavilion
    if (!withPond && r() < 0.5) {
      for (const [dx, dz] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) cyls.add(cx + dx, 0, cz + dz, 0.1, 1.8, 0.1, TRIM);
      cones.add(cx, 1.8, cz, 2.0, 0.9, 2.0, col("#8a4f45"));
    }
  };

  const plaza = (cx: number, cz: number) => {
    cyls.add(cx, 0, cz, 2.2, 0.35, 2.2, col("#7a8094"));
    cyls.add(cx, 0.35, cz, 1.9, 0.12, 1.9, col("#3d5fa0"));
    cyls.add(cx, 0.35, cz, 0.35, 1.3, 0.35, col("#9aa0b4"));
    glows.add(cx, 1.5, cz, 0.3, 0.3, 0.3, col("#9ec8ff"));
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      tree(cx + Math.cos(a) * 2.5, cz + Math.sin(a) * 2.5, 0.8);
    }
  };

  /* ------------------------- facade details ------------------------- */

  // wall-mounted air conditioners
  const facadeUnits = (cx: number, cz: number, w: number, d: number, y0: number, y1: number, n: number) => {
    for (let i = 0; i < n; i++) {
      const y = y0 + r() * Math.max(0.1, y1 - y0);
      if (r() < 0.5) trims.add(cx + w / 2 + 0.2, y, cz + (r() - 0.5) * (d - 0.9), 0.4, 0.34, 0.58, pick(r, METAL));
      else trims.add(cx + (r() - 0.5) * (w - 0.9), y, cz + d / 2 + 0.2, 0.58, 0.34, 0.4, pick(r, METAL));
    }
  };

  // balconies with railings and a bit of green
  const balconies = (cx: number, cz: number, w: number, d: number, h: number) => {
    for (let y = 3.7; y < h - 1; y += 5.4) {
      trims.add(cx, y, cz + d / 2 + 0.3, w * 0.72, 0.1, 0.6, SLAB);
      trims.add(cx, y + 0.1, cz + d / 2 + 0.58, w * 0.72, 0.62, 0.04, TRIM);
      trims.add(cx + w / 2 + 0.3, y, cz, 0.6, 0.1, d * 0.6, SLAB);
      trims.add(cx + w / 2 + 0.58, y + 0.1, cz, 0.04, 0.62, d * 0.6, TRIM);
      if (r() < 0.6) icos.add(cx + (r() - 0.5) * w * 0.4, y + 0.38, cz + d / 2 + 0.35, 0.36, 0.3, 0.36, pick(r, TREE));
    }
  };

  // zig-zag fire escape on the street-facing side of old brick buildings
  const fireEscape = (cx: number, cz: number, w: number, d: number, h: number) => {
    const x = cx + w / 2 + 0.4;
    let flip = 1;
    for (let y = 2.9; y < h - 0.6; y += 2.7) {
      trims.add(x, y, cz, 0.55, 0.07, d * 0.6, TRIM);
      trims.add(x + 0.25, y, cz, 0.04, 0.5, d * 0.6, TRIM);
      trims.add(x, y, cz + flip * d * 0.27, 0.06, 2.95, 0.06, TRIM, 0, [0, 0, 0], 0.7 * flip);
      flip = -flip;
    }
  };

  // lit door with a canopy over it, on the +z face
  const entrance = (x: number, z: number, d: number, c: THREE.Color = pick(r, AWNING)) => {
    glows.add(x, 0.15, z + d / 2 + 0.03, 0.85, 1.9, 0.05, col("#ffbf78"));
    trims.add(x, 2.15, z + d / 2 + 0.4, 1.4, 0.09, 0.8, c);
    glows.add(x + 0.95, 1.2, z + d / 2 + 0.05, 0.1, 0.18, 0.1, col("#ffd9a0"));
  };

  // rooftop billboard on a frame
  const billboard = (x: number, y: number, z: number, ry: number) => {
    for (const dx of [-1.1, 1.1]) cyls.add(x + Math.cos(ry) * dx, y, z - Math.sin(ry) * dx, 0.07, 1.6, 0.07, TRIM);
    const k = SIGN_OK[Math.floor(r() * SIGN_OK.length)];
    signs[k].add(x, y + 2.2, z, 3.4, 1.05, 0.14, new THREE.Color(1, 1, 1), ry);
  };

  /* ------------------------------- the coast ------------------------------- */

  const palm = (x: number, z: number, s = 1) => addPalm({ box: trims, cyl: cyls, cone: cones, ico: icos }, x, 0, z, s * 1.1, r, mobile);

  const umbrella = (x: number, z: number) => {
    cyls.add(x, 0, z, 0.05, 1.75, 0.05, TRIM);
    cones.add(x, 1.55, z, 2.0, 0.5, 2.0, pick(r, AWNING));
    trims.add(x + 1.0, 0.02, z + 0.2, 0.55, 0.16, 1.3, col("#e8e0d0"), r() * 0.5);
    trims.add(x - 1.0, 0.02, z - 0.2, 0.55, 0.16, 1.3, col("#d8cfc0"), r() * 0.5);
  };

  const beachHut = (x: number, z: number) => {
    const seed = nextSeed();
    walls.add(x, 0, z, 2.1, 2.2, 2.0, pick(r, FACADE.pastel), 0, [seed, 1, 0]);
    gables.add(x, 2.2, z, 2.5, 1.0, 2.4, pick(r, ROOF), r() < 0.5 ? 0 : Math.PI / 2);
    glows.add(x, 0.2, z - 1.02, 0.55, 1.1, 0.04, col("#ffb870"));
    trims.add(x, 0.0, z - 1.5, 2.4, 0.08, 1.0, col("#8a7455"));
  };

  const beachBar = (x: number, z: number) => {
    const seed = nextSeed();
    walls.add(x, 0, z, 4.8, 2.7, 2.6, col("#4f8f8a"), 0, [seed, 2, 0]);
    gables.add(x, 2.7, z, 5.6, 1.5, 3.4, col("#a8895a"), 0);
    signs[0].add(x, 3.9, z - 1.45, 1.8, 0.56, 0.12, new THREE.Color(1, 1, 1), Math.PI);
    awning(x, z, 4.8, 2.6, "z-", 2.5);
    // string lights across the terrace
    for (let i = 0; i < 12; i++) {
      const sag = Math.sin((i / 11) * Math.PI) * 0.35;
      glows.add(x - 3.0 + i * 0.55, 3.0 - sag, z - 2.9, 0.12, 0.12, 0.12, col(i % 3 === 0 ? "#ffd9a0" : "#ff9acb"));
    }
    for (const dx of [-2.2, 0, 2.2]) {
      cyls.add(x + dx, 0, z - 3.3, 0.5, 0.75, 0.5, col("#d8cfc0"));
      cones.add(x + dx, 1.5, z - 3.3, 1.7, 0.4, 1.7, pick(r, AWNING));
      cyls.add(x + dx, 0, z - 3.3, 0.05, 1.6, 0.05, TRIM);
    }
    plan.spills.push({ x, z: z - 2.6, color: "255,190,120" });
    plan.seaLights.push({ x, z: z - 2.6, color: "#ffc98a", i: 0.8 });
  };

  const lifeguard = (x: number, z: number) => {
    for (const [dx, dz] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) cyls.add(x + dx, 0, z + dz, 0.07, 1.8, 0.07, col("#d8d2c4"));
    walls.add(x, 1.8, z, 1.7, 1.3, 1.7, col("#e8e0d0"), 0, [nextSeed(), 1, 0]);
    gables.add(x, 3.1, z, 2.1, 0.7, 2.1, col("#b3363a"), 0);
    cyls.add(x + 1.0, 3.0, z, 0.03, 1.1, 0.03, TRIM);
    trims.add(x + 1.3, 3.7, z, 0.5, 0.3, 0.03, col("#d9433a"));
    glows.add(x, 2.0, z - 0.88, 0.5, 0.5, 0.04, col("#ffcf8a"));
  };

  // a pier that runs along z (south coast) or x (east coast) from a point on the sand out to sea
  const pier = (x0: number, z0: number, axis: "x" | "z", len: number) => {
    const a0 = axis === "z" ? z0 : x0;
    const c0 = axis === "z" ? x0 : z0;
    const a1 = a0 + len;
    const mid = a0 + len / 2;
    const W = (a: number, c: number): [number, number] => (axis === "z" ? [c0 + c, a] : [a, c0 + c]);
    const box = (a: number, c: number, y: number, sa: number, sh: number, sc: number, colr: THREE.Color) => {
      const [x, z] = W(a, c);
      trims.add(x, y, z, axis === "z" ? sc : sa, sh, axis === "z" ? sa : sc, colr);
    };
    box(mid, 0, 0.62, len, 0.16, 2.7, col("#6b5a48"));
    box(mid, 0, 0.46, len, 0.2, 2.4, col("#4a3b2e"));
    for (let a = a0 + 1; a < a1; a += 3) {
      for (const c of [-1.15, 1.15]) {
        const [x, z] = W(a, c);
        cyls.add(x, -2.4, z, 0.2, 3.1, 0.2, col("#4a3b2e"));
      }
      box(a, 0, 0.5, 0.18, 0.08, 2.8, col("#3d3024"));
    }
    for (const c of [-1.3, 1.3]) {
      box(mid, c, 1.45, len, 0.07, 0.07, TRIM);
      box(mid, c, 1.0, len, 0.05, 0.05, TRIM);
      for (let a = a0 + 0.5; a < a1; a += 2) {
        const [x, z] = W(a, c);
        cyls.add(x, 0.7, z, 0.06, 0.8, 0.06, TRIM);
      }
    }
    for (let a = a0 + 4, n = 0; a < a1 - 3; a += 6, n++) {
      for (const c of [-1.35, 1.35]) {
        const [x, z] = W(a, c);
        cyls.add(x, 0.7, z, 0.07, 2.5, 0.07, TRIM);
        glows.add(x, 3.15, z, 0.3, 0.3, 0.3, col("#ffc98a"));
        if (landL(x, z) < 0) plan.seaLights.push({ x, z, color: "#ffc98a", i: 1 });
      }
      if (n % 4 === 0) {
        const [lx, lz] = W(a, 0);
        plan.lights.push({ x: lx, y: 3.2, z: lz, color: 0xffb870, intensity: 22, distance: 8 });
      }
    }
    // end pavilion with a neon sign
    const ea = a1 - 3;
    const [ex, ez] = W(ea, 0);
    const seed = nextSeed();
    const along = axis === "z";
    walls.add(ex, 0.7, ez, along ? 4.4 : 3.4, 2.5, along ? 3.4 : 4.4, col("#8a6f58"), 0, [seed, 1, 0]);
    gables.add(ex, 3.2, ez, along ? 4.9 : 3.9, 1.3, along ? 3.9 : 4.9, col("#454b63"), along ? Math.PI / 2 : 0);
    signs[11].add(ex + (along ? 0 : 1.78), 4.6, ez + (along ? 1.78 : 0), 2.2, 0.68, 0.12, new THREE.Color(1, 1, 1), along ? 0 : Math.PI / 2);
    glows.add(ex + (along ? 0 : 1.72), 0.9, ez + (along ? 1.72 : 0), along ? 1.0 : 0.04, 1.7, along ? 0.04 : 1.0, col("#ffb870"));
    plan.seaLights.push({ x: ex + (along ? 0 : 3), z: ez + (along ? 3 : 0), color: "#ff9acb", i: 1.2 });
    for (let k = 0; k < 4; k++) {
      const [cx2, cz2] = W(a0 + 8 + k * 7 + r() * 2, (r() - 0.5) * 1.6);
      trims.add(cx2, 0.7, cz2, 0.5, 0.45, 0.5, col("#7a6249"), r());
    }
    plan.piers.push({ x: ex, z: ez, axis });
  };

  // everything that lives along the shoreline, placed by distance to the water (landL)
  const coastDressing = () => {
    const rr = rand(909);
    const scatter = (n: number, lMin: number, lMax: number, fn: (x: number, z: number) => void, minD = 0) => {
      const pts: [number, number][] = [];
      for (let tries = 0, placed = 0; placed < n && tries < n * 90; tries++) {
        const x = -70 + rr() * 160;
        const z = -88 + rr() * 156;
        const L = landL(x, z);
        if (L < lMin || L > lMax) continue;
        if (x > 40 && Math.abs(z - 12) < 8) continue; // the bridge causeway across the beach stays clear
        if (minD && pts.some((p) => Math.hypot(p[0] - x, p[1] - z) < minD)) continue;
        pts.push([x, z]);
        fn(x, z);
        placed++;
      }
    };
    // boardwalk lamps along the contour, arms pointing at the water
    scatter(
      56,
      10.2,
      10.9,
      (x, z) => {
        const gx = landL(x + 1, z) - landL(x - 1, z);
        const gz = landL(x, z + 1) - landL(x, z - 1);
        const dx = Math.abs(gx) > Math.abs(gz) ? -Math.sign(gx) : 0;
        const dz = dx ? 0 : -Math.sign(gz);
        lamp(x, z, dx, dz);
      },
      9,
    );
    scatter(150, 7.4, 12.2, (x, z) => palm(x, z, 0.85 + rr() * 0.35), 3.4);
    scatter(90, 3.2, 7.2, (x, z) => umbrella(x, z), 4.4);
    scatter(18, 7.8, 9.8, (x, z) => beachHut(x, z), 8);
    scatter(4, 6.0, 8.2, (x, z) => beachBar(x, z), 30);
    scatter(4, 4.6, 6.4, (x, z) => lifeguard(x, z), 34);
    // rocks and driftwood where the land meets the water
    scatter(90, -0.8, 2.2, (x, z) => icos.add(x, 0, z, 0.9 + rr() * 1.5, 0.6 + rr() * 0.9, 0.9 + rr() * 1.5, col("#55596b"), rr() * 3), 2.6);

    // one pier on the south coast, one on the east coast
    const east = findCoast(30, -26, 1, 0);
    pier(east.x - 9.5, -26, "x", 46);
  };

  /* ------------------- hero corner: the reference, in miniature ------------------- */

  const heroCorner = (cx: number, cz: number) => {
    const plaster = col("#b7a48f");
    const slate = col("#454b63");
    const brick = col("#8e5b52");
    const warmGlow = col("#ffb35c");
    // tall corner body (right), shop style so the street level glows
    const bx = cx + 0.7, bz = cz - 0.4, bw = 3.8, bd = 5.2, bh = 11;
    walls.add(bx, 0, bz, bw, bh, bd, plaster, 0, [11, 2, 0]);
    for (let k = 1; k < 4; k++) trims.add(bx, k * 2.75 + 0.5, bz, bw + 0.14, 0.12, bd + 0.14, SLAB);
    // steeply pitched slate roof, dormers, skylights, chimney
    gables.add(bx, bh, bz, bw + 0.5, 2.7, bd + 0.5, slate, Math.PI / 2);
    trims.add(bx - 0.9, bh + 1.2, bz - 1.2, 0.55, 2.0, 0.55, brick);
    trims.add(bx - 0.9, bh + 3.15, bz - 1.2, 0.75, 0.14, 0.75, SLAB);
    for (const dz of [-1.4, 0.2, 1.7]) {
      gables.add(bx + bw / 2 - 0.2, bh + 0.35, bz + dz, 0.85, 0.85, 0.95, slate, 0);
      glows.add(bx + bw / 2 + 0.12, bh + 0.45, bz + dz, 0.05, 0.42, 0.34, warmGlow);
    }
    for (const dz of [-1.5, 0, 1.5]) glows.add(bx + 0.55, bh + 1.1, bz + dz, 0.95, 0.04, 0.55, col("#ffd9a0"), 0, [0, 0, 0], 0, -0.9);
    acUnit(bx - 0.6, bh + 0.2, bz + 1.4, 1.0);
    dish(bx + 0.1, bh + 2.2, bz - 1.8, 0.9);
    // weather vane
    cyls.add(bx - 0.9, bh + 3.3, bz + 1.0, 0.04, 1.4, 0.04, TRIM);
    trims.add(bx - 0.9, bh + 4.5, bz + 1.0, 0.9, 0.1, 0.1, TRIM, 0.6);
    trims.add(bx - 1.2, bh + 4.3, bz + 1.0, 0.3, 0.35, 0.05, TRIM, 0.6);
    // lower wing on the left with a flat roof full of equipment and a balcony
    const ax = cx - 1.9, az = cz + 0.1, aw = 2.3, ad = 4.4, ah = 5.8;
    walls.add(ax, 0, az, aw, ah, ad, col("#d1b7aa"), 0, [14, 2, 0]);
    trims.add(ax, ah, az, aw + 0.3, 0.2, ad + 0.3, SLAB);
    parapet(ax, ah + 0.2, az, aw, ad);
    for (let k = 0; k < 4; k++) trims.add(ax - 0.75 + k * 0.5, ah + 0.25, az - 0.9, 0.46, 0.05, 1.0, col("#2b3a63"), 0, [0, 0, 0], -0.5);
    acUnit(ax + 0.4, ah + 0.2, az + 1.2, 0.8);
    trims.add(ax - 0.6, ah + 0.2, az + 1.3, 0.8, 0.8, 0.8, pick(r, FACADE.concrete));
    // fire ladder up the side
    trims.add(ax - aw / 2 - 0.12, 0.3, az - 1.2, 0.05, ah, 0.05, TRIM);
    trims.add(ax - aw / 2 - 0.12, 0.3, az - 0.85, 0.05, ah, 0.05, TRIM);
    for (let k = 0; k < 12; k++) trims.add(ax - aw / 2 - 0.12, 0.5 + k * 0.42, az - 1.03, 0.04, 0.04, 0.4, TRIM);
    trims.add(ax, 3.1, az + ad / 2 + 0.3, aw * 0.9, 0.1, 0.65, SLAB);
    awning(ax, az, aw, ad, "z+", 2.7);
    awning(bx, bz, bw, bd, "x+", 2.9);
    awning(bx, bz, bw, bd, "z+", 2.9);
    // neon: GUESTHOUSE over the wing door, a tall LEASE blade on the corner
    signs[10].add(ax, 3.9, az + ad / 2 + 0.34, 2.2, 0.72, 0.14, new THREE.Color(1, 1, 1), 0);
    vertSigns.add(bx + bw / 2 + 0.28, 4.6, bz + bd / 2 - 0.25, 0.9, 4.6, 0.14, new THREE.Color(1, 1, 1), Math.PI / 2);
    plan.lights.push(
      { x: ax, y: 3.8, z: az + ad / 2 + 1.6, color: 0xff4f9a, intensity: 55, distance: 9 },
      { x: bx + bw / 2 + 1.6, y: 4.6, z: bz + bd / 2 - 0.4, color: 0x4fe0c8, intensity: 55, distance: 9 },
      { x: bx + 1.8, y: 2.4, z: bz + bd / 2 + 1.2, color: 0xffb15c, intensity: 40, distance: 8 },
    );
    plan.spills.push(
      { x: ax, z: az + ad / 2 + 1.5, color: "255,79,154" },
      { x: bx + bw / 2 + 1.5, z: bz + bd / 2 - 0.3, color: "79,224,200" },
    );
    // big leafy trees like the reference
    tree(cx - 3.0, cz - 2.3, 1.7);
    tree(cx - 1.9, cz - 3.0, 1.45);
    // street life: hydrant, bins, a bus shelter, a parked red coupe, a lamp with a long pool
    cyls.add(cx + 3.25, 0, cz + 2.4, 0.28, 0.65, 0.28, col("#b3463f"));
    cyls.add(cx - 3.1, 0, cz + 2.9, 0.34, 0.7, 0.34, col("#2f3a4c"));
    for (const dz of [-0.9, 0.9]) cyls.add(cx + 3.3, 0, cz + dz - 1.0, 0.08, 2.6, 0.08, TRIM);
    trims.add(cx + 3.3, 2.6, cz - 1.0, 0.8, 0.1, 2.2, col("#4d5470"));
    glows.add(cx + 3.34, 0.7, cz - 1.0, 0.04, 1.6, 1.8, col("#9ec8ff").multiplyScalar(0.7));
    const carX = cx + 4.0, carZ = cz + 0.2;
    trims.add(carX, 0.12, carZ, 0.82, 0.36, 1.8, col("#b3363a"));
    trims.add(carX, 0.48, carZ - 0.1, 0.7, 0.32, 0.95, col("#20253a"));
    glows.add(carX + 0.22, 0.24, carZ - 0.9, 0.2, 0.12, 0.05, col("#ff4a3a"));
    glows.add(carX - 0.22, 0.24, carZ - 0.9, 0.2, 0.12, 0.05, col("#ff4a3a"));
    lamp(cx + 3.05, cz - 3.05, 1, 0);
    plan.steam.push({ x: cx + 4.1, z: cz - 1.6 });
  };

  /* ------------------------------ the grid ---------------------------- */

  const N = BLOCKS;
  // hand-placed green space and low-density quarters
  const PARKS = new Set(["-3,-3", "-4,-3", "3,4", "-1,5", "5,2", "2,-2"]);
  const POND = new Set(["-4,-3", "3,4"]);
  const FORCE_GLASS: Record<string, "crystal" | "round"> = { "-2,-2": "crystal", "-1,3": "round" };
  const SITES: Record<string, "church" | "gas" | "build" | "hospital" | "hotel" | "school" | "workshop" | "industry"> = { "-6,-4": "church", "-7,4": "gas", "-2,2": "build", "4,-1": "build", "3,6": "hospital", "1,-4": "hotel", "-6,0": "school", "6,3": "workshop" };
  // how many random numbers the block would have used if it were an ordinary one: an industry block draws the same amount, so
  // the rest of the city comes out exactly as it was (every later block starts from the same point of the sequence)
  const INDUSTRY_BURN: Record<string, number> = { "-4,7": 72 };
  // an industry building that stands downtown takes exactly one block, which the engine fills with its landmark
  INDUSTRIES.forEach((ind) => {
    if (ind.site === "block") SITES[`${ind.x / PITCH},${ind.z / PITCH}`] = "industry";
  });

  for (let i = -N; i <= N; i++) {
    for (let j = -N; j <= N; j++) {
      const cx = i * PITCH;
      const cz = j * PITCH;
      const d = Math.hypot(cx, cz);
      let type: BlockType;
      const key = `${i},${j}`;

      // too close to the water: nothing is built here, the shore takes over
      const shoreL = landL(cx, cz);
      if (shoreL < 16) {
        plan.blocks.push({ cx, cz, type: "shore" });
        continue;
      }

      const nearZone = inZone(cx, cz, 4.5) || cz === -48;
      if (nearZone) {
        // blocks swallowed by a landmark plaza: just trees and lawn
        type = "green";
        plan.blocks.push({ cx, cz, type });
        if (!inZone(cx, cz, 0)) {
          for (let k = 0; k < 5; k++) tree(cx + (r() - 0.5) * 4.6, cz + (r() - 0.5) * 4.6, 0.8 + r() * 0.5);
        }
        continue;
      }

      if (SITES[key]) {
        const kind = SITES[key];
        if (kind === "church") {
          plan.blocks.push({ cx, cz, type: "green" });
          church(cx, cz);
        } else if (kind === "gas") {
          plan.blocks.push({ cx, cz, type: "mid" });
          gasStation(cx, cz);
        } else if (kind === "hospital") {
          plan.blocks.push({ cx, cz, type: "mid" });
          hospital(cx, cz);
        } else if (kind === "hotel") {
          plan.blocks.push({ cx, cz, type: "mid" });
          hotel(cx, cz);
        } else if (kind === "school") {
          plan.blocks.push({ cx, cz, type: "mid" });
          school(cx, cz);
        } else if (kind === "workshop") {
          plan.blocks.push({ cx, cz, type: "mid" });
          workshop(cx, cz);
        } else if (kind === "industry") {
          plan.blocks.push({ cx, cz, type: "mid" });
          for (let k = 0; k < (INDUSTRY_BURN[key] ?? 0); k++) r();
        } else {
          plan.blocks.push({ cx, cz, type: "mid" });
          construction(cx, cz);
        }
        continue;
      }

      // the city thins out toward the west, where the fields begin
      if (!PARKS.has(key) && key !== "2,2" && !FORCE_GLASS[key] && r() < Math.max(smooth(36, 80, -cx), smooth(36, 80, cz)) * 0.55) {
        plan.blocks.push({ cx, cz, type: "green" });
        for (let k = 0; k < 4; k++) tree(cx + (r() - 0.5) * 4.6, cz + (r() - 0.5) * 4.6, 0.8 + r() * 0.6);
        continue;
      }

      const q = r();
      if (key === "2,2") type = "hero";
      else if (FORCE_GLASS[key]) type = "tower";
      else if (PARKS.has(key)) type = "park";
      else if (shoreL < 24 || (cx < -14 && cz > 18) || ((-cx > 32 || cz > 44) && q < 0.85)) type = q < 0.8 ? "houses" : "park";
      else if (d < 38) type = q < 0.3 ? "tower" : q < 0.7 ? "mid" : q < 0.93 ? "shops" : "plaza";
      else if (d < 50) type = q < 0.08 ? "tower" : q < 0.42 ? "mid" : q < 0.72 ? "shops" : q < 0.9 ? "houses" : "park";
      else type = q < 0.5 ? "houses" : q < 0.7 ? "mid" : q < 0.85 ? "shops" : "park";
      if (cx >= 40 && (cz === 8 || cz === 16) && type !== "hero") type = "none"; // the two blocks either side of the bridge approach stay open and empty

      plan.blocks.push({ cx, cz, type });
      if (type === "hero") heroCorner(cx, cz);
      else if (type === "tower") tower(cx, cz, d, FORCE_GLASS[key]);
      else if (type === "mid") mid(cx, cz, d);
      else if (type === "shops") shops(cx, cz);
      else if (type === "houses") houses(cx, cz);
      else if (type === "park") park(cx, cz, POND.has(key));
      else if (type === "none") for (let k = 0; k < 3; k++) tree(cx + (r() - 0.5) * 2.6, cz + (r() - 0.5) * 2.6, 0.8 + r() * 0.4); // a few trees well inside the lot, never near the street
      else plaza(cx, cz);

      // street furniture: two lamps on diagonal corners, sidewalk trees, hydrants
      const flip = (i + j) % 2 === 0 ? 1 : -1;
      lamp(cx + 3.05 * flip, cz + 3.05, flip, 0);
      lamp(cx - 3.05 * flip, cz - 3.05, -flip, 0);
      if (type !== "park" && type !== "houses" && r() < 0.5) tree(cx - 3.1 * flip, cz + 3.1 * flip * (r() < 0.5 ? -1 : 1), 0.6);
      if (r() < 0.28) cyls.add(cx + 3.2, 0, cz - 3.2, 0.26, 0.6, 0.26, col("#b3463f"));
      streetLife(cx, cz, type);
    }
  }

  // traffic lights at some intersections
  for (let a = -BLOCKS - 1; a <= BLOCKS - 1; a++) {
    for (let b = -BLOCKS - 1; b <= BLOCKS - 1; b++) {
      const ix = 4 + a * PITCH;
      const iz = 4 + b * PITCH;
      if (inZone(ix, iz, 0) || r() > 0.22) continue;
      cyls.add(ix + 1.25, 0, iz + 1.25, 0.08, 3.1, 0.08, TRIM);
      trims.add(ix + 1.25, 2.7, iz + 1.0, 0.22, 0.6, 0.22, TRIM);
      glows.add(ix + 1.25, 3.0, iz + 0.86, 0.12, 0.12, 0.06, col(r() < 0.5 ? "#ff5a4a" : "#6dffb0"));
    }
  }

  // zone dressing: lamps and trees around the landmark plazas
  const ring = (x: number, z: number, rad: number, n: number, withLamps: boolean) => {
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + 0.2;
      const px = x + Math.cos(a) * rad;
      const pz = z + Math.sin(a) * rad;
      if (withLamps && k % 2 === 0) {
        cyls.add(px, 0, pz, 0.1, 3.4, 0.1, TRIM);
        glows.add(px, 3.35, pz, 0.34, 0.12, 0.34, col("#ffc98a"));
        plan.lamps.push({ x: px, z: pz });
      } else tree(px, pz, 0.9 + r() * 0.3);
    }
  };
  ring(0, 0, 13.2, 22, true);
  ring(ZONES.crm.x, ZONES.crm.z, 10.2, 14, true);
  ring(ZONES.auto.x, ZONES.auto.z, 10.2, 14, true);
  ring(ZONES.ant.x, ZONES.ant.z, 7.2, 8, true);
  CASE_XS.forEach((x) => {
    for (const dx of [-7.6, 7.6]) {
      if (Math.abs(x + dx) <= 48) {
        cyls.add(x + dx, 0, CASE_Z + 3.6, 0.1, 3.4, 0.1, TRIM);
        glows.add(x + dx, 3.35, CASE_Z + 3.6, 0.34, 0.12, 0.34, col("#ffc98a"));
        plan.lamps.push({ x: x + dx, z: CASE_Z + 3.6 });
        tree(x + dx, CASE_Z - 3.6, 0.9);
      }
    }
  });

  coastDressing();

  // a handful of steaming manholes around the city
  for (let k = 0; k < 7; k++) {
    const a = Math.floor(r() * 16) - 8;
    const b = Math.floor(r() * 14) - 8;
    const x = 4 + a * PITCH, z = 4 + b * PITCH + 2;
    if (!inZone(x, z, 1)) plan.steam.push({ x, z });
  }

  [walls, wallsCyl, trims, glows, cyls, cones, icos, leaves, gables, vertSigns, ...signs, ...boards].forEach((b) => b.build(group));

  // signs breathe and a few of them flicker like failing neon tubes
  const base = signMats.map((m) => m.color.clone());
  const tick = (t: number) => {
    signMats.forEach((m, i) => {
      const flick = i % 3 === 0 && Math.sin(t * 31 + i * 5.7) > 0.93 ? 0.35 : 1;
      const k = (0.9 + 0.1 * Math.sin(t * 1.3 + i)) * flick;
      m.color.copy(base[i]).multiplyScalar(k * (1 - 0.85 * dayU.value));
    });
  };
  return { group, plan, tick };
}

/* ------------------------------------------------------------------ */
/* Ground: asphalt, sidewalks, markings, puddles and lamp pools         */
/* ------------------------------------------------------------------ */

export async function paintGround(plan: Plan, k: number, pause?: () => Promise<void>) {
  // The ground is one big rectangle: the whole city plus the beach on its south edge.
  const X0 = GROUND.x0;
  const Z0 = GROUND.z0;
  const W = Math.round((GROUND.x1 - GROUND.x0) * k);
  const H = Math.round((GROUND.z1 - GROUND.z0) * k);
  const X = (x: number) => (x - X0) * k;
  const Z = (z: number) => (z - Z0) * k;
  const mk = () => {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    return c;
  };
  const cMap = mk();
  const cEm = mk();
  const cRough = mk();
  const g = cMap.getContext("2d")!;
  const e = cEm.getContext("2d")!;
  const rg = cRough.getContext("2d")!;
  const rr = rand(404);

  g.fillStyle = "#2a2d3a"; // the same asphalt as the roads outside the city
  g.fillRect(0, 0, W, H);
  e.fillStyle = "#000";
  e.fillRect(0, 0, W, H);
  rg.fillStyle = "#8c8c8c"; // damp asphalt, close to the dry roads outside
  rg.fillRect(0, 0, W, H);

  const rect = (x: number, z: number, w: number, d: number, color: string, rough?: string) => {
    g.fillStyle = color;
    g.fillRect(X(x), Z(z), w * k, d * k);
    if (rough) {
      rg.fillStyle = rough;
      rg.fillRect(X(x), Z(z), w * k, d * k);
    }
  };

  // blocks: sidewalk ring + a pad that depends on what stands on it
  plan.blocks.forEach(({ cx, cz, type }) => {
    if (type === "shore") return;
    rect(cx - 3, cz - 3, 6, 6, "#3a3f4e", "#dcdcdc");
    const inner =
      type === "park" || type === "green" ? "#548542" : type === "houses" || type === "none" ? "#5e8a45" : type === "plaza" ? "#555b70" : "#2a2d39";
    rect(cx - 2.45, cz - 2.45, 4.9, 4.9, inner, "#e6e6e6");
    if (type === "park" || type === "green") {
      for (let n = 0; n < 40; n++) {
        g.fillStyle = `rgba(${60 + rr() * 30},${120 + rr() * 40},${80 + rr() * 30},0.18)`;
        g.beginPath();
        g.arc(X(cx + (rr() - 0.5) * 4.6), Z(cz + (rr() - 0.5) * 4.6), (0.15 + rr() * 0.3) * k, 0, 7);
        g.fill();
      }
      if (type === "park") {
        g.strokeStyle = "#8a8466";
        g.lineWidth = 0.28 * k;
        g.beginPath();
        g.moveTo(X(cx - 2.45), Z(cz));
        g.quadraticCurveTo(X(cx), Z(cz - 1.4), X(cx + 2.45), Z(cz + 0.4));
        g.stroke();
      }
    }
  });

  // road markings (only north of the boardwalk)
  for (let n = -BLOCKS - 1; n <= BLOCKS - 1; n++) {
    const c = 4 + n * PITCH;
    const avenue = n % 3 === 0;
    g.fillStyle = avenue ? "rgba(214,178,74,0.85)" : "rgba(190,196,214,0.55)";
    for (let t = -HALF + 4; t < HALF - 3; t += 2.4) {
      const m = (((t + HALF + 4) % PITCH) + PITCH) % PITCH;
      if (m < 2.2 || m > PITCH - 2.2) continue;
      g.fillRect(X(t), Z(c) - 0.04 * k, 1.2 * k, 0.08 * k);
      g.fillRect(X(c) - 0.04 * k, Z(t), 0.08 * k, 1.2 * k);
    }
  }
  // zebra crossings at every intersection
  g.fillStyle = "rgba(220,224,236,0.55)";
  for (let a = -BLOCKS - 1; a <= BLOCKS - 1; a++) {
    for (let b = -BLOCKS - 1; b <= BLOCKS - 1; b++) {
      const ix = 4 + a * PITCH;
      const iz = 4 + b * PITCH;
      for (let s = 0; s < 5; s++) {
        const off = -0.8 + s * 0.4;
        g.fillRect(X(ix + off) - 0.09 * k, Z(iz - 1.9), 0.18 * k, 0.8 * k);
        g.fillRect(X(ix + off) - 0.09 * k, Z(iz + 1.1), 0.18 * k, 0.8 * k);
        g.fillRect(X(ix - 1.9), Z(iz + off) - 0.09 * k, 0.8 * k, 0.18 * k);
        g.fillRect(X(ix + 1.1), Z(iz + off) - 0.09 * k, 0.8 * k, 0.18 * k);
      }
    }
  }

  // puddles
  for (let n = 0; n < 700; n++) {
    const a = Math.floor(rr() * (BLOCKS * 2)) - BLOCKS;
    const along = (rr() - 0.5) * (HALF * 2 - 8);
    const off = (rr() - 0.5) * 1.3;
    const horizontal = rr() < 0.5;
    const x = horizontal ? along : 4 + a * PITCH + off;
    const z = horizontal ? 4 + a * PITCH + off : along;
    const w = (0.6 + rr() * 1.9) * k;
    const h = (0.3 + rr() * 0.7) * k;
    g.fillStyle = "rgba(14,17,28,0.8)";
    g.beginPath();
    g.ellipse(X(x), Z(z), w, h, rr() * 3, 0, 7);
    g.fill();
    g.strokeStyle = "rgba(120,140,210,0.1)";
    g.lineWidth = 2;
    g.stroke();
    rg.fillStyle = "#101010";
    rg.beginPath();
    rg.ellipse(X(x), Z(z), w, h, 0, 0, 7);
    rg.fill();
  }
  plan.ponds.forEach((p) => {
    g.fillStyle = "#1d3a5e";
    g.beginPath();
    g.arc(X(p.x), Z(p.z), p.r * k, 0, 7);
    g.fill();
    rg.fillStyle = "#080808";
    rg.beginPath();
    rg.arc(X(p.x), Z(p.z), p.r * k, 0, 7);
    rg.fill();
  });

  // landmark plazas painted over the street grid
  const { hub, crm, auto, ant, cases } = ZONES;
  const disc = (x: number, z: number, rad: number, color: string) => {
    g.fillStyle = color;
    g.beginPath();
    g.arc(X(x), Z(z), rad * k, 0, 7);
    g.fill();
    rg.fillStyle = "#cfcfcf";
    rg.beginPath();
    rg.arc(X(x), Z(z), rad * k, 0, 7);
    rg.fill();
  };
  disc(hub.x, hub.z, hub.r - 1.4, "#3e4357");
  g.strokeStyle = "rgba(160,168,196,0.35)";
  g.lineWidth = 0.1 * k;
  for (const rad of [4, 7.5, 11]) {
    g.beginPath();
    g.arc(X(0), Z(0), rad * k, 0, 7);
    g.stroke();
  }
  for (let n = 0; n < 12; n++) {
    const a = (n / 12) * Math.PI * 2;
    g.beginPath();
    g.moveTo(X(Math.cos(a) * 4), Z(Math.sin(a) * 4));
    g.lineTo(X(Math.cos(a) * 11), Z(Math.sin(a) * 11));
    g.stroke();
  }
  const pad = (x: number, z: number, half: number, color: string) => {
    rect(x - half, z - half, half * 2, half * 2, color, "#cfcfcf");
    g.strokeStyle = "rgba(160,168,196,0.4)";
    g.lineWidth = 0.12 * k;
    g.strokeRect(X(x - half + 0.6), Z(z - half + 0.6), (half * 2 - 1.2) * k, (half * 2 - 1.2) * k);
  };
  pad(crm.x, crm.z, crm.r - 1, "#3e4357");
  pad(auto.x, auto.z, auto.r - 1, "#3e4357");
  pad(ant.x, ant.z, ant.r - 1.2, "#3a4a42");
  rect(cases.x0, cases.z0, cases.x1 - cases.x0, cases.z1 - cases.z0, "#3b4054", "#cfcfcf");
  g.strokeStyle = "rgba(160,168,196,0.3)";
  g.lineWidth = 0.1 * k;
  g.strokeRect(X(cases.x0 + 1), Z(cases.z0 + 1), (cases.x1 - cases.x0 - 2) * k, (cases.z1 - cases.z0 - 2) * k);

  // pools of lamp light
  plan.lamps.forEach((l) => {
    const gr = g.createRadialGradient(X(l.x), Z(l.z), 0, X(l.x), Z(l.z), 3.2 * k);
    gr.addColorStop(0, "rgba(255,170,90,0.4)");
    gr.addColorStop(1, "rgba(255,170,90,0)");
    g.globalCompositeOperation = "lighter";
    g.fillStyle = gr;
    g.fillRect(X(l.x) - 3.2 * k, Z(l.z) - 3.2 * k, 6.4 * k, 6.4 * k);
    const ge = e.createRadialGradient(X(l.x), Z(l.z), 0, X(l.x), Z(l.z), 2.6 * k);
    ge.addColorStop(0, "rgba(255,150,70,0.5)");
    ge.addColorStop(1, "rgba(255,150,70,0)");
    e.globalCompositeOperation = "lighter";
    e.fillStyle = ge;
    e.fillRect(X(l.x) - 2.6 * k, Z(l.z) - 2.6 * k, 5.2 * k, 5.2 * k);
    g.globalCompositeOperation = "source-over";
    e.globalCompositeOperation = "source-over";
  });

  // neon spilling onto the wet street
  plan.spills.forEach((sp) => {
    const gr = g.createRadialGradient(X(sp.x), Z(sp.z), 0, X(sp.x), Z(sp.z), 4.2 * k);
    gr.addColorStop(0, `rgba(${sp.color},0.55)`);
    gr.addColorStop(1, `rgba(${sp.color},0)`);
    g.globalCompositeOperation = "lighter";
    g.fillStyle = gr;
    g.fillRect(X(sp.x) - 4.2 * k, Z(sp.z) - 4.2 * k, 8.4 * k, 8.4 * k);
    const ge = e.createRadialGradient(X(sp.x), Z(sp.z), 0, X(sp.x), Z(sp.z), 3.2 * k);
    ge.addColorStop(0, `rgba(${sp.color},0.5)`);
    ge.addColorStop(1, `rgba(${sp.color},0)`);
    e.globalCompositeOperation = "lighter";
    e.fillStyle = ge;
    e.fillRect(X(sp.x) - 3.2 * k, Z(sp.z) - 3.2 * k, 6.4 * k, 6.4 * k);
    g.globalCompositeOperation = "source-over";
    e.globalCompositeOperation = "source-over";
  });

  // The shore, per pixel: wet sand, dry sand, dunes, a boardwalk and lawn follow the real
  // coastline (landL). The wet asphalt lets the mirrored city show through, pavements stay
  // solid, the water side is transparent and the western edge melts into the fields.
  const cAlpha = mk();
  const ag = cAlpha.getContext("2d")!;
  const md = g.getImageData(0, 0, W, H);
  const rd = rg.getImageData(0, 0, W, H);
  const ad = ag.createImageData(W, H);
  const hex3 = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const mixc = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const WET = hex3("#4a4759");
  const DAMP = hex3("#7a6e68");
  const DRY = hex3("#a38f72");
  const DUNE = hex3("#566f4a");
  const LAWN = hex3("#35513f");
  const PLANK = hex3("#6b5a48");
  const hsh = (x: number, y: number) => {
    const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return v - Math.floor(v);
  };
  // landL (two exp/log per call) used to run for every one of the ~6M pixels. Sample it on a coarse grid instead and only
  // go per pixel where the shore can be: the field changes by under ~3 m per metre, so a cell whose corners are all far
  // inland (or far out to sea) cannot hold the shore band.
  const S = 8;
  const nx = Math.ceil(W / S) + 1;
  const ny = Math.ceil(H / S) + 1;
  const coarse = new Float32Array(nx * ny);
  for (let cj = 0; cj < ny; cj++) for (let ci = 0; ci < nx; ci++) coarse[cj * nx + ci] = landL(X0 + (ci * S) / k, Z0 + (cj * S) / k);
  const cellMin = new Float32Array((nx - 1) * (ny - 1));
  const cellMax = new Float32Array((nx - 1) * (ny - 1));
  for (let cj = 0; cj < ny - 1; cj++) {
    for (let ci = 0; ci < nx - 1; ci++) {
      const a0 = coarse[cj * nx + ci];
      const a1 = coarse[cj * nx + ci + 1];
      const a2 = coarse[(cj + 1) * nx + ci];
      const a3 = coarse[(cj + 1) * nx + ci + 1];
      cellMin[cj * (nx - 1) + ci] = Math.min(a0, a1, a2, a3);
      cellMax[cj * (nx - 1) + ci] = Math.max(a0, a1, a2, a3);
    }
  }
  let slice = performance.now();
  for (let j = 0; j < H; j++) {
    if (pause && j % 32 === 0 && performance.now() - slice > 8) {
      await pause();
      slice = performance.now();
    }
    const z = Z0 + j / k;
    const rowCell = Math.min(ny - 2, Math.floor(j / S)) * (nx - 1);
    for (let i = 0; i < W; i++) {
      const x = X0 + i / k;
      const idx = (j * W + i) * 4;
      let a = 255;
      const interior = x > -60 && x < 52 && z > -58 && z < 36;
      let shore = false;
      if (!interior) {
        const cell = rowCell + Math.min(nx - 2, Math.floor(i / S));
        const L = cellMin[cell] > 18.5 ? 99 : cellMax[cell] < -3.5 ? -99 : landL(x, z);
        if (L < 16) {
          shore = true;
          const n = hsh(Math.floor(x * 4), Math.floor(z * 4));
          let c: [number, number, number];
          let rough = 235;
          if (L <= 0) {
            c = WET;
            rough = 40;
            a = 255 * Math.min(1, Math.max(0, (L + 0.5) / 0.9));
          } else if (L < 1.6) {
            c = mixc(WET, DAMP, L / 1.6);
            rough = 70;
          } else if (L < 3.8) {
            c = mixc(DAMP, DRY, (L - 1.6) / 2.2);
            rough = 150;
          } else if (L < 9.5) {
            c = mixc(DRY, [DRY[0] * 1.08, DRY[1] * 1.05, DRY[2] * 0.98], n);
          } else if (L < 12.4) {
            const t = Math.min(1, Math.max(0, (L - 9.5) / 2.9));
            c = n < t * 0.9 ? DUNE : DRY;
            rough = 220;
            if (L > 10.3 && L < 11.7) {
              c = mixc(PLANK, [PLANK[0] * 0.8, PLANK[1] * 0.8, PLANK[2] * 0.8], Math.sin((x + z) * 5.2) > 0.85 ? 1 : 0);
              rough = 200;
            }
          } else {
            c = mixc(LAWN, DUNE, n * 0.5);
          }
          md.data[idx] = c[0] * (0.92 + n * 0.16);
          md.data[idx + 1] = c[1] * (0.92 + n * 0.16);
          md.data[idx + 2] = c[2] * (0.92 + n * 0.16);
          rd.data[idx] = rough;
          a = 0; // the beach itself comes from the terrain, exactly as it does outside the city
        }
      }
      if (!shore) {
        const v = rd.data[idx];
        a = v > 150 ? 255 : v > 60 ? 188 : 105;
      }
      const ex = Math.max(-x, (z - 60) * 1.6 + 52);
      if (ex > 67.5) {
        // the painted ground ends just past the last ring of blocks; real streets (drawn as geometry) take over beyond it
        const t = Math.min(1, (ex - 67.5) / 0.8);
        a *= 1 - t * t * (3 - 2 * t);
      }
      ad.data[idx] = ad.data[idx + 1] = ad.data[idx + 2] = a;
      ad.data[idx + 3] = 255;
    }
  }
  g.putImageData(md, 0, 0);
  rg.putImageData(rd, 0, 0);
  ag.putImageData(ad, 0, 0);
  const alpha = new THREE.CanvasTexture(cAlpha);

  const map = new THREE.CanvasTexture(cMap);
  map.colorSpace = THREE.SRGBColorSpace;
  const emissive = new THREE.CanvasTexture(cEm);
  emissive.colorSpace = THREE.SRGBColorSpace;
  const rough = new THREE.CanvasTexture(cRough);
  [map, emissive, rough, alpha].forEach((t) => {
    t.anisotropy = 8;
  });
  return { map, emissive, rough, alpha };
}
