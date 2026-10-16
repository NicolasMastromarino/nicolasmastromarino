import * as THREE from "three";
import { Bucket, GEO, type Plan } from "./city-kit";
import { ANT_C, AUTO_C, CASE_XS, CASE_Z, CRM_C, findCoast, landL, rand } from "./city-layout";
import { dayU, rainState, makeBoardTexture, makeFoliageMaterial, makeGlowMaterial, makeSignTexture, makeTrimMaterial, registerGlow, type Uniform } from "./city-materials";
import { addPalm } from "./city-palm";
import { HIGHWAY_Z, ROADS_X, ROADS_Z, terrainHeight } from "./city-terrain";
import { INDUSTRIES, laneOf } from "./industries";

/**
 * Everything that lives beyond the street grid: the railway, farm machinery,
 * herds, wind turbines, the mountain road and its villages, the stadium, the
 * big bridge, the container port, construction cranes and a helicopter.
 */

type Anim = (t: number, dt: number) => void;
export type WorldCtx = { scene: THREE.Scene; animated: Anim[]; mobile: boolean; plan: Plan; time: Uniform; farms: [number, number, number][] };
export type World = {
  /** lamps that should fade away in daylight */
  nightLights: { light: THREE.PointLight; base: number }[];
  nightBeams: { mat: THREE.MeshBasicMaterial; base: number }[];
};

const C = (h: string) => new THREE.Color(h);
const PLASTER = ["#b7a48f", "#a89a86", "#b98d84", "#a7b3a0", "#c1b08a"].map(C);
const ROOFS = ["#4d5470", "#3f4559", "#8a4f45", "#5a5f78", "#6b4a45"].map(C);
const CARS = ["#b3363a", "#d9a441", "#cfd3dc", "#3f6fb0", "#6b7488", "#2f3548", "#4a9a8a"].map(C);
const BOXES = ["#b3363a", "#3f6fb0", "#d9a441", "#4a9a8a", "#8b5a8c", "#d8694f", "#6b7488", "#cfd3dc"].map(C);
const hmax = (x: number, z: number, r: number) => {
  let m = Math.max(0, terrainHeight(x, z));
  for (const [dx, dz] of [[r, 0], [-r, 0], [0, r], [0, -r], [r, r], [-r, -r], [r, -r], [-r, r]]) m = Math.max(m, terrainHeight(x + dx, z + dz));
  return m;
};

const smoothS = (a: number, b: number, v: number) => {
  const k = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

export function buildWorld(ctx: WorldCtx): World {
  const { scene, animated } = ctx;
  const r = rand(9001);
  const rr = (a: number, b: number) => a + (b - a) * r();
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const out: World = { nightLights: [], nightBeams: [] };

  /* ------------------------------ shared kit ------------------------------ */
  const trimMat = makeTrimMaterial();
  const foliageMat = makeFoliageMaterial();
  const glowMat = makeGlowMaterial(1.9);
  const B = {
    box: new Bucket(GEO.box(), trimMat),
    cyl: new Bucket(GEO.cyl(), trimMat),
    cone: new Bucket(GEO.cone(), trimMat),
    ico: new Bucket(GEO.ico(), foliageMat),
    gab: new Bucket(GEO.gable(), trimMat),
    glow: new Bucket(GEO.box(), glowMat, { cast: false, receive: false }),
  };
  // neon shop signs and big LED billboards for the countryside, the same idea as downtown
  const SIGNW = ["INN", "BAKERY", "MARKET", "FEED", "CAFE", "GARAGE", "DINER", "FARM SHOP", "BAR", "DELI", "HARDWARE", "OPEN", "STATION", "TACOS", "BURGERS", "PIZZA", "COFFEE", "TICKETS", "GAS", "PORT", "TUNNEL"];
  const NEONW = ["#ff4f9a", "#4fd8ff", "#ffb84f", "#6dffb0", "#b98aff"];
  const signGeoW = new THREE.BoxGeometry(1, 1, 1);
  const signsW = SIGNW.map((t, i) => {
    const m = new THREE.MeshBasicMaterial({ map: makeSignTexture(t, NEONW[i % NEONW.length]), color: new THREE.Color(1.4, 1.4, 1.4) });
    registerGlow(m);
    return new Bucket(signGeoW, m, { cast: false, receive: false });
  });
  const signIdx = (name: string) => Math.max(0, SIGNW.indexOf(name));
  const BOARDS: [string, string, string, string][] = [
    ["ONE SYSTEM", "CRM + AUTOMATION", "#ff5b3d", "#b02a6a"],
    ["AUTOMATE", "EVERY FOLLOW-UP", "#1fb5a8", "#1b4f9a"],
    ["NEVER LOSE", "A LEAD AGAIN", "#8a4fd8", "#3a2a8a"],
    ["BOOK NOW", "WE ANSWER IN 5 MIN", "#f2a53a", "#d8503a"],
  ];
  const boardsW = BOARDS.map(([h, sub, c1, c2]) => new Bucket(signGeoW, new THREE.MeshBasicMaterial({ map: makeBoardTexture(h, sub, c1, c2), color: new THREE.Color(1.25, 1.25, 1.25) }), { cast: false, receive: false }));
  const AWN = ["#d8694f", "#4fa3a5", "#d4a24c", "#8b5a8c", "#6a86d6"].map(C);
  const geoBox = GEO.box();
  const geoCyl = GEO.cyl();
  const geoCone = GEO.cone();
  const geoWheel = new THREE.CylinderGeometry(0.5, 0.5, 1, 10).rotateX(Math.PI / 2); // axle along z
  const geoBlade = new THREE.BoxGeometry(1, 1, 1);
  const stdCache = new Map<string, THREE.MeshStandardMaterial>();
  const std = (hex: string, rough = 0.7, metal = 0.1) => {
    const k = `${hex}-${rough}-${metal}`;
    let m = stdCache.get(k);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color: C(hex), roughness: rough, metalness: metal });
      stdCache.set(k, m);
    }
    return m;
  };
  const glowCache = new Map<string, THREE.MeshBasicMaterial>();
  const gm = (hex: string, k = 1.9) => {
    const key = `${hex}-${k}`;
    let m = glowCache.get(key);
    if (!m) {
      m = new THREE.MeshBasicMaterial({ color: C(hex).multiplyScalar(k) });
      registerGlow(m);
      glowCache.set(key, m);
    }
    return m;
  };
  /** mesh with its base at y (boxes and cylinders), centred in x and z */
  const mesh = (parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, sx: number, sy: number, sz: number, x: number, y: number, z: number, ry = 0, shadow = true) => {
    const m = new THREE.Mesh(geo, mat);
    m.scale.set(sx, sy, sz);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    m.castShadow = shadow && (mat as THREE.MeshStandardMaterial).isMeshStandardMaterial === true;
    parent.add(m);
    return m;
  };
  const bx = (p: THREE.Object3D, hex: string, w: number, h: number, d: number, x: number, y: number, z: number, ry = 0) => mesh(p, geoBox, std(hex), w, h, d, x, y, z, ry);
  const gl = (p: THREE.Object3D, hex: string, w: number, h: number, d: number, x: number, y: number, z: number, k = 1.9, ry = 0) => mesh(p, geoBox, gm(hex, k), w, h, d, x, y, z, ry, false);

  // everything that is paved or fenced registers here, so grass, shrubs and trees never grow over it
  const roadHash = new Map<string, [number, number, number][]>();
  const bigAreas: [number, number, number][] = [];
  const addRoad = (x: number, z: number, rad: number) => {
    if (rad > 8) {
      bigAreas.push([x, z, rad]);
      return;
    }
    const k = Math.floor(x / 8) + "," + Math.floor(z / 8);
    const cell = roadHash.get(k);
    if (cell) cell.push([x, z, rad]);
    else roadHash.set(k, [[x, z, rad]]);
  };
  const onRoad = (x: number, z: number, pad = 0) => {
    const cx0 = Math.floor(x / 8);
    const cz0 = Math.floor(z / 8);
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        const cell = roadHash.get(cx0 + i + "," + (cz0 + j));
        if (cell) for (const [px, pz, rd] of cell) if (Math.hypot(px - x, pz - z) < rd + pad) return true;
      }
    }
    for (const [px, pz, rd] of bigAreas) if (Math.hypot(px - x, pz - z) < rd + pad) return true;
    return false;
  };
  // the industry sites out of town keep their plaza clear of grass, shrubs and trees
  INDUSTRIES.forEach((ind) => {
    if (ind.site !== "open") return;
    addRoad(ind.x, ind.z, ind.size ? ind.size * 0.75 : 10.6);
    const lane = laneOf(ind);
    if (!lane) return;
    const alongZ = lane.d >= lane.w;
    for (let s = -(alongZ ? lane.d : lane.w) / 2; s <= (alongZ ? lane.d : lane.w) / 2; s += 2) addRoad(lane.x + (alongZ ? 0 : s), lane.z + (alongZ ? s : 0), 3.6);
  });
  const coastPts: [number, number][] = [];
  const pools: [number, number, number, number][] = [];
  const blobs: [number, number, number, number, number][] = [];
  const blob = (x: number, z: number, rx: number, rz: number) => blobs.push([x, Math.max(0.05, terrainHeight(x, z)) + 0.05, z, rx, rz]);
  const blinkers: { m: THREE.Object3D; period: number; duty: number; ph: number }[] = [];
  const blink = (m: THREE.Object3D, period = 1.6, duty = 0.35, ph = r()) => blinkers.push({ m, period, duty, ph });
  const redLight = (p: THREE.Object3D, x: number, y: number, z: number, s = 0.4) => {
    const m = mesh(p, geoBox, new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.25, 0.2) }), s, s, s, x, y, z, 0, false);
    blink(m);
    return m;
  };

  const beamGeo = new THREE.ConeGeometry(1, 1, 14, 1, true).translate(0, -0.5, 0).rotateZ(Math.PI / 2);
  const beam = (p: THREE.Object3D, len: number, rad: number, x: number, y: number, z: number, opacity = 0.14) => {
    const mat = new THREE.MeshBasicMaterial({ color: C("#fff1cf"), transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    const m = new THREE.Mesh(beamGeo, mat);
    m.scale.set(len, rad, rad);
    m.position.set(x, y, z);
    p.add(m);
    out.nightBeams.push({ mat, base: opacity });
    return m;
  };
  const addLight = (x: number, y: number, z: number, color: number, intensity: number, distance: number) => {
    const l = new THREE.PointLight(color, intensity, distance, 1.6);
    l.position.set(x, y, z);
    scene.add(l);
    out.nightLights.push({ light: l, base: intensity });
  };
  const lampPost = (x: number, y: number, z: number, h = 4) => {
    B.cyl.add(x, y, z, 0.12, h, 0.12, C("#2c3040"));
    B.glow.add(x, y + h, z, 0.4, 0.14, 0.4, C("#ffc98a"));
  };

  /* terrain sampling for flat placements */
  const flatAt = (x: number, z: number, rad: number, limit: number) => {
    const hs = [terrainHeight(x, z), terrainHeight(x + rad, z), terrainHeight(x - rad, z), terrainHeight(x, z + rad), terrainHeight(x, z - rad)];
    return Math.max(...hs) - Math.min(...hs) < limit;
  };
  const RAIL_Z = -14;
  const STAD = { x: -114, z: 30 };
  /** the real footprint of the stadium pad and its car parks (world units) */
  const PAD = { x0: -146.5, x1: -81.5, z0: 10, z1: 61.5 };
  const inPad = (x: number, z: number, m = 0) => x > PAD.x0 - m && x < PAD.x1 + m && z > PAD.z0 - m && z < PAD.z1 + m;
  let PCOAST = 1e9;
  for (let z = 106; z <= 134; z += 3) PCOAST = Math.min(PCOAST, findCoast(40, z, 1, 0, 0).x);
  const PORT = { x0: PCOAST - 7, x1: PCOAST + 29, z0: 108, z1: 132 };
  const blocked = (x: number, z: number, pad = 0) => {
    if (x > -130 - pad && x < 100 + pad && z > -98 - pad && z < 120 + pad) return true; // the city and the suburbs spilling out of it
    if (x < -60 && ROADS_Z.some((rz) => Math.abs(z - rz) < 10 + pad)) return true;
    if (z > 96 && ROADS_X.some((rx) => Math.abs(x - rx) < 10 + pad)) return true;
    if (Math.abs(z - RAIL_Z) < 9 + pad && x < -60) return true;
    if (inPad(x, z, 6 + pad)) return true; // the stadium and its car parks
    if (x > -192 - pad && x < -153 + pad && z > -2 - pad && z < 34 + pad) return true; // the gas station
    if (Math.abs(x + 140) < 12 + pad && z > -56 - pad && z < 14 + pad) return true; // the link road across the railway
    if (x > -132 - pad && x < -70 + pad && z > -172 - pad && z < -98 + pad) return true; // the beach villas on the northern bay
    return false;
  };
  const spots: [number, number, number][] = []; // taken spots: x, z, radius
  const free = (x: number, z: number, rad: number) => spots.every(([sx, sz, sr]) => Math.hypot(sx - x, sz - z) > sr + rad);
  const findField = (rad: number, tries = 2500, hCap = 1.6, region?: () => [number, number]) => {
    for (let k = 0; k < tries; k++) {
      const [x, z] = region ? region() : r() < 0.55 ? [rr(-260, -92), rr(-130, 150)] : [rr(-90, 110), rr(112, 190)];
      if (blocked(x, z, rad * 0.4) || landL(x, z) < 34) continue;
      if (terrainHeight(x, z) > hCap || !flatAt(x, z, rad * 0.6, 0.8)) continue;
      if (!free(x, z, rad)) continue;
      spots.push([x, z, rad]);
      return [x, z] as [number, number];
    }
    return null;
  };

  /* ------------------------------------------------------------------ */
  /* Surface train: a shuttle between the far hills and the town station */
  /* ------------------------------------------------------------------ */
  const X0 = -250;
  const TUN_X = -192.2; // the tunnel mouth, cut into the first mountain west of town
  const TUN_Y = 0.8; // rail height from the mouth inwards
  const TUN_FLAT = -186; // the rails are level from here into the mountain
  const X1 = -70;
  const STEP = 8;
  const ys: number[] = [];
  for (let x = X0; x <= X1 + 0.1; x += STEP) ys.push(x <= TUN_FLAT ? TUN_Y : Math.max(0.3, hmax(x, RAIL_Z, 3)) + 0.35);
  const railY = (x: number) => {
    const f = Math.min(ys.length - 1.001, Math.max(0, (x - X0) / STEP));
    const i = Math.floor(f);
    return ys[i] + (ys[i + 1] - ys[i]) * (f - i);
  };
  for (let i = 0; i < ys.length - 1; i++) {
    const xa = X0 + i * STEP;
    const xm = xa + STEP / 2;
    const dy = ys[i + 1] - ys[i];
    const len = Math.hypot(STEP, dy);
    const ang = Math.atan2(dy, STEP);
    B.box.add(xm, (ys[i] + ys[i + 1]) / 2 - 1.55, RAIL_Z, len + 0.3, 1.5, 4.4, C("#59586a"), 0, [0, 0, 0], 0, ang);
    for (const dz of [-0.72, 0.72]) B.box.add(xm, (ys[i] + ys[i + 1]) / 2 + 0.02, RAIL_Z + dz, len, 0.2, 0.14, C("#aeb4c4"), 0, [0, 0, 0], 0, ang);
  }
  for (let x = X0; x < X1; x += 1.7) B.box.add(x, railY(x) - 0.16, RAIL_Z, 0.36, 0.2, 3.1, C("#4a3d36"));
  for (let x = X0; x < X1; x += 6) addRoad(x, RAIL_Z, 4.6);
  // buffer stop and trackside signals
  B.box.add(X1 + 1, railY(X1), RAIL_Z, 1.2, 1.1, 2.6, C("#b3363a"));
  for (const sx of [-150, -130]) {
    B.cyl.add(sx, railY(sx) - 0.2, RAIL_Z + 2.6, 0.14, 3.6, 0.14, C("#2c3040"));
    B.glow.add(sx, railY(sx) + 3.0, RAIL_Z + 2.6, 0.34, 0.34, 0.2, sx === -150 ? C("#6dffb0") : C("#ff5a4a"));
  }
  // the tunnel: a stone headwall set into the mountain, an arched mouth, wing walls and a signal
  {
    const dy0 = TUN_Y - 12.35; // the portal was drawn for a rail height of 12.35
    const gy = 11.2 + dy0;
    const px = TUN_X;
    const STONE = C("#7d7a72");
    const STONE2 = C("#a39f94");
    const STONE3 = C("#6a675f");
    const DARK = C("#07080e");
    B.box.add(px - 1.1, 7.4 + dy0, RAIL_Z, 2.5, 11.5, 14, STONE);
    for (let k = 0; k < 9; k++) B.box.add(px + 0.12, 8.0 + dy0 + k * 1.25, RAIL_Z, 0.1, 0.06, 13.6, STONE3); // courses of masonry
    for (let k = -3; k <= 3; k++) B.box.add(px + 0.12, 7.6 + dy0, RAIL_Z + k * 2.0, 0.1, 11.0, 0.06, STONE3);
    B.box.add(px - 1.0, 18.7 + dy0, RAIL_Z, 3.1, 0.5, 14.8, STONE2); // coping
    B.box.add(px - 0.9, 18.3 + dy0, RAIL_Z, 2.8, 0.2, 14.4, STONE3);
    // arched mouth: a stone ring, then the black bore
    const cy = TUN_Y + 2.7;
    B.box.add(px + 0.2, TUN_Y - 0.4, RAIL_Z, 0.3, cy - TUN_Y + 0.4, 6.6, STONE2);
    B.cyl.add(px + 0.05, cy, RAIL_Z, 6.6, 0.45, 6.6, STONE2, 0, [0, 0, 0], 0, -Math.PI / 2);
    B.box.add(px + 0.36, TUN_Y - 0.4, RAIL_Z, 0.3, cy - TUN_Y + 0.4, 5.2, DARK);
    B.cyl.add(px + 0.2, cy, RAIL_Z, 5.2, 0.5, 5.2, DARK, 0, [0, 0, 0], 0, -Math.PI / 2);
    B.box.add(px + 0.4, cy + 2.75, RAIL_Z, 0.5, 0.5, 1.0, STONE2); // keystone
    for (const sz of [-1, 1]) B.cyl.add(px - 0.9, 19.0 + dy0, RAIL_Z + sz * 1.5, 0.14, 0.4, 0.14, C("#4d5470"));
    signsW[signIdx("TUNNEL")].add(px - 0.9, 19.3 + dy0, RAIL_Z, 3.6, 1.1, 0.12, new THREE.Color(1, 1, 1), Math.PI / 2);
    for (const sz of [-1, 1]) {
      B.cyl.add(px + 0.5, 11.4 + dy0, RAIL_Z + sz * 4.6, 0.3, 4.2, 0.3, C("#4d5470"));
      B.glow.add(px + 0.5, 15.5 + dy0, RAIL_Z + sz * 4.6, 0.5, 0.3, 0.5, C("#ffc98a"));
    }
    // wing walls that step down the cutting, with a stone coping
    for (const sz of [-1, 1]) {
      for (let k = 0; k < 6; k++) {
        const h = 4.4 - k * 0.7;
        B.box.add(px + 1.3 + k * 2.0, gy - 0.4, RAIL_Z + sz * 3.7, 2.05, h + 0.4, 0.7, STONE);
        B.box.add(px + 1.3 + k * 2.0, gy + h, RAIL_Z + sz * 3.7, 2.1, 0.18, 0.95, STONE2);
      }
    }
    // boulders and a few old sleepers piled beside the portal
    for (const [bx0, bz0, sc] of [[3, -7.6, 1.8], [6, -9.4, 1.3], [1.5, 8.2, 2.0], [5, 10.2, 1.4], [-1, -9, 2.2]] as const) B.ico.add(px + bx0, gy - 0.3, RAIL_Z + bz0, sc * 1.4, sc, sc * 1.2, C("#5b5d78"), bz0);
    // a trackside signal at the mouth
    B.cyl.add(px + 3.2, TUN_Y - 0.2, RAIL_Z + 2.6, 0.14, 3.6, 0.14, C("#2c3040"));
    B.glow.add(px + 3.2, TUN_Y + 3.0, RAIL_Z + 2.6, 0.34, 0.34, 0.2, C("#6dffb0"));
    addRoad(px + 6, RAIL_Z, 12);
  }
  // station: platform, canopy, building, lamps
  {
    const px0 = -120;
    const px1 = -82;
    const pxm = (px0 + px1) / 2;
    const y = railY(pxm);
    B.box.add(pxm, -1, RAIL_Z - 4.4, px1 - px0, y + 1.5, 4.6, C("#8e93a6"));
    B.box.add(pxm, y + 0.5, RAIL_Z - 2.2, px1 - px0, 0.12, 0.3, C("#e8d36a"));
    for (let x = px0 + 3; x <= px1 - 2; x += 7) B.cyl.add(x, y + 0.5, RAIL_Z - 5.8, 0.2, 3.6, 0.2, C("#4d5470"));
    B.box.add(pxm, y + 4.1, RAIL_Z - 4.8, px1 - px0 + 1.5, 0.28, 5.4, C("#4d5470"));
    B.glow.add(pxm, y + 3.98, RAIL_Z - 4.4, px1 - px0 - 1, 0.1, 0.5, C("#ffe6b0"));
    signsW[signIdx("STATION")].add(pxm, y + 5.1, RAIL_Z - 2.3, 5.2, 1.61, 0.12, new THREE.Color(1, 1, 1), 0);
    for (const sx of [-1, 1]) B.cyl.add(pxm + sx * 2.2, y + 4.3, RAIL_Z - 2.3, 0.14, 0.9, 0.14, C("#4d5470"));
    for (let x = px0 + 6; x <= px1 - 4; x += 12) {
      B.box.add(x, y + 0.5, RAIL_Z - 6.2, 1.6, 0.4, 0.5, C("#6b5a48"));
      B.box.add(x, y + 0.5, RAIL_Z - 6.4, 1.6, 1.0, 0.1, C("#6b5a48"));
    }
    // building behind the platform
    const bx0 = pxm - 4;
    B.box.add(bx0, 0, RAIL_Z - 12, 12, 4.0, 5.2, C("#b3a58f"));
    B.gab.add(bx0, 4.0, RAIL_Z - 12, 13, 1.8, 6.0, C("#454b63"));
    for (let k = -2; k <= 2; k++) if (k !== 0) B.glow.add(bx0 + k * 2.2, 1.3, RAIL_Z - 9.37, 0.9, 1.4, 0.06, C("#ffb870"));
    B.box.add(bx0, 4.6, RAIL_Z - 9.2, 4.0, 1.2, 0.16, C("#161a2c"));
    B.glow.add(bx0, 4.75, RAIL_Z - 9.1, 3.4, 0.5, 0.05, C("#6dffb0"));
    for (const lx of [px0 + 2, pxm, px1 - 2]) lampPost(lx, y + 0.5, RAIL_Z - 2.9, 3.6);
    spots.push([-110, RAIL_Z - 7, 12], [-98, RAIL_Z - 7, 12]);
    addRoad(-100, -22, 24);
  }

  const train = new THREE.Group();
  scene.add(train);
  {
    const CAR_L = 6.8;
    const NC = 5;
    const heads: THREE.Object3D[][] = [[], []]; // [front/rear][white,red]
    for (let i = 0; i < NC; i++) {
      const cx = (i - (NC - 1) / 2) * (CAR_L + 0.25);
      const g = new THREE.Group();
      g.position.set(cx, 0, 0);
      train.add(g);
      const lead = i === 0 || i === NC - 1;
      bx(g, "#c9cedb", CAR_L, 1.9, 2.5, 0, 0.75, 0);
      bx(g, i % 2 ? "#3f6fb0" : "#d8694f", CAR_L + 0.02, 0.62, 2.52, 0, 0.75, 0);
      bx(g, "#9ea5b8", CAR_L - 0.4, 0.22, 2.0, 0, 2.65, 0);
      bx(g, "#3a3f55", 1.6, 0.45, 1.2, i % 2 ? 1.2 : -1.4, 2.85, 0);
      for (const sz of [-1, 1]) for (let w = 0; w < 5; w++) gl(g, w === 2 && lead ? "#ffe6b0" : "#ffcf8a", 0.88, 0.66, 0.05, -2.7 + w * 1.35, 1.75, sz * 1.27, 1.5);
      for (const bxp of [-2.3, 2.3]) {
        bx(g, "#23283a", 2.2, 0.5, 2.1, bxp, 0.25, 0);
        for (const wx of [-0.7, 0.7]) for (const sz of [-0.95, 0.95]) mesh(g, geoWheel, std("#161a2c"), 0.8, 0.8, 0.25, bxp + wx, 0.45, sz);
      }
      if (lead) {
        const dir = i === 0 ? -1 : 1;
        bx(g, "#aeb4c4", 0.8, 1.55, 2.1, dir * (CAR_L / 2 + 0.38), 0.85, 0);
        const slot = i === 0 ? 0 : 1;
        for (const sz of [-0.7, 0.7]) {
          const w = gl(g, "#fff6dc", 0.08, 0.3, 0.4, dir * (CAR_L / 2 + 0.8), 1.35, sz, 3.0);
          const rd = gl(g, "#ff3a2a", 0.08, 0.26, 0.34, dir * (CAR_L / 2 + 0.8), 1.35, sz, 2.2);
          heads[slot].push(w, rd);
        }
      }
    }
    train.userData.heads = heads;
    const hb = beam(train, 12, 3.4, -(NC / 2) * (CAR_L + 0.25) - 1, 1.4, 0, 0.12);
    hb.rotation.y = Math.PI; // pointing toward -x, flipped with direction below
    train.userData.beam = hb;
  }
  const XSTOP = -101;
  const XFAR = -226; // far enough in for all five cars to be under the mountain
  const ease = (u: number) => 1 - Math.pow(1 - u, 3);
  const easeIn = (u: number) => u * u * u;
  animated.push((t) => {
    const cyc = 100;
    const u = ((t + 6) % cyc);
    let x = XSTOP;
    let dir = 1;
    let show = true;
    if (u < 30) {
      x = XFAR + (XSTOP - XFAR) * ease(u / 30);
    } else if (u < 44) {
      x = XSTOP;
      dir = u < 37 ? 1 : -1;
    } else if (u < 74) {
      x = XSTOP + (XFAR - XSTOP) * easeIn((u - 44) / 30);
      dir = -1;
    } else show = false;
    train.visible = show;
    if (!show) return;
    train.position.set(x, railY(x) + 0.05, RAIL_Z);
    train.rotation.z = Math.atan2(railY(x + 6) - railY(x - 6), 12);
    const heads = train.userData.heads as THREE.Object3D[][];
    // the leading end shows white lamps, the trailing end red
    heads[0].forEach((o, k) => (o.visible = dir < 0 ? k % 2 === 0 : k % 2 === 1)); // end at -x
    heads[1].forEach((o, k) => (o.visible = dir > 0 ? k % 2 === 0 : k % 2 === 1)); // end at +x
    const b = train.userData.beam as THREE.Mesh;
    b.rotation.y = dir > 0 ? 0 : Math.PI;
    b.position.x = dir > 0 ? 18.5 : -18.5;
  });

  /* ------------------------------------------------------------------ */
  /* Fields: crop plots, tractors, herds                                  */
  /* ------------------------------------------------------------------ */
  const cornTex = (() => {
    const cv = document.createElement("canvas");
    cv.width = 128;
    cv.height = 128;
    const g2 = cv.getContext("2d")!;
    g2.fillStyle = "#e9e4cf";
    g2.fillRect(0, 0, 128, 128);
    const gr = g2.createLinearGradient(0, 0, 0, 128);
    gr.addColorStop(0, "rgba(255,250,200,0.45)");
    gr.addColorStop(0.15, "rgba(255,250,200,0)");
    gr.addColorStop(0.8, "rgba(30,25,10,0)");
    gr.addColorStop(1, "rgba(30,25,10,0.5)");
    g2.fillStyle = gr;
    g2.fillRect(0, 0, 128, 128);
    for (let x = 4; x < 128; x += 16) {
      g2.fillStyle = "rgba(40,50,15,0.45)";
      g2.fillRect(x, 14, 3, 114);
      for (let y = 26; y < 120; y += 14) {
        g2.strokeStyle = (y / 14) % 2 ? "rgba(50,65,20,0.55)" : "rgba(255,255,215,0.45)";
        g2.lineWidth = 2;
        g2.beginPath();
        g2.moveTo(x + 1, y);
        g2.lineTo((y / 14) % 2 ? x + 13 : x - 11, y - 9);
        g2.stroke();
      }
      g2.fillStyle = "rgba(150,110,40,0.6)";
      g2.beginPath();
      g2.ellipse(x + 6, 66, 3, 8, 0.3, 0, Math.PI * 2);
      g2.fill();
      g2.fillStyle = "rgba(255,250,210,0.5)";
      for (let k = 0; k < 6; k++) g2.fillRect(x - 4 + k * 3, 4 + (k % 2) * 2, 2, 9);
    }
    const tx = new THREE.CanvasTexture(cv);
    tx.colorSpace = THREE.SRGBColorSpace;
    tx.anisotropy = 4;
    return tx;
  })();
  const cornB = new Bucket(GEO.box(), new THREE.MeshStandardMaterial({ map: cornTex, color: 0xffffff, roughness: 0.9 }));
  const pendingBarns: [number, number, number][] = [];
  /** a cornfield made of individual plants with their own heights and tassels, plus the details around it */
  const cornPlants = (x: number, z: number, wi: number, di: number, hh: number, golden: boolean) => {
    const cols = golden ? [C("#c9a93a"), C("#d4b648"), C("#bfa032"), C("#dcc05a")] : [C("#4f8a3f"), C("#5c9a45"), C("#468338"), C("#63a04a")];
    const tass = golden ? C("#ebd679") : C("#cdb356");
    for (let i = 0; i * 1.9 < di - 0.8; i++) {
      const pz = z - di / 2 + 0.9 + i * 1.9;
      for (let j = 0; j * 0.62 < wi - 0.8; j++) {
        if (r() < 0.06) continue; // a missing plant
        const px = x - wi / 2 + 0.6 + j * 0.62 + (r() - 0.5) * 0.14;
        const zz = pz + (r() - 0.5) * 0.3;
        const ph = 1.45 + r() * 0.8;
        cornB.add(px, hh + 0.04, zz, 0.5, ph, 0.5, pick(cols), r() * 0.7);
        B.box.add(px, hh + 0.04 + ph, zz, 0.3, 0.17, 0.3, tass, r());
        if (r() < 0.18) B.box.add(px + 0.2, hh + 0.04 + ph * 0.5, zz + 0.2, 0.14, 0.34, 0.14, golden ? C("#8a6a2a") : C("#5a7a30"));
      }
    }
    // tyre tracks in the headland, a wire fence on posts, an irrigation line with sprinklers, a scarecrow and crows
    const hw = wi / 2 + 1.7;
    const hd = di / 2 + 1.7;
    for (const sz of [-1, 1]) B.box.add(x, hh + 0.14, z + sz * (di / 2 + 1.0), wi + 1, 0.03, 0.34, C("#463a2d"));
    for (let k = -Math.floor(hw / 2.6); k <= Math.floor(hw / 2.6); k++) for (const sz of [-1, 1]) B.cyl.add(x + k * 2.6, hh, z + sz * hd, 0.1, 1.0, 0.1, C("#6b5a48"));
    for (let k = -Math.floor(hd / 2.6); k <= Math.floor(hd / 2.6); k++) for (const sx of [-1, 1]) B.cyl.add(x + sx * hw, hh, z + k * 2.6, 0.1, 1.0, 0.1, C("#6b5a48"));
    for (const yy of [0.55, 0.85]) {
      for (const sz of [-1, 1]) B.box.add(x, hh + yy, z + sz * hd, hw * 2, 0.03, 0.03, C("#aeb4c4"));
      for (const sx of [-1, 1]) B.box.add(x + sx * hw, hh + yy, z, 0.03, 0.03, hd * 2, C("#aeb4c4"));
    }
    B.box.add(x, hh + 0.2, z - di / 2 - 0.3, wi, 0.12, 0.12, C("#aeb4c4"));
    for (let k = 0; k * 4 < wi - 1; k++) {
      B.cyl.add(x - wi / 2 + 1 + k * 4, hh + 0.2, z - di / 2 - 0.3, 0.12, 0.5, 0.12, C("#2c3040"));
      B.box.add(x - wi / 2 + 1 + k * 4, hh + 0.7, z - di / 2 - 0.3, 0.4, 0.08, 0.08, C("#3f6fb0"));
    }
    const sx0 = x + wi * 0.2;
    B.box.add(sx0, hh, z, 0.1, 2.2, 0.1, C("#6b5a48"));
    B.box.add(sx0, hh + 1.6, z, 1.2, 0.1, 0.1, C("#6b5a48"));
    B.box.add(sx0, hh + 1.15, z, 0.5, 0.7, 0.3, C("#7a4a6a"));
    B.box.add(sx0, hh + 2.1, z, 0.34, 0.34, 0.34, C("#d9b88a"));
    B.box.add(sx0, hh + 2.42, z, 0.5, 0.1, 0.5, C("#5a4538"));
    B.box.add(sx0, hh + 2.45, z, 0.3, 0.22, 0.3, C("#5a4538"));
    for (let k = 0; k < 4; k++) B.box.add(x + (r() - 0.5) * wi * 0.8, hh + 2.0, z + (r() - 0.5) * di * 0.6, 0.22, 0.14, 0.34, C("#161a2c"));
  };
  const pivots: { g: THREE.Group; sp: number; ph: number }[] = [];
  const plots = ctx.mobile ? 9 : 20;
  for (let k = 0; k < plots; k++) {
    const p = findField(20, 3000, 1.2);
    if (!p) break;
    let [x, z] = p;
    // the ripe corn that ran along the solar farm sits against the cow pen instead: same field, same tractor, same random numbers
    const moved = k === 1 && Math.hypot(x + 68, z - 131) < 8;
    if (moved) {
      x = -78;
      z = 143.5;
    }
    const hh = hmax(x, z, 10) + 0.1;
    const w = rr(20, 28);
    const d = rr(16, 22);
    addRoad(x, z, Math.max(w, d) / 2 + 3);
    const along = r() < 0.5;
    const soil = pick(["#4b3d33", "#5a4a38", "#3e4a35"].map(C));
    const kind = k % 8 === 7 ? 6 : Math.floor(r() * 8);
    B.box.add(x, hh - 1.2, z, w, 1.3, d, soil);
    if (kind <= 1) {
      // classic stripes
      const rows = Math.floor((along ? d : w) / 1.6);
      const crop = pick(["#4f8a3f", "#6fa04a", "#a89a3f", "#c1a840", "#3f7a52", "#6a8f3f"].map(C));
      for (let i = 0; i < rows; i++) {
        const o = -(along ? d : w) / 2 + 0.8 + i * 1.6;
        if (along) B.box.add(x, hh + 0.05, z + o, w - 1.2, 0.35, 0.8, crop);
        else B.box.add(x + o, hh + 0.05, z, 0.8, 0.35, d - 1.2, crop);
      }
    } else if (kind === 2) {
      cornPlants(x, z, w - 4, d - 4, hh, false);
    } else if (kind === 3) {
      // orchard: a grid of round trees, some in blossom
      B.box.add(x, hh + 0.02, z, w - 1, 0.2, d - 1, C("#4f7b3e"));
      const bloom = r() < 0.4;
      for (let i = 0; i * 4.2 < d - 3; i++) {
        for (let j = 0; j * 4.2 < w - 3; j++) {
          const px = x - w / 2 + 2.2 + j * 4.2;
          const pz = z - d / 2 + 2.2 + i * 4.2;
          B.cyl.add(px, hh, pz, 0.3, 1.2, 0.3, C("#5a4538"));
          B.ico.add(px, hh + 1.9, pz, 2.4, 1.8, 2.4, bloom ? pick([C("#f2b8c6"), C("#f6dfe4"), C("#e8a4b8")]) : pick([C("#4f8d52"), C("#58984f"), C("#3f7a4a")]), r() * 3);
          if (!bloom && r() < 0.5) B.ico.add(px + 0.5, hh + 1.5, pz + 0.4, 0.3, 0.3, 0.3, pick([C("#d8503a"), C("#e8b83a")]));
        }
      }
    } else if (kind === 4) {
      // vineyard: posts, wires, leafy vines and bunches of grapes
      B.box.add(x, hh + 0.02, z, w - 1, 0.15, d - 1, C("#6a5a3a"));
      for (let i = 0; i * 2.6 < d - 2; i++) {
        const pz = z - d / 2 + 1.5 + i * 2.6;
        for (let j = 0; j * 3.2 < w - 2; j++) B.cyl.add(x - w / 2 + 1.4 + j * 3.2, hh, pz, 0.1, 1.5, 0.1, C("#6b5a48"));
        B.box.add(x, hh + 1.25, pz, w - 2, 0.04, 0.04, C("#c9ced9"));
        B.box.add(x, hh + 0.05, pz, w - 2, 0.9, 0.7, C("#4f8a3f"));
        for (let j = 0; j * 1.5 < w - 3; j++) B.ico.add(x - w / 2 + 2 + j * 1.5, hh + 0.3, pz + 0.38, 0.28, 0.35, 0.28, pick([C("#4a2a5a"), C("#6a3a7a"), C("#7a8a3a")]));
      }
    } else if (kind === 5) {
      // sunflowers
      B.box.add(x, hh + 0.02, z, w - 1, 0.15, d - 1, C("#5a8a3a"));
      for (let i = 0; i * 1.9 < d - 2; i++) {
        for (let j = 0; j * 1.9 < w - 2; j++) {
          const px = x - w / 2 + 1.3 + j * 1.9 + (i % 2) * 0.5;
          const pz = z - d / 2 + 1.2 + i * 1.9;
          B.box.add(px, hh, pz, 0.07, 1.1, 0.07, C("#4f8a3f"));
          B.box.add(px, hh + 1.0, pz, 0.5, 0.5, 0.12, C("#f2c230"), r() * 3);
          B.box.add(px, hh + 1.15, pz + 0.07, 0.22, 0.22, 0.05, C("#5a3a22"), r());
        }
      }
    } else if (kind === 6) {
      // greenhouses: glassy roofs, pale walls and magenta grow lights that glow at night
      for (let i = 0; i < 3; i++) {
        const gz = z - 6 + i * 6;
        B.box.add(x, hh, gz, 18, 2.2, 4.6, C("#bfe4de"));
        B.gab.add(x, hh + 2.2, gz, 18.4, 1.5, 5.0, C("#d8f2ee"), 0);
        for (let q = -4; q <= 4; q++) B.box.add(x + q * 2, hh, gz + 2.32, 0.08, 2.2, 0.05, C("#e8e0d0"));
        B.glow.add(x, hh + 1.0, gz + 2.34, 17, 0.35, 0.04, C("#ff4fd0").multiplyScalar(0.55));
        B.glow.add(x, hh + 1.0, gz - 2.34, 17, 0.35, 0.04, C("#ff4fd0").multiplyScalar(0.55));
      }
    } else {
      // ripe golden corn, with a tractor that keeps circling the field along the headland
      const wi = w - 5;
      const di = d - 5;
      for (const [bx0, bz0] of [[x + w / 2 + 8.5, z], [x - w / 2 - 8.5, z], [x, z + d / 2 + 8.5], [x, z - d / 2 - 8.5]] as [number, number][]) {
        if (moved) break; // its barn is built by hand below
        if (blocked(bx0, bz0, 8) || landL(bx0, bz0) < 30 || terrainHeight(bx0, bz0) > 1.8 || !free(bx0, bz0, 8)) continue;
        spots.push([bx0, bz0, 8]);
        addRoad(bx0, bz0, 9);
        const toX = x - bx0;
        const toZ = z - bz0;
        pendingBarns.push([bx0, bz0, Math.abs(toX) > Math.abs(toZ) ? (toX > 0 ? 1 : 3) : toZ > 0 ? 0 : 2]);
        break;
      }
      cornPlants(x, z, wi, di, hh, true);
      B.box.add(x, hh + 0.02, z, w - 1, 0.1, d - 1, C("#8a7a50")); // trodden headland under the stalks' footprint
      // the tractor, going round and round on a rounded-rectangle loop just outside the corn
      const loopW = w / 2 - 1.1;
      const loopD = d / 2 - 1.1;
      const rad = 2.2;
      const path: [number, number][] = [];
      const arc = (cx0: number, cz0: number, a0: number) => {
        for (let q = 0; q <= 6; q++) {
          const an = a0 + (q / 6) * (Math.PI / 2);
          path.push([cx0 + Math.cos(an) * rad, cz0 + Math.sin(an) * rad]);
        }
      };
      path.push([-loopW + rad, -loopD]);
      path.push([loopW - rad, -loopD]);
      arc(loopW - rad, -loopD + rad, -Math.PI / 2);
      path.push([loopW, loopD - rad]);
      arc(loopW - rad, loopD - rad, 0);
      path.push([-loopW + rad, loopD]);
      arc(-loopW + rad, loopD - rad, Math.PI / 2);
      path.push([-loopW, -loopD + rad]);
      arc(-loopW + rad, -loopD + rad, Math.PI);
      const cumL: number[] = [0];
      for (let i = 1; i < path.length; i++) cumL.push(cumL[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
      cumL.push(cumL[cumL.length - 1] + Math.hypot(path[0][0] - path[path.length - 1][0], path[0][1] - path[path.length - 1][1]));
      const loopLen = cumL[cumL.length - 1];
      const tg = new THREE.Group();
      scene.add(tg);
      const tcol = pick(["#3f8f4a", "#b3363a", "#d9a441", "#3f6fb0"]);
      bx(tg, tcol, 2.4, 0.9, 1.2, 0, 0.7, 0);
      bx(tg, tcol, 1.4, 0.7, 1.0, 1.35, 0.7, 0);
      bx(tg, "#1b2236", 1.0, 1.0, 1.0, -0.5, 1.6, 0);
      bx(tg, tcol, 1.2, 0.12, 1.2, -0.5, 2.6, 0);
      const twheels: THREE.Object3D[] = [];
      for (const sz of [-0.75, 0.75]) {
        twheels.push(mesh(tg, geoWheel, std("#161a2c"), 1.5, 1.5, 0.5, -0.75, 0.75, sz));
        twheels.push(mesh(tg, geoWheel, std("#161a2c"), 0.95, 0.95, 0.4, 1.5, 0.48, sz * 0.85));
      }
      bx(tg, "#7a7f93", 2.6, 0.5, 1.6, -2.5, 0.5, 0);
      for (const sz of [-0.4, 0.4]) gl(tg, "#fff6dc", 0.08, 0.26, 0.3, 2.07, 0.95, sz, 3.0);
      blink(mesh(tg, geoBox, new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.2, 0.2) }), 0.2, 0.2, 0.2, -0.5, 2.8, 0.4, 0, false), 1.1, 0.5);
      beam(tg, 8, 3.2, 2.1, 0.95, 0, 0.14);
      const startPh = r();
      const tsp = rr(2.0, 2.8);
      animated.push((t) => {
        const sd = (((t * tsp) / loopLen + startPh) % 1) * loopLen;
        let i = 1;
        while (i < cumL.length - 1 && cumL[i] < sd) i++;
        const pa = path[(i - 1) % path.length];
        const pb = path[i % path.length];
        const fr = (sd - cumL[i - 1]) / Math.max(0.0001, cumL[i] - cumL[i - 1]);
        const lx = pa[0] + (pb[0] - pa[0]) * fr;
        const lz = pa[1] + (pb[1] - pa[1]) * fr;
        tg.position.set(x + lx, hh + 0.06, z + lz);
        tg.rotation.y = Math.atan2(-(pb[1] - pa[1]), pb[0] - pa[0]);
        twheels.forEach((wh) => (wh.rotation.z = -t * tsp * 1.2));
      });
    }
  }
  animated.push((t) => pivots.forEach((pv) => (pv.g.rotation.y = pv.ph + t * pv.sp)));
  // tractors working the fields, with their headlights on
  const tractors: { g: THREE.Group; a: [number, number]; b: [number, number]; sp: number; ph: number; wheels: THREE.Object3D[] }[] = [];
  const TN = ctx.mobile ? 3 : 6;
  for (let k = 0; k < TN; k++) {
    const p = findField(30, 3000, 1.4);
    if (!p) break;
    const [x, z] = p;
    const horiz = r() < 0.5;
    const L = rr(12, 20);
    const a: [number, number] = horiz ? [x - L, z] : [x, z - L];
    const b: [number, number] = horiz ? [x + L, z] : [x, z + L];
    const g = new THREE.Group();
    scene.add(g);
    const body = pick(["#3f8f4a", "#b3363a", "#d9a441", "#3f6fb0"]);
    bx(g, body, 2.4, 0.9, 1.2, 0, 0.7, 0);
    bx(g, body, 1.4, 0.7, 1.0, 1.35, 0.7, 0);
    bx(g, "#1b2236", 1.0, 1.0, 1.0, -0.5, 1.6, 0);
    bx(g, body, 1.2, 0.12, 1.2, -0.5, 2.6, 0);
    const wheels: THREE.Object3D[] = [];
    for (const sz of [-0.75, 0.75]) {
      wheels.push(mesh(g, geoWheel, std("#161a2c"), 1.5, 1.5, 0.5, -0.75, 0.75, sz));
      wheels.push(mesh(g, geoWheel, std("#161a2c"), 0.95, 0.95, 0.4, 1.5, 0.48, sz * 0.85));
    }
    bx(g, "#7a7f93", 2.6, 0.5, 1.6, -2.5, 0.5, 0); // implement
    for (const sz of [-0.4, 0.4]) gl(g, "#fff6dc", 0.08, 0.26, 0.3, 2.07, 0.95, sz, 3.0);
    const bl = mesh(g, geoBox, new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.2, 0.2) }), 0.2, 0.2, 0.2, -0.5, 2.8, 0.4, 0, false);
    blink(bl, 1.1, 0.5);
    beam(g, 8, 3.2, 2.1, 0.95, 0, 0.14);
    tractors.push({ g, a, b, sp: rr(1.3, 1.9), ph: r(), wheels });
  }
  animated.push((t) => {
    tractors.forEach((tr) => {
      const L = Math.hypot(tr.b[0] - tr.a[0], tr.b[1] - tr.a[1]);
      const cyc = (L * 2) / tr.sp;
      const u = (((t / cyc + tr.ph) % 1) + 1) % 1;
      const dir = u < 0.5 ? 1 : -1;
      const f = u < 0.5 ? u * 2 : (1 - u) * 2;
      const x = tr.a[0] + (tr.b[0] - tr.a[0]) * f;
      const z = tr.a[1] + (tr.b[1] - tr.a[1]) * f;
      tr.g.position.set(x, Math.max(0, terrainHeight(x, z)) + 0.02, z);
      const hd = Math.atan2(-(tr.b[1] - tr.a[1]) * dir, (tr.b[0] - tr.a[0]) * dir);
      tr.g.rotation.y = hd;
      tr.wheels.forEach((w) => (w.rotation.z = -t * tr.sp * dir * 1.2));
    });
  });
  // pastures with a few cows
  const cowBody = [C("#e9e6df"), C("#e9e6df"), C("#6b4a38"), C("#2a2a32"), C("#b08a62")];
  const PN = ctx.mobile ? 3 : 7;
  for (let k = 0; k < PN; k++) {
    const p = findField(16, 3000, 1.4);
    if (!p) break;
    const [x, z] = p;
    const hh = hmax(x, z, 8) + 0.05;
    const w = 20;
    const d = 14;
    for (let i = 0; i <= 5; i++) {
      for (const sz of [-1, 1]) B.box.add(x - w / 2 + (i * w) / 5, hh, z + (sz * d) / 2, 0.16, 0.9, 0.16, C("#8a7a62"));
    }
    for (let i = 0; i <= 3; i++) for (const sx of [-1, 1]) B.box.add(x + (sx * w) / 2, hh, z - d / 2 + (i * d) / 3, 0.16, 0.9, 0.16, C("#8a7a62"));
    for (const [yy, hgt] of [[0.45, 0.08], [0.78, 0.08]]) {
      B.box.add(x, hh + yy, z - d / 2, w, hgt, 0.08, C("#8a7a62"));
      B.box.add(x, hh + yy, z + d / 2, w, hgt, 0.08, C("#8a7a62"));
      B.box.add(x - w / 2, hh + yy, z, 0.08, hgt, d, C("#8a7a62"));
      B.box.add(x + w / 2, hh + yy, z, 0.08, hgt, d, C("#8a7a62"));
    }
    const cows = 4 + Math.floor(r() * 4);
    for (let c = 0; c < cows; c++) {
      const cx = x + rr(-w / 2 + 2, w / 2 - 2);
      const cz = z + rr(-d / 2 + 2, d / 2 - 2);
      const ry = r() * Math.PI * 2;
      const col = pick(cowBody);
      const cs = Math.cos(ry);
      const sn = Math.sin(ry);
      const at = (lx: number, lz: number) => [cx + lx * cs + lz * sn, cz - lx * sn + lz * cs] as const;
      B.box.add(cx, hh + 0.42, cz, 1.4, 0.7, 0.62, col, ry);
      const [hx, hz] = at(0.82, 0);
      B.box.add(hx, hh + 0.68, hz, 0.46, 0.44, 0.44, col, ry);
      if (col.r > 0.8) {
        const [px, pz] = at(-0.1, 0.02);
        B.box.add(px, hh + 0.5, pz, 0.5, 0.72, 0.64, C("#3a3238"), ry);
      }
      for (const [lx, lz] of [[0.5, 0.2], [0.5, -0.2], [-0.5, 0.2], [-0.5, -0.2]]) {
        const [qx, qz] = at(lx, lz);
        B.box.add(qx, hh, qz, 0.13, 0.46, 0.13, C("#2c3040"), ry);
      }
    }
    // a couple of round hay bales
    for (let b = 0; b < 2; b++) B.cyl.add(x + rr(-w / 2 + 2, w / 2 - 2), hh + 0.6, z + rr(-d / 2 + 2, d / 2 - 2), 1.1, 1.1, 1.1, C("#c1a840"), 0, [0, 0, 0], Math.PI / 2);
  }

  /* ------------------------------------------------------------------ */
  /* Wind turbines on the hills                                          */
  /* ------------------------------------------------------------------ */
  const turbines: { rotor: THREE.Object3D; sp: number }[] = [];
  const WN = ctx.mobile ? 4 : 9;
  for (let k = 0, placed = 0; k < 4000 && placed < WN; k++) {
    const x = r() < 0.7 ? rr(-300, -120) : rr(-120, 220);
    const z = r() < 0.7 ? rr(-210, 190) : rr(150, 280);
    if (blocked(x, z, 8) || landL(x, z) < 12) continue;
    const h = terrainHeight(x, z);
    if (h < 6 || h > 30 || !flatAt(x, z, 3, 3)) continue;
    if (!free(x, z, 22)) continue;
    spots.push([x, z, 22]);
    placed++;
    const y = hmax(x, z, 2);
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = 0.9 + rr(-0.3, 0.3);
    scene.add(g);
    mesh(g, new THREE.CylinderGeometry(0.28, 0.55, 20, 8).translate(0, 10, 0), std("#d8dbe6", 0.6), 1, 1, 1, 0, -0.5, 0);
    bx(g, "#c9cedb", 2.8, 1.2, 1.2, 0.5, 19.6, 0);
    const rotor = new THREE.Group();
    rotor.position.set(2.0, 20.2, 0);
    g.add(rotor);
    for (let b = 0; b < 3; b++) {
      const arm = new THREE.Group();
      arm.rotation.x = (b * Math.PI * 2) / 3;
      rotor.add(arm);
      const bl = new THREE.Mesh(geoBlade, std("#e9ecf4", 0.5));
      bl.scale.set(0.12, 9, 0.5);
      bl.position.set(0, 4.8, 0);
      bl.castShadow = true;
      arm.add(bl);
    }
    mesh(rotor, new THREE.SphereGeometry(0.5, 8, 6), std("#c9cedb"), 1, 1, 1, 0, 0, 0);
    redLight(g, 0, 20.9, 0, 0.35);
    turbines.push({ rotor, sp: rr(0.5, 0.8) });
  }
  animated.push((t) => turbines.forEach((w) => (w.rotor.rotation.x = t * w.sp)));

  /* ------------------------------------------------------------------ */
  /* Mountain road and villages                                          */
  /* ------------------------------------------------------------------ */
  // the roundabout where the northern avenue, the link road and the beach road meet (centre line radius r)
  const RB = { x: -140, z: -44, r: 6.2 };
  const wp = [[-140, 4], [-140, -20], [-140, RB.z + RB.r]].map(([x, z]) => new THREE.Vector3(x, 0, z));
  const curve = new THREE.CatmullRomCurve3(wp, false, "catmullrom", 0.5);
  const pts = curve.getSpacedPoints(Math.round(curve.getLength() / 3));
  pts.forEach((p) => addRoad(p.x, p.z, 5.6));
  const hs = pts.map((p) => hmax(p.x, p.z, 3) + 0.5);
  for (let pass = 0; pass < 4; pass++) for (let i = 1; i < hs.length - 1; i++) hs[i] = Math.max(hs[i] * 0.5 + (hs[i - 1] + hs[i + 1]) * 0.25, hmax(pts[i].x, pts[i].z, 2.5) + 0.4);
  // meet the highway level at the start, and ride above the rails where the line is crossed
  for (let i = 0; i < pts.length; i++) {
    if (i < 3) hs[i] = Math.max(0.55, hmax(pts[i].x, pts[i].z, 2.4)) + 0.1 + i * 0.12; // same height as the highway it leaves
    if (i >= pts.length - 3) hs[i] = Math.max(0.55, hmax(pts[i].x, pts[i].z, 2.4)) + 0.1; // and the same as the avenue it joins
    // at the level crossing the road lies at track level, so the rails run over the asphalt
    const dzr = Math.abs(pts[i].z - RAIL_Z);
    if (dzr < 9) hs[i] += (railY(pts[i].x) + 0.04 - hs[i]) * smoothS(9, 4, dzr);
  }
  const cum: number[] = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z, hs[i] - hs[i - 1]));
  const ROAD_LEN = cum[cum.length - 1];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const hd = Math.hypot(dx, dz);
    const mx = (a.x + b.x) / 2;
    const mz = (a.z + b.z) / 2;
    const dy = hs[i + 1] - hs[i];
    const ry = Math.atan2(-dz, dx);
    const my = (hs[i] + hs[i + 1]) / 2;
    B.box.add(mx, my - 1.3, mz, Math.hypot(hd, dy) + 0.4, 1.5, 5.6, C("#2a2d3a"), ry, [0, 0, 0], 0, Math.atan2(dy, hd));
    if (i % 2 === 0) B.glow.add(mx, my + 0.22, mz, 1.5, 0.05, 0.14, C("#d8d2b0"), ry, [0, 0, 0], 0, Math.atan2(dy, hd));
    if (i % 4 === 0) for (const side of [-1, 1]) {
      const nx = (-dz / hd) * side * 3.2;
      const nz = (dx / hd) * side * 3.2;
      B.cyl.add(mx + nx, my - 0.2, mz + nz, 0.12, 1.0, 0.12, C("#8e93a6"));
      B.glow.add(mx + nx, my + 0.65, mz + nz, 0.14, 0.14, 0.14, C("#ff8a3a"));
    }
  }
  // level crossing: barriers, flashing lights and warning signs on both sides of the tracks
  {
    const cx = -140;
    const y = railY(cx) + 0.04;
    B.box.add(cx, y - 0.16, RAIL_Z, 6.4, 0.2, 5.6, C("#3a3f50")); // the crossing slab, with the rails and sleepers laid over it
    for (const dz of [-0.72, 0.72]) B.box.add(cx, y + 0.06, RAIL_Z + dz * 1.0, 6.2, 0.16, 0.16, C("#aeb4c4"));
    for (let q = -3; q <= 3; q++) B.box.add(cx + q * 0.8, y + 0.04, RAIL_Z, 0.5, 0.06, 3.0, C("#4a3d36"));
    for (const sz of [-1, 1]) {
      for (const sx of [-1, 1]) {
        const px = cx + sx * 3.5;
        const pz = RAIL_Z + sz * 4.2;
        B.cyl.add(px, y - 0.2, pz, 0.14, 3.2, 0.14, C("#e8e0d0"));
        B.box.add(px, y + 2.4, pz, 0.7, 0.5, 0.2, C("#161a2c"));
        const lamp = redLight(scene, px, y + 2.6, pz, 0.32);
        void lamp;
        // the barrier arm, striped white and red
        for (let k = 0; k < 4; k++) B.box.add(px - sx * (0.8 + k * 0.8), y + 1.0, pz - sz * 0.02, 0.8, 0.14, 0.14, k % 2 ? C("#e8e0d0") : C("#b3363a"));
      }
    }
  }

  const roadPose = (s: number, lane: number) => {
    let i = 1;
    while (i < cum.length - 1 && cum[i] < s) i++;
    const f = (s - cum[i - 1]) / Math.max(0.0001, cum[i] - cum[i - 1]);
    const a = pts[i - 1];
    const b = pts[i];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const hd = Math.hypot(dx, dz) || 1;
    const x = a.x + dx * f + (-dz / hd) * lane;
    const z = a.z + dz * f + (dx / hd) * lane;
    const y = hs[i - 1] + (hs[i] - hs[i - 1]) * f;
    return { x, y, z, ry: Math.atan2(-dz, dx), rz: Math.atan2(hs[i] - hs[i - 1], hd) };
  };

    const SUB_WALLS = [...PLASTER, ...["#e8e0d0", "#c9a24a", "#7b8ba8", "#5b8f8a", "#9b5a4a", "#d9c7a0", "#b5c4b1", "#a3b8d0"].map(C)];
    const SUB_ROOFS = [...ROOFS, ...["#a8553f", "#4f6f5a", "#7a4a3a", "#6b7088"].map(C)];
    const MODERN = ["#e8e6e0", "#8e93a6", "#3a3f50", "#d8d2c4", "#5b6478"].map(C);
    const DOORS = ["#b3363a", "#2f5f8a", "#3f7a5a", "#d9a441", "#6b3f2f", "#1f2a44", "#8b5a8c", "#e8e0d0"].map(C);
    const WHITE = C("#e8e0d0");
    const suburbHouse = (x: number, z: number, y: number, k: number, dx: number, dz: number, scale = 0.85) => {
      const rot = (k * Math.PI) / 2;
      const cs = Math.round(Math.cos(rot));
      const sn = Math.round(Math.sin(rot));
      const SC = scale; // a touch smaller than the block, so porch, fence and sides stay inside it
      const W = (lx: number, lz: number): [number, number] => [x + (lx * cs + lz * sn) * SC, z + (-lx * sn + lz * cs) * SC];
      const box = (lx: number, lz: number, by: number, w: number, h: number, d: number, c: THREE.Color) => {
        const [wx, wz] = W(lx, lz);
        B.box.add(wx, y + by * SC, wz, w * SC, h * SC, d * SC, c, rot);
      };
      const glow = (lx: number, lz: number, by: number, w: number, h: number, d: number, c: THREE.Color) => {
        const [wx, wz] = W(lx, lz);
        B.glow.add(wx, y + by * SC, wz, w * SC, h * SC, d * SC, c, rot);
      };
      /** ridge length first, then height, then the span across the ridge */
      const roof = (lx: number, lz: number, by: number, len: number, h: number, span: number, c: THREE.Color, alongX: boolean) => {
        const [wx, wz] = W(lx, lz);
        B.gab.add(wx, y + by * SC, wz, len * SC, h * SC, span * SC, c, alongX ? rot : rot + Math.PI / 2);
      };
      box(0, 0, -2.3, 3.4, 1.7, 3.0, C("#59586a")); // foundation, so houses sit right on slopes
      const wallC = pick(SUB_WALLS);
      const roofC = pick(SUB_ROOFS);
      const doorC = pick(DOORS);
      const warm = () => (r() < 0.8 ? (r() < 0.85 ? C("#ffb870") : C("#9ec8ff")) : null);
      // a window: white frame, dark glass (always visible) and a warm light inside when somebody is home
      const win = (lx: number, fz: number, by: number, ww = 0.6, hh = 0.7) => {
        box(lx, fz + 0.01, by, ww + 0.12, hh + 0.12, 0.05, WHITE);
        const lit = warm();
        if (lit) glow(lx, fz + 0.04, by + 0.06, ww, hh, 0.05, lit);
        else box(lx, fz + 0.04, by + 0.06, ww, hh, 0.05, C("#2a3550"));
        if (r() < 0.4) for (const sx of [-1, 1]) box(lx + sx * (ww / 2 + 0.2), fz + 0.03, by, 0.16, hh + 0.12, 0.05, C("#3a4a5a"));
        if (r() < 0.3) {
          // a flower box under the window
          box(lx, fz + 0.12, by - 0.12, ww + 0.2, 0.14, 0.2, C("#6b4a3a"));
          for (let q = -1; q <= 1; q++) glow(lx + q * ww * 0.3, fz + 0.14, by + 0.04, 0.1, 0.1, 0.1, pick([C("#ff8aa8"), C("#ffd36a"), C("#ffffff")]).multiplyScalar(0.6));
        }
      };
      /** a real door: frame, coloured leaf, knob, step, lamp and often a little porch roof */
      const door = (lx: number, fz: number) => {
        box(lx, fz + 0.01, 0, 0.74, 1.4, 0.06, WHITE);
        box(lx, fz + 0.04, 0, 0.56, 1.28, 0.08, doorC);
        box(lx + 0.18, fz + 0.1, 0.62, 0.07, 0.07, 0.05, C("#d9c27a"));
        box(lx, fz + 0.22, -0.04, 0.95, 0.14, 0.4, C("#8e93a6"));
        glow(lx + 0.5, fz + 0.06, 1.5, 0.12, 0.14, 0.1, C("#ffd9a0"));
        if (r() < 0.55) {
          box(lx, fz + 0.35, 1.62, 1.15, 0.08, 0.65, roofC);
          for (const sx of [-1, 1]) box(lx + sx * 0.5, fz + 0.62, 0, 0.08, 1.62, 0.08, WHITE);
        }
      };
      const kind = r();
      let w = 2.4;
      let d = 2.1;
      if (kind < 0.3) {
        // cottage
        w = rr(2.3, 2.8);
        d = rr(2.0, 2.4);
        box(0, 0, -0.6, w, 2.9, d, wallC);
        roof(0, 0, 2.3, w + 0.5, 1.15, d + 0.45, roofC, true);
        const dl = r() < 0.5 ? -w * 0.22 : w * 0.22;
        door(dl, d / 2);
        win(-dl, d / 2, 1.0);
        if (r() < 0.6) box(-w * 0.3 + 0.1, -d * 0.2, 2.9, 0.34, 0.9, 0.34, C("#7f5049"));
      } else if (kind < 0.5) {
        // two storeys with a garage wing
        w = 1.9;
        d = 2.2;
        box(-0.5, 0, -0.6, w, 5.2, d, wallC);
        roof(-0.5, 0, 4.6, w + 0.5, 1.2, d + 0.45, roofC, true);
        box(1.0, 0.1, -0.6, 1.25, 2.6, d - 0.5, wallC);
        box(1.0, 0.1, 2.0, 1.45, 0.14, d - 0.2, SUB_ROOFS[Math.floor(r() * SUB_ROOFS.length)]);
        box(1.0, d / 2 - 0.4, 0, 1.0, 1.1, 0.06, C("#8e93a6"));
        for (let g = 0; g < 3; g++) box(1.0, d / 2 - 0.37, 0.25 + g * 0.3, 0.9, 0.05, 0.03, C("#6b7088"));
        door(-0.9, d / 2);
        win(-0.2, d / 2, 1.0, 0.5, 0.65);
        win(-0.5, d / 2, 3.0, 0.7, 0.75);
      } else if (kind < 0.68) {
        // modern, flat roof
        w = rr(2.5, 2.9);
        d = rr(2.0, 2.3);
        const tall = r() < 0.4;
        const mc = pick(MODERN);
        box(0, 0, -0.6, w, (tall ? 4.4 : 2.9) + 0.6, d, mc);
        box(0, 0, tall ? 3.8 : 2.3, w + 0.5, 0.2, d + 0.5, C("#2c3040"));
        glow(-w * 0.18, d / 2 + 0.04, 0.8, w * 0.5, 1.0, 0.05, r() < 0.85 ? C("#ffcf8a") : C("#9ec8ff"));
        door(w * 0.3, d / 2);
        if (tall) win(-w * 0.2, d / 2, 2.7, 1.1, 0.8);
      } else if (kind < 0.86) {
        // L-shaped, two roofs at right angles
        w = 2.8;
        d = 2.4;
        box(-0.2, -0.3, -0.6, 2.4, 2.9, 1.7, wallC);
        roof(-0.2, -0.3, 2.3, 2.9, 1.1, 2.0, roofC, true);
        box(0.95, 0.5, -0.6, 1.4, 2.9, 1.7, wallC);
        roof(0.95, 0.5, 2.3, 2.0, 1.1, 1.7, roofC, false);
        door(0.95, 0.5 + 0.85);
        win(-0.7, -0.3 + 0.85, 1.0);
        win(0.3, -0.3 + 0.85, 1.0, 0.5, 0.65);
      } else {
        // duplex: two doors, two gables
        w = 2.9;
        d = 2.0;
        box(0, 0, -0.6, w, 3.2, d, wallC);
        for (const sx of [-1, 1]) roof(sx * (w / 4), 0, 2.6, w / 2 + 0.2, 1.1, d + 0.4, roofC, false);
        for (const sx of [-1, 1]) {
          door(sx * 0.65, d / 2);
          win(sx * 0.65, d / 2, 2.0, 0.5, 0.6);
        }
      }
      const frontZ = d / 2;
      if (r() < 0.35) for (let q = -2; q <= 2; q++) box(q * 0.55, frontZ + 0.7, 0, 0.1, 0.55, 0.06, WHITE);
      if (r() < 0.4) {
        box(w / 2 + 0.3, frontZ + 0.55, 0, 0.06, 0.8, 0.06, C("#5a4538"));
        box(w / 2 + 0.3, frontZ + 0.55, 0.8, 0.3, 0.22, 0.2, pick(DOORS));
      }
      if (r() < 0.5) {
        const [bx0, bz0] = W(-w / 2 + 0.1, frontZ + 0.35);
        B.ico.add(bx0, y + 0.3, bz0, 0.8, 0.6, 0.8, pick(["#3f6b4f", "#4f7d5a", "#58844a"].map(C)), r() * 3);
      }
      if (r() < 0.55) {
        const [tx, tz] = W(w / 2 + 0.3, -d / 2 - 0.1);
        B.cyl.add(tx, y - 0.2, tz, 0.16, 0.9, 0.16, C("#5a4538"));
        B.ico.add(tx, y + 0.85, tz, 1.5, 1.4, 1.5, pick(["#3f6b4f", "#4f7d5a", "#2f5a45", "#5a8a62"].map(C)), r() * 3);
      }
      if (r() < 0.3) {
        const [cx0, cz0] = W(-w / 2 - 0.3, frontZ - 0.2);
        B.box.add(cx0, y - 0.1, cz0, 0.9, 0.36, 1.7, pick(CARS), rot);
      }
      void dx;
      void dz;
    };
  /** a local frame: +z is the front of a building, k turns it in quarter turns */
  const frame = (x: number, z: number, y: number, k: number) => {
    const rot = (k * Math.PI) / 2;
    const cs = Math.round(Math.cos(rot));
    const sn = Math.round(Math.sin(rot));
    const W = (lx: number, lz: number): [number, number] => [x + lx * cs + lz * sn, z - lx * sn + lz * cs];
    const white1 = new THREE.Color(1, 1, 1);
    return {
      W,
      box: (lx: number, lz: number, by: number, w: number, h: number, d: number, c: THREE.Color, rx = 0, rz = 0) => {
        const [wx, wz] = W(lx, lz);
        B.box.add(wx, y + by, wz, w, h, d, c, rot, [0, 0, 0], rx, rz);
      },
      glow: (lx: number, lz: number, by: number, w: number, h: number, d: number, c: THREE.Color) => {
        const [wx, wz] = W(lx, lz);
        B.glow.add(wx, y + by, wz, w, h, d, c, rot);
      },
      cyl: (lx: number, lz: number, by: number, w: number, h: number, d: number, c: THREE.Color) => {
        const [wx, wz] = W(lx, lz);
        B.cyl.add(wx, y + by, wz, w, h, d, c);
      },
      cone: (lx: number, lz: number, by: number, w: number, h: number, d: number, c: THREE.Color) => {
        const [wx, wz] = W(lx, lz);
        B.cone.add(wx, y + by, wz, w, h, d, c);
      },
      ico: (lx: number, lz: number, by: number, w: number, h: number, d: number, c: THREE.Color) => {
        const [wx, wz] = W(lx, lz);
        B.ico.add(wx, y + by, wz, w, h, d, c, r() * 3);
      },
      roof: (lx: number, lz: number, by: number, len: number, h: number, span: number, c: THREE.Color, alongX = true) => {
        const [wx, wz] = W(lx, lz);
        B.gab.add(wx, y + by, wz, len, h, span, c, alongX ? rot : rot + Math.PI / 2);
      },
      sign: (lx: number, lz: number, by: number, kind: number, w: number) => {
        const [wx, wz] = W(lx, lz);
        signsW[kind].add(wx, y + by, wz, w, w * 0.31, 0.12, white1, rot);
      },
    };
  };

  /** a little shop: lit window, door, awning, a neon sign, a table with a parasol and string lights */
  const shopBuilding = (x: number, z: number, y: number, k: number, kind: number) => {
    const f = frame(x, z, y, k);
    const w = 4.0;
    const d = 3.0;
    const h = 3.1;
    const wallC = pick([C("#b3a58f"), C("#8f9fb8"), C("#b98d84"), C("#a7b3a0"), C("#d9c7a0")]);
    const awnC = pick(AWN);
    const WHITEc = C("#e8e0d0");
    f.box(0, 0, -2.0, w + 0.4, 1.4, d + 0.4, C("#59586a"));
    f.box(0, 0, -0.6, w, h + 0.6, d, wallC);
    f.box(0, 0, h, w + 0.3, 0.22, d + 0.3, C("#8e93a6"));
    f.box(0, d / 2 + 0.08, 2.35, w * 0.86, 0.75, 0.1, C("#161a2c"));
    f.sign(0, d / 2 + 0.16, 2.43, kind, 2.4);
    f.box(-0.75, d / 2 + 0.02, 0.5, 2.1, 1.65, 0.05, WHITEc);
    f.glow(-0.75, d / 2 + 0.05, 0.58, 1.9, 1.45, 0.05, C("#ffcf8a").multiplyScalar(0.85));
    f.sign(-0.75, d / 2 + 0.1, 1.0, signIdx("OPEN"), 0.9);
    f.box(1.3, d / 2 + 0.03, 0, 0.9, 1.95, 0.07, pick([C("#b3363a"), C("#2f5f8a"), C("#3f7a5a"), C("#6b3f2f")]));
    f.glow(1.3, d / 2 + 0.07, 1.1, 0.5, 0.6, 0.04, C("#ffd9a0"));
    f.box(0, d / 2 + 0.55, 2.2, w * 0.92, 0.08, 1.1, awnC, -0.28);
    for (const sx of [-1, 1]) f.glow(sx * (w / 2 + 0.03), 0, 1.0, 0.05, 1.0, 0.9, C("#ffb870").multiplyScalar(0.8));
    // outdoor seating, planter, bike rack
    f.cyl(-1.6, d / 2 + 1.5, 0, 0.7, 0.75, 0.7, C("#8a7a62"));
    f.cyl(-2.25, d / 2 + 1.5, 0, 0.4, 0.45, 0.4, C("#6b5a48"));
    f.cyl(-0.95, d / 2 + 1.5, 0, 0.4, 0.45, 0.4, C("#6b5a48"));
    f.cyl(-1.6, d / 2 + 1.5, 0.7, 0.08, 1.5, 0.08, WHITEc);
    f.cone(-1.6, d / 2 + 1.5, 2.0, 2.4, 0.6, 2.4, awnC);
    f.cyl(2.3, d / 2 + 0.7, 0, 0.5, 0.5, 0.5, C("#8a4f45"));
    f.ico(2.3, d / 2 + 0.7, 0.5, 0.7, 0.7, 0.7, C("#3f6b4f"));
    f.box(1.6, d / 2 + 1.5, 0, 0.9, 0.55, 0.06, C("#8e93a6"));
    f.box(-1.0, -0.3, h + 0.22, 0.9, 0.5, 0.7, C("#8a8fa0"));
    for (let q = 0; q < 6; q++) f.glow(-1.9 + q * 0.76, d / 2 + 1.1, 2.55 - Math.sin((q / 5) * Math.PI) * 0.25, 0.1, 0.1, 0.1, pick([C("#ffcf8a"), C("#ff8aa8"), C("#9ec8ff")]).multiplyScalar(0.8));
  };

  /** a big barn: stone plinth, board lines, braced doors, a hayloft, corner trim, cupola and a weathervane, with hay and a trough */
  const barnBuilding = (x: number, z: number, q: number) => {
    const y = Math.max(0.1, hmax(x, z, 3));
    const f = frame(x, z, y, q);
    const WHITEc = C("#e8e0d0");
    const barnC = pick([C("#7a3f38"), C("#8a6a45"), C("#a05a3a"), C("#6b4a45")]);
    const roofC = pick(ROOFS);
    f.box(0, 0, -2.2, 6.4, 1.8, 8.4, C("#59586a"));
    f.box(0, 0, -0.8, 6.0, 5.4, 8.0, barnC);
    f.box(0, 0, -0.1, 6.15, 1.0, 8.15, C("#6b6a64")); // stone plinth
    for (let k = -5; k <= 5; k++) f.box(k * 0.55, 4.02, 0.9, 0.05, 4.2, 0.04, barnC.clone().multiplyScalar(0.7));
    for (let k = -3; k <= 3; k++) {
      f.box(3.02, k * 1.1, 0.9, 0.04, 4.2, 0.05, barnC.clone().multiplyScalar(0.7));
      f.box(-3.02, k * 1.1, 0.9, 0.04, 4.2, 0.05, barnC.clone().multiplyScalar(0.7));
    }
    f.roof(0, 0, 4.6, 8.8, 1.2, 6.8, roofC, false);
    f.roof(0, 0, 5.8, 8.8, 1.6, 3.9, roofC.clone().multiplyScalar(1.1), false);
    for (let k = -4; k <= 4; k++) f.box(k * 0.95, 0, 4.7, 0.06, 0.08, 6.9, roofC.clone().multiplyScalar(0.7), 0, 0);
    f.box(0, 4.04, 0, 3.4, 3.4, 0.1, WHITEc);
    for (const sx of [-1, 1]) {
      f.box(sx * 0.78, 4.1, 0.0, 1.45, 3.25, 0.08, barnC.clone().multiplyScalar(0.8));
      f.box(sx * 0.78, 4.18, 0.1, 0.14, 3.5, 0.06, WHITEc, 0, 0.7 * sx);
      f.box(sx * 0.78, 4.18, 0.1, 0.14, 3.5, 0.06, WHITEc, 0, -0.7 * sx);
    }
    f.box(0, 4.04, 3.5, 1.7, 1.4, 0.08, C("#20253a"));
    f.box(0, 4.0, 4.9, 0.12, 0.12, 0.4, C("#4a3a2c"));
    f.glow(0, 4.1, 3.0, 0.34, 0.2, 0.1, C("#ffd9a0"));
    for (const [cx2, cz2] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) f.box(cx2 * 3.0, cz2 * 4.0, -0.8, 0.18, 6.0, 0.18, WHITEc);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) f.glow(sx * 3.04, sz * 1.8, 2.0, 0.05, 0.6, 0.6, C("#ffb870").multiplyScalar(0.55));
    f.box(0, 0, 6.4, 1.0, 0.8, 1.0, barnC);
    f.cone(0, 0, 7.2, 1.2, 0.8, 1.2, C("#4d5470"));
    f.box(0, 0, 8.0, 0.05, 0.9, 0.05, C("#2c3040"));
    f.box(0, 0, 8.7, 0.8, 0.22, 0.05, C("#2c3040"));
    for (let a = 0; a < 4; a++) f.box(4.6 + (a % 2) * 0.95, 1.2, a < 2 ? 0 : 0.5, 0.9, 0.5, 0.6, C("#c1a840"));
    for (let a = 0; a < 2; a++) {
      const [wx, wz] = f.W(5.2 + a * 1.5, 3.4);
      B.cyl.add(wx, y + 0.65, wz, 1.2, 1.2, 1.2, C("#c1a840"), 0, [0, 0, 0], Math.PI / 2);
    }
    f.box(-4.2, 2.4, 0, 2.0, 0.45, 0.6, C("#6b5a48"));
    f.box(-4.2, 2.4, 0.45, 1.8, 0.1, 0.4, C("#2a3550"));
    addRoad(x, z, 9);
  };

  /** a farmstead: house, gambrel barn with braced doors and a loft, silos, shed, tank, coop, fences, hay and a pickup */
  const farmstead = (x: number, z: number, q: number) => {
    addRoad(x, z, 17);
    const y = Math.max(0.1, hmax(x, z, 2));
    const f = frame(x, z, y, q);
    suburbHouse(x, z, y, q, 0, 0);
    const WHITEc = C("#e8e0d0");
    const barnC = pick([C("#7a3f38"), C("#8a6a45"), C("#5f6a5a"), C("#a89a86"), C("#6b4a45")]);
    const roofC = pick(ROOFS);
    if (r() < 0.9) {
      f.box(8.5, -1.5, -0.6, 5.2, 5.0, 7.2, barnC);
      f.roof(8.5, -1.5, 3.8, 7.8, 1.1, 5.8, roofC, false);
      f.roof(8.5, -1.5, 4.9, 7.8, 1.5, 3.4, roofC.clone().multiplyScalar(1.1), false);
      f.box(8.5, 2.14, 0, 2.6, 3.0, 0.1, WHITEc);
      for (const sx of [-1, 1]) {
        f.box(8.5 + sx * 0.62, 2.2, 0.02, 1.15, 2.85, 0.08, barnC.clone().multiplyScalar(0.8));
        f.box(8.5 + sx * 0.62, 2.26, 0.1, 0.14, 3.0, 0.06, WHITEc, 0, 0.68 * sx);
        f.box(8.5 + sx * 0.62, 2.26, 0.1, 0.14, 3.0, 0.06, WHITEc, 0, -0.68 * sx);
      }
      f.box(8.5, 2.14, 3.4, 1.4, 1.2, 0.08, C("#20253a"));
      f.glow(8.5, 2.2, 3.1, 0.34, 0.2, 0.1, C("#ffd9a0"));
      for (const [cx2, cz2] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) f.box(8.5 + cx2 * 2.55, -1.5 + cz2 * 3.55, -0.6, 0.16, 5.6, 0.16, WHITEc);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) f.glow(8.5 + sx * 2.61, -1.5 + sz * 1.6, 1.8, 0.05, 0.6, 0.6, C("#ffb870").multiplyScalar(0.55));
      f.box(8.5, -1.5, 5.9, 0.9, 0.7, 0.9, barnC);
      f.cone(8.5, -1.5, 6.6, 1.1, 0.7, 1.1, C("#4d5470"));
      f.box(8.5, -1.5, 7.3, 0.05, 0.8, 0.05, C("#2c3040"));
      f.box(8.5, -1.5, 7.9, 0.7, 0.2, 0.05, C("#2c3040"));
    }
    // silos with rings, a dome, a ladder and a smaller twin
    if (r() < 0.6) {
      f.cyl(12.8, -4.0, -0.5, 2.8, 5.8, 2.8, C("#b8b0a0"));
      for (let k = 0; k < 4; k++) f.cyl(12.8, -4.0, 0.5 + k * 1.3, 2.95, 0.12, 2.95, C("#8e93a6"));
      f.ico(12.8, -4.0, 5.1, 2.8, 1.5, 2.8, C("#8a8fa0"));
      f.box(11.4, -4.0, 0, 0.18, 5.4, 0.1, C("#2c3040"));
      if (r() < 0.5) {
        f.cyl(12.8, -7.0, -0.5, 2.2, 4.6, 2.2, C("#c1bbab"));
        f.ico(12.8, -7.0, 4.0, 2.2, 1.2, 2.2, C("#8a8fa0"));
      }
    }
    // shed with a door and a window
    if (r() < 0.7) {
      f.box(-5.5, 3.6, -0.4, 2.8, 2.6, 2.4, C("#8e93a6"));
      f.roof(-5.5, 3.6, 2.2, 3.1, 0.9, 2.7, roofC, true);
      f.box(-5.0, 4.83, 0, 1.0, 1.7, 0.06, C("#6b3f2f"));
      f.glow(-6.2, 4.83, 1.0, 0.5, 0.5, 0.05, C("#ffb870").multiplyScalar(0.6));
    }
    // water tank on legs
    if (r() < 0.45) {
      for (const [dx, dz] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) f.box(2 + dx, 7.5 + dz, 0, 0.1, 2.6, 0.1, C("#4d5470"));
      f.cyl(2, 7.5, 2.6, 1.6, 1.4, 1.6, C("#7a8094"));
      f.cone(2, 7.5, 4.0, 1.8, 0.6, 1.8, C("#4d5470"));
    }
    // old farm windmill pump
    if (r() < 0.3) {
      f.cyl(-3.5, -6.5, 0, 0.3, 6.5, 0.3, C("#8e93a6"));
      f.box(-3.5, -6.5, 6.2, 0.06, 1.7, 1.7, C("#c9ced9"));
      f.box(-3.5, -6.5, 6.2, 0.06, 0.1, 2.0, C("#c9ced9"));
      f.box(-3.5, -6.5, 6.2, 0.06, 2.0, 0.1, C("#c9ced9"));
    }
    // paddock fence with two rails
    if (r() < 0.6) {
      for (let k = 0; k <= 5; k++) {
        f.box(-12, -9 + k * 1.6, 0, 0.14, 1.0, 0.14, C("#8a7a62"));
        f.box(-4, -9 + k * 1.6, 0, 0.14, 1.0, 0.14, C("#8a7a62"));
      }
      for (const yy of [0.45, 0.8]) {
        f.box(-12, -5, yy, 0.08, 0.08, 8.2, C("#8a7a62"));
        f.box(-4, -5, yy, 0.08, 0.08, 8.2, C("#8a7a62"));
        f.box(-8, -9, yy, 8.2, 0.08, 0.08, C("#8a7a62"));
      }
    }
    // hen house with a ramp and a few hens
    if (r() < 0.45) {
      f.box(-2.6, -6.2, 0.4, 1.5, 1.0, 1.1, C("#a85f4a"));
      f.roof(-2.6, -6.2, 1.4, 1.7, 0.5, 1.3, C("#4d5470"), true);
      f.box(-2.6, -5.5, 0.3, 0.5, 0.08, 1.1, C("#6b5a48"), 0.5, 0);
      f.box(-2.6, -5.66, 0.3, 0.4, 0.6, 0.05, C("#20253a"));
      for (let k = 0; k < 4; k++) f.ico(-3.4 + k * 0.5, -4.4 + (k % 2) * 0.3, 0.1, 0.3, 0.28, 0.3, C(k % 2 ? "#e8e0d0" : "#b0703f"));
    }
    // hay: stacked square bales and two rolls
    for (let a = 0; a < 3; a++) f.box(5.2 + a * 1.0, 3.2, 0.0, 0.9, 0.5, 0.6, C("#c1a840"));
    for (let a = 0; a < 2; a++) f.box(5.5 + a * 1.0, 3.2, 0.5, 0.9, 0.5, 0.6, C("#b89a38"));
    for (let a = 0; a < 2; a++) {
      const [wx, wz] = f.W(9 + a * 1.4, 4.2);
      B.cyl.add(wx, y + 0.65, wz, 1.2, 1.2, 1.2, C("#c1a840"), 0, [0, 0, 0], Math.PI / 2);
    }
    // a pickup parked by the barn
    if (r() < 0.7) {
      const pc = pick([C("#b3363a"), C("#3f6fb0"), C("#d8d2c4"), C("#3f7a5a")]);
      f.box(5.6, 6.2, 0.1, 1.9, 0.55, 0.95, pc);
      f.box(5.2, 6.2, 0.62, 0.85, 0.45, 0.85, C("#20253a"));
      f.box(6.2, 6.2, 0.62, 0.9, 0.12, 0.9, pc.clone().multiplyScalar(0.8));
      f.glow(4.62, 6.2, 0.4, 0.06, 0.18, 0.7, C("#fff6dc"));
    }
    // laundry line, mailbox and a vegetable patch
    if (r() < 0.4) {
      for (const sx of [-1, 1]) f.box(sx * 2.8, 3.6, 0, 0.08, 1.9, 0.08, C("#5a4538"));
      f.box(0, 3.6, 1.8, 5.6, 0.03, 0.03, C("#c9ced9"));
      for (let k = 0; k < 4; k++) f.box(-1.8 + k * 1.2, 3.6, 0.9, 0.5, 0.8, 0.03, pick([C("#e8e0d0"), C("#d8694f"), C("#4fa3a5"), C("#d4a24c")]));
    }
    f.box(-3.4, 4.2, 0, 0.06, 0.9, 0.06, C("#5a4538"));
    f.box(-3.4, 4.2, 0.9, 0.3, 0.22, 0.2, C("#b3363a"));
    if (r() < 0.5) for (let k = 0; k < 5; k++) f.box(-9 + k * 0.7, 6.4, 0, 0.35, 0.3, 3.2, k % 2 ? C("#4f8a3f") : C("#6fa04a"));
  };

  const village = (cx: number, cz: number, n: number, church: boolean) => {
    const placedH: [number, number][] = [];
    for (let k = 0, got = 0; k < 120 && got < n; k++) {
      const a = r() * Math.PI * 2;
      const rad = Math.sqrt(r()) * 11;
      const x = cx + Math.cos(a) * rad;
      const z = cz + Math.sin(a) * rad;
      if (placedH.some(([px, pz]) => Math.hypot(px - x, pz - z) < 4.4)) continue;
      if (blocked(x, z) || landL(x, z) < 10) continue;
      placedH.push([x, z]);
      got++;
      const y0 = hmax(x, z, 1.8);
      suburbHouse(x, z, y0, Math.floor(r() * 4), 0, 0);
      if (r() < 0.4) {
        B.cyl.add(x + 1.7, y0, z + 1.9, 0.16, 0.9, 0.16, C("#5a4538"));
        B.ico.add(x + 1.7, y0 + 1.2, z + 1.9, 1.6, 1.5, 1.6, pick(["#2f5a45", "#3f6b4f", "#46745a"].map(C)));
      }
    }
    if (church) {
      const y0 = hmax(cx, cz, 3);
      B.box.add(cx, y0 - 1.6, cz, 4.0, 4.4 + 1.6, 6.0, C("#b3a58f"));
      B.gab.add(cx, y0 + 4.4, cz, 4.6, 2.2, 6.6, C("#454b63"), Math.PI / 2);
      B.box.add(cx + 2.9, y0 - 1.6, cz - 2.2, 2.0, 8 + 1.6, 2.0, C("#a89a86"));
      B.cone.add(cx + 2.9, y0 + 8, cz - 2.2, 2.4, 3.6, 2.4, C("#4d5470"));
      B.glow.add(cx + 2.9, y0 + 6, cz - 1.17, 0.5, 1.1, 0.05, C("#ffcf8a"));
      for (let k = -1; k <= 1; k++) B.glow.add(cx + 2.03, y0 + 2.4, cz + k * 1.6, 0.05, 1.4, 0.5, C(k ? "#ffb870" : "#ffd36a"));
    }
    // the square: a well, a shop with a lit sign, a bench and hay
    {
      const wy = hmax(cx, cz, 2);
      B.cyl.add(cx, wy, cz, 1.4, 0.9, 1.4, C("#8e93a6"));
      B.cyl.add(cx, wy + 0.9, cz, 1.0, 0.08, 1.0, C("#2a3550"));
      for (const sx of [-1, 1]) B.box.add(cx + sx * 0.6, wy + 0.9, cz, 0.1, 1.5, 0.1, C("#5a4538"));
      B.gab.add(cx, wy + 2.4, cz, 1.7, 0.7, 1.4, C("#8a4f45"));
      B.box.add(cx + 2.6, wy, cz + 0.8, 1.4, 0.4, 0.4, C("#6b5a48"));
      const sy = hmax(cx + 5, cz - 4, 2);
      shopBuilding(cx + 5, cz - 4, sy, Math.floor(r() * 4), r() < 0.5 ? signIdx("INN") : signIdx("MARKET"));
      for (let a = 0; a < 2; a++) B.cyl.add(cx - 4 + a * 1.4, hmax(cx - 4, cz + 3, 1) + 0.6, cz + 3, 1.2, 1.2, 1.2, C("#c1a840"), 0, [0, 0, 0], Math.PI / 2);
    }
    // lamps along the lane
    for (let k = 0; k < 4; k++) {
      const x = cx + rr(-9, 9);
      const z = cz + rr(-9, 9);
      lampPost(x, hmax(x, z, 0.5), z, 2.8);
    }
    spots.push([cx, cz, 14]);
    addRoad(cx, cz, 14);
  };
  const spurs: [[number, number], [number, number]][] = [];
  const hillVillages: [number, number][] = [];
  // villages hugging the road, and others on the southern hills
  const villageAt = (s: number, side: number, n: number, ch: boolean) => {
    const p = roadPose(ROAD_LEN * s, 0);
    const dx = Math.cos(p.ry);
    const dz = -Math.sin(p.ry);
    const vx = p.x + -dz * side * 14;
    const vz = p.z + dx * side * 14;
    village(vx, vz, n, ch);
    spurs.push([[vx, vz], [p.x, p.z]]);
  };
  for (let k = 0, placed = 0; k < 3000 && placed < (ctx.mobile ? 2 : 5); k++) {
    // the hill villages stay in the southern foothills, none up in the mountains
    const x = rr(-130, 140);
    const z = rr(205, 270);
    if (blocked(x, z, 6) || landL(x, z) < 14 || !free(x, z, 16)) continue;
    const h = terrainHeight(x, z);
    if (h < 12 || h > 22 || !flatAt(x, z, 8, 4.5)) continue; // low hills only, nothing up in the mountains
    village(x, z, 8, r() < 0.4);
    hillVillages.push([x, z]);
    placed++;
  }

  /* generic car fleet along a path */
  type Pose = { x: number; y: number; z: number; ry: number; rz: number };
  const fleet = (n: number, len: number, pathFn: (s: number, lane: number) => Pose, lanes: [number, number], spMin: number, spMax: number) => {
    type Car = { off: number; sp: number; dir: number; lane: number };
    const cars: Car[] = Array.from({ length: n }, () => {
      const dir = r() < 0.5 ? 1 : -1;
      return { off: r() * len, sp: rr(spMin, spMax), dir, lane: dir > 0 ? lanes[0] : lanes[1] };
    });
    const body = new THREE.InstancedMesh(geoBox, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.5 }), n);
    const cabin = new THREE.InstancedMesh(geoBox, new THREE.MeshStandardMaterial({ color: 0x1b2236, roughness: 0.2, metalness: 0.6 }), n);
    const lights = new THREE.InstancedMesh(geoBox, new THREE.MeshBasicMaterial({ color: 0xffffff }), n * 4);
    [body, cabin, lights].forEach((m) => {
      m.frustumCulled = false;
      m.castShadow = m !== lights;
      scene.add(m);
    });
    cars.forEach((c, i) => body.setColorAt(i, pick(CARS)));
    const white = new THREE.Color(2.2, 1.9, 1.4);
    const red = new THREE.Color(1.8, 0.2, 0.15);
    for (let i = 0; i < n; i++) [white, white, red, red].forEach((c, k) => lights.setColorAt(i * 4 + k, c));
    const local = (x: number, y: number, z: number, sx: number, sy: number, sz: number) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(sx, sy, sz));
    const LB = local(0, 0.12, 0, 1.9, 0.4, 0.9);
    const LC = local(-0.1, 0.5, 0, 1.0, 0.34, 0.78);
    const LL = [local(0.96, 0.24, 0.3, 0.07, 0.14, 0.24), local(0.96, 0.24, -0.3, 0.07, 0.14, 0.24), local(-0.96, 0.24, 0.3, 0.07, 0.14, 0.24), local(-0.96, 0.24, -0.3, 0.07, 0.14, 0.24)];
    const M = new THREE.Matrix4();
    const base = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const sc = new THREE.Vector3(1, 1, 1);
    const p = new THREE.Vector3();
    animated.push((t) => {
      cars.forEach((c, i) => {
        const s0 = (((c.off + c.sp * t) % len) + len) % len;
        const s = c.dir > 0 ? s0 : len - s0;
        const po = pathFn(s, c.lane);
        e.set(0, po.ry + (c.dir > 0 ? 0 : Math.PI), c.dir > 0 ? po.rz : -po.rz, "YXZ");
        q.setFromEuler(e);
        base.compose(p.set(po.x, po.y, po.z), q, sc);
        M.multiplyMatrices(base, LB);
        body.setMatrixAt(i, M);
        M.multiplyMatrices(base, LC);
        cabin.setMatrixAt(i, M);
        for (let k = 0; k < 4; k++) {
          M.multiplyMatrices(base, LL[k]);
          lights.setMatrixAt(i * 4 + k, M);
        }
      });
      body.instanceMatrix.needsUpdate = true;
      cabin.instanceMatrix.needsUpdate = true;
      lights.instanceMatrix.needsUpdate = true;
    });
  };
  fleet(ctx.mobile ? 2 : 4, ROAD_LEN, (s, lane) => roadPose(Math.min(ROAD_LEN - 0.01, Math.max(0.01, s)), lane), [1.3, -1.3], 3.5, 6);

  /* ------------------------------------------------------------------ */
  /* Roads out of town: arterials, farm lanes and their traffic          */
  /* ------------------------------------------------------------------ */
  type Strip = { pts: [number, number][]; hs: number[]; cum: number[]; len: number };
  type StripOpts = { dash?: boolean; lamps?: boolean; thick?: number; dirt?: boolean; ramp?: boolean; cutHigh?: number };
  const DIRTS = ["#8a785b", "#948263", "#7f6e53", "#8f7d60", "#86745a"].map(C);
  const PEBBLE = ["#8a8576", "#77746a", "#9a9484", "#6b6a64"].map(C);
  const makeStrip = (a: [number, number], b: [number, number], w: number, color: THREE.Color, o: StripOpts = {}): Strip => {
    if (o.dirt) {
      // a lane stops at the edge of the road it joins instead of running across it
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (L > 8) {
        const k = (L - 2.9) / L;
        b = [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
      }
    }
    return makePoly([a, b], w, color, o);
  };
  const makePoly = (poly: [number, number][], w: number, color: THREE.Color, o: StripOpts = {}): Strip => {
    const pts: [number, number][] = [poly[0]];
    for (let s = 1; s < poly.length; s++) {
      const A = poly[s - 1];
      const Bp = poly[s];
      const n = Math.max(1, Math.round(Math.hypot(Bp[0] - A[0], Bp[1] - A[1]) / 4));
      for (let i = 1; i <= n; i++) pts.push([A[0] + ((Bp[0] - A[0]) * i) / n, A[1] + ((Bp[1] - A[1]) * i) / n]);
    }
    // a road that would climb into the mountains ends at their foot, behind a barrier
    let barrier = false;
    if (o.cutHigh !== undefined) {
      const k = pts.findIndex(([px, pz]) => hmax(px, pz, 2.4) > o.cutHigh!);
      if (k > 2) {
        pts.length = k;
        barrier = true;
      }
    }
    pts.forEach(([px, pz]) => addRoad(px, pz, w / 2 + 2.3));
    const hs = pts.map(([x, z]) => Math.max(0.55, hmax(x, z, 2.4)) + 0.1);
    for (let pass = 0; pass < 2; pass++) for (let i = 1; i < hs.length - 1; i++) hs[i] = Math.max(hs[i] * 0.5 + (hs[i - 1] + hs[i + 1]) * 0.25, hmax(pts[i][0], pts[i][1], 2) + 0.08);
    // where a road leaves the city it eases down from street level instead of leaving a lip
    if (o.ramp) for (let i = 0; i < Math.min(4, hs.length); i++) hs[i] = 0.08 + (hs[i] - 0.08) * (i / 3);
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], hs[i] - hs[i - 1]));
    const thick = o.thick ?? 0.34;
    for (let i = 0; i < pts.length - 1; i++) {
      const dx = pts[i + 1][0] - pts[i][0];
      const dz = pts[i + 1][1] - pts[i][1];
      const hd = Math.hypot(dx, dz);
      const dy = hs[i + 1] - hs[i];
      const ry = Math.atan2(-dz, dx);
      const rz = Math.atan2(dy, hd);
      const mx = (pts[i][0] + pts[i + 1][0]) / 2;
      const mz = (pts[i][1] + pts[i + 1][1]) / 2;
      const my = (hs[i] + hs[i + 1]) / 2;
      const segLen = Math.hypot(hd, dy);
      B.box.add(mx, my - thick - 0.6, mz, segLen + 0.3, thick + 0.6, w, o.dirt ? DIRTS[(i * 5 + 1) % DIRTS.length] : color, ry, [0, 0, 0], 0, rz);
      if (o.dirt) {
        // packed gravel: a lighter crown down the middle, pebbles at the sides and the odd tuft
        B.box.add(mx, my + 0.012, mz, segLen + 0.1, 0.03, w * 0.5, C("#9a8a6c"), ry, [0, 0, 0], 0, rz);
        for (const sd of [-1, 1]) {
          if ((i + (sd > 0 ? 1 : 0)) % 2 === 0) {
            const ex = (-dz / hd) * sd * (w / 2 - 0.05);
            const ez = (dx / hd) * sd * (w / 2 - 0.05);
            B.ico.add(mx + ex, my + 0.06, mz + ez, 0.3 + (i % 3) * 0.08, 0.2, 0.26, PEBBLE[(i * 3) % PEBBLE.length], i);
          }
        }
        if (i % 4 === 0) B.cone.add(mx + (-dz / hd) * (w / 2 + 0.25), my - 0.05, mz + (dx / hd) * (w / 2 + 0.25), 0.22, 0.45, 0.22, C("#6a9a48"));
      } else {
        // reflector posts along the edge, and a road sign every so often
        if (i % 2 === 0) {
          const sd = i % 4 === 0 ? 1 : -1;
          const rx2 = mx + (-dz / hd) * sd * (w / 2 + 0.35);
          const rz2 = mz + (dx / hd) * sd * (w / 2 + 0.35);
          B.box.add(rx2, my - 0.05, rz2, 0.08, 0.7, 0.08, C("#e8e0d0"));
          B.glow.add(rx2, my + 0.5, rz2, 0.1, 0.12, 0.1, sd > 0 ? C("#ff6a4a") : C("#ffd36a"));
        }
        if (o.lamps && i % 17 === 6) {
          const spx = mx + (-dz / hd) * -(w / 2 + 1.2);
          const spz = mz + (dx / hd) * -(w / 2 + 1.2);
          B.cyl.add(spx, my - 0.1, spz, 0.1, 2.5, 0.1, C("#8e93a6"));
          B.box.add(spx, my + 1.7, spz, 1.0, 0.9, 0.06, C("#e8d36a"), ry + Math.PI / 2);
          B.box.add(spx, my + 1.95, spz, 0.5, 0.12, 0.08, C("#20253a"), ry + Math.PI / 2);
        }
      }
      if (o.dash && i % 2 === 0) B.glow.add(mx, my + 0.02, mz, 1.8, 0.04, 0.14, C("#d8d2b0"), ry, [0, 0, 0], 0, rz);
      if (o.lamps && i % (o.dirt ? 4 : 4) === 2) {
        const nx = (-dz / hd) * (w / 2 + 0.7) * (i % 8 === 2 ? 1 : -1);
        const nz = (dx / hd) * (w / 2 + 0.7) * (i % 8 === 2 ? 1 : -1);
        const ph = o.dirt ? 3.4 : 4.6;
        B.cyl.add(mx + nx, my - 0.2, mz + nz, 0.12, ph, 0.12, C("#2c3040"));
        B.glow.add(mx + nx * 0.7, my + ph - 0.1, mz + nz * 0.7, 0.4, 0.14, 0.4, C("#ffc98a"));
        pools.push([mx + nx * 0.4, my + 0.07, mz + nz * 0.4, o.dirt ? 3.2 : 4.4]);
      }
    }
    if (barrier) {
      const n = pts.length;
      const ex = pts[n - 1][0];
      const ez = pts[n - 1][1];
      const ey = hs[n - 1];
      const dx = ex - pts[n - 2][0];
      const dz = ez - pts[n - 2][1];
      const hd = Math.hypot(dx, dz) || 1;
      const ry = Math.atan2(-dz, dx);
      const nx = -dz / hd;
      const nz = dx / hd;
      for (let k = 0; k < 5; k++) {
        const off = (k - 2) * (w / 5);
        B.box.add(ex + nx * off, ey + 0.55, ez + nz * off, 0.5, 0.45, w / 5 + 0.02, k % 2 ? C("#e8e0d0") : C("#b3363a"), ry);
      }
      for (const sd of [-1, 1]) B.box.add(ex + nx * sd * (w / 2 - 0.1), ey, ez + nz * sd * (w / 2 - 0.1), 0.25, 0.7, 0.25, C("#4d5470"), ry);
      B.box.add(ex - (dx / hd) * 1.4, ey + 0.3, ez - (dz / hd) * 1.4, 0.15, 1.6, 0.15, C("#8e93a6"));
      B.box.add(ex - (dx / hd) * 1.4, ey + 1.5, ez - (dz / hd) * 1.4, 0.15, 0.8, 0.8, C("#e6b422"), ry);
    }
    return { pts, hs, cum, len: cum[cum.length - 1] };
  };
  const stripPose = (st: Strip, s: number, lane: number) => {
    const ss = Math.min(st.len - 0.01, Math.max(0.01, s));
    let i = 1;
    while (i < st.cum.length - 1 && st.cum[i] < ss) i++;
    const f = (ss - st.cum[i - 1]) / Math.max(0.0001, st.cum[i] - st.cum[i - 1]);
    const dx = st.pts[i][0] - st.pts[i - 1][0];
    const dz = st.pts[i][1] - st.pts[i - 1][1];
    const hd = Math.hypot(dx, dz) || 1;
    return {
      x: st.pts[i - 1][0] + dx * f + (-dz / hd) * lane,
      y: st.hs[i - 1] + (st.hs[i] - st.hs[i - 1]) * f,
      z: st.pts[i - 1][1] + dz * f + (dx / hd) * lane,
      ry: Math.atan2(-dz, dx),
      rz: Math.atan2(st.hs[i] - st.hs[i - 1], hd),
    };
  };
  const ASPHALT = C("#2a2d3a");
  // the highway: out of the avenue at z = 4 and over the hills, hugging the ground the whole way
  const PORTX = -198.4; // where the highway and the southern avenue go into the mountain
  const highway = makeStrip([-66, HIGHWAY_Z], [PORTX + 0.6, HIGHWAY_Z], 5.4, ASPHALT, { dash: true, lamps: true, ramp: true });
  // where an avenue or the highway meets the city it narrows, step by step, to the width of a city street and runs on into it
  for (const rz of ROADS_Z) {
    [5.0, 4.2, 3.4, 2.8].forEach((w, q) => B.box.add(-65 + q * 2, 0.09 - 0.34, rz, 2.1, 0.34, w, ASPHALT));
    B.box.add(-60, 0.09 - 0.34, rz, 2.6, 0.34, 2.4, ASPHALT);
  }
  // past the portal the cars keep going, level, under the mountain, and the terrain hides them
  const intoMountain = (st: Strip) => (s: number, lane: number) => {
    if (s <= st.len) return stripPose(st, s, lane);
    const e = stripPose(st, st.len, lane);
    return { ...e, x: e.x - (s - st.len), rz: 0 };
  };
  fleet(ctx.mobile ? 14 : 34, highway.len + 40, intoMountain(highway), [1.4, -1.4], 12, 22);
  const arterials: Strip[] = [];
    // the northern avenue bends into the link road at the level crossing; the southern one runs level to its own tunnel
  for (const rz of ROADS_Z) if (rz !== HIGHWAY_Z) arterials.push(rz < RAIL_Z ? makeStrip([-66, rz], [RB.x + RB.r, rz], 5.6, ASPHALT, { dash: true, lamps: true, ramp: true }) : makeStrip([-66, rz], [PORTX + 0.6, rz], 5.2, ASPHALT, { dash: true, lamps: true, ramp: true }));
  for (const rx of ROADS_X) arterials.push(makeStrip([rx, 68], [rx, 380], 5.2, ASPHALT, { dash: true, lamps: true, ramp: true }));
  arterials.forEach((st) => {
    const tun = st.pts[st.pts.length - 1][0] < -190;
    fleet(ctx.mobile ? 3 : 7, st.len + (tun ? 40 : 0), tun ? intoMountain(st) : (s, lane) => stripPose(st, s, lane), [1.3, -1.3], 7, 13);
  });
  // the roundabout: a ring of asphalt with a kerbed grass island, lamps outside and a tree and a lamp inside
  {
    const yR = Math.max(0.55, hmax(RB.x, RB.z, 8)) + 0.1;
    const N = 28;
    const W = 5.4;
    for (let k = 0; k < N; k++) {
      const am = ((k + 0.5) / N) * Math.PI * 2;
      const mx = RB.x + Math.cos(am) * RB.r;
      const mz = RB.z + Math.sin(am) * RB.r;
      const ry = Math.atan2(-Math.cos(am), -Math.sin(am));
      B.box.add(mx, yR - 0.94, mz, 2 * RB.r * Math.sin(Math.PI / N) + 0.5, 0.94, W, ASPHALT, ry);
      if (k % 2 === 0) B.glow.add(mx, yR + 0.02, mz, 1.3, 0.04, 0.14, C("#d8d2b0"), ry);
      if (k % 2 === 1) addRoad(mx, mz, W / 2 + 2.3);
    }
    addRoad(RB.x, RB.z, RB.r - W / 2);
    // the island: grass inside a light kerb
    B.cyl.add(RB.x, yR - 0.05, RB.z, 6.0, 0.5, 6.0, C("#35553f"));
    for (let k = 0; k < 16; k++) {
      const a = ((k + 0.5) / 16) * Math.PI * 2;
      B.box.add(RB.x + Math.cos(a) * 3.1, yR - 0.05, RB.z + Math.sin(a) * 3.1, 1.25, 0.56, 0.4, C("#9aa0b4"), Math.atan2(-Math.cos(a), -Math.sin(a)));
    }
    B.cyl.add(RB.x - 0.3, yR + 0.45, RB.z + 0.2, 0.3, 1.4, 0.3, C("#5a4538"));
    B.ico.add(RB.x - 0.3, yR + 2.2, RB.z + 0.2, 2.6, 2.2, 2.6, C("#4f7d5a"), 1.3);
    for (const [fx, fz] of [[1.6, -1.2], [-1.5, 1.4], [0.8, 1.9]]) B.ico.add(RB.x + fx, yR + 0.7, RB.z + fz, 0.8, 0.6, 0.8, C("#5a8a62"), fx);
    lampPost(RB.x + 1.4, yR + 0.4, RB.z - 0.8, 4.0);
    // lamps round the outside, between the arms
    for (const a of [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4]) {
      const lx = RB.x + Math.cos(a) * (RB.r + 3.9);
      const lz = RB.z + Math.sin(a) * (RB.r + 3.9);
      lampPost(lx, yR - 0.2, lz, 4.4);
      pools.push([lx, yR + 0.07, lz, 4.4]);
    }
  }
  // the portals: a stone headwall set into the mountain, an arched mouth, stepped wing walls, lamps and a sign
  const roadPortal =(px: number, pz: number) => {
    const y = Math.max(0.55, hmax(px + 1, pz, 2)) + 0.1;
    const STONE = C("#7d7a72");
    const STONE2 = C("#a39f94");
    const STONE3 = C("#6a675f");
    const DARK = C("#07080e");
    B.box.add(px - 1.2, y - 5, pz, 2.8, 13.8, 19, STONE);
    for (let k = 0; k < 8; k++) B.box.add(px + 0.2, y + 0.4 + k * 1.0, pz, 0.1, 0.06, 18.6, STONE3);
    for (let k = -4; k <= 4; k++) B.box.add(px + 0.2, y - 4.6, pz + k * 2.1, 0.1, 12.6, 0.06, STONE3);
    B.box.add(px - 1.1, y + 8.8, pz, 3.3, 0.5, 19.8, STONE2);
    B.box.add(px - 1.0, y + 8.4, pz, 3.0, 0.2, 19.4, STONE3);
    const cy = y + 3.0;
    B.box.add(px + 0.3, y - 0.4, pz, 0.3, cy - y + 0.4, 8.2, STONE2);
    B.cyl.add(px + 0.15, cy, pz, 8.2, 0.45, 8.2, STONE2, 0, [0, 0, 0], 0, -Math.PI / 2);
    B.box.add(px + 0.46, y - 0.4, pz, 0.3, cy - y + 0.4, 6.9, DARK);
    B.cyl.add(px + 0.3, cy, pz, 6.9, 0.5, 6.9, DARK, 0, [0, 0, 0], 0, -Math.PI / 2);
    B.box.add(px + 0.5, cy + 3.5, pz, 0.5, 0.5, 1.2, STONE2);
    for (const sz of [-1, 1]) B.cyl.add(px - 0.9, y + 9.1, pz + sz * 1.7, 0.14, 0.4, 0.14, C("#4d5470"));
    signsW[signIdx("TUNNEL")].add(px - 0.9, y + 9.4, pz, 4.2, 1.3, 0.12, new THREE.Color(1, 1, 1), Math.PI / 2);
    for (const sz of [-1, 1]) {
      B.cyl.add(px + 0.6, y - 0.2, pz + sz * 6.6, 0.3, 4.6, 0.3, C("#4d5470"));
      B.glow.add(px + 0.6, y + 4.4, pz + sz * 6.6, 0.5, 0.3, 0.5, C("#ffc98a"));
      for (let k = 0; k < 4; k++) {
        const h = 3.2 - k * 0.7;
        B.box.add(px + 1.5 + k * 2.0, y - 0.4, pz + sz * 3.9, 2.05, h + 0.4, 0.7, STONE);
        B.box.add(px + 1.5 + k * 2.0, y + h, pz + sz * 3.9, 2.1, 0.18, 0.95, STONE2);
      }
    }
    addRoad(px + 4, pz, 9);
  };
  roadPortal(PORTX, HIGHWAY_Z);
  roadPortal(PORTX, ROADS_Z[2]);
  // the ocean-side road: it hugs the east coast a beach's width inland, from the far hills up to the city
  {
    const raw: [number, number][] = [];
    for (let z = 380; z >= 68; z -= 6) {
      let x = 10;
      while (landL(x, z) > 14.5 && x < 240) x += 0.5;
      raw.push([x, z]);
    }
    // swing the road inland around the port so the quay never sits on it
    const lim = PORT.x0 - 10;
    raw.forEach((p) => {
      const d = Math.max(PORT.z0 - p[1], p[1] - PORT.z1, 0);
      const t = 1 - Math.min(1, d / 18);
      const k = t * t * (3 - 2 * t);
      p[0] -= (p[0] - Math.min(p[0], lim)) * k;
    });
    const poly: [number, number][] = raw.map((p, i) => {
      const a = raw[Math.max(0, i - 1)];
      const b = raw[Math.min(raw.length - 1, i + 1)];
      return [(a[0] + p[0] + b[0]) / 3, p[1]] as [number, number];
    });
    poly.push([poly[poly.length - 1][0] - 10, 66], [poly[poly.length - 1][0] - 26, 68]);
    const coast = makePoly(poly, 5.4, ASPHALT, { dash: true, lamps: true });
    coast.pts.forEach((p) => coastPts.push(p));
    fleet(ctx.mobile ? 4 : 10, coast.len, (s, lane) => stripPose(coast, s, lane), [1.3, -1.3], 6, 11);
    // palms, parasols and benches on the sand between the road and the water
    const palm = (x: number, z: number, sc: number) => {
      addPalm({ box: B.box, cyl: B.cyl, cone: B.cone, ico: B.ico }, x, Math.max(0.05, terrainHeight(x, z)), z, sc, r, ctx.mobile);
      blob(x + 0.6, z + 0.4, 1.7 * sc, 1.3 * sc);
    };
    const seaward = (x: number, z: number, level: number) => {
      let px = x;
      while (landL(px, z) > level && px < x + 40) px += 0.5;
      return px;
    };
    const PARASOL = ["#d8694f", "#4fa3a5", "#d4a24c", "#8b5a8c", "#6a86d6"].map(C);
    for (let i = 2; i < poly.length - 3; i++) {
      const [x, z] = poly[i];
      if (z > PORT.z0 - 12 && z < PORT.z1 + 12) continue; // keep the port area clear
      if (i % 2 === 0) {
        const px = seaward(x, z, 7.5 + r() * 2);
        palm(px, z + (r() - 0.5) * 4, 0.9 + r() * 0.4);
      }
      if (i % 3 === 1) {
        const px = seaward(x, z, 4.2);
        const y = Math.max(0.05, terrainHeight(px, z));
        B.cyl.add(px, y, z, 0.1, 2.3, 0.1, C("#e8e0d0"));
        B.cone.add(px, y + 2.1, z, 3.2, 0.8, 3.2, pick(PARASOL));
        B.box.add(px + 1.2, y + 0.04, z + 0.4, 1.6, 0.1, 0.7, pick(PARASOL), r());
      }
      if (i % 4 === 2) {
        const bx2 = x + 3.4;
        B.box.add(bx2, 0.1, z, 0.4, 0.4, 1.5, C("#6b5a48"));
        B.box.add(bx2 + 0.2, 0.1, z, 0.1, 0.9, 1.5, C("#6b5a48"));
      }
      if (i % 12 === 5) {
        // a lifeguard tower
        const px = seaward(x, z, 5.5);
        const y = Math.max(0.05, terrainHeight(px, z));
        for (const [dx, dz] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) B.cyl.add(px + dx, y, z + dz, 0.14, 2.0, 0.14, C("#e8e0d0"));
        B.box.add(px, y + 2.0, z, 2.2, 1.4, 2.2, C("#d8694f"));
        B.gab.add(px, y + 3.4, z, 2.6, 0.8, 2.6, C("#e8e0d0"));
        B.glow.add(px - 1.12, y + 2.6, z, 0.05, 0.5, 0.9, C("#ffd9a0"));
      }
    }
  }
  // power lines along the highway and the arterials, and big LED billboards beside the highway
  const wire = (x1: number, y1: number, z1: number, x2: number, y2: number, z2: number) => {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const dy = y2 - y1;
    const hd = Math.hypot(dx, dz) || 1;
    B.box.add((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2, Math.hypot(hd, dy), 0.04, 0.04, C("#1b1f2c"), Math.atan2(-dz, dx), [0, 0, 0], 0, Math.atan2(dy, hd));
  };
  const powerLine = (st: Strip, side: number, every: number) => {
    let prev: [number, number, number][] | null = null;
    for (let i = 2; i < st.pts.length - 2; i += every) {
      const a = st.pts[i];
      const b = st.pts[i + 1];
      const dx = b[0] - a[0];
      const dz = b[1] - a[1];
      const hd = Math.hypot(dx, dz) || 1;
      const nx = (-dz / hd) * side;
      const nz = (dx / hd) * side;
      const px = a[0] + nx * 4.6;
      const pz = a[1] + nz * 4.6;
      if (inPad(px, pz, 2)) continue;
      const py = Math.max(0.1, hmax(px, pz, 0.8));
      B.cyl.add(px, py - 0.2, pz, 0.24, 6.8, 0.24, C("#5a4538"));
      B.box.add(px, py + 6.1, pz, 2.4, 0.14, 0.14, C("#4a3a2c"), Math.atan2(-dz, dx) + Math.PI / 2);
      const tops: [number, number, number][] = [-0.95, 0, 0.95].map((t) => [px + nx * t, py + 6.35, pz + nz * t] as [number, number, number]);
      // the crossarm lies across the road, so the wires sit at offsets along the road normal
      tops.forEach(([tx, ty, tz]) => B.glow.add(tx, ty, tz, 0.1, 0.1, 0.1, C("#ffd9a0").multiplyScalar(0.25)));
      if (prev) for (let q = 0; q < 3; q++) {
        const mx2 = (prev[q][0] + tops[q][0]) / 2;
        const mz2 = (prev[q][2] + tops[q][2]) / 2;
        const my2 = (prev[q][1] + tops[q][1]) / 2 - 0.45;
        wire(prev[q][0], prev[q][1], prev[q][2], mx2, my2, mz2);
        wire(mx2, my2, mz2, tops[q][0], tops[q][1], tops[q][2]);
      }
      prev = tops;
    }
  };
  powerLine(highway, -1, 6);
  arterials.forEach((st, i) => powerLine(st, i % 2 ? 1 : -1, 6));
  const roadBoard = (x: number, z: number, k: number) => {
    const y = Math.max(0.1, hmax(x, z, 3));
    for (const dx of [-3.2, 3.2]) B.cyl.add(x + dx, y - 0.3, z, 0.42, 7.2, 0.42, C("#4d5470"));
    B.box.add(x, y + 6.7, z, 8.4, 0.18, 1.1, C("#4d5470"));
    boardsW[k].add(x, y + 5.5, z + 0.17, 9.4, 4.1, 0.3, new THREE.Color(1, 1, 1), 0);
    boardsW[k].add(x, y + 5.5, z - 0.17, 9.4, 4.1, 0.3, new THREE.Color(1, 1, 1), Math.PI);
    for (const dx of [-3.4, -1.1, 1.1, 3.4]) B.glow.add(x + dx, y + 7.2, z + 0.3, 0.45, 0.28, 0.45, C("#fff3d0"));
  };
  roadBoard(-122, HIGHWAY_Z - 8.5, 0);

  // the station comes alive: a textured platform and hall, boards and clocks, a taxi rank, a bus stop, planters and kiosks
  {
    const px0 = -120;
    const px1 = -82;
    const pxm = (px0 + px1) / 2;
    const y = railY(pxm);
    const bx0 = pxm - 4;
    const canvasTex = (w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) => {
      const cv = document.createElement("canvas");
      cv.width = w;
      cv.height = h;
      draw(cv.getContext("2d")!);
      const t = new THREE.CanvasTexture(cv);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      return t;
    };
    const noise = (g: CanvasRenderingContext2D, w: number, h: number, n: number, a: number) => {
      for (let i = 0; i < n; i++) {
        g.fillStyle = Math.random() < 0.5 ? `rgba(20,22,32,${a})` : `rgba(220,224,236,${a})`;
        g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 1 + Math.random() * 2);
      }
    };
    // platform: paving slabs, wear, a tactile warning strip and the platform number
    {
      const W = 1280;
      const H = 160;
      const tex = canvasTex(W, H, (g) => {
        g.fillStyle = "#8f95a7";
        g.fillRect(0, 0, W, H);
        for (let ix = 0; ix < 38; ix++) for (let iy = 0; iy < 4; iy++) {
          const v = 128 + Math.floor(Math.random() * 26);
          g.fillStyle = `rgb(${v},${v + 4},${v + 18})`;
          g.fillRect(ix * 33.7 + 1, iy * 36 + 1, 31.7, 34);
        }
        g.strokeStyle = "rgba(30,34,50,0.55)";
        g.lineWidth = 1.5;
        for (let ix = 0; ix <= 38; ix++) { g.beginPath(); g.moveTo(ix * 33.7, 0); g.lineTo(ix * 33.7, H); g.stroke(); }
        for (let iy = 0; iy <= 4; iy++) { g.beginPath(); g.moveTo(0, iy * 36); g.lineTo(W, iy * 36); g.stroke(); }
        for (let k = 0; k < 7; k++) {
          const px = Math.random() * W;
          const rg = g.createRadialGradient(px, 60, 4, px, 60, 70);
          rg.addColorStop(0, "rgba(30,34,50,0.28)");
          rg.addColorStop(1, "rgba(30,34,50,0)");
          g.fillStyle = rg;
          g.fillRect(px - 70, 0, 140, H);
        }
        noise(g, W, H, 1400, 0.16);
        // the track side is the bottom edge: a yellow line, with a field of tactile bumps behind it
        g.fillStyle = "#d8b838";
        g.fillRect(0, H - 40, W, 8);
        g.fillStyle = "rgba(216,184,56,0.85)";
        g.fillRect(0, H - 32, W, 28);
        g.fillStyle = "rgba(60,50,10,0.55)";
        for (let ix = 0; ix < W; ix += 9) for (let iy = H - 28; iy < H - 4; iy += 9) { g.beginPath(); g.arc(ix + 4, iy + 4, 2, 0, Math.PI * 2); g.fill(); }
        g.fillStyle = "#e8e6de";
        for (const [pn, cx] of [[1, 210], [2, 640], [3, 1070]] as const) {
          g.beginPath();
          g.arc(cx, 62, 28, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = "#2a2f45";
          g.font = "bold 40px sans-serif";
          g.textAlign = "center";
          g.fillText(String(pn), cx, 76);
          g.fillStyle = "#e8e6de";
        }
      });
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(px1 - px0, 4.4).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -2 }));
      plane.position.set(pxm, y + 0.52, RAIL_Z - 4.4);
      plane.receiveShadow = true;
      scene.add(plane);
    }
    // station hall facade (platform side): ashlar courses, a dark plinth, pilasters, window frames, a cornice and posters
    {
      const W = 768;
      const H = 256;
      const tex = canvasTex(W, H, (g) => {
        g.fillStyle = "#b8aa92";
        g.fillRect(0, 0, W, H);
        for (let iy = 0; iy < 16; iy++) {
          const off = iy % 2 ? 24 : 0;
          for (let ix = -1; ix < 17; ix++) {
            const v = 160 + Math.floor(Math.random() * 22);
            g.fillStyle = `rgb(${v + 14},${v + 2},${v - 22})`;
            g.fillRect(ix * 48 + off + 1, iy * 16 + 1, 46, 14);
          }
        }
        noise(g, W, H, 1800, 0.12);
        g.fillStyle = "#5d574b"; // plinth
        g.fillRect(0, H - 26, W, 26);
        g.fillStyle = "#8f8774"; // cornice
        g.fillRect(0, 0, W, 16);
        g.fillStyle = "#6e6759";
        g.fillRect(0, 16, W, 4);
        const u = W / 12;
        for (const k of [-2, -1, 1, 2]) {
          const cx = (k * 2.2 + 6) * u;
          g.fillStyle = "#4a4338";
          g.fillRect(cx - 0.62 * u, 256 - (2.9 / 4) * H - 6, 1.24 * u, (1.6 / 4) * H + 12); // window frames, the glow goes in the middle
          g.fillStyle = "#cfc6b0";
          g.fillRect(cx - 0.7 * u, 256 - (1.3 / 4) * H + 2, 1.4 * u, 7); // sills
        }
        for (const cx of [0.5 * u, 11.5 * u, 2.7 * u, 9.3 * u]) {
          g.fillStyle = "#cbbfa6";
          g.fillRect(cx - 7, 20, 14, H - 46);
        }
        // posters beside the door
        const post = (cx: number, c1: string, c2: string) => {
          g.fillStyle = "#2c2a26";
          g.fillRect(cx - 17, 82, 34, 60);
          g.fillStyle = c1;
          g.fillRect(cx - 14, 85, 28, 30);
          g.fillStyle = c2;
          g.fillRect(cx - 14, 118, 28, 7);
          g.fillStyle = "#e8e0d0";
          g.fillRect(cx - 14, 128, 20, 3);
          g.fillRect(cx - 14, 134, 14, 3);
        };
        post(4.7 * u, "#3f6fb0", "#e6b422");
        post(7.3 * u, "#d8694f", "#e8e0d0");
      });
      const fac = new THREE.Mesh(new THREE.PlaneGeometry(12, 4), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
      fac.position.set(bx0, 2.0, RAIL_Z - 9.385);
      fac.receiveShadow = true;
      scene.add(fac);
      // the two end walls: ashlar, a plinth, a cornice, a tall window frame and a lit door frame
      const sideTex = canvasTex(332, 256, (g) => {
        g.fillStyle = "#b8aa92";
        g.fillRect(0, 0, 332, 256);
        for (let iy = 0; iy < 16; iy++) {
          const off = iy % 2 ? 24 : 0;
          for (let ix = -1; ix < 8; ix++) {
            const v = 160 + Math.floor(Math.random() * 22);
            g.fillStyle = `rgb(${v + 14},${v + 2},${v - 22})`;
            g.fillRect(ix * 48 + off + 1, iy * 16 + 1, 46, 14);
          }
        }
        noise(g, 332, 256, 900, 0.12);
        g.fillStyle = "#5d574b";
        g.fillRect(0, 230, 332, 26);
        g.fillStyle = "#8f8774";
        g.fillRect(0, 0, 332, 16);
        g.fillStyle = "#6e6759";
        g.fillRect(0, 16, 332, 4);
        g.fillStyle = "#cbbfa6";
        for (const cx of [10, 322]) g.fillRect(cx - 8, 20, 16, 210);
        // a tall arched window in the middle
        g.fillStyle = "#4a4338";
        g.fillRect(166 - 40, 60, 80, 120);
        g.beginPath();
        g.arc(166, 60, 40, Math.PI, 0);
        g.fill();
        g.fillStyle = "#cfc6b0";
        g.fillRect(166 - 48, 180, 96, 8);
        // a poster board and a service door frame on either side
        g.fillStyle = "#2c2a26";
        g.fillRect(44, 100, 36, 70);
        g.fillStyle = "#3f6fb0";
        g.fillRect(48, 104, 28, 34);
        g.fillStyle = "#e8e0d0";
        g.fillRect(48, 144, 24, 4);
        g.fillRect(48, 152, 16, 4);
        g.fillStyle = "#3a3f50";
        g.fillRect(250, 100, 40, 130);
        g.fillStyle = "#cfc6b0";
        g.fillRect(246, 96, 48, 6);
      });
      const sideMat = new THREE.MeshStandardMaterial({ map: sideTex, roughness: 0.9 });
      for (const sd of [-1, 1]) {
        const sideP = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 4), sideMat);
        sideP.rotation.y = sd * (Math.PI / 2);
        sideP.position.set(bx0 + sd * 6.01, 2.0, RAIL_Z - 12);
        sideP.receiveShadow = true;
        scene.add(sideP);
      }
      const back = new THREE.Mesh(new THREE.PlaneGeometry(12, 4), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
      back.rotation.y = Math.PI;
      back.position.set(bx0, 2.0, RAIL_Z - 14.615);
      back.receiveShadow = true;
      scene.add(back);
    }
    // departure boards hanging from the canopy, lit and double sided
    {
      const tex = canvasTex(256, 128, (g) => {
        g.fillStyle = "#080b16";
        g.fillRect(0, 0, 256, 128);
        g.fillStyle = "#ffb84f";
        g.font = "bold 17px monospace";
        g.fillText("DEPARTURES", 12, 22);
        g.fillStyle = "#1f2540";
        g.fillRect(8, 28, 240, 2);
        const rows = [["21:05", "HILLTOP", "1"], ["21:35", "SUMMIT", "2"], ["22:05", "HILLTOP", "3"], ["22:35", "SUMMIT", "2"]];
        g.font = "bold 15px monospace";
        rows.forEach(([t, d, p], i) => {
          g.fillStyle = i === 0 ? "#6dffb0" : "#ffcf8a";
          g.fillText(t, 12, 52 + i * 22);
          g.fillText(d, 74, 52 + i * 22);
          g.fillText(p, 224, 52 + i * 22);
        });
      });
      const mat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.3, 1.3, 1.3), side: THREE.DoubleSide });
      registerGlow(mat);
      for (const bxp of [-112, -90]) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 1.5), mat);
        m.rotation.y = Math.PI / 2;
        m.position.set(bxp, y + 3.2, RAIL_Z - 4.4);
        scene.add(m);
        B.box.add(bxp, y + 3.95, RAIL_Z - 4.4, 0.14, 0.2, 0.14, C("#4d5470"));
        B.box.add(bxp, y + 2.4, RAIL_Z - 4.4, 0.12, 0.1, 3.1, C("#161a2c"));
      }
    }
    // station clock on the hall roof: a tower with a lit face on both visible sides
    B.box.add(bx0, 5.0, RAIL_Z - 12, 2.2, 2.4, 2.2, C("#b8aa92"));
    B.box.add(bx0, 7.4, RAIL_Z - 12, 2.5, 0.22, 2.5, C("#8f8774"));
    B.cone.add(bx0, 7.6, RAIL_Z - 12, 2.8, 1.8, 2.8, C("#454b63"));
    B.cyl.add(bx0, 9.3, RAIL_Z - 12, 0.1, 0.9, 0.1, C("#aeb4c4"));
    B.box.add(bx0, 5.75, RAIL_Z - 10.87, 1.5, 1.4, 0.08, C("#2a2f45"));
    B.glow.add(bx0, 5.85, RAIL_Z - 10.82, 1.3, 1.2, 0.05, C("#fff3d0"));
    B.box.add(bx0, 6.45, RAIL_Z - 10.78, 0.1, 0.5, 0.05, C("#161a2c"));
    B.box.add(bx0 + 0.14, 6.4, RAIL_Z - 10.78, 0.36, 0.1, 0.05, C("#161a2c"));
    B.box.add(bx0 + 1.14, 5.75, RAIL_Z - 12, 0.08, 1.4, 1.5, C("#2a2f45"));
    B.glow.add(bx0 + 1.19, 5.85, RAIL_Z - 12, 0.05, 1.2, 1.3, C("#fff3d0"));
    B.box.add(bx0 + 1.24, 6.45, RAIL_Z - 12, 0.05, 0.5, 0.1, C("#161a2c"));
    B.box.add(bx0 + 1.24, 6.4, RAIL_Z - 11.86, 0.05, 0.1, 0.36, C("#161a2c"));
    // hall: plinth, a glazed door, a red entrance awning, a TICKETS sign, planters and a bench
    B.box.add(bx0, 0, RAIL_Z - 12, 12.5, 0.45, 5.6, C("#6e6759"));
    B.box.add(bx0, 0.1, RAIL_Z - 9.38, 2.0, 2.6, 0.1, C("#2c3040"));
    B.glow.add(bx0 - 0.45, 0.3, RAIL_Z - 9.31, 0.75, 2.2, 0.05, C("#ffd9a0"));
    B.glow.add(bx0 + 0.45, 0.3, RAIL_Z - 9.31, 0.75, 2.2, 0.05, C("#ffd9a0"));
    B.box.add(bx0, 2.85, RAIL_Z - 8.9, 4.6, 0.22, 1.6, C("#b3363a"));
    for (const sx of [-1, 1]) B.cyl.add(bx0 + sx * 2.1, 0, RAIL_Z - 8.3, 0.14, 2.9, 0.14, C("#e8e0d0"));
    signsW[signIdx("TICKETS")].add(bx0 + 4.4, 2.85, RAIL_Z - 9.3, 3.0, 0.9, 0.1, new THREE.Color(1, 1, 1), 0);
    for (const sx of [-4.8, 4.8]) {
      B.box.add(bx0 + sx, 0, RAIL_Z - 8.7, 1.5, 0.55, 0.9, C("#6e6759"));
      B.ico.add(bx0 + sx, 0.5, RAIL_Z - 8.7, 1.2, 0.9, 1.0, C("#3f6f3f"), sx);
      B.ico.add(bx0 + sx + 0.2, 0.9, RAIL_Z - 8.8, 0.7, 0.6, 0.7, C("#e8a03a"), 2 + sx);
    }
    // on the platform: ticket machines, a bin, a vending machine, a luggage trolley, bollards, wall-lit clocks
    for (const mx of [-109.6, -108.2]) {
      B.box.add(mx, y + 0.5, RAIL_Z - 6.5, 0.8, 1.5, 0.6, C("#3f6fb0"));
      B.glow.add(mx, y + 1.2, RAIL_Z - 6.18, 0.5, 0.45, 0.04, C("#9affc0"));
    }
    B.box.add(-96.5, y + 0.5, RAIL_Z - 6.5, 1.0, 1.8, 0.7, C("#b3363a"));
    B.glow.add(-96.5, y + 1.2, RAIL_Z - 6.12, 0.7, 0.9, 0.04, C("#ffcf8a"));
    B.cyl.add(-104.4, y + 0.5, RAIL_Z - 6.3, 0.5, 0.9, 0.5, C("#3a3f50"));
    B.box.add(-92.4, y + 0.5, RAIL_Z - 6.3, 1.6, 0.14, 0.9, C("#aeb4c4"));
    B.box.add(-92.4, y + 0.64, RAIL_Z - 6.7, 1.6, 0.9, 0.06, C("#aeb4c4"));
    for (const [cx2, cy2, cz2, cc] of [[-92.8, 0.8, -6.3, "#8a5a3a"], [-92.0, 0.8, -6.3, "#3f6fb0"]] as const) B.box.add(cx2, y + cy2, RAIL_Z + cz2 - 0.2, 0.6, 0.5, 0.4, C(cc));
    for (let k = 0; k < 9; k++) B.cyl.add(px0 + 4 + k * 4.3, y + 0.5, RAIL_Z - 2.3, 0.12, 0.5, 0.12, C("#e6b422"));
    for (const cxp of [-113.5, -85.5]) {
      B.cyl.add(cxp, y + 0.5, RAIL_Z - 5.8, 0.14, 3.0, 0.14, C("#2c3040"));
      B.box.add(cxp, y + 3.2, RAIL_Z - 5.8, 0.3, 1.0, 1.0, C("#fff3d0"));
      B.glow.add(cxp, y + 3.25, RAIL_Z - 5.8, 0.34, 0.8, 0.8, C("#fff3d0"));
    }
    // canopy: ribs across the roof and a coloured fascia along the track edge
    for (let x = px0; x <= px1; x += 3) B.box.add(x, y + 4.38, RAIL_Z - 4.8, 0.18, 0.14, 5.4, C("#3a4058"));
    B.box.add(pxm, y + 3.95, RAIL_Z - 2.05, px1 - px0 + 1.5, 0.4, 0.1, C("#d8694f"));
    // ramps down at both platform ends and a crushed-stone track bed between the rails
    for (const sd of [-1, 1]) for (let k = 0; k < 3; k++) {
      const top = y + 0.5 - 0.17 * (k + 1);
      B.box.add(sd < 0 ? px0 - 0.6 - k * 0.9 : px1 + 0.6 + k * 0.9, -1, RAIL_Z - 4.4, 0.9, top + 1, 4.6, C("#8e93a6"));
    }
    for (let x = px0 - 14; x < px1 + 14; x += 4) B.box.add(x, railY(x) - 0.12, RAIL_Z, 4.1, 0.1, 3.6, C("#74737d"));
    // forecourt: a taxi rank and a drop-off apron to the east of the hall, joined to the avenue
    const ASP = C("#2a2d3a");
    makeStrip([-98.6, -26.5], [-80, -26.5], 6.2, ASP, { dash: true });
    makeStrip([-84, -28], [-84, -44], 3.8, ASP, { dash: true });
    const gy2 = 0.66;
    for (let k = 0; k < 4; k++) B.box.add(-96.8 + k * 3.6, gy2 + 0.02, -24.6, 0.1, 0.03, 2.6, C("#d8dbe6"));
    const taxi = (x: number, z: number, hue: string, roof: boolean) => {
      B.box.add(x, gy2 + 0.14, z, 1.9, 0.5, 0.95, C(hue));
      B.box.add(x, gy2 + 0.62, z, 1.0, 0.36, 0.78, C("#20253a"));
      B.cyl.add(x - 0.6, gy2 + 0.02, z - 0.5, 0.36, 0.16, 0.36, C("#161a2c"));
      B.cyl.add(x + 0.6, gy2 + 0.02, z - 0.5, 0.36, 0.16, 0.36, C("#161a2c"));
      B.cyl.add(x - 0.6, gy2 + 0.02, z + 0.5, 0.36, 0.16, 0.36, C("#161a2c"));
      B.cyl.add(x + 0.6, gy2 + 0.02, z + 0.5, 0.36, 0.16, 0.36, C("#161a2c"));
      if (roof) B.glow.add(x, gy2 + 1.0, z, 0.42, 0.14, 0.26, C("#ffe6a0"));
    };
    taxi(-95, -23.4 - 1.2, "#e6b422", true);
    taxi(-91.4, -23.4 - 1.2, "#e6b422", true);
    taxi(-87.8, -23.4 - 1.2, "#e6b422", true);
    taxi(-94, -28.4, "#cfd3dc", false);
    taxi(-88.6, -28.4, "#3f6fb0", false);
    B.box.add(-96.6, gy2, -22.4, 0.2, 2.4, 0.2, C("#4d5470"));
    B.box.add(-96.6, gy2 + 2.4, -22.4, 1.0, 0.8, 0.14, C("#e6b422"));
    // a bus stop with glass, a bench, a timetable and a lamp
    {
      const sx = -82.2;
      const sz = -23.4;
      B.box.add(sx, gy2 + 2.3, sz, 3.4, 0.14, 1.8, C("#3f6fb0"));
      B.box.add(sx, gy2 + 0.04, sz + 0.2, 3.2, 0.05, 1.6, C("#74737d"));
      for (const dx of [-1.55, 1.55]) B.cyl.add(sx + dx, gy2, sz - 0.7, 0.12, 2.3, 0.12, C("#4d5470"));
      B.glow.add(sx, gy2 + 1.3, sz - 0.78, 2.7, 1.5, 0.04, C("#9ec8ff").multiplyScalar(0.45));
      B.box.add(sx, gy2 + 0.55, sz - 0.5, 2.1, 0.12, 0.45, C("#6b5a48"));
      B.glow.add(sx + 1.4, gy2 + 1.4, sz + 0.5, 0.04, 0.8, 0.5, C("#ffcf8a"));
    }
    // a lit kiosk near the bus stop and bike racks by the hall
    B.box.add(-90, 0.2, -31.3, 2.2, 2.2, 1.8, C("#d8694f"));
    B.box.add(-90, 2.4, -31.3, 2.6, 0.2, 2.2, C("#454b63"));
    B.glow.add(-90, 1.1, -30.37, 1.7, 0.9, 0.05, C("#ffcf8a"));
    for (let k = 0; k < 6; k++) B.box.add(-118 + k * 0.5, 0.1, RAIL_Z - 8.4, 0.05, 0.9, 0.7, C("#aeb4c4"));
    for (const lx of [-96, -88, -82]) lampPost(lx, 0.1, -29.8, 4.2);

    // ---- the hall in detail: roof, back, ends ----
    const hz = RAIL_Z - 12; // the hall's centre line
    const BRICK = C("#8a4f45");
    const SLATE = C("#2c3040");
    const WARMW = C("#ffcf8a").multiplyScalar(0.9);
    // roof: ridge cap, courses of tiles on both slopes, gutters, downpipes, chimneys and dormers
    B.box.add(bx0, 5.74, hz, 13.3, 0.16, 0.45, C("#3a4058"));
    for (const sd of [-1, 1]) {
      for (let q = 1; q <= 5; q++) {
        const dz = (q / 6) * 2.9;
        B.box.add(bx0, 4.0 + 1.8 * (1 - dz / 3) + 0.02, hz + sd * dz, 13.2, 0.05, 0.07, C("#3a4058"), 0, [0, 0, 0], sd * 0.54);
      }
      B.box.add(bx0, 3.9, hz + sd * 3.05, 13.4, 0.14, 0.18, C("#8e93a6"));
    }
    for (const dx of [-6.2, 6.2]) for (const sd of [-1, 1]) B.cyl.add(bx0 + dx, 0.45, hz + sd * 2.95, 0.12, 3.5, 0.12, C("#8e93a6"));
    for (const cx of [-4.4, 4.2]) {
      B.box.add(bx0 + cx, 4.4, hz - 1.0, 0.9, 2.3, 0.9, BRICK);
      B.box.add(bx0 + cx, 6.6, hz - 1.0, 1.15, 0.16, 1.15, SLATE);
      for (const q of [0, 1, 2]) B.box.add(bx0 + cx, 5.2 + q * 0.5, hz - 1.0, 0.94, 0.04, 0.94, C("#6a3a32"));
    }
    for (const dx of [-3.4, 3.4]) for (const sd of [-1, 1]) {
      const dzs = sd * 1.35;
      B.box.add(bx0 + dx, 4.15, hz + dzs, 1.3, 1.1, 0.7, C("#eae6dc"));
      B.glow.add(bx0 + dx, 4.3, hz + dzs + sd * 0.37, 0.8, 0.7, 0.05, WARMW);
      B.gab.add(bx0 + dx, 5.1, hz + dzs, 1.5, 0.6, 1.0, SLATE, Math.PI / 2);
    }
    for (const dx of [-1.8, 1.8]) {
      B.cyl.add(bx0 + dx, 5.0, hz + 0.9, 0.5, 0.45, 0.5, C("#aeb4c4"));
      B.cyl.add(bx0 + dx, 5.4, hz + 0.9, 0.62, 0.08, 0.62, C("#8e93a6"));
    }
    // the back (north side): lit windows behind frames, a double door with a canopy and steps, lamps, a café sign, wall units and planters
    for (let k = -2; k <= 2; k++) {
      if (k === 0) continue;
      B.glow.add(bx0 + k * 2.2, 1.3, RAIL_Z - 14.64, 0.9, 1.4, 0.06, C("#ffb870"));
      B.box.add(bx0 + k * 2.2, 0.95, RAIL_Z - 14.66, 1.3, 0.1, 0.1, C("#cfc6b0"));
    }
    B.box.add(bx0, 0.1, RAIL_Z - 14.64, 2.4, 2.6, 0.1, C("#2c3040"));
    B.glow.add(bx0 - 0.55, 0.3, RAIL_Z - 14.7, 0.9, 2.2, 0.05, C("#ffd9a0"));
    B.glow.add(bx0 + 0.55, 0.3, RAIL_Z - 14.7, 0.9, 2.2, 0.05, C("#ffd9a0"));
    B.glow.add(bx0, 2.75, RAIL_Z - 14.68, 2.0, 0.3, 0.05, C("#ffe6b0"));
    B.box.add(bx0, 2.95, RAIL_Z - 15.2, 3.8, 0.2, 1.7, C("#3f6fb0"));
    for (const sx of [-1, 1]) B.cyl.add(bx0 + sx * 1.8, 0.3, RAIL_Z - 15.9, 0.12, 2.7, 0.12, C("#e8e0d0"));
    B.box.add(bx0, 0.1, RAIL_Z - 15.4, 3.0, 0.3, 1.2, C("#8e93a6"));
    B.box.add(bx0, 0.4, RAIL_Z - 15.0, 2.6, 0.3, 0.8, C("#a0a4b0"));
    for (const sx of [-1, 1]) {
      B.box.add(bx0 + sx * 2.1, 2.1, RAIL_Z - 14.72, 0.1, 0.5, 0.2, C("#2c3040"));
      B.glow.add(bx0 + sx * 2.1, 2.0, RAIL_Z - 14.84, 0.3, 0.3, 0.3, C("#ffd9a0"));
    }
    signsW[signIdx("COFFEE")].add(bx0 - 3.6, 2.85, RAIL_Z - 14.68, 2.4, 0.75, 0.1, new THREE.Color(1, 1, 1), 0);
    for (const dx of [4.4, -4.4]) {
      B.box.add(bx0 + dx, 2.9, RAIL_Z - 14.78, 1.0, 0.7, 0.4, C("#aeb4c4"));
      B.cyl.add(bx0 + dx + 0.7, 0.3, RAIL_Z - 14.7, 0.1, 3.4, 0.1, C("#8e93a6"));
    }
    for (const dx of [-5.2, 5.2]) {
      B.box.add(bx0 + dx, 0.1, RAIL_Z - 15.4, 1.4, 0.55, 0.9, C("#6e6759"));
      B.ico.add(bx0 + dx, 0.6, RAIL_Z - 15.4, 1.2, 0.9, 1.0, C("#3f6f3f"), dx);
    }
    B.box.add(bx0 + 3.2, 0.1, RAIL_Z - 15.0, 1.6, 0.4, 0.5, C("#6b5a48"));
    B.box.add(bx0 + 3.2, 0.5, RAIL_Z - 15.2, 1.6, 0.7, 0.08, C("#6b5a48"));
    pools.push([bx0, 0.7, RAIL_Z - 16, 4.5]);
    // both ends: a lit arched window, a wall lamp, a bench and a drain pipe
    for (const sd of [-1, 1]) {
      const ex = bx0 + sd * 6.04;
      B.glow.add(ex, 1.25, hz, 0.06, 1.7, 1.0, WARMW);
      B.glow.add(ex, 2.95, hz, 0.06, 0.4, 0.9, WARMW);
      B.box.add(ex + sd * 0.05, 1.1, hz, 0.1, 0.12, 1.5, C("#cfc6b0"));
      B.box.add(ex + sd * 0.1, 0.1, hz + 0.6, 0.1, 2.3, 0.9, C("#3a3f50"));
      B.glow.add(ex + sd * 0.2, 2.6, hz + 1.9, 0.25, 0.25, 0.25, C("#ffd9a0"));
      B.box.add(ex + sd * 0.8, 0.1, hz - 0.2, 0.7, 0.5, 1.8, C("#6b5a48"));
      B.cyl.add(ex + sd * 0.1, 0.3, hz - 2.4, 0.1, 3.6, 0.1, C("#8e93a6"));
    }
    // a luggage cart and parcel stack by the east door
    B.box.add(bx0 + 7.2, 0.1, hz + 1.2, 1.4, 0.2, 0.9, C("#aeb4c4"));
    for (const [dx, dz, c] of [[7.0, 1.2, "#8a5a3a"], [7.5, 1.3, "#3f6fb0"]] as const) B.box.add(bx0 + dx, 0.3, hz + dz, 0.6, 0.5, 0.5, C(c));
  }

  // the beaches beyond the city: palms, rocks and parasols, each with a soft shadow on the sand
  {
    const inCity = (x: number, z: number) => x > -74 && x < 94 && z > -92 && z < 98;
    const inPort = (x: number, z: number) => (x > PORT.x0 - 16 && z > PORT.z0 - 16 && z < PORT.z1 + 16) || (x > -132 && x < -70 && z > -172 && z < -98);
    const placed: [number, number][] = [];
    const clear = (x: number, z: number, d: number) => placed.every(([px, pz]) => Math.hypot(px - x, pz - z) > d);
    const sample = (): [number, number] => (r() < 0.7 ? [rr(40, 120), rr(96, 340)] : [rr(-140, -70), rr(-110, -40)]);
    const ROCKS = ["#7d8094", "#6b6e84", "#8e93a6", "#5f6378"].map(C);
    const PARASOL = ["#d8694f", "#4fa3a5", "#d4a24c", "#8b5a8c", "#6a86d6"].map(C);
    let palms = 0;
    let rocks = 0;
    let umbrellas = 0;
    const wantPalms = ctx.mobile ? 50 : 170;
    const wantRocks = ctx.mobile ? 40 : 120;
    const wantUmb = ctx.mobile ? 14 : 40;
    for (let tries = 0; tries < 60000 && (palms < wantPalms || rocks < wantRocks || umbrellas < wantUmb); tries++) {
      const [x, z] = sample();
      if (inCity(x, z) || inPort(x, z)) continue;
      const L = landL(x, z);
      if (L < -0.5 || L > 12) continue;
      const h = terrainHeight(x, z);
      if (h > 1.6) continue;
      const y = Math.max(0.05, h);
      if (L > 6.8 && palms < wantPalms && clear(x, z, 5)) {
        placed.push([x, z]);
        palms++;
        const sc = 0.8 + r() * 0.5;
        addPalm({ box: B.box, cyl: B.cyl, cone: B.cone, ico: B.ico }, x, y, z, sc, r, ctx.mobile);
        blob(x + 0.6, z + 0.4, 1.7 * sc, 1.3 * sc);
      } else if (L > -0.4 && L < 3.6 && rocks < wantRocks && clear(x, z, 3.2)) {
        placed.push([x, z]);
        rocks++;
        const n = 2 + Math.floor(r() * 3);
        for (let k = 0; k < n; k++) {
          const sx = x + (r() - 0.5) * 2.4;
          const sz = z + (r() - 0.5) * 2.4;
          const sz2 = 0.5 + r() * 1.1;
          B.ico.add(sx, Math.max(0.0, terrainHeight(sx, sz)) - 0.1, sz, sz2 * 1.5, sz2, sz2 * 1.2, pick(ROCKS), r() * 3);
          blob(sx + 0.3, sz + 0.25, sz2 * 1.1, sz2 * 0.85);
        }
      } else if (L > 4 && L < 6.4 && umbrellas < wantUmb && clear(x, z, 4)) {
        placed.push([x, z]);
        umbrellas++;
        B.cyl.add(x, y, z, 0.1, 2.3, 0.1, C("#e8e0d0"));
        B.cone.add(x, y + 2.1, z, 3.2, 0.8, 3.2, pick(PARASOL));
        B.box.add(x + 1.3, y + 0.04, z + 0.5, 1.6, 0.1, 0.7, pick(PARASOL), r());
        blob(x + 0.5, z + 0.4, 1.7, 1.5);
      }
    }
  }

  // a dirt lane from every farm to the nearest road
  const nearest = (v: number, list: number[]) => list.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
  const LANE = C("#6a5a48");
  const DIRT: StripOpts = { dirt: true, lamps: true };
  pendingBarns.forEach(([bx2, bz2, bq]) => barnBuilding(bx2, bz2, bq));
  ctx.farms.forEach(([x, z, q]) => {
    farmstead(x, z, q);
    if (x < -60) {
      const rz = nearest(z, ROADS_Z.filter((q) => q < RAIL_Z === z < RAIL_Z));
      makeStrip([x - 2, z], [x - 2, rz], 2.2, LANE, DIRT);
    } else {
      const rx = nearest(x, ROADS_X);
      makeStrip([x, z - 2], [rx, z - 2], 2.2, LANE, DIRT);
    }
  });

  // stadium, station and villages each get a lane to the nearest road
  makeStrip([STAD.x, PAD.z1 - 1], [STAD.x, 68], 3.6, ASPHALT, { dash: true }); // a short paved entrance onto the arterial, no traffic of its own
  makeStrip([STAD.x, PAD.z0 + 1], [STAD.x, HIGHWAY_Z + 1], 3.6, ASPHALT, { dash: true }); // and another up to the highway
  spurs.forEach(([a, b]) => makeStrip(a, b, 2.2, LANE, DIRT));
  void hillVillages; // the forest villages have no road of their own

  /* ------------------------------------------------------------------ */
  /* Stadium on the western edge of town, among the houses               */
  /* ------------------------------------------------------------------ */
  for (const cx of [-130, -114, -98]) for (const cz of [20, 36, 52]) {
    spots.push([cx, cz, 17]);
    addRoad(cx, cz, 17);
  }
  {
    const S = 0.62;
    const g = new THREE.Group();
    const gy = 0.2; // the ground here is levelled, so the pad sits flush
    g.position.set(STAD.x, gy, STAD.z);
    g.scale.setScalar(S);
    scene.add(g);
    const SB = {
      box: new Bucket(GEO.box(), trimMat),
      cyl: new Bucket(GEO.cyl(), trimMat),
      glow: new Bucket(GEO.box(), glowMat, { cast: false, receive: false }),
      cone: new Bucket(GEO.cone(), trimMat),
      ico: new Bucket(GEO.ico(), trimMat),
    };
    const y0 = 0.3;
    const mkTex = (w: number, h: number, draw: (g2: CanvasRenderingContext2D) => void) => {
      const cv = document.createElement("canvas");
      cv.width = w;
      cv.height = h;
      draw(cv.getContext("2d")!);
      const tx = new THREE.CanvasTexture(cv);
      tx.colorSpace = THREE.SRGBColorSpace;
      tx.anisotropy = 8;
      return tx;
    };
    // seats: rows with risers and aisles, tinted per tier
    const seatTex = mkTex(128, 64, (g2) => {
      g2.fillStyle = "#e4e4e8";
      g2.fillRect(0, 0, 128, 64);
      for (let y = 0; y < 64; y += 8) {
        g2.fillStyle = "rgba(0,0,0,0.3)";
        g2.fillRect(0, y + 6, 128, 2);
        for (let x = 0; x < 128; x += 10) {
          g2.fillStyle = "rgba(255,255,255,0.35)";
          g2.fillRect(x + 1, y + 1, 8, 4);
          g2.fillStyle = "rgba(0,0,0,0.14)";
          g2.fillRect(x + 8, y, 2, 6);
        }
      }
      g2.fillStyle = "rgba(0,0,0,0.28)";
      for (const ax of [30, 70, 110]) g2.fillRect(ax, 0, 4, 64);
    });
    // the outer wall: concrete panels, joints, vent slits and weathering
    const wallTex = mkTex(256, 128, (g2) => {
      g2.fillStyle = "#b9bdc8";
      g2.fillRect(0, 0, 256, 128);
      for (let k = 0; k < 900; k++) {
        g2.fillStyle = Math.random() < 0.5 ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
        g2.fillRect(Math.random() * 256, Math.random() * 128, 2, 2);
      }
      g2.fillStyle = "rgba(20,22,30,0.4)";
      for (let x = 0; x < 256; x += 32) g2.fillRect(x, 0, 2, 128);
      g2.fillRect(0, 96, 256, 3);
      g2.fillRect(0, 12, 256, 2);
      for (let x = 12; x < 256; x += 64) g2.fillRect(x, 28, 8, 46);
      const grd = g2.createLinearGradient(0, 80, 0, 128);
      grd.addColorStop(0, "rgba(40,36,30,0)");
      grd.addColorStop(1, "rgba(40,36,30,0.5)");
      g2.fillStyle = grd;
      g2.fillRect(0, 80, 256, 48);
      for (let k = 0; k < 8; k++) {
        g2.fillStyle = "rgba(60,50,40," + (0.08 + Math.random() * 0.1) + ")";
        g2.fillRect(Math.random() * 256, 14, 3 + Math.random() * 5, 20 + Math.random() * 60);
      }
    });
    const seatB = new Bucket(GEO.box(), new THREE.MeshStandardMaterial({ map: seatTex, color: 0xffffff, roughness: 0.7 }));
    const wallB = new Bucket(GEO.box(), new THREE.MeshStandardMaterial({ map: wallTex, color: 0xffffff, roughness: 0.85 }));
    SB.box.add(0, -6, 9, 100, y0 + 6, 78, C("#4f5366"));
    // the pad: asphalt with the car-park lines and arrows, a tiled plaza at the gate, a walkway with a zebra, bays, oil, puddles
    {
      const PXL = 8;
      const padTex = mkTex(100 * PXL, 78 * PXL, (g2) => {
        const X = (lx: number) => (lx + 50) * PXL;
        const Z = (lz: number) => (lz + 30) * PXL;
        g2.fillStyle = "#585d6e";
        g2.fillRect(0, 0, 100 * PXL, 78 * PXL);
        for (let k = 0; k < 11000; k++) {
          g2.fillStyle = Math.random() < 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.08)";
          g2.fillRect(Math.random() * 100 * PXL, Math.random() * 78 * PXL, 1 + Math.random() * 3, 1 + Math.random() * 3);
        }
        for (let k = 0; k < 14; k++) {
          g2.fillStyle = "rgba(0,0,0,0.12)";
          g2.fillRect(Math.random() * 90 * PXL, Math.random() * 70 * PXL, (6 + Math.random() * 14) * PXL, (3 + Math.random() * 8) * PXL);
        }
        // the gate plaza: pale paving in a grid
        g2.fillStyle = "#7d8296";
        g2.fillRect(X(-36), Z(16), 72 * PXL, 12 * PXL);
        g2.strokeStyle = "rgba(20,22,30,0.35)";
        g2.lineWidth = 1;
        for (let x = -36; x <= 36; x += 2) { g2.beginPath(); g2.moveTo(X(x), Z(16)); g2.lineTo(X(x), Z(28)); g2.stroke(); }
        for (let z = 16; z <= 28; z += 2) { g2.beginPath(); g2.moveTo(X(-36), Z(z)); g2.lineTo(X(36), Z(z)); g2.stroke(); }
        // the walkway from the lot to the gate, with a zebra crossing
        g2.fillStyle = "rgba(180,184,198,0.5)";
        g2.fillRect(X(-4), Z(28), 8 * PXL, 20 * PXL);
        g2.fillStyle = "rgba(240,240,235,0.85)";
        for (let k = 0; k < 8; k++) g2.fillRect(X(-3.6 + k * 0.95), Z(29.2), 0.55 * PXL, 2.6 * PXL);
        // south car park bays and aisle arrows
        g2.fillStyle = "rgba(240,240,235,0.85)";
        for (let row = 0; row < 4; row++) {
          const zz = 31 + row * 4.4;
          for (let k = 0; k < 20; k++) g2.fillRect(X(-42 + k * 4.4 - 2.0) - 1, Z(zz - 1.7), 3, 3.4 * PXL);
        }
        for (let x = -40; x < 40; x += 14) {
          const ax = X(x);
          const az = Z(29.6);
          g2.beginPath();
          g2.moveTo(ax, az - 6); g2.lineTo(ax + 24, az); g2.lineTo(ax, az + 6);
          g2.closePath();
          g2.fill();
        }
        // side lots
        for (const sx of [-1, 1]) for (let c2 = 0; c2 < 2; c2++) for (let k = 0; k < 11; k++) {
          const xx = sx * (38 + c2 * 4.4);
          const zz = -22 + k * 3.6;
          g2.fillRect(X(xx - 1.7), Z(zz - 1.8) - 1, 3.4 * PXL, 3);
        }
        // accessible bays in blue near the walkway, and a yellow fire lane round the edge
        g2.fillStyle = "rgba(60,120,210,0.8)";
        for (const bxx of [-7.5, 7.5]) g2.fillRect(X(bxx), Z(31.2), 2.4 * PXL, 3.2 * PXL);
        g2.strokeStyle = "rgba(230,180,34,0.8)";
        g2.lineWidth = 3;
        g2.setLineDash([22, 14]);
        g2.strokeRect(X(-48), Z(-28), 96 * PXL, 74 * PXL);
        g2.setLineDash([]);
        // oil, puddles, cracks and tyre marks
        for (let k = 0; k < 18; k++) {
          g2.fillStyle = "rgba(8,8,12," + (0.14 + Math.random() * 0.12) + ")";
          g2.beginPath();
          g2.ellipse(Math.random() * 100 * PXL, Math.random() * 78 * PXL, 8 + Math.random() * 22, 5 + Math.random() * 10, Math.random() * 3, 0, Math.PI * 2);
          g2.fill();
        }
        for (let k = 0; k < 8; k++) {
          const px = Math.random() * 100 * PXL;
          const py = Math.random() * 78 * PXL;
          const rg = g2.createRadialGradient(px, py, 2, px, py, 34);
          rg.addColorStop(0, "rgba(170,200,230,0.3)");
          rg.addColorStop(1, "rgba(170,200,230,0)");
          g2.fillStyle = rg;
          g2.beginPath();
          g2.ellipse(px, py, 34, 18, 0, 0, Math.PI * 2);
          g2.fill();
        }
        g2.strokeStyle = "rgba(15,17,25,0.35)";
        g2.lineWidth = 1;
        for (let k = 0; k < 24; k++) {
          let px = Math.random() * 100 * PXL;
          let py = Math.random() * 78 * PXL;
          g2.beginPath();
          g2.moveTo(px, py);
          for (let q = 0; q < 6; q++) { px += (Math.random() - 0.5) * 26; py += (Math.random() - 0.4) * 22; g2.lineTo(px, py); }
          g2.stroke();
        }
      });
      const padPlane = new THREE.Mesh(new THREE.PlaneGeometry(100, 78).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: padTex, roughness: 0.85, metalness: 0.05 }));
      padPlane.position.set(0, y0 + 0.03, 9);
      padPlane.receiveShadow = true;
      g.add(padPlane);
    }
    // the pitch: mown stripes, worn goalmouths and every line, lit from within at night
    {
      const PP = 24;
      const pitchTex = mkTex(25 * PP, 15 * PP, (g2) => {
        const X = (lx: number) => (lx + 12.5) * PP;
        const Z = (lz: number) => (lz + 7.5) * PP;
        for (let k = 0; k < 10; k++) {
          g2.fillStyle = k % 2 ? "#2d8f44" : "#37a350";
          g2.fillRect(k * 2.5 * PP, 0, 2.5 * PP, 15 * PP);
        }
        for (let k = 0; k < 6000; k++) {
          g2.fillStyle = Math.random() < 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.07)";
          g2.fillRect(Math.random() * 25 * PP, Math.random() * 15 * PP, 2, 2);
        }
        for (const sx of [-1, 1]) {
          g2.fillStyle = "rgba(120,100,50,0.35)";
          g2.beginPath();
          g2.ellipse(X(sx * 11.2), Z(0), 1.1 * PP, 2 * PP, 0, 0, Math.PI * 2);
          g2.fill();
        }
        g2.strokeStyle = "rgba(245,248,252,0.92)";
        g2.fillStyle = "rgba(245,248,252,0.92)";
        g2.lineWidth = 3;
        g2.strokeRect(X(-12.1), Z(-7.1), 24.2 * PP, 14.2 * PP);
        g2.beginPath();
        g2.moveTo(X(0), Z(-7.1));
        g2.lineTo(X(0), Z(7.1));
        g2.stroke();
        g2.beginPath();
        g2.arc(X(0), Z(0), 2.4 * PP, 0, Math.PI * 2);
        g2.stroke();
        g2.beginPath();
        g2.arc(X(0), Z(0), 5, 0, Math.PI * 2);
        g2.fill();
        for (const sx of [-1, 1]) {
          g2.strokeRect(sx < 0 ? X(-12.1) : X(12.1 - 3.2), Z(-4), 3.2 * PP, 8 * PP);
          g2.strokeRect(sx < 0 ? X(-12.1) : X(12.1 - 1.2), Z(-2.2), 1.2 * PP, 4.4 * PP);
          g2.beginPath();
          g2.arc(X(sx * 9.1), Z(0), 4, 0, Math.PI * 2);
          g2.fill();
          for (const sz of [-1, 1]) {
            g2.beginPath();
            g2.arc(X(sx * 12.1), Z(sz * 7.1), 0.7 * PP, 0, Math.PI * 2);
            g2.stroke();
          }
        }
      });
      const pitch = new THREE.Mesh(new THREE.PlaneGeometry(25, 15).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: pitchTex, emissiveMap: pitchTex, emissive: 0xffffff, emissiveIntensity: 0.85, roughness: 1 }));
      pitch.position.set(0, y0 + 0.06, 0);
      pitch.receiveShadow = true;
      g.add(pitch);
    }
    for (const sx of [-1, 1]) {
      SB.box.add(sx * 12, y0, -1.2, 0.12, 2.0, 0.12, C("#e9ecf4"));
      SB.box.add(sx * 12, y0, 1.2, 0.12, 2.0, 0.12, C("#e9ecf4"));
      SB.box.add(sx * 12, y0 + 2.0, 0, 0.12, 0.12, 2.5, C("#e9ecf4"));
    }
    // the bowl: tiers of seats around an ellipse, then the outer wall and a lit roof ring
    const N = 44;
    const seat = [C("#b3363a"), C("#3f6fb0"), C("#cdd2de"), C("#d9a441")];
    for (let ring = 0; ring < 3; ring++) {
      const a = 15.5 + ring * 2.6;
      const b = 10.5 + ring * 2.6;
      const hh = 1.6 + ring * 2.0;
      for (let k = 0; k < N; k++) {
        const th = (k / N) * Math.PI * 2;
        const tx = -a * Math.sin(th);
        const tz = b * Math.cos(th);
        const len = (Math.hypot(tx, tz) * ((Math.PI * 2) / N)) * 1.08;
        seatB.add(a * Math.cos(th), y0, b * Math.sin(th), len, hh, 2.7, seat[(Math.floor(k / 3) + ring) % seat.length], Math.atan2(-tz, tx));
      }
    }
    const ao = 22.2;
    const bo = 17.2;
    for (let k = 0; k < N; k++) {
      const th = (k / N) * Math.PI * 2;
      const tx = -ao * Math.sin(th);
      const tz = bo * Math.cos(th);
      const ry = Math.atan2(-tz, tx);
      const len = (Math.hypot(tx, tz) * ((Math.PI * 2) / N)) * 1.1;
      wallB.add(ao * Math.cos(th), y0, bo * Math.sin(th), len, 6.6, 1.2, C("#d4d8e2"), ry);
      SB.box.add((ao - 1.5) * Math.cos(th), y0 + 6.4, (bo - 1.5) * Math.sin(th), len, 0.3, 2.8, C("#4d5470"), ry);
      SB.glow.add((ao - 2.4) * Math.cos(th), y0 + 6.25, (bo - 2.4) * Math.sin(th), len * 0.9, 0.1, 0.4, C("#ffe6b0"), ry);
    }
    for (let k = 0; k < (ctx.mobile ? 60 : 150); k++) {
      const th = r() * Math.PI * 2;
      const ring = Math.floor(r() * 3);
      SB.glow.add((15.5 + ring * 2.6) * Math.cos(th), y0 + 1.6 + ring * 2.0 + 0.04, (10.5 + ring * 2.6) * Math.sin(th), 0.22, 0.2, 0.22, pick([C("#ffd9a0"), C("#9ec8ff"), C("#ff8a8a"), C("#ffffff")]).multiplyScalar(0.7));
    }
    // floodlight towers
    for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const px = sx * 25;
      const pz = sz * 19;
      SB.cyl.add(px, y0, pz, 0.45, 19, 0.45, C("#4d5470"));
      const ry = Math.atan2(-px, -pz);
      for (let row = 0; row < 3; row++) for (let c = -1; c <= 1; c++) {
        SB.glow.add(px + Math.cos(ry) * c * 1.1, y0 + 19.2 + row * 0.9, pz - Math.sin(ry) * c * 1.1, 0.95, 0.7, 0.3, C("#fff6e0"), ry);
      }
    }
    addLight(STAD.x, gy + 16, STAD.z, 0xfff0d8, 300, 52);
    // sign and the car park
    const tex = makeSignTexture("STADIUM", "#ff4f9a");
    const sg = new THREE.Mesh(geoBox, new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.5, 1.5, 1.5) }));
    sg.scale.set(11, 3.4, 0.4);
    sg.position.set(8, y0 + 9.2, 18.8);
    g.add(sg);
    SB.cyl.add(3.5, y0, 18.4, 0.4, 9.2, 0.4, C("#4d5470"));
    SB.cyl.add(12.5, y0, 18.4, 0.4, 9.2, 0.4, C("#4d5470"));
    // a big car park in front of the gate and two on the flanks
    const lotCar = (x: number, z: number, across: boolean) => {
      const car = pick(CARS);
      SB.box.add(x, y0 + 0.14, z, across ? 1.8 : 0.9, 0.36, across ? 0.9 : 1.8, car);
      SB.box.add(x, y0 + 0.5, z, across ? 0.95 : 0.72, 0.32, across ? 0.72 : 0.95, C("#20253a"));
    };
    for (let row = 0; row < 4; row++) {
      const z = 31 + row * 4.4;
      for (let k = 0; k < 20; k++) {
        const x = -42 + k * 4.4;
        SB.box.add(x - 2.0, y0 + 0.02, z, 0.12, 0.04, 3.4, C("#d8dbe6"));
        if (r() < 0.7) lotCar(x, z, false);
      }
    }
    for (const sx of [-1, 1]) for (let c2 = 0; c2 < 2; c2++) for (let k = 0; k < 11; k++) {
      const x = sx * (38 + c2 * 4.4);
      const z = -22 + k * 3.6;
      SB.box.add(x, y0 + 0.02, z - 1.8, 3.4, 0.04, 0.12, C("#d8dbe6"));
      if (r() < 0.65) lotCar(x, z, true);
    }
    for (let k = 0; k < 7; k++) {
      SB.cyl.add(-36 + k * 12, y0, 29, 0.12, 5, 0.12, C("#2c3040"));
      SB.glow.add(-36 + k * 12, y0 + 5, 29, 0.4, 0.14, 0.4, C("#ffc98a"));
    }
    // game day: food trucks with lit hatches and neon signs, market stalls, string lights, flags, a coach and ticket booths
    const wp = (lx: number, lz: number): [number, number] => [STAD.x + lx * S, STAD.z + lz * S];
    const truck = (x: number, z: number, hue: string, kind: number) => {
      const body = C(hue);
      SB.box.add(x, y0 + 0.5, z, 4.4, 2.3, 2.0, body);
      SB.box.add(x + 2.9, y0 + 0.5, z, 1.5, 1.5, 1.9, body.clone().multiplyScalar(0.82));
      SB.box.add(x + 3.0, y0 + 1.25, z, 1.3, 0.55, 1.95, C("#20253a"));
      SB.box.add(x + 0.5, y0 + 0.05, z, 6.2, 0.55, 1.9, C("#161a2c"));
      SB.glow.add(x - 0.3, y0 + 1.3, z - 1.02, 2.1, 0.9, 0.05, C("#ffcf8a"));
      SB.box.add(x - 0.3, y0 + 2.25, z - 1.45, 2.8, 0.08, 1.0, pick(AWN), 0, [0, 0, 0], -0.28, 0);
      SB.glow.add(x - 1.9, y0 + 2.8, z, 0.12, 0.12, 0.12, C("#ff4f9a"));
      const [sx2, sz2] = wp(x + 0.4, z + 0.4);
      signsW[kind].add(sx2, gy + (y0 + 3.6) * S, sz2, 2.1, 0.65, 0.12, new THREE.Color(1, 1, 1), 0);
    };
    const TRUCKS = ["#e8e0d0", "#d8694f", "#4fa3a5", "#d4a24c", "#8b5a8c", "#6a86d6"];
    [[-27, signIdx("TACOS")], [-18, signIdx("BURGERS")], [11, signIdx("PIZZA")], [20, signIdx("COFFEE")]].forEach(([tx, kind]) => truck(tx, 25, pick(TRUCKS), kind));
    for (const x of [-12.5, -7, 7, 12.5]) {
      for (const [dx, dz] of [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]]) SB.cyl.add(x + dx, y0, 22.6 + dz, 0.1, 2.0, 0.1, C("#e8e0d0"));
      SB.cone.add(x, y0 + 2.0, 22.6, 3.0, 1.3, 3.0, pick(AWN));
      SB.box.add(x, y0, 22.6, 2.0, 0.75, 0.9, C("#8a7a62"));
      SB.glow.add(x, y0 + 0.8, 22.6, 1.5, 0.1, 0.6, pick([C("#ffcf8a"), C("#ff8aa8"), C("#9ec8ff")]).multiplyScalar(0.7));
    }
    for (let k = 0; k <= 26; k++) {
      const x = -27 + k * 2.1;
      SB.glow.add(x, y0 + 3.2 + 0.7 * Math.pow(x / 27, 2) - 0.25 * Math.sin((k % 3) * 2), 23.4, 0.2, 0.2, 0.2, pick([C("#ffcf8a"), C("#ff8aa8"), C("#9ec8ff"), C("#ffffff")]).multiplyScalar(0.85));
    }
    for (let k = 0; k < 16; k++) {
      const th = (k / 16) * Math.PI * 2 + 0.2;
      const fx = (ao + 1.6) * Math.cos(th);
      const fz = (bo + 1.6) * Math.sin(th);
      if (fz > 13 && Math.abs(fx) < 12) continue;
      SB.cyl.add(fx, y0, fz, 0.12, 6.4, 0.12, C("#e8e0d0"));
      SB.box.add(fx + 0.6, y0 + 5.5, fz, 1.2, 0.7, 0.05, seat[k % 4]);
    }
    for (let k = 0; k < 7; k++) {
      SB.ico.add(-1.6 + (k % 4) * 1.0, y0 + 4.4 + (k % 3) * 0.55, 19.2, 0.75, 0.9, 0.75, pick([C("#ff4f6a"), C("#ffd36a"), C("#4fd8ff"), C("#6dffb0"), C("#ffffff")]));
      SB.box.add(-1.6 + (k % 4) * 1.0, y0, 19.2, 0.03, 4.0 + (k % 3) * 0.55, 0.03, C("#e8e0d0"));
    }
    // ticket booths with a sign and a coach unloading
    for (const sx of [-1, 1]) {
      SB.box.add(sx * 6.5, y0, 20.6, 2.0, 2.4, 1.6, C("#d8d2c4"));
      SB.box.add(sx * 6.5, y0 + 2.4, 20.6, 2.4, 0.15, 2.0, C("#b3363a"));
      SB.glow.add(sx * 6.5, y0 + 1.1, 19.77, 1.3, 0.7, 0.05, C("#ffcf8a"));
    }
    const [tkx, tkz] = wp(0, 21.5);
    signsW[signIdx("TICKETS")].add(tkx, gy + (y0 + 3.4) * S, tkz, 3.0, 0.93, 0.12, new THREE.Color(1, 1, 1), 0);
    SB.box.add(-36, y0 + 0.2, 40, 8, 2.6, 2.6, C("#d4a24c"));
    SB.glow.add(-36, y0 + 1.5, 38.67, 7.2, 0.7, 0.05, C("#ffcf8a"));
    SB.box.add(-36, y0 + 2.8, 40, 7.6, 0.14, 2.3, C("#e8e0d0"));
    for (const [wx3, wz3] of [[-34, 38.6], [-38, 41.4]]) SB.cyl.add(wx3, y0, wz3, 0.9, 0.5, 0.9, C("#161a2c"));
    // fans lined up at the food trucks and at the gate
    const SKIN = ["#e8c4a0", "#c99a74", "#8a5a3c", "#f0d2b4", "#a8704c"].map(C);
    const SHIRTS = [...seat, C("#e8e0d0"), C("#2f3548"), C("#4a9a8a"), C("#d8694f")];
    for (const tx of [-27, -18, 11, 20]) {
      for (let k = 0; k < 4; k++) {
        const px = tx + rr(-1.8, 1.0);
        const pz = 21.4 + rr(-0.5, 0.5);
        SB.box.add(px, y0, pz, 0.5, 1.05, 0.36, pick(SHIRTS));
        SB.ico.add(px, y0 + 1.25, pz, 0.42, 0.42, 0.42, pick(SKIN));
      }
    }
    for (let k = 0; k < 14; k++) {
      const px = rr(-5, 5);
      const pz = rr(18.4, 20.4);
      SB.box.add(px, y0, pz, 0.5, 1.05, 0.36, pick(SHIRTS));
      SB.ico.add(px, y0 + 1.25, pz, 0.42, 0.42, 0.42, pick(SKIN));
    }
    Object.values(SB).forEach((b) => b.build(g));
    seatB.build(g);
    wallB.build(g);
    // supporters walking in from the car park, in team colours, until they reach the gate
    {
      const NF = ctx.mobile ? 28 : 72;
      const fanBody = new THREE.InstancedMesh(geoBox, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }), NF);
      const fanHead = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.5, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }), NF);
      const fans = Array.from({ length: NF }, () => ({ sx: rr(-40, 40), sz: rr(30, 47), gx: rr(-3.5, 3.5), ph: r(), sp: rr(0.03, 0.05) }));
      fans.forEach((_, i) => {
        fanBody.setColorAt(i, pick(SHIRTS));
        fanHead.setColorAt(i, pick(SKIN));
      });
      [fanBody, fanHead].forEach((m) => {
        m.frustumCulled = false;
        g.add(m);
      });
      const FM = new THREE.Matrix4();
      const FQ = new THREE.Quaternion();
      const FE = new THREE.Euler();
      const FP = new THREE.Vector3();
      const FS = new THREE.Vector3();
      animated.push((t) => {
        fans.forEach((fa, i) => {
          const u = (t * fa.sp + fa.ph) % 1;
          const hide = u > 0.97;
          const gz = 17.4;
          const px = fa.sx + (fa.gx - fa.sx) * u;
          const pz = fa.sz + (gz - fa.sz) * u;
          const bob = Math.abs(Math.sin(u * 150)) * 0.12;
          FE.set(0, Math.atan2(fa.gx - fa.sx, gz - fa.sz), 0);
          FQ.setFromEuler(FE);
          FP.set(px, y0 + bob, pz);
          FS.set(hide ? 0 : 0.5, hide ? 0 : 1.05, hide ? 0 : 0.36);
          FM.compose(FP, FQ, FS);
          fanBody.setMatrixAt(i, FM);
          FP.set(px, y0 + 1.25 + bob, pz);
          FS.setScalar(hide ? 0 : 0.42);
          FM.compose(FP, FQ, FS);
          fanHead.setMatrixAt(i, FM);
        });
        fanBody.instanceMatrix.needsUpdate = true;
        fanHead.instanceMatrix.needsUpdate = true;
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /* The big bridge out to sea (east)                                    */
  /* ------------------------------------------------------------------ */
  {
    const ZB = 12; // the bridge is the continuation of the city street at z = 12
    const shore = findCoast(40, ZB, 1, 0, 0).x;
    const xs0 = shore - 4; // keeps the pier spacing
    const xStreet = findCoast(40, ZB, 1, 0, 16.5).x; // where the painted street ends and the beach begins
    const xs = xs0 - 5 * Math.ceil((xs0 - (xStreet - 2)) / 5);
    const xe = 330;
    const DECK = 11;
    const flatEnd = shore - 6;
    const ramp = (x: number) => 0.14 + (DECK - 0.14) * Math.min(1, Math.max(0, (x - flatEnd) / 58)); // level with the street across the beach, then up to the deck height
    const T1 = shore + 70;
    const T2 = shore + 150;
    const T3 = shore + 230;
    const TOPH = DECK + 34;
    for (let x = xs; x < xe; x += 5) {
      const y = ramp(x + 2.5);
      const dy = ramp(x + 5) - ramp(x);
      const ang = Math.atan2(dy, 5);
      B.box.add(x + 2.5, y - 1.1, ZB, 5.2, 1.1, 10, C("#6b7088"), 0, [0, 0, 0], 0, ang);
      B.box.add(x + 2.5, y, ZB, 5.1, 0.12, 9.6, x < flatEnd + 4 ? C("#2a2d3a") : C("#262a36"), 0, [0, 0, 0], 0, ang);
      if (Math.round((x - xs0) / 5) % 2 === 0) B.glow.add(x + 2.5, y + 0.14, ZB, 2.0, 0.04, 0.14, C("#d8d2b0"), 0, [0, 0, 0], 0, ang);
      for (const sz of [-1, 1]) {
        const tg = Math.min(1, Math.max(0, (x - (flatEnd - 8)) / 18)); // a low kerb over the sand that grows into the guard rail
        B.box.add(x + 2.5, y + 0.1, ZB + sz * 4.8, 5.1, 0.16 + 0.54 * tg, 0.35, C(tg < 0.3 ? "#4a4f63" : tg < 0.7 ? "#6b7088" : "#8e93a6"), 0, [0, 0, 0], 0, ang);
        if (tg > 0.5 && Math.round((x - xs0) / 5) % 2 === 1) B.glow.add(x + 2.5, y + 0.85, ZB + sz * 4.8, 0.3, 0.14, 0.3, C("#ffc98a"));
      }
      // piers down to the water between the towers
      if (x > shore + 4 && Math.round((x - xs0) / 5) % 6 === 0) B.cyl.add(x + 2.5, -3, ZB, 2.2, y + 2.4, 2.2, C("#6b7088"));
    }
    for (const tx of [T1, T2, T3]) {
      for (const sz of [-1, 1]) {
        B.box.add(tx, -3, ZB + sz * 5.6, 2.2, TOPH + 3, 1.6, C("#cf5d4a"));
        B.glow.add(tx, TOPH + 0.2, ZB + sz * 5.6, 0.5, 0.5, 0.5, C("#ff3a2a"));
      }
      for (const yy of [DECK + 8, DECK + 20, TOPH - 1.5]) B.box.add(tx, yy, ZB, 2.0, 1.6, 12.2, C("#cf5d4a"));
      B.box.add(tx, -3, ZB, 6.0, DECK + 2.6, 11, C("#6b7088"));
    }
    // where the street meets the bridge: a zebra crossing, a stop line and lamps along the causeway over the sand
    {
      for (let q = 0; q < 6; q++) B.box.add(xs + 3.2, 0.18, ZB - 3.6 + q * 1.4, 1.6, 0.03, 0.7, C("#d8dbe6"));
      for (const sz of [-1, 1]) B.box.add(xs + 5.6, 0.18, ZB + sz * 2.4, 0.3, 0.03, 4.4, C("#d8dbe6"));
      for (let x = xs + 10; x < shore - 4; x += 10) for (const sz of [-1, 1]) lampPost(x, 0.1, ZB + sz * 5.6, 4.4);
    }
    // main cables, hangers
    const cableY = (x: number) => {
      const spans: [number, number][] = [[shore + 5, T1], [T1, T2], [T2, T3], [T3, T3 + 70]];
      for (const [a, b] of spans) {
        if (x >= a && x <= b) {
          const mid = (a + b) / 2;
          const half = (b - a) / 2;
          const u = (x - mid) / half;
          const low = ramp(x) + 3.2;
          const topA = a === shore + 5 ? ramp(a) + 2 : TOPH;
          const topB = b === T3 + 70 ? low : TOPH;
          const edge = topA + (topB - topA) * (x - a) / (b - a);
          return low + (edge - low) * u * u + (a === shore + 5 || b === T3 + 70 ? 0 : 0);
        }
      }
      return ramp(x) + 3;
    };
    for (const sz of [-1, 1]) {
      for (let x = shore + 5; x < T3 + 70; x += 4) {
        const y1 = cableY(x);
        const y2 = cableY(x + 4);
        const ang = Math.atan2(y2 - y1, 4);
        B.box.add(x + 2, (y1 + y2) / 2 - 0.15, ZB + sz * 5.2, Math.hypot(4, y2 - y1) + 0.1, 0.3, 0.3, C("#d8dbe6"), 0, [0, 0, 0], 0, ang);
        if (Math.round(x / 4) % 2 === 0) {
          const yy = cableY(x + 2);
          const dk = ramp(x + 2);
          if (yy - dk > 1.2) B.box.add(x + 2, dk + 0.7, ZB + sz * 5.2, 0.1, yy - dk - 0.7, 0.1, C("#aeb4c4"));
        }
      }
    }
    redLight(scene, T1, TOPH + 1.2, ZB, 0.5);
    redLight(scene, T2, TOPH + 1.2, ZB, 0.5);
    redLight(scene, T3, TOPH + 1.2, ZB, 0.5);
    const len = xe - xs - 10;
    fleet(ctx.mobile ? 8 : 18, len, (s, lane) => {
      const x = xs + 5 + s;
      return { x, y: ramp(x) + 0.14, z: ZB + lane, ry: 0, rz: Math.atan2(ramp(x + 1) - ramp(x - 1), 2) };
    }, [-1.6, 1.6], 7, 12);
    addLight(shore + 60, DECK + 6, ZB, 0xffd9a0, 260, 60);
    addLight(shore + 150, DECK + 6, ZB, 0xffd9a0, 260, 60);
  }

  /* ------------------------------------------------------------------ */
  /* Container port on the north-east coast                              */
  /* ------------------------------------------------------------------ */
  const portCranes: { trolley: THREE.Object3D; hoist: THREE.Object3D; load: THREE.Object3D; ph: number }[] = [];
  {
    const { x0, x1, z0, z1 } = PORT;
    const cxm = (x0 + x1) / 2;
    const czm = (z0 + z1) / 2;
    const K = 0.62;
    spots.push([cxm, czm, 22]);
    makeStrip([x0 - 10, czm], [x0 + 5, czm], 3.6, ASPHALT, { dash: true });

    /* ---- textures: corrugated, lettered, weathered containers and a painted quay floor ---- */
    const LOGOS: [string, string][] = [["ONE SYSTEM", "#ffffff"], ["ZAPCO", "#fff3c4"], ["LEADLINE", "#e8f3ff"], ["AUTOMATE", "#ffe4d6"]];
    const contMats = LOGOS.map(([logo, ink], li) => {
      const c = document.createElement("canvas");
      c.width = 256;
      c.height = 128;
      const g = c.getContext("2d")!;
      g.fillStyle = "#e9e9ea";
      g.fillRect(0, 0, 256, 128);
      // corrugation
      for (let x = 0; x < 256; x += 8) {
        g.fillStyle = "rgba(0,0,0,0.16)";
        g.fillRect(x, 8, 3, 112);
        g.fillStyle = "rgba(255,255,255,0.22)";
        g.fillRect(x + 4, 8, 2, 112);
      }
      // top and bottom rails, corner castings
      g.fillStyle = "rgba(0,0,0,0.42)";
      g.fillRect(0, 0, 256, 8);
      g.fillRect(0, 120, 256, 8);
      for (const cx2 of [0, 244]) {
        g.fillRect(cx2, 0, 12, 14);
        g.fillRect(cx2, 114, 12, 14);
      }
      // the door end: locking rods and hinges
      g.fillStyle = "rgba(0,0,0,0.3)";
      for (let x = 188; x < 248; x += 7) g.fillRect(x, 14, 2, 100);
      g.fillRect(188, 62, 60, 3);
      // lettering
      g.font = "800 30px Arial, sans-serif";
      g.fillStyle = ink;
      g.shadowColor = "rgba(0,0,0,0.5)";
      g.shadowBlur = 3;
      g.fillText(logo, 14, 62);
      g.shadowBlur = 0;
      g.font = "600 10px monospace";
      g.fillStyle = "rgba(0,0,0,0.6)";
      g.fillText("NMXU " + (482910 + li * 7331) + " 4   22G1", 14, 106);
      g.fillText("MAX GROSS 30480 KG", 14, 92);
      // rust streaks and dents
      for (let k = 0; k < 14; k++) {
        const rx = Math.random() * 256;
        g.fillStyle = "rgba(120,60,20," + (0.06 + Math.random() * 0.12) + ")";
        g.fillRect(rx, 8, 2 + Math.random() * 4, 20 + Math.random() * 60);
      }
      for (let k = 0; k < 6; k++) {
        g.fillStyle = "rgba(255,255,255,0.12)";
        g.fillRect(Math.random() * 230, 20 + Math.random() * 80, 14 + Math.random() * 20, 6 + Math.random() * 10);
      }
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      return new THREE.MeshStandardMaterial({ map: tex, color: 0xffffff, roughness: 0.72, metalness: 0.2 });
    });
    const contB = contMats.map((m) => new Bucket(GEO.box(), m));
    const cont = (x: number, y: number, z: number, len: number, h: number, dd: number, hex: string | THREE.Color, ry = 0) => contB[Math.floor(r() * contB.length)].add(x, y, z, len, h, dd, typeof hex === "string" ? C(hex) : hex, ry);
    const contMesh = (parent: THREE.Object3D, hex: string, w: number, h: number, d: number, x: number, y: number, z: number) => {
      const m = new THREE.Mesh(geoBox, contMats[Math.floor(r() * contMats.length)].clone());
      (m.material as THREE.MeshStandardMaterial).color = C(hex);
      m.scale.set(w, h, d);
      m.position.set(x, y, z);
      m.castShadow = true;
      parent.add(m);
      return m;
    };

    // the quay: concrete slab, then a floor painted with slabs, lanes, stack pads, hazard stripes, rails, puddles and stains
    B.box.add(cxm, -1.6, czm, x1 - x0, 2.5, z1 - z0, C("#4f5366"));
    const PX = 20;
    {
      const c = document.createElement("canvas");
      c.width = (x1 - x0) * PX;
      c.height = (z1 - z0) * PX;
      const g = c.getContext("2d")!;
      const X = (wx: number) => (wx - x0) * PX;
      const Z = (wz: number) => (wz - z0) * PX;
      g.fillStyle = "#666b7c";
      g.fillRect(0, 0, c.width, c.height);
      for (let k = 0; k < 5200; k++) {
        g.fillStyle = Math.random() < 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.07)";
        g.fillRect(Math.random() * c.width, Math.random() * c.height, 1 + Math.random() * 3, 1 + Math.random() * 3);
      }
      // slab joints and cracks
      g.strokeStyle = "rgba(15,17,25,0.4)";
      g.lineWidth = 2;
      for (let x = x0; x <= x1; x += 6) { g.beginPath(); g.moveTo(X(x), 0); g.lineTo(X(x), c.height); g.stroke(); }
      for (let z = z0; z <= z1; z += 6) { g.beginPath(); g.moveTo(0, Z(z)); g.lineTo(c.width, Z(z)); g.stroke(); }
      g.lineWidth = 1;
      for (let k = 0; k < 16; k++) {
        let px = Math.random() * c.width;
        let py = Math.random() * c.height;
        g.beginPath();
        g.moveTo(px, py);
        for (let q = 0; q < 6; q++) { px += (Math.random() - 0.5) * 30; py += (Math.random() - 0.3) * 24; g.lineTo(px, py); }
        g.stroke();
      }
      // stack pads with white corner marks
      for (let ix = 0; ix < 3; ix++) for (let iz = 0; iz < 5; iz++) {
        if (iz === 2) continue;
        const sx = X(x0 + 6 + ix * 6.2);
        const sz = Z(z0 + 3 + iz * 4.6);
        g.fillStyle = "rgba(15,17,25,0.28)";
        g.fillRect(sx - 3.1 * PX, sz - 1.6 * PX, 6.2 * PX, 3.2 * PX);
        g.strokeStyle = "rgba(240,240,240,0.8)";
        g.lineWidth = 3;
        for (const [ax, az] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          g.beginPath();
          g.moveTo(sx + ax * 3.1 * PX, sz + az * 1.6 * PX - az * 18);
          g.lineTo(sx + ax * 3.1 * PX, sz + az * 1.6 * PX);
          g.lineTo(sx + ax * 3.1 * PX - ax * 24, sz + az * 1.6 * PX);
          g.stroke();
        }
      }
      // the access lane: darker asphalt, dashed centre line, arrows and stop bars
      g.fillStyle = "rgba(34,37,48,0.7)";
      g.fillRect(0, Z(czm) - 1.9 * PX, X(x1 - 8), 3.8 * PX);
      g.fillStyle = "rgba(235,235,225,0.85)";
      for (let x = 0; x < X(x1 - 8); x += 46) g.fillRect(x, Z(czm) - 2, 26, 4);
      g.fillRect(X(x0 + 4), Z(czm) - 1.9 * PX, 6, 3.8 * PX);
      g.beginPath();
      g.moveTo(X(x0 + 9), Z(czm) - 1.4 * PX); g.lineTo(X(x0 + 9) + 38, Z(czm) - 1.4 * PX + 10); g.lineTo(X(x0 + 9), Z(czm) - 1.4 * PX + 20);
      g.closePath();
      g.fill();
      // hazard stripes along the quay edge and a yellow safety line
      const hx = X(x1 - 1.5);
      for (let k = -6; k < c.height / 16 + 6; k++) {
        g.fillStyle = "#e6b422";
        g.beginPath();
        g.moveTo(hx, k * 16); g.lineTo(hx + 12, k * 16); g.lineTo(hx + 12 + 30, k * 16 + 16); g.lineTo(hx + 30, k * 16 + 16);
        g.closePath();
        g.fill();
      }
      g.fillStyle = "rgba(20,22,28,0.35)";
      g.fillRect(hx, 0, 30, c.height);
      g.fillStyle = "#e6b422";
      g.fillRect(hx - 8, 0, 5, c.height);
      // crane rails with sleepers
      for (const rx of [x1 - 2 - 3 * K, x1 - 2 + 3 * K]) {
        g.fillStyle = "rgba(60,64,78,0.9)";
        g.fillRect(X(rx) - 4, 0, 8, c.height);
        g.fillStyle = "rgba(190,195,210,0.9)";
        g.fillRect(X(rx) - 1.5, 0, 3, c.height);
        for (let z = 0; z < c.height; z += 20) { g.fillStyle = "rgba(30,26,22,0.6)"; g.fillRect(X(rx) - 12, z, 24, 5); }
      }
      // numbered rows, drains, oil, tyre marks, puddles
      g.font = "700 30px Arial, sans-serif";
      g.fillStyle = "rgba(245,245,240,0.6)";
      for (let iz = 0; iz < 5; iz++) if (iz !== 2) g.fillText("A" + (iz + 1), X(x0 + 0.8), Z(z0 + 3 + iz * 4.6) + 10);
      for (let k = 0; k < 7; k++) {
        const gx = Math.random() * c.width;
        const gz = Math.random() * c.height;
        g.fillStyle = "rgba(10,10,14,0.7)";
        g.fillRect(gx, gz, 26, 14);
        g.fillStyle = "rgba(90,95,110,0.8)";
        for (let q = 0; q < 5; q++) g.fillRect(gx + 3 + q * 5, gz + 2, 2, 10);
      }
      for (let k = 0; k < 9; k++) {
        g.fillStyle = "rgba(8,8,12," + (0.14 + Math.random() * 0.12) + ")";
        g.beginPath();
        g.ellipse(Math.random() * c.width, Math.random() * c.height, 12 + Math.random() * 30, 6 + Math.random() * 14, Math.random() * 3, 0, Math.PI * 2);
        g.fill();
      }
      g.strokeStyle = "rgba(10,10,14,0.22)";
      g.lineWidth = 6;
      for (let k = 0; k < 8; k++) {
        const ty = Math.random() * c.height;
        g.beginPath();
        g.moveTo(0, ty);
        g.bezierCurveTo(c.width * 0.3, ty + 30, c.width * 0.6, ty - 30, c.width * 0.9, ty + 10);
        g.stroke();
      }
      for (let k = 0; k < 7; k++) {
        const pxx = Math.random() * c.width;
        const pyy = Math.random() * c.height;
        const rg = g.createRadialGradient(pxx, pyy, 2, pxx, pyy, 40);
        rg.addColorStop(0, "rgba(170,200,230,0.34)");
        rg.addColorStop(1, "rgba(170,200,230,0)");
        g.fillStyle = rg;
        g.beginPath();
        g.ellipse(pxx, pyy, 40, 22, 0, 0, Math.PI * 2);
        g.fill();
      }
      const floorTex = new THREE.CanvasTexture(c);
      floorTex.colorSpace = THREE.SRGBColorSpace;
      floorTex.anisotropy = 8;
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.82, metalness: 0.05 }));
      floor.position.set(cxm, 0.915, czm);
      floor.receiveShadow = true;
      scene.add(floor);
    }
    B.box.add(x1 - 0.3, 0.85, czm, 0.6, 0.2, z1 - z0, C("#8a8fa0")); // kerb
    // bollards, tyre fenders and ladders along the quay edge
    for (let q = 0; q < 7; q++) {
      const bz = z0 + 1.5 + q * 3.5;
      B.cyl.add(x1 - 0.9, 0.9, bz, 0.4, 0.5, 0.4, C("#e6b422"));
      B.cyl.add(x1 + 0.12, 0.2, bz + 0.9, 0.5, 0.6, 0.5, C("#161a2c"), 0, [0, 0, 0], 0, Math.PI / 2);
    }
    B.box.add(x1 + 0.08, -1.4, czm - 6, 0.08, 2.4, 0.4, C("#c9ced9"));

    // containers: textured, in stacks of one or two
    for (let ix = 0; ix < 3; ix++) {
      for (let iz = 0; iz < 5; iz++) {
        if (iz === 2) continue; // the access road runs through the middle
        const x = x0 + 6 + ix * 6.2;
        const z = z0 + 3 + iz * 4.6;
        const h = 1 + Math.floor(r() * 2);
        for (let lv = 0; lv < h; lv++) cont(x, 0.92 + lv * 2.6, z, 5.4, 2.55, 2.3, pick(BOXES));
      }
    }
    // a gate house with a barrier arm, a chain-link fence, cones and pallets
    B.box.add(x0 + 1.4, 0.92, czm + 3.2, 1.8, 2.4, 1.8, C("#d8d2c4"));
    B.box.add(x0 + 1.4, 3.3, czm + 3.2, 2.2, 0.16, 2.2, C("#4d5470"));
    B.glow.add(x0 + 1.4, 1.6, czm + 2.28, 1.2, 0.7, 0.05, C("#ffcf8a"));
    B.box.add(x0 + 2.6, 0.92, czm - 1.8, 0.14, 1.0, 0.14, C("#2c3040"));
    for (let k = 0; k < 4; k++) B.box.add(x0 + 2.6, 1.4, czm - 1.8 + k * 0.4 - 0.2, 0.1, 0.12, 0.45, k % 2 ? C("#e8e0d0") : C("#b3363a"));
    for (let k = 0; k < 7; k++) {
      B.cone.add(x0 + 3.2, 0.92, czm - 3.1 + k * 1.0, 0.35, 0.6, 0.35, C("#ff7a2a"));
      B.cone.add(x0 + 3.2, 1.4, czm - 3.1 + k * 1.0, 0.2, 0.12, 0.2, C("#e8e0d0"));
    }
    for (let k = 0; k <= 12; k++) {
      B.cyl.add(x0 + k * 2.9, 0.92, z0 + 0.2, 0.1, 1.9, 0.1, C("#8e93a6"));
      B.box.add(x0 + k * 2.9 + 1.45, 1.1, z0 + 0.2, 2.9, 1.2, 0.03, C("#aeb4c4"));
    }
    for (let k = 0; k < 5; k++) B.box.add(x0 + 22 + (k % 3) * 1.4, 0.92 + Math.floor(k / 3) * 0.2, z1 - 2 - Math.floor(k / 3) * 0.2, 1.2, 0.18, 1.0, C("#a8854a"));

    // the port office: two floors, framed windows, a flag, a radar dish and a tall PORT sign
    B.box.add(x0 + 3, 0.92, z1 - 2.8, 5.6, 5.0, 3.2, C("#8e93a6"));
    B.box.add(x0 + 3, 5.92, z1 - 2.8, 6.0, 0.25, 3.6, C("#4d5470"));
    for (let k = 0; k < 4; k++) for (let fl = 0; fl < 2; fl++) {
      B.box.add(x0 + 1.2 + k * 1.4, 1.8 + fl * 2.2, z1 - 1.18, 0.9, 1.1, 0.05, C("#e8e0d0"));
      B.glow.add(x0 + 1.2 + k * 1.4, 1.9 + fl * 2.2, z1 - 1.14, 0.75, 0.9, 0.05, C(k === 2 && fl === 0 ? "#9ec8ff" : "#ffd9a0").multiplyScalar(0.8));
    }
    B.box.add(x0 + 3, 0.92, z1 - 1.14, 1.0, 1.8, 0.07, C("#6b3f2f"));
    signsW[signIdx("PORT")].add(x0 + 3, 6.7, z1 - 1.0, 3.2, 0.99, 0.12, new THREE.Color(1, 1, 1), 0);
    B.cyl.add(x0 + 5.2, 6.2, z1 - 3.6, 0.08, 3.4, 0.08, C("#e8e0d0"));
    B.box.add(x0 + 5.6, 8.9, z1 - 3.6, 0.9, 0.55, 0.04, C("#3f6fb0"));
    B.cyl.add(x0 + 1.2, 6.2, z1 - 3.6, 0.2, 1.4, 0.2, C("#c9ced9"));
    B.box.add(x0 + 1.2, 7.5, z1 - 3.6, 1.6, 0.08, 0.9, C("#dfe3ee"), 0, [0, 0, 0], -0.5, 0);
    // a warehouse with roll-up dock doors, ribbed roof and vents
    B.box.add(x0 + 13, 0.92, z1 - 2.4, 11, 3.6, 3.6, C("#7a8094"));
    B.gab.add(x0 + 13, 4.5, z1 - 2.4, 11.4, 1.2, 4.0, C("#4d5470"));
    for (let k = 0; k < 12; k++) B.box.add(x0 + 8 + k * 0.9, 4.55, z1 - 2.4, 0.06, 0.1, 3.9, C("#3a3f50"));
    for (let k = 0; k < 4; k++) {
      B.glow.add(x0 + 9.2 + k * 2.4, 0.95, z1 - 0.57, 1.7, 2.1, 0.05, C("#ffbf78").multiplyScalar(0.7));
      for (let q = 0; q < 6; q++) B.box.add(x0 + 9.2 + k * 2.4, 1.0 + q * 0.34, z1 - 0.53, 1.72, 0.04, 0.03, C("#6b7088"));
    }
    for (let k = 0; k < 3; k++) B.cyl.add(x0 + 9.5 + k * 3.2, 5.7, z1 - 2.4, 0.5, 0.5, 0.5, C("#aeb4c4"));
    // fuel tanks, a forklift and two container trucks
    for (let k = 0; k < 2; k++) {
      B.cyl.add(x1 - 8 + k * 2.6, 0.92, z0 + 3.6, 2.2, 3.0, 2.2, C("#c9ced9"));
      B.cyl.add(x1 - 8 + k * 2.6, 3.92, z0 + 3.6, 2.3, 0.15, 2.3, C("#8e93a6"));
    }
    B.box.add(x0 + 20, 0.92, z1 - 5, 1.1, 0.7, 0.8, C("#e6b422"));
    B.box.add(x0 + 20.8, 0.92, z1 - 5, 0.12, 1.7, 0.5, C("#2c3040"));
    B.box.add(x0 + 19.6, 1.6, z1 - 5, 0.8, 0.9, 0.7, C("#161a2c"));
    B.glow.add(x0 + 21.0, 1.2, z1 - 5, 0.05, 0.18, 0.4, C("#fff6dc"));
    B.glow.add(x0 + 19.6, 2.55, z1 - 5, 0.2, 0.12, 0.2, C("#ff9a2a"));
    for (const [tx, tz] of [[x0 + 11, czm - 0.7], [x0 + 24, czm + 0.7]]) {
      B.box.add(tx, 1.0, tz, 1.8, 1.7, 1.2, C("#d9a441"));
      B.box.add(tx + 0.5, 1.9, tz, 0.7, 0.6, 1.0, C("#20253a"));
      B.box.add(tx - 3.4, 0.98, tz, 6.2, 0.35, 1.1, C("#161a2c"));
      cont(tx - 3.4, 1.33, tz, 5.4, 2.55, 2.3, pick(BOXES));
      B.glow.add(tx + 0.93, 1.5, tz - 0.4, 0.05, 0.2, 0.3, C("#fff6dc"));
      B.glow.add(tx + 0.93, 1.5, tz + 0.4, 0.05, 0.2, 0.3, C("#fff6dc"));
    }

    /* ---- the gantry cranes: trusses, ladders, a machinery house, an operator cab, stays and twin hoist cables ---- */
    const pstrut = (parent: THREE.Object3D, hex: string, a: [number, number, number], b2: [number, number, number], t: number) => {
      const m = new THREE.Mesh(geoBox, std(hex, 0.6, 0.25));
      const dir = new THREE.Vector3(b2[0] - a[0], b2[1] - a[1], b2[2] - a[2]);
      const len = dir.length();
      m.position.set(a[0], a[1], a[2]);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
      m.scale.set(t, len, t);
      parent.add(m);
      return m;
    };
    const crane = (z: number, ph: number) => {
      const g = new THREE.Group();
      g.position.set(x1 - 2, 0.92, z);
      g.scale.setScalar(K);
      scene.add(g);
      const col = "#d46a3e";
      const dark = "#9a4a2c";
      for (const lx of [-3, 3]) for (const lz of [-4, 4]) {
        bx(g, col, 0.9, 25, 0.9, lx, 0, lz);
        bx(g, "#e6b422", 0.96, 1.4, 0.96, lx, 0, lz);
        bx(g, "#161a2c", 0.5, 1.4, 0.5, lx, 0.35, lz).scale.set(0.5, 0.35, 0.5);
      }
      for (const lz of [-4, 4]) {
        bx(g, col, 8, 1.1, 1.0, 0, 25, lz);
        pstrut(g, dark, [-3, 2, lz], [3, 14, lz], 0.28);
        pstrut(g, dark, [3, 2, lz], [-3, 14, lz], 0.28);
        pstrut(g, dark, [-3, 14, lz], [3, 25, lz], 0.28);
        pstrut(g, dark, [3, 14, lz], [-3, 25, lz], 0.28);
        for (let yy = 1.2; yy < 24; yy += 1.1) bx(g, "#c9ced9", 0.06, 0.06, 0.5, -3.5, yy, lz).visible = false;
      }
      for (const lx of [-3, 3]) {
        pstrut(g, dark, [lx, 4, -4], [lx, 4, 4], 0.3);
        pstrut(g, dark, [lx, 14, -4], [lx, 14, 4], 0.3);
        for (let yy = 1.5; yy < 24; yy += 1.0) bx(g, "#c9ced9", 0.8, 0.07, 0.07, lx, yy, -4.5);
      }
      // the boom: a box girder with a top chord, posts and diagonals, out over the water
      bx(g, col, 38, 1.2, 1.4, 11, 25.2, 0);
      bx(g, dark, 38, 0.14, 1.5, 11, 26.5, 0);
      for (let q = -8; q < 30; q += 2) {
        bx(g, dark, 0.14, 1.3, 0.14, q, 25.4, 0.78);
        bx(g, dark, 0.14, 1.3, 0.14, q, 25.4, -0.78);
        pstrut(g, dark, [q, 26.5, 0.8], [q + 2, 25.3, 0.8], 0.1);
        pstrut(g, dark, [q, 26.5, -0.8], [q + 2, 25.3, -0.8], 0.1);
      }
      bx(g, col, 8, 1.6, 9.6, 0, 24.4, 0);
      // stays from the tower head to the boom
      pstrut(g, "#aeb4c4", [0, 31, 0], [24, 26.4, 0], 0.1);
      pstrut(g, "#aeb4c4", [0, 31, 0], [-8, 26.4, 0], 0.1);
      pstrut(g, col, [-2, 26.4, 0], [0, 31, 0], 0.4);
      pstrut(g, col, [2, 26.4, 0], [0, 31, 0], 0.4);
      // machinery house with a lit window, vents and a beacon
      bx(g, "#e8e0d0", 3.4, 2.0, 2.6, -2.6, 26.7, 2.2);
      gl(g, "#ffd9a0", 1.2, 0.7, 0.05, -2.6, 27.2, 3.52, 1.8);
      bx(g, "#4d5470", 0.7, 0.5, 0.7, -3.4, 28.7, 2.2);
      const trolley = new THREE.Group();
      trolley.position.set(14, 25.6, 0);
      g.add(trolley);
      bx(trolley, "#2c3040", 2.6, 1.0, 2.6, 0, 0, 0);
      bx(trolley, "#e6b422", 2.7, 0.18, 2.7, 0, 0.9, 0);
      // the operator's cab hangs under the trolley
      bx(trolley, "#e8e0d0", 1.4, 1.3, 1.4, 1.9, -1.8, 0);
      gl(trolley, "#9ec8ff", 0.05, 0.6, 1.0, 2.62, -1.4, 0, 1.4);
      const hoist = new THREE.Group();
      hoist.position.set(0, -14, 0);
      trolley.add(hoist);
      for (const sx of [-0.85, 0.85]) for (const sz of [-0.6, 0.6]) mesh(hoist, geoBox, std("#aeb4c4", 0.5, 0.5), 0.07, 1, 0.07, sx, 0, sz, 0, false);
      const load = new THREE.Group();
      load.position.set(0, -15.2, 0);
      trolley.add(load);
      bx(load, "#2c3040", 3.2, 0.3, 2.5, 0, 0, 0);
      for (const sx of [-1.5, 1.5]) for (const sz of [-1.1, 1.1]) gl(load, "#ffd36a", 0.22, 0.22, 0.22, sx, -0.02, sz, 2.2);
      contMesh(load, pick(BOXES).getStyle(), 5.4 * 0.5, 2.55 * 0.86, 2.3 * 0.9, 0, -2.2, 0);
      redLight(g, 11, 27.1, 0, 0.5);
      redLight(g, 30, 26.8, 0, 0.5);
      redLight(g, 0, 31.4, 0, 0.5);
      gl(g, "#fff6e0", 1.0, 0.5, 0.4, 0, 26.9, 4.6, 2.6);
      for (let q = 0; q < 8; q++) gl(g, "#fff3d0", 0.5, 0.1, 0.1, 4 + q * 3.4, 24.6, 0, 1.4);
      portCranes.push({ trolley, hoist, load, ph });
    };
    crane(czm - 3.8, 0.2);
    crane(czm + 3.8, 0.7);
    for (const z of [z0 + 2.5, z1 - 2.5]) {
      B.cyl.add(x0 + 16, 0.92, z, 0.25, 10, 0.25, C("#4d5470"));
      for (let c = -1; c <= 1; c++) B.glow.add(x0 + 16.3, 10.3, z + c * 0.7, 0.35, 0.5, 0.6, C("#fff6e0"), 2.4);
    }
    addLight(cxm + 2, 10, czm, 0xffe0b0, 240, 36);

    /* ---- the ship alongside: ribbed hull, waterline band, portholes, textured deck cargo ---- */
    const ship = new THREE.Group();
    ship.position.set(x1 + 4.9, 0, czm);
    ship.scale.setScalar(K);
    scene.add(ship);
    bx(ship, "#2d3a5a", 11, 4.2, 44, 0, -1.8, 0);
    bx(ship, "#b3363a", 11.2, 0.8, 44.2, 0, -1.8, 0);
    bx(ship, "#1b2236", 11.1, 0.4, 44.1, 0, 2.0, 0);
    bx(ship, "#2d3a5a", 6, 4.2, 6, 0, -1.8, 24.5).rotation.y = Math.PI / 4;
    for (let k = -9; k <= 9; k++) for (const sx of [-1, 1]) bx(ship, "#222d48", 0.08, 3.4, 0.2, sx * 5.54, -1.4, k * 2.2);
    for (let k = -8; k <= 8; k++) for (const sx of [-1, 1]) gl(ship, "#ffd9a0", 0.05, 0.22, 0.22, sx * 5.52, 0.9, k * 2.4, 1.2);
    bx(ship, "#dfe3ee", 8, 5.5, 7, 0, 2.4, -16);
    bx(ship, "#dfe3ee", 6.5, 2.4, 5, 0, 7.9, -16);
    bx(ship, "#1b2236", 6.7, 0.9, 5.1, 0, 8.5, -16);
    gl(ship, "#9ec8ff", 6.2, 0.5, 0.05, 0, 8.6, -13.46, 1.5);
    bx(ship, "#b3363a", 2.4, 4.2, 2.4, 0, 10.3, -17.5);
    bx(ship, "#e8e0d0", 2.5, 0.5, 2.5, 0, 12.0, -17.5);
    bx(ship, "#c9ced9", 0.12, 3.4, 0.12, 2.0, 10.3, -15.6);
    bx(ship, "#c9ced9", 2.0, 0.1, 0.1, 2.0, 13.4, -15.6);
    for (let k = -2; k <= 2; k++) for (const sx of [-1, 1]) gl(ship, "#ffd9a0", 0.06, 0.8, 0.9, sx * 4.03, 4.6, -16 + k * 1.3, 1.8);
    for (let ix = 0; ix < 2; ix++) for (let iz = 0; iz < 5; iz++) {
      const h = 1 + Math.floor(r() * 3);
      for (let lv = 0; lv < h; lv++) contMesh(ship, pick(BOXES).getStyle(), 4.2, 2.5, 5.6, -2.6 + ix * 5.2, 2.4 + lv * 2.6, -4 + iz * 6.8);
    }
    bx(ship, "#4d5470", 0.5, 0.5, 0.5, 0, 2.2, 22).scale.set(0.5, 1.2, 0.5);
    redLight(ship, 0, 12.8 + 1.2, -17.5, 0.4);
    gl(ship, "#9affc0", 0.3, 0.3, 0.3, -5.6, 3.6, 21, 2.4);
    gl(ship, "#ff5a4a", 0.3, 0.3, 0.3, 5.6, 3.6, 21, 2.4);
    animated.push((t) => {
      ship.position.y = Math.sin(t * 0.6) * 0.1;
      ship.rotation.z = Math.sin(t * 0.45) * 0.008;
    });
    contB.forEach((cb) => cb.build(scene));
  }
  animated.push((t) => {
    portCranes.forEach((c) => {
      const u = 0.5 + 0.5 * Math.sin(t * 0.18 + c.ph * 6);
      c.trolley.position.x = 6 + u * 22;
      const drop = 0.5 + 0.5 * Math.sin(t * 0.36 + c.ph * 9);
      const len = 3 + drop * 17;
      c.hoist.scale.y = len;
      c.hoist.position.y = -len + 0.3;
      c.load.position.y = -len - 1.2;
    });
  });

  /* ------------------------------------------------------------------ */
  /* Construction cranes (placed by the city generator)                  */
  /* ------------------------------------------------------------------ */
  const towerCranes: THREE.Object3D[] = [];
  ctx.plan.cranes.forEach((c, idx) => {
    const g = new THREE.Group();
    g.position.set(c.x, 0, c.z);
    scene.add(g);
    const H = c.h + 6;
    bx(g, "#d4a24c", 0.8, H, 0.8, 0, 0, 0);
    for (let yy = 1; yy < H - 1; yy += 2.6) bx(g, "#b88a3c", 1.05, 0.12, 1.05, 0, yy, 0);
    const top = new THREE.Group();
    top.position.set(0, H, 0);
    g.add(top);
    bx(top, "#d4a24c", 22, 0.7, 0.8, 5, 0.6, 0);
    bx(top, "#b88a3c", 20, 0.15, 0.2, 5, 1.5, 0.3);
    bx(top, "#d4a24c", 0.8, 3.2, 0.8, 0, 1.3, 0);
    bx(top, "#9ea5b8", 1.8, 1.4, 1.6, -5.4, -0.6, 0);
    bx(top, "#1b2236", 1.2, 1.2, 1.1, 1.2, 1.3, 0);
    const trol = bx(top, "#2c3040", 1.0, 0.5, 1.0, 9, 0.2, 0);
    const rope = bx(top, "#aeb4c4", 0.08, 8, 0.08, 9, -8, 0);
    bx(top, "#d4a24c", 0.5, 0.6, 0.5, 9, -8.5, 0);
    redLight(top, 0, 4.7, 0, 0.35);
    redLight(top, 15.5, 0.9, 0, 0.3);
    void trol;
    void rope;
    towerCranes.push(top);
    top.userData.ph = idx * 1.7;
  });
  animated.push((t) => towerCranes.forEach((c) => (c.rotation.y = Math.sin(t * 0.09 + (c.userData.ph as number)) * 1.5 + (c.userData.ph as number))));

  /* ------------------------------------------------------------------ */
  /* The grid keeps going: streets and houses thinning out into the fields */
  /* ------------------------------------------------------------------ */
  {
    const road = C("#2a2d3a");
    const populated = new Set<string>();
    const cells: [number, number, number][] = [];
    for (let i = -17; i <= 8; i++) {
      for (let j = -8; j <= 15; j++) {
        const cx = i * 8;
        const cz = j * 8;
        const d = Math.max(-cx - 64, cz - 64);
        if (d <= 0 || d > 60) continue;
        if (landL(cx, cz) < 18 || landL(cx, cz) > 400) continue;
        if (cx > 64) continue;
        if (Math.abs(cz - RAIL_Z) < 10 && cx < -60) continue;
        if (cz <= 64 && Math.abs(cz - STAD.z) < 26 && cx < STAD.x) continue;
        if (!free(cx, cz, 4)) continue;
        if (inPad(cx, cz, 6.5)) continue; // never over the stadium or its lots
        if (cx < -60 && ROADS_Z.some((rz) => Math.abs(cz - rz) < 7)) continue; // nothing is built against the avenues that leave town
        if (cz > 64 && ROADS_X.some((rx) => Math.abs(cx - rx) < 7)) continue;
        if (coastPts.some(([px, pz]) => Math.hypot(px - cx, pz - cz) < 6.2)) continue; // nor over the coast road
        if (d > 28) continue; // a compact, complete ring of streets and houses: no scattered outliers and loops of bare road
        cells.push([cx, cz, d]);
        populated.add(i + "," + j);
      }
    }
    const y0 = (cx: number, cz: number) => Math.max(0.14, hmax(cx, cz, 3) + 0.05);
    // streets live on the nodes (4 + 8a, 4 + 8b): every block borders four streets, and each one is chained back to the city
    const edges = new Map<string, [number, number, number, number]>();
    const addEdge = (a1: number, b1: number, a2: number, b2: number) => edges.set(a1 + "," + b1 + "," + a2 + "," + b2, [a1, b1, a2, b2]);
    cells.forEach(([cx, cz]) => {
      const i = cx / 8;
      const j = cz / 8;
      addEdge(i - 1, j - 1, i, j - 1);
      addEdge(i, j - 1, i, j);
      addEdge(i - 1, j, i, j);
      addEdge(i - 1, j - 1, i - 1, j);
      if (j <= 8) for (let a = i; a <= -9; a++) addEdge(a, j, a + 1, j);
      else for (let b = j; b >= 9; b--) addEdge(i, b - 1, i, b);
    });
    // only streets that will really be drawn count: the avenues, the stadium lot and the coast road already cover some of them
    const drawable = (a1: number, b1: number, a2: number, b2: number) => {
      const x1 = 4 + 8 * a1;
      const z1 = 4 + 8 * b1;
      const horiz = b1 === b2;
      if (horiz && x1 < -66 && ROADS_Z.includes(z1)) return false;
      if (!horiz && z1 > 68 && ROADS_X.includes(x1)) return false;
      const mx = (x1 + 4 + 8 * a2) / 2;
      const mz = (z1 + 4 + 8 * b2) / 2;
      if (coastPts.some(([px, pz]) => Math.hypot(px - mx, pz - mz) < 3.3)) return false;
      if (inPad(mx, mz, 3)) return false;
      return true;
    };
    edges.forEach(([a1, b1, a2, b2], k) => {
      if (!drawable(a1, b1, a2, b2)) edges.delete(k);
    });
    // where a street may legitimately end: on the painted city streets, or on an avenue
    const anchored = (a: number, b: number) => (a >= -8 && b <= 8) || (a <= -9 && ROADS_Z.includes(4 + 8 * b)) || (b >= 8 && ROADS_X.includes(4 + 8 * a));
    // every street must lead to the city or an avenue: whole groups that do not are removed, then spurs that end in the grass
    {
      const parent = new Map<string, string>();
      const find = (k: string): string => {
        let p = parent.get(k) ?? k;
        if (p !== k) {
          p = find(p);
          parent.set(k, p);
        }
        return p;
      };
      const union = (k1: string, k2: string) => parent.set(find(k1), find(k2));
      edges.forEach(([a1, b1, a2, b2]) => union(a1 + "," + b1, a2 + "," + b2));
      const good = new Set<string>();
      edges.forEach(([a1, b1, a2, b2]) => {
        if (anchored(a1, b1)) good.add(find(a1 + "," + b1));
        if (anchored(a2, b2)) good.add(find(a2 + "," + b2));
      });
      edges.forEach(([a1, b1], k) => {
        if (!good.has(find(a1 + "," + b1))) edges.delete(k);
      });
      const deg = new Map<string, number>();
      const bump = (a: number, b: number, v: number) => deg.set(a + "," + b, (deg.get(a + "," + b) ?? 0) + v);
      edges.forEach(([a1, b1, a2, b2]) => {
        bump(a1, b1, 1);
        bump(a2, b2, 1);
      });
      for (let pass = 0; pass < 12; pass++) {
        let changed = false;
        edges.forEach(([a1, b1, a2, b2], k) => {
          const d1 = deg.get(a1 + "," + b1) ?? 0;
          const d2 = deg.get(a2 + "," + b2) ?? 0;
          if ((d1 <= 1 && !anchored(a1, b1)) || (d2 <= 1 && !anchored(a2, b2))) {
            edges.delete(k);
            bump(a1, b1, -1);
            bump(a2, b2, -1);
            changed = true;
          }
        });
        if (!changed) break;
      }
    }
    edges.forEach(([a1, b1, a2, b2]) => {
      const x1 = 4 + 8 * a1;
      const z1 = 4 + 8 * b1;
      const x2 = 4 + 8 * a2;
      const z2 = 4 + 8 * b2;
      const horiz = z1 === z2;
      if (horiz && x1 < -66 && ROADS_Z.includes(z1)) return; // the arterial is already there
      if (!horiz && z1 > 68 && ROADS_X.includes(x1)) return;
      const mx = (x1 + x2) / 2;
      const mz = (z1 + z2) / 2;
      if (coastPts.some(([px, pz]) => Math.hypot(px - mx, pz - mz) < 3.3)) return;
      if (inPad(mx, mz, 3)) return;
      const yy = y0(mx, mz);
      B.box.add(mx, yy - 0.3, mz, horiz ? 8.4 : 2.4, 0.34, horiz ? 2.4 : 8.4, road);
      B.glow.add(mx, yy + 0.06, mz, horiz ? 2.0 : 0.12, 0.03, horiz ? 0.12 : 2.0, C("#d8d2b0"));
      if ((a1 + b1) % 2 === 0) lampPost(x1 + 1.6, yy - 0.2, z1 + 1.6, 3.4);
    });
    const plotKind = new Map<string, string>();
    const INDUSTRY_PLOT_BURN: Record<string, number> = { "32,88": 96 };
    cells.forEach(([cx, cz, d]) => {
      const ci = cx / 8;
      const cj = cz / 8;
      const sides = [[ci - 1, cj - 1, ci, cj - 1], [ci, cj - 1, ci, cj], [ci - 1, cj, ci, cj], [ci - 1, cj - 1, ci - 1, cj]].filter(([p, q, u, v]) => edges.has(p + "," + q + "," + u + "," + v)).length;
      if (sides < 2) return; // no street to face: nothing is built
      const y = y0(cx, cz);
      // lawn, in quarters: any quarter that would lie on a road (the wide highway, the arterials, the coast road, lanes) is left out
      const LAWN = C("#5e8a45");
      for (const [qx, qz] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) {
        if (!onRoad(cx + qx, cz + qz, -0.4)) B.box.add(cx + qx, y - 0.4, cz + qz, 2.8, 0.4, 2.8, LAWN);
      }
      // every plot gets its own character, and no plot repeats its neighbours: small houses, big houses, half-garden plots, businesses of several kinds, pocket parks and the odd empty lot
      const TREEC = ["#3f6b4f", "#4f7d5a", "#2f5a45", "#5a8a62"].map(C);
      const tree2 = (tx: number, tz: number, ts: number) => {
        if (onRoad(tx, tz, -0.4)) return;
        B.cyl.add(tx, y - 0.2, tz, 0.16 * ts, 0.9 * ts, 0.16 * ts, C("#5a4538"));
        B.ico.add(tx, y + 0.85 * ts, tz, 1.7 * ts, 1.5 * ts, 1.7 * ts, pick(TREEC), r() * 3);
      };
      const kinds = ["houses", "houses", "garden", "big", "big", "biz", "biz", "park", "park", "empty"];
      const left = plotKind.get((ci - 1) + "," + cj);
      const up = plotKind.get(ci + "," + (cj - 1));
      let kind = pick(kinds);
      for (let tries = 0; tries < 6 && (kind === left || kind === up) && kind !== "houses"; tries++) kind = pick(kinds);
      if ((kind === "biz" || kind === "big") && onRoad(cx, cz - 0.6, 0.4)) kind = "houses";
      plotKind.set(ci + "," + cj, kind);
      // an industry building stands on this plot: nothing else is built, but the plot draws the same random numbers it would have
      // (measured on the original plot), so every plot after it comes out exactly as before
      const burn = INDUSTRY_PLOT_BURN[cx + "," + cz];
      if (burn !== undefined) {
        for (let k = 0; k < burn; k++) r();
        addRoad(cx, cz, 5.6);
        return;
      }
      if (kind === "biz") {
        const variant = Math.floor(r() * 3);
        if (variant === 0) {
          shopBuilding(cx, cz - 0.6, y, 0, Math.floor(r() * 10));
        } else if (variant === 1) {
          // a mixed-use building: a shop at street level with flats above, an awning, a lit shop window and a flat roof
          const wc = pick(SUB_WALLS);
          B.box.add(cx, y, cz - 0.3, 4.4, 5.6, 3.2, wc);
          B.box.add(cx, y + 5.6, cz - 0.3, 4.8, 0.3, 3.6, C("#2c3040"));
          B.glow.add(cx, y + 0.5, cz + 1.33, 3.6, 1.8, 0.05, C("#ffcf8a"));
          B.box.add(cx, y + 2.6, cz + 1.6, 4.2, 0.12, 0.9, pick(AWN));
          for (let q = 0; q < 3; q++) {
            B.box.add(cx - 1.4 + q * 1.4, y + 3.3, cz + 1.29, 0.95, 1.2, 0.05, C("#e8e0d0"));
            B.glow.add(cx - 1.4 + q * 1.4, y + 3.4, cz + 1.33, 0.75, 1.0, 0.05, r() < 0.75 ? C("#ffb870") : C("#2a3550"));
          }
          B.box.add(cx + 1.2, y + 5.9, cz - 0.3, 0.9, 0.8, 0.9, pick(MODERN));
        } else {
          // a café: a low building under a gable, a terrace with tables and parasols, a sign
          const rc = pick(SUB_ROOFS);
          B.box.add(cx, y, cz - 0.7, 4.2, 3.0, 2.6, pick(SUB_WALLS));
          B.gab.add(cx, y + 3.0, cz - 0.7, 4.8, 1.3, 3.2, rc, 0);
          B.glow.add(cx - 0.8, y + 0.5, cz + 0.62, 2.2, 1.7, 0.05, C("#ffcf8a"));
          B.box.add(cx + 1.4, y, cz + 0.62, 0.9, 2.2, 0.06, C("#6b3f2f"));
          signsW[signIdx(pick(["CAFE", "BAKERY", "COFFEE", "DELI"]))].add(cx, y + 3.1, cz + 0.68, 2.4, 0.75, 0.1, new THREE.Color(1, 1, 1), 0);
          for (const tx of [-1.3, 0.3, 1.5]) {
            B.cyl.add(cx + tx, y, cz + 1.9, 0.6, 0.7, 0.6, C("#8a7a62"));
            B.cyl.add(cx + tx, y + 0.7, cz + 1.9, 0.07, 1.4, 0.07, C("#e8e0d0"));
            B.cone.add(cx + tx, y + 2.0, cz + 1.9, 1.7, 0.45, 1.7, pick(AWN));
          }
        }
        for (let k = 0; k < 3; k++) if (r() < 0.7) B.box.add(cx - 1.8 + k * 1.8, y - 0.1, cz + 2.2, 0.9, 0.36, 1.7, pick(CARS));
        addRoad(cx, cz, 5.6);
        return;
      }
      if (kind === "park") {
        // a pocket park: a handful of trees of different sizes, shrubs, a bench and a lamp
        for (let k = 0; k < 6; k++) tree2(cx + (r() - 0.5) * 5.0, cz + (r() - 0.5) * 5.0, 0.9 + r() * 0.7);
        if (!onRoad(cx, cz, -0.4)) {
          B.box.add(cx, y - 0.05, cz + 0.4, 1.4, 0.12, 0.4, C("#6b5a48"));
          B.box.add(cx, y + 0.1, cz + 0.6, 1.4, 0.4, 0.08, C("#6b5a48"));
          lampPost(cx - 1.0, y - 0.1, cz - 0.6, 2.6);
        }
        addRoad(cx, cz, 5.6);
        return;
      }
      if (kind === "empty") {
        // an empty lot with a tree or two
        tree2(cx + (r() - 0.5) * 3, cz + (r() - 0.5) * 3, 1.0 + r() * 0.4);
        addRoad(cx, cz, 5.6);
        return;
      }
      if (kind === "big") {
        // one big house with a garden, filling the plot
        suburbHouse(cx, cz - 0.4, y, Math.floor(r() * 4), 0, 0, 1.5);
        tree2(cx - 2.1, cz + 2.0, 0.9 + r() * 0.3);
        if (r() < 0.6) tree2(cx + 2.1, cz + 2.1, 0.8 + r() * 0.3);
        addRoad(cx, cz, 5.6);
        return;
      }
      const n = kind === "garden" ? 2 : 4; // some plots are half houses, half garden trees
      const slots = [[-1.25, -1.25], [1.25, -1.25], [-1.25, 1.25], [1.25, 1.25]].sort(() => r() - 0.5);
      for (let k = 0; k < 4; k++) {
        const [dx, dz] = slots[k];
        const x = cx + dx;
        const z = cz + dz;
        if (onRoad(x, z, -0.4)) continue; // a plot that touches a road stays empty: no house, no tree
        if (k >= n) {
          if (r() < 0.85) tree2(x, z, 1.0);
          continue;
        }
        // the front faces whichever street is nearest, so no two neighbours look straight down the same line
        const face = r() < 0.5 ? (dz > 0 ? 0 : 2) : dx > 0 ? 1 : 3;
        suburbHouse(x, z, y, face, dx, dz);
      }
      addRoad(cx, cz, 5.6);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Helicopter circling the city                                        */
  /* ------------------------------------------------------------------ */
  {
    const heli = new THREE.Group();
    scene.add(heli);
    const hull = new THREE.Group();
    heli.add(hull);
    hull.scale.setScalar(1.7);
    bx(hull, "#2d3347", 2.2, 1.1, 1.1, 0, 0.1, 0);
    bx(hull, "#8fb0d8", 0.9, 0.9, 1.0, 1.0, 0.3, 0);
    bx(hull, "#2d3347", 3.4, 0.3, 0.3, -2.4, 0.5, 0);
    bx(hull, "#2d3347", 0.3, 0.9, 0.12, -3.9, 0.5, 0);
    for (const sz of [-0.5, 0.5]) bx(hull, "#161a2c", 2.0, 0.08, 0.1, 0.2, -0.2, sz);
    const rotor = new THREE.Group();
    rotor.position.set(0, 1.35, 0);
    hull.add(rotor);
    mesh(rotor, geoBox, std("#161a2c"), 7.6, 0.05, 0.28, 0, 0, 0, 0, false);
    mesh(rotor, geoBox, std("#161a2c"), 0.28, 0.05, 7.6, 0, 0, 0, 0, false);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(3.8, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xaab4d8, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide }));
    disc.position.y = 1.4;
    hull.add(disc);
    const tail = new THREE.Group();
    tail.position.set(-3.9, 0.5, 0.1);
    hull.add(tail);
    mesh(tail, geoBox, std("#161a2c"), 0.05, 1.1, 0.14, 0, -0.55, 0, 0, false);
    const strobe = mesh(hull, geoBox, new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 3, 3) }), 0.2, 0.2, 0.2, 0, 1.1, 0, 0, false);
    blink(strobe, 1.3, 0.12);
    mesh(hull, geoBox, new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.2, 0.15) }), 0.18, 0.18, 0.18, -0.2, 0.1, -0.62, 0, false);
    mesh(hull, geoBox, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 2.4, 0.5) }), 0.18, 0.18, 0.18, -0.2, 0.1, 0.62, 0, false);
    // when it rains the helicopter comes down on the pad on top of the SUPPORT TICKETS tower
    const PADX = CASE_XS[1];
    const PADZ = CASE_Z;
    const PADY = 0.3 + 12 + 0.3 + 0.34;
    const easeIO = (v: number) => {
      const k = Math.min(1, Math.max(0, v));
      return k * k * (3 - 2 * k);
    };
    const lerpAng = (a0: number, a1: number, k: number) => a0 + Math.atan2(Math.sin(a1 - a0), Math.cos(a1 - a0)) * k;
    let landU = 0;
    let rotorA = 0;
    let padHeading = Math.PI / 2;
    animated.push((t, dt) => {
      landU += ((rainState.value > 0.6 ? 1 : 0) - landU) * (1 - Math.exp(-dt * 0.32));
      if (Math.abs(landU - Math.round(landU)) < 0.002) landU = Math.round(landU);
      const u = landU;
      const a = t * 0.05;
      const R = 120;
      const ox = -8 + Math.cos(a) * R;
      const oy = 48 + Math.sin(t * 0.3) * 1.2;
      const oz = 6 + Math.sin(a) * R;
      const orbitHeading = -a - Math.PI / 2;
      const hy = PADY + 15;
      let px = ox;
      let py = oy;
      let pz = oz;
      let heading = orbitHeading;
      if (u > 0) {
        const toPad = Math.atan2(-(PADZ - oz), PADX - ox);
        if (u < 0.7) {
          const e = easeIO(u / 0.7);
          px = ox + (PADX - ox) * e;
          py = oy + (hy - oy) * e;
          pz = oz + (PADZ - oz) * e;
          heading = lerpAng(orbitHeading, toPad, Math.min(1, e * 1.4));
          padHeading = heading;
        } else {
          const e = easeIO((u - 0.7) / 0.3);
          px = PADX;
          pz = PADZ;
          py = hy + (PADY - hy) * e;
          heading = lerpAng(padHeading, Math.PI / 2, e);
        }
      }
      const landed = easeIO((u - 0.9) / 0.1);
      heli.position.set(px, py, pz);
      heli.rotation.y = heading;
      heli.rotation.x = 0.08 * (1 - landed);
      rotorA += dt * 24 * (1 - 0.9 * landed);
      rotor.rotation.y = rotorA;
    });
  }

  /* ------------------------------------------------------------------ */
  animated.push((t) => {
    blinkers.forEach((b) => (b.m.visible = (((t / b.period + b.ph) % 1) + 1) % 1 < b.duty));
  });
  if (pools.length) {
    const pc = document.createElement("canvas");
    pc.width = pc.height = 128;
    const pg = pc.getContext("2d")!;
    const grad = pg.createRadialGradient(64, 64, 2, 64, 64, 62);
    grad.addColorStop(0, "rgba(255,196,120,0.95)");
    grad.addColorStop(0.4, "rgba(255,170,90,0.38)");
    grad.addColorStop(1, "rgba(255,150,70,0)");
    pg.fillStyle = grad;
    pg.fillRect(0, 0, 128, 128);
    const poolTex = new THREE.CanvasTexture(pc);
    poolTex.colorSpace = THREE.SRGBColorSpace;
    const poolMat = new THREE.MeshBasicMaterial({ map: poolTex, color: 0xffffff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    const poolMesh = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2), poolMat, pools.length);
    const PM = new THREE.Matrix4();
    const pq = new THREE.Quaternion();
    pools.forEach(([x, y, z, rad], i) => {
      PM.compose(new THREE.Vector3(x, y, z), pq, new THREE.Vector3(rad, 1, rad));
      poolMesh.setMatrixAt(i, PM);
    });
    poolMesh.frustumCulled = false;
    poolMesh.renderOrder = 3;
    scene.add(poolMesh);
    out.nightBeams.push({ mat: poolMat, base: 0.5 });
  }
  if (blobs.length) {
    const blobMat = new THREE.MeshBasicMaterial({ color: 0x05060c, transparent: true, opacity: 0.32, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const blobMesh = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 18).rotateX(-Math.PI / 2), blobMat, blobs.length);
    const M = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    blobs.forEach(([x, y, z, rx, rz], i) => {
      M.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(rx, 1, rz));
      blobMesh.setMatrixAt(i, M);
    });
    blobMesh.frustumCulled = false;
    blobMesh.renderOrder = 2;
    scene.add(blobMesh);
  }
  // a roadside gas station on the highway: a painted forecourt joined to the road by two driveways, a striped canopy, pumps on islands, a shop and its extras
  {
    const gx = -172;
    const gz = HIGHWAY_Z + 12.5;
    const yb = Math.max(0.55, hmax(gx, HIGHWAY_Z, 2.4)) + 0.1;
    addRoad(gx, gz + 3, 18);
    const asph = C("#2a2d3a");
    // two driveways, built like every other road, so they meet the highway flush
    for (const dx of [-8.5, 8.5]) makeStrip([gx + dx, HIGHWAY_Z + 1.0], [gx + dx, gz - 4], 3.8, ASPHALT);
    B.box.add(gx, yb - 0.5, gz + 1, 22, 0.5, 12, asph);
    // the forecourt floor: painted lanes round the pump islands, bays, arrows, a crossing, oil stains and puddles
    {
      const PX = 32;
      const cv = document.createElement("canvas");
      cv.width = 22 * PX;
      cv.height = 12 * PX;
      const g2 = cv.getContext("2d")!;
      const X = (lx: number) => (lx + 11) * PX;
      const Z = (lz: number) => (lz + 6) * PX;
      g2.fillStyle = "#585d6e";
      g2.fillRect(0, 0, cv.width, cv.height);
      for (let k = 0; k < 6000; k++) {
        g2.fillStyle = Math.random() < 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.08)";
        g2.fillRect(Math.random() * cv.width, Math.random() * cv.height, 1 + Math.random() * 3, 1 + Math.random() * 3);
      }
      g2.fillStyle = "rgba(14,15,20,0.3)";
      for (const px of [-2.6, 2.6]) g2.fillRect(X(px - 0.5), Z(-1.4), 1 * PX, 5.6 * PX); // pump islands
      g2.strokeStyle = "rgba(230,180,34,0.9)";
      g2.lineWidth = 3;
      for (const px of [-2.6, 2.6]) g2.strokeRect(X(px - 0.7), Z(-1.7), 1.4 * PX, 6.2 * PX);
      g2.setLineDash([16, 10]);
      g2.strokeRect(X(-9.4), Z(-5.4), 18.8 * PX, 10.8 * PX);
      g2.setLineDash([]);
      g2.fillStyle = "rgba(240,240,235,0.85)";
      for (let k = 0; k < 5; k++) g2.fillRect(X(-8 + k * 3.4) - 1, Z(3.2), 3, 2.6 * PX); // bays in front of the shop
      for (let k = 0; k < 6; k++) g2.fillRect(X(-1.5 + k * 0.62), Z(-5.6), 0.34 * PX, 1.6 * PX); // crossing
      for (const ax of [-8.5, 8.5]) {
        g2.beginPath();
        g2.moveTo(X(ax) - 8, Z(-3) + 16); g2.lineTo(X(ax), Z(-3)); g2.lineTo(X(ax) + 8, Z(-3) + 16);
        g2.closePath();
        g2.fill();
      }
      for (let k = 0; k < 14; k++) {
        g2.fillStyle = "rgba(8,8,12," + (0.14 + Math.random() * 0.14) + ")";
        g2.beginPath();
        g2.ellipse(Math.random() * cv.width, Math.random() * cv.height, 10 + Math.random() * 26, 6 + Math.random() * 12, Math.random() * 3, 0, Math.PI * 2);
        g2.fill();
      }
      for (let k = 0; k < 5; k++) {
        const px = Math.random() * cv.width;
        const py = Math.random() * cv.height;
        const rg = g2.createRadialGradient(px, py, 2, px, py, 30);
        rg.addColorStop(0, "rgba(170,200,230,0.3)");
        rg.addColorStop(1, "rgba(170,200,230,0)");
        g2.fillStyle = rg;
        g2.beginPath();
        g2.ellipse(px, py, 30, 16, 0, 0, Math.PI * 2);
        g2.fill();
      }
      g2.strokeStyle = "rgba(15,17,25,0.4)";
      g2.lineWidth = 1;
      for (let k = 0; k < 16; k++) {
        let px = Math.random() * cv.width;
        let py = Math.random() * cv.height;
        g2.beginPath();
        g2.moveTo(px, py);
        for (let q = 0; q < 5; q++) { px += (Math.random() - 0.5) * 24; py += (Math.random() - 0.4) * 20; g2.lineTo(px, py); }
        g2.stroke();
      }
      const ftex = new THREE.CanvasTexture(cv);
      ftex.colorSpace = THREE.SRGBColorSpace;
      ftex.anisotropy = 8;
      const fplane = new THREE.Mesh(new THREE.PlaneGeometry(22, 12).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: ftex, roughness: 0.85 }));
      fplane.position.set(gx, yb + 0.02, gz + 1);
      fplane.receiveShadow = true;
      scene.add(fplane);
    }
    // the canopy: striped columns, a red and white fascia, a grid of lights underneath, a roof vent
    for (const [dx, dz] of [[-4, -1.5], [4, -1.5], [-4, 3.5], [4, 3.5]]) {
      B.cyl.add(gx + dx, yb, gz + dz, 0.34, 4.6, 0.34, C("#e8e0d0"));
      for (let q = 0; q < 4; q++) B.cyl.add(gx + dx, yb + 0.3 + q * 1.1, gz + dz, 0.37, 0.45, 0.37, C("#b3363a"));
    }
    B.box.add(gx, yb + 4.6, gz + 1, 10.4, 0.4, 6.4, C("#e8e0d0"));
    B.box.add(gx, yb + 4.95, gz + 1, 10.6, 0.3, 6.6, C("#b3363a"));
    B.box.add(gx, yb + 4.75, gz + 1, 10.7, 0.12, 6.7, C("#f2efe6"));
    for (let ix = -1; ix <= 1; ix++) for (let iz = -1; iz <= 1; iz += 2) B.glow.add(gx + ix * 3.0, yb + 4.55, gz + 1 + iz * 1.5, 1.6, 0.05, 1.0, C("#ffe6b0").multiplyScalar(0.9));
    B.box.add(gx, yb + 5.2, gz + 1, 2.6, 0.5, 1.0, C("#8e93a6"));
    // pumps on raised islands, with displays, hoses, nozzles, bollards and an air pump
    for (const px of [-2.6, 2.6]) {
      B.box.add(gx + px, yb, gz - 1.4, 1.0, 0.18, 5.4, C("#b6b8c0"));
      B.box.add(gx + px, yb + 0.18, gz - 1.4, 0.98, 0.04, 5.38, C("#e6b422"));
      for (const q of [0.4, 2.8]) {
        B.box.add(gx + px, yb + 0.18, gz + q - 1.4, 0.7, 1.45, 0.55, C("#b3363a"));
        B.box.add(gx + px, yb + 1.63, gz + q - 1.4, 0.74, 0.12, 0.58, C("#e8e0d0"));
        B.glow.add(gx + px, yb + 1.1, gz + q - 1.4 + 0.29, 0.42, 0.3, 0.03, C("#9affc0"));
        B.box.add(gx + px + 0.4, yb + 0.7, gz + q - 1.4, 0.05, 0.6, 0.05, C("#161a2c"));
        B.box.add(gx + px + 0.4, yb + 1.1, gz + q - 1.4, 0.18, 0.12, 0.12, C("#2c3040"));
      }
      for (const q of [-1.2, 3.9]) B.cyl.add(gx + px, yb + 0.18, gz + q, 0.2, 0.7, 0.2, C("#e6b422"));
    }
    B.box.add(gx + 8.6, yb, gz + 2.6, 0.6, 1.1, 0.5, C("#3f6fb0"));
    B.glow.add(gx + 8.6, yb + 0.7, gz + 2.86, 0.34, 0.22, 0.03, C("#9ec8ff"));
    // the shop, plus the little things around it: a freezer, firewood, a propane cage, tyres, a vending machine, a bench, flags
    shopBuilding(gx + 1, gz + 9.4, yb, 0, signIdx("OPEN"));
    B.box.add(gx - 3.4, yb, gz + 7.6, 1.6, 1.0, 0.7, C("#dfe3ee"));
    B.glow.add(gx - 3.4, yb + 0.4, gz + 7.97, 1.3, 0.5, 0.03, C("#9ec8ff").multiplyScalar(0.8));
    for (let k = 0; k < 6; k++) B.box.add(gx + 5.6 + (k % 3) * 0.55, yb + Math.floor(k / 3) * 0.3, gz + 7.8, 0.5, 0.28, 0.5, C("#8a6a45"));
    B.box.add(gx + 6.6, yb, gz + 7.4, 1.4, 1.2, 0.9, C("#aeb4c4"));
    for (let k = 0; k < 4; k++) B.cyl.add(gx - 5.6, yb + k * 0.3, gz + 8.0, 0.8, 0.28, 0.8, C("#161a2c"));
    B.box.add(gx - 2.2, yb, gz + 7.6, 0.8, 1.7, 0.6, C("#b3363a"));
    B.glow.add(gx - 2.2, yb + 0.9, gz + 7.91, 0.6, 0.7, 0.03, C("#ffcf8a"));
    B.box.add(gx + 4.4, yb, gz + 7.8, 1.4, 0.4, 0.4, C("#6b5a48"));
    for (const [fx, fc] of [[-6.4, "#b3363a"], [-5.8, "#3f6fb0"], [-5.2, "#e6b422"]] as const) {
      B.cyl.add(gx + fx, yb, gz + 6.4, 0.07, 3.2, 0.07, C("#e8e0d0"));
      B.box.add(gx + fx + 0.35, yb + 2.7, gz + 6.4, 0.7, 0.45, 0.04, C(fc));
    }
    for (let q = 0; q < 10; q++) B.glow.add(gx - 4.5 + q * 1.0, yb + 3.4 - Math.sin((q / 9) * Math.PI) * 0.35 - 0.2, gz + 7.0, 0.1, 0.1, 0.1, pick([C("#ffcf8a"), C("#ff8aa8"), C("#9ec8ff")]).multiplyScalar(0.8));
    // the tall price pylon: a lit GAS sign, three rows of red digits and a frame
    B.cyl.add(gx + 10, yb, gz - 2, 0.5, 8.4, 0.5, C("#4d5470"));
    B.box.add(gx + 10, yb + 5.2, gz - 2, 2.3, 3.0, 0.4, C("#161a2c"));
    signsW[signIdx("GAS")].add(gx + 10, yb + 8.9, gz - 2, 3.6, 1.12, 0.14, new THREE.Color(1, 1, 1), 0);
    for (let q = 0; q < 3; q++) {
      B.glow.add(gx + 10, yb + 6.3 - q * 0.9, gz - 1.78, 1.5, 0.5, 0.04, C("#ff5a4a"));
      for (let dgt = 0; dgt < 4; dgt++) B.box.add(gx + 9.45 + dgt * 0.37, yb + 6.15 - q * 0.9, gz - 1.76, 0.2, 0.3, 0.03, C("#7a1a14"));
    }
    // cars and trucks at the pumps and by the shop
    for (const [dx, dz, c2] of [[-4.5, 5.2, "#cfd3dc"], [3.7, 5.2, "#3f6fb0"], [-2.6, 1.4, "#b3363a"]] as const) {
      B.box.add(gx + dx, yb + 0.1, gz + dz, 1.8, 0.4, 0.9, C(c2));
      B.box.add(gx + dx, yb + 0.45, gz + dz, 1.0, 0.35, 0.8, C("#20253a"));
    }
    B.box.add(gx - 9, yb, gz - 3.5, 7.2, 2.7, 2.5, C("#e8e0d0"));
    B.box.add(gx - 4.9, yb, gz - 3.5, 1.8, 1.7, 2.4, C("#b3363a"));
    for (let q = 0; q < 6; q++) B.box.add(gx - 11.4 + q * 1.2, yb + 0.5, gz - 2.24, 0.9, 2.0, 0.03, C("#d0d3dc"));
    for (let k = 0; k < 4; k++) lampPost(gx - 9 + k * 6, yb, gz + 6.5, 4.4);
    pools.push([gx, yb + 0.05, gz + 1, 7]);
  }

  // oil rigs out at sea: legs, braced jackets, decks, a derrick, a crane, a helipad and a flare that flickers
  const strut = (parent: THREE.Object3D, hex: string, a: [number, number, number], b2: [number, number, number], t: number) => {
    const m = new THREE.Mesh(geoBox, std(hex, 0.6, 0.3));
    const dir = new THREE.Vector3(b2[0] - a[0], b2[1] - a[1], b2[2] - a[2]);
    const len = dir.length();
    m.position.set(a[0], a[1], a[2]);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    m.scale.set(t, len, t);
    parent.add(m);
    return m;
  };
  const flames: { m: THREE.Mesh; light: THREE.PointLight; base: number; ph: number }[] = [];
  const oilRig = (rx: number, rz: number, S: number, derrick: boolean) => {
    const g = new THREE.Group();
    g.position.set(rx, 0, rz);
    g.scale.setScalar(S);
    scene.add(g);
    const STEEL = "#aeb3c2";
    const YEL = "#d9a441";
    const L = 6.5;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(g, geoCyl, std(STEEL, 0.6, 0.3), 1.5, 16, 1.5, sx * L, -5, sz * L);
    const cn: [number, number][] = [[-L, -L], [L, -L], [L, L], [-L, L]];
    for (let i = 0; i < 4; i++) {
      const p1 = cn[i];
      const p2 = cn[(i + 1) % 4];
      strut(g, STEEL, [p1[0], -2, p1[1]], [p2[0], 4, p2[1]], 0.35);
      strut(g, STEEL, [p2[0], -2, p2[1]], [p1[0], 4, p1[1]], 0.35);
      strut(g, STEEL, [p1[0], 4, p1[1]], [p2[0], 9.6, p2[1]], 0.35);
      strut(g, STEEL, [p2[0], 4, p2[1]], [p1[0], 9.6, p1[1]], 0.35);
    }
    bx(g, "#7a8094", 16, 1.2, 16, 0, 10, 0);
    bx(g, "#8e93a6", 11, 1.0, 11, 0, 11.2, 0);
    for (const [ax, az, sx2, sz2] of [[0, 8.05, 16, 0.12], [0, -8.05, 16, 0.12], [8.05, 0, 0.12, 16], [-8.05, 0, 0.12, 16]] as const) gl(g, "#ffcf8a", sx2, 0.12, sz2, ax, 10.9, az, 1.6);
    // living quarters with lit windows, and the helipad on top
    bx(g, "#dfe3ee", 5, 4, 5, -4.5, 12.2, -4.5);
    for (let fl = 0; fl < 2; fl++) for (let q = 0; q < 4; q++) {
      gl(g, "#ffd9a0", 0.6, 0.7, 0.05, -6.2 + q * 1.1, 13.0 + fl * 1.5, -1.98, 1.6);
      gl(g, "#ffd9a0", 0.05, 0.7, 0.6, -1.98, 13.0 + fl * 1.5, -6.2 + q * 1.1, 1.6);
    }
    mesh(g, geoCyl, std("#3a3f50"), 6, 0.3, 6, -4.5, 16.2, -4.5);
    gl(g, "#e8e0d0", 2.2, 0.05, 0.3, -4.5, 16.52, -4.5, 2);
    gl(g, "#e8e0d0", 0.3, 0.05, 2.2, -5.3, 16.52, -4.5, 2);
    gl(g, "#e8e0d0", 0.3, 0.05, 2.2, -3.7, 16.52, -4.5, 2);
    for (const [tx, tz] of [[-5, 3], [-2.4, 4.6], [0.4, 5.6]]) mesh(g, geoCyl, std("#e8e0d0"), 2.2, 3.2, 2.2, tx, 12.2, tz);
    bx(g, "#d86a3e", 3, 1.2, 1.2, -8.9, 8.6, 2);
    bx(g, "#d86a3e", 3, 1.2, 1.2, -8.9, 8.6, -2);
    for (const [fx, fz] of [[-7.4, 7.4], [7.4, 7.4], [7.4, -7.4]]) {
      mesh(g, geoCyl, std("#4d5470"), 0.2, 3, 0.2, fx, 11.2, fz);
      gl(g, "#fff6e0", 0.9, 0.5, 0.5, fx, 14.2, fz, 3);
      redLight(g, fx, 14.9, fz, 0.35);
    }
    if (derrick) {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) strut(g, YEL, [3 + sx * 2, 12.2, 3 + sz * 2], [3 + sx * 0.6, 36, 3 + sz * 0.6], 0.35);
      for (let yy = 15; yy < 35; yy += 4.5) {
        const wd = 4 - ((yy - 12.2) / 24) * 2.8;
        bx(g, YEL, wd, 0.16, 0.16, 3, yy, 3 + wd / 2);
        bx(g, YEL, wd, 0.16, 0.16, 3, yy, 3 - wd / 2);
        bx(g, YEL, 0.16, 0.16, wd, 3 + wd / 2, yy, 3);
        bx(g, YEL, 0.16, 0.16, wd, 3 - wd / 2, yy, 3);
      }
      bx(g, "#7a8094", 2.0, 1.4, 2.0, 3, 36, 3);
      redLight(g, 3, 37.8, 3, 0.5);
      // the crane
      mesh(g, geoCyl, std(YEL), 1.2, 3, 1.2, 6, 12.2, -5);
      const cg = new THREE.Group();
      cg.position.set(6, 15.2, -5);
      g.add(cg);
      strut(cg, YEL, [0, 0, 0], [8, 5, 0], 0.4);
      strut(cg, YEL, [0, 0, 0], [-3, 0.5, 0], 0.5);
      bx(cg, "#4d5470", 1.6, 0.9, 1.6, -2.6, -0.2, 0);
      animated.push((t) => (cg.rotation.y = Math.sin(t * 0.12 + rx) * 1.2));
    }
    // the flare: a boom with a flame that flickers and lights the water
    strut(g, STEEL, [7.5, 11.2, 7.5], [15, 20, 15], 0.45);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.9, 3.4, 6).translate(0, 1.7, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 1.5, 0.35) }));
    flame.position.set(15, 20, 15);
    g.add(flame);
    const light = new THREE.PointLight(0xff8a3a, 260, 55, 1.6);
    light.position.set(rx + 15 * S, 20 * S, rz + 15 * S);
    scene.add(light);
    out.nightLights.push({ light, base: 260 });
    flames.push({ m: flame, light, base: 260, ph: r() * 6 });
    // handrails round both decks, a pipe rack, mud tanks, a vent stack and escape capsules
    for (const [hy, half] of [[11.2, 8.0], [12.2, 5.5]] as const) {
      for (const hh of [0.55, 1.1]) {
        for (const sg of [-1, 1]) {
          bx(g, "#e8e0d0", half * 2, 0.06, 0.06, 0, hy + hh, sg * half);
          bx(g, "#e8e0d0", 0.06, 0.06, half * 2, sg * half, hy + hh, 0);
        }
      }
      for (let q = -half; q <= half; q += half / 2) for (const sg of [-1, 1]) {
        bx(g, "#e8e0d0", 0.06, 1.1, 0.06, q, hy, sg * half);
        bx(g, "#e8e0d0", 0.06, 1.1, 0.06, sg * half, hy, q);
      }
    }
    for (const py of [11.9, 12.4, 12.9]) strut(g, "#7a8094", [-6.5, py, 6.6], [6.5, py, 6.6], 0.3);
    for (const [tx, tz] of [[5.5, -1], [5.5, -4], [2.4, -5.4]]) {
      mesh(g, geoCyl, std("#c9ced9", 0.5, 0.4), 2.2, 2.4, 2.2, tx, 12.2, tz);
      mesh(g, geoCyl, std("#b3363a"), 2.25, 0.35, 2.25, tx, 13.6, tz);
    }
    mesh(g, geoCyl, std("#aeb3c2", 0.6, 0.3), 0.6, 9, 0.6, -7.2, 11.2, 6.8);
    redLight(g, -7.2, 20.5, 6.8, 0.4);
    for (const sz of [-1, 1]) {
      bx(g, "#e8803a", 2.6, 1.1, 1.1, -8.6, 11.3, sz * 3.2);
      mesh(g, geoCone, std("#e8803a"), 1.1, 0.8, 1.1, -9.9, 11.3 + 0.15, sz * 3.2);
      gl(g, "#ffd9a0", 0.05, 0.3, 0.5, -8.6, 11.7, sz * 3.2 + sz * 0.57, 1.6);
    }
    // a stair down to the boat landing, with rungs, and a landing platform at the waterline
    strut(g, "#7a8094", [8.2, 10, 1.4], [10.6, 0.7, 1.4], 0.3);
    strut(g, "#7a8094", [8.2, 10, 2.6], [10.6, 0.7, 2.6], 0.3);
    for (let q = 1; q < 11; q++) bx(g, "#aeb3c2", 0.1, 0.1, 1.2, 8.2 + (2.4 * q) / 11, 10 - (9.3 * q) / 11, 2.0);
    bx(g, "#7a8094", 3.2, 0.25, 3.0, 11.6, 0.6, 2.0);
    gl(g, "#ffcf8a", 3.0, 0.06, 0.1, 11.6, 0.9, 3.5, 1.4);
    // yellow splash zones and white foam collars on the legs, with floodlights under the deck
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      mesh(g, geoCyl, std(YEL, 0.6, 0.2), 1.62, 3.2, 1.62, sx * L, -1.4, sz * L);
      mesh(g, geoCyl, std("#eef2f8"), 2.6, 0.08, 2.6, sx * L, 0.02, sz * L, 0, false);
      gl(g, "#fff3d0", 0.5, 0.2, 0.5, sx * 7.6, 9.8, sz * 7.6, 2.2);
    }
    // helideck edge lights and the number on the side of the deck
    for (let q = 0; q < 12; q++) {
      const a = (q / 12) * Math.PI * 2;
      gl(g, "#6dffb0", 0.22, 0.12, 0.22, -4.5 + Math.cos(a) * 3.1, 16.45, -4.5 + Math.sin(a) * 3.1, 2.6);
    }
    // a supply vessel alongside
    const ship = new THREE.Group();
    ship.position.set(rx + 13 * S, 0, rz + 3 * S);
    ship.scale.setScalar(S);
    scene.add(ship);
    bx(ship, "#2d3a5a", 3.2, 1.4, 12, 0, -0.8, 0);
    bx(ship, "#b3363a", 3.3, 0.3, 12.1, 0, -0.1, 0);
    bx(ship, "#dfe3ee", 2.6, 1.8, 2.6, 0, 0.5, -3.4);
    for (let q = -1; q <= 1; q++) gl(ship, "#ffd9a0", 0.5, 0.4, 0.05, q * 0.8, 1.3, -2.08, 1.8);
    redLight(ship, 0, 2.5, -3.4, 0.3);
    gl(ship, "#9affc0", 0.25, 0.25, 0.25, 1.5, 0.7, 4.5, 2.4);
    gl(ship, "#ff5a4a", 0.25, 0.25, 0.25, -1.5, 0.7, 4.5, 2.4);
    animated.push((t) => {
      ship.position.y = Math.sin(t * 0.7 + rx) * 0.12;
      ship.rotation.z = Math.sin(t * 0.5 + rz) * 0.02;
    });
  };
  oilRig(52, -140, 1.15, true); // one rig, out in the open sea north of the beach where the visitor can see it from the opening view

  // a cruise ship working the channel under the bridge: out of the south, under the deck, away to the north
  {
    const ZB = 12;
    const bShore = findCoast(40, ZB, 1, 0, 0).x;
    const LANE = bShore + 103.5; // half way between two piers, clear of the towers
    const cs = new THREE.Group();
    scene.add(cs);
    const body = new THREE.Group();
    body.rotation.y = Math.PI; // the bow (local +z) points north, up the channel
    cs.add(body);
    const mkTex = (w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) => {
      const cv = document.createElement("canvas");
      cv.width = w;
      cv.height = h;
      draw(cv.getContext("2d")!);
      const t = new THREE.CanvasTexture(cv);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    };
    const winTex = (len: number, lit: string) => {
      const t = mkTex(64, 16, (g) => {
        g.fillStyle = "#222a40";
        g.fillRect(0, 0, 64, 16);
        g.fillStyle = lit;
        for (let i = 0; i < 4; i++) g.fillRect(i * 16 + 2, 3, 12, 10);
      });
      t.wrapS = THREE.RepeatWrapping;
      t.repeat.set(len / 2.2, 1);
      return t;
    };
    const band = (len: number, h: number, x: number, y: number, z: number, side: number, lit = "#ffd9a0") => {
      const mat = new THREE.MeshBasicMaterial({ map: winTex(len, lit), color: new THREE.Color(1.15, 1.1, 1.0) });
      registerGlow(mat);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(len, h), mat);
      m.rotation.y = side * (Math.PI / 2);
      m.position.set(x * side, y, z);
      body.add(m);
    };
    const WHITE = "#eef1f7";
    const NAVY = "#1d2a4a";
    // hull: navy below, a red boot stripe, a white topside, a raked bow and a stern with a marina platform
    bx(body, NAVY, 9, 1.4, 44, 0, -1.4, -2);
    bx(body, "#b3363a", 9.1, 0.35, 44.1, 0, 0, -2);
    bx(body, WHITE, 9.2, 2.0, 44.2, 0, 0.35, -2);
    bx(body, NAVY, 6.3, 1.4, 6.3, 0, -1.4, 20).rotation.y = Math.PI / 4;
    bx(body, "#b3363a", 6.4, 0.35, 6.4, 0, 0, 20).rotation.y = Math.PI / 4;
    bx(body, WHITE, 6.5, 2.0, 6.5, 0, 0.35, 20).rotation.y = Math.PI / 4;
    bx(body, "#4d5470", 7.2, 0.3, 1.6, 0, -0.3, -24.6);
    for (const sx of [-1, 1]) {
      bx(body, WHITE, 0.07, 0.55, 40, sx * 4.55, 2.35, -1);
      bx(body, WHITE, 0.07, 0.55, 40, sx * 4.55, 2.35 + 0.55, -1);
    }
    for (const sx of [-1, 1]) band(40, 0.55, 4.62, 1.35, -1, sx);
    // three stepped decks of cabins, an aft pool terrace, the bridge house and two funnels
    bx(body, WHITE, 8.2, 1.85, 36, 0, 2.35, -3);
    band(34, 0.8, 4.12, 3.3, -3, 1);
    band(34, 0.8, 4.12, 3.3, -3, -1);
    bx(body, WHITE, 7.2, 1.8, 27, 0, 4.2, -1.5);
    band(25, 0.8, 3.62, 5.1, -1.5, 1);
    band(25, 0.8, 3.62, 5.1, -1.5, -1);
    bx(body, WHITE, 6.0, 1.6, 18, 0, 6.0, -3);
    band(16, 0.7, 3.02, 6.8, -3, 1);
    band(16, 0.7, 3.02, 6.8, -3, -1);
    for (const [dz, ln] of [[-3, 36], [-1.5, 27], [-3, 18]] as const) {
      const wy = dz === -3 && ln === 36 ? 4.2 : ln === 27 ? 6.0 : 7.6;
      const hw = ln === 36 ? 4.2 : ln === 27 ? 3.7 : 3.1;
      bx(body, "#aeb4c4", hw * 2 + 0.3, 0.12, ln + 0.3, 0, wy, dz);
    }
    bx(body, WHITE, 7.2, 1.5, 4.0, 0, 6.0, 10.5);
    gl(body, "#9ec8ff", 6.4, 0.7, 0.05, 0, 6.5, 12.52, 1.4);
    bx(body, "#aeb4c4", 9.4, 0.14, 1.0, 0, 6.85, 10.6);
    for (const [fz, tall] of [[-3, 1.4], [-8.5, 1.4]] as const) {
      bx(body, WHITE, 3.0, tall, 4.6, 0, 7.6, fz);
      bx(body, "#c9433a", 3.06, 0.45, 4.66, 0, 7.6 + 0.55, fz);
      bx(body, "#161a2c", 3.1, 0.2, 4.7, 0, 7.6 + tall, fz);
    }
    mesh(body, geoCyl, std("#aeb4c4"), 0.18, 2.2, 0.18, 0, 7.5, 10.5);
    const radar = bx(body, "#dfe3ee", 1.8, 0.1, 0.18, 0, 9.55, 10.5);
    gl(body, "#fff6e0", 0.22, 0.22, 0.22, 0, 9.75, 10.5, 3);
    gl(body, "#6dffb0", 0.3, 0.3, 0.3, 4.1, 6.5, 11.0, 2.6);
    gl(body, "#ff5a4a", 0.3, 0.3, 0.3, -4.1, 6.5, 11.0, 2.6);
    // aft pool terrace on the roof of the first deck
    bx(body, "#cfd6e4", 6.8, 0.1, 5.8, 0, 4.2, -18);
    gl(body, "#37c4e8", 3.4, 0.05, 4.2, 0, 4.3, -18, 1.0);
    for (let q = 0; q < 3; q++) {
      bx(body, "#f2efe6", 0.7, 0.18, 1.5, -2.6, 4.3, -20 + q * 1.9);
      bx(body, "#f2efe6", 0.7, 0.18, 1.5, 2.6, 4.3, -20 + q * 1.9);
    }
    // lifeboats in their davits along the first deck, and string lights over the aft terrace
    for (let q = 0; q < 6; q++) for (const sx of [-1, 1]) {
      bx(body, "#e8803a", 0.9, 0.7, 2.4, sx * 4.45, 2.9, -13 + q * 4.6);
      bx(body, "#eef1f7", 0.1, 0.9, 0.1, sx * 4.45, 3.6, -13 + q * 4.6 - 1.0);
    }
    for (let q = 0; q < 9; q++) gl(body, "#ffd9a0", 0.12, 0.12, 0.12, -3.2 + q * 0.8, 5.1 - Math.sin((q / 8) * Math.PI) * 0.25, -21.4, 1.8);
    // the bow: anchor winch, a capstan, mooring posts and a forward mast light
    bx(body, "#c9ced9", 2.2, 0.6, 1.6, 0, 2.35, 16);
    mesh(body, geoCyl, std("#4d5470"), 0.9, 0.5, 0.9, 0, 2.95, 18);
    for (const sx of [-1, 1]) mesh(body, geoCyl, std("#2c3040"), 0.35, 0.5, 0.35, sx * 3.2, 2.35, 14);
    mesh(body, geoCyl, std("#aeb4c4"), 0.12, 2.0, 0.12, 0, 2.35, 19);
    gl(body, "#fff6e0", 0.2, 0.2, 0.2, 0, 4.4, 19, 3);
    // the wake: a foam trail astern and a bow wave
    const wakeTex = mkTex(64, 256, (g) => {
      const gr = g.createLinearGradient(0, 0, 0, 256);
      // the top of the texture is the far end of the trail: clear there, foamy at the stern
      gr.addColorStop(0, "rgba(220,235,250,0)");
      gr.addColorStop(0.55, "rgba(220,235,250,0.10)");
      gr.addColorStop(1, "rgba(235,244,252,0.55)");
      g.fillStyle = gr;
      g.fillRect(0, 0, 64, 256);
      for (let i = 0; i < 220; i++) {
        const yy = Math.random() * 256;
        g.fillStyle = "rgba(255,255,255," + (0.05 + Math.random() * 0.4 * (yy / 256) * (yy / 256)) + ")";
        g.fillRect(Math.random() * 64, yy, 1 + Math.random() * 3, 1 + Math.random() * 3);
      }
      g.globalCompositeOperation = "destination-in"; // soft edges across the trail
      const sg = g.createLinearGradient(0, 0, 64, 0);
      sg.addColorStop(0, "rgba(0,0,0,0)");
      sg.addColorStop(0.35, "rgba(0,0,0,1)");
      sg.addColorStop(0.65, "rgba(0,0,0,1)");
      sg.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = sg;
      g.fillRect(0, 0, 64, 256);
    });
    const wakeMat = new THREE.MeshBasicMaterial({ map: wakeTex, transparent: true, opacity: 0.5, depthWrite: false, fog: false });
    // a trail that widens as it goes: narrow at the stern, wide where it has almost faded away
    const trail = (len: number, w0: number, w1: number) => {
      const geo = new THREE.PlaneGeometry(1, len).rotateX(-Math.PI / 2);
      const pos = geo.getAttribute("position");
      for (let i = 0; i < pos.count; i++) pos.setX(i, pos.getX(i) * (pos.getZ(i) > 0 ? w0 : w1)); // +z is the stern end after the rotation
      return geo;
    };
    const wk = new THREE.Mesh(trail(44, 3.4, 12), wakeMat);
    wk.position.set(0, 0.07, -46);
    body.add(wk);
    for (const sg of [-1, 1]) {
      const edge = new THREE.Mesh(trail(34, 1.2, 3.4), wakeMat);
      edge.position.set(sg * 3.2, 0.07, -42);
      edge.rotation.y = -sg * 0.12;
      body.add(edge);
    }
    const START = 80;
    animated.push((t) => {
      const z = 190 - ((t * 2.6 + START) % 330);
      cs.position.set(LANE, Math.sin(t * 0.5) * 0.08 + 0.05, z);
      cs.rotation.z = Math.sin(t * 0.37) * 0.012;
      radar.rotation.y = t * 1.6;
    });
  }
  animated.push((t) => {
    flames.forEach((fl) => {
      const k = 0.85 + 0.3 * Math.sin(t * 9 + fl.ph) + 0.15 * Math.sin(t * 23 + fl.ph * 2);
      fl.m.scale.set(0.9 + 0.2 * Math.sin(t * 13 + fl.ph), 0.8 + 0.5 * k, 0.9 + 0.2 * Math.cos(t * 11 + fl.ph));
      fl.light.intensity = fl.base * k * (1 - 0.94 * dayU.value);
    });
  });


  // the bases of the landmark buildings (the case studies, the hub, the two districts and the antenna): a stone plinth with joints and a ledge, steps, lit portals, planters, lamps, flags and tiled paving
  {
    const FOOT: { x0: number; x1: number; z0: number; z1: number }[] = [
      { x0: -2.6, x1: 2.6, z0: -2.6, z1: 2.6 },
      { x0: -3.3, x1: 3.3, z0: -3.3, z1: 3.3 },
      { x0: -5.3, x1: 5.3, z0: -1.8, z1: 1.8 },
      { x0: -4.7, x1: 4.7, z0: -1.7, z1: 1.7 },
      { x0: -5.3, x1: 4.4, z0: -2.2, z1: 2.2 },
      { x0: -6.1, x1: 5.9, z0: -1.9, z1: 1.9 },
    ];
    const TINTS = ["#ff7a5c", "#7f8cd6", "#86b08a", "#d6b980", "#8b6f98", "#a9c3d6"].map(C);
    const stone = C("#4a5068");
    const ledge = C("#7b829c");
    const joint = C("#2c3040");
    const dress = (cx: number, cz: number, fp: { x0: number; x1: number; z0: number; z1: number }, i: number, Y0: number, sides: number[], full: boolean) => {
      const mx = cx + (fp.x0 + fp.x1) / 2;
      const mz = cz + (fp.z0 + fp.z1) / 2;
      const W = fp.x1 - fp.x0;
      const D = fp.z1 - fp.z0;
      B.box.add(mx, Y0, mz, W + 0.8, 1.05, D + 0.8, stone);
      B.box.add(mx, Y0 + 1.05, mz, W + 1.1, 0.14, D + 1.1, ledge);
      B.glow.add(mx, Y0 + 1.19, cz + fp.z1 + 0.4, W + 0.9, 0.05, 0.05, TINTS[i].clone().multiplyScalar(0.7));
      B.glow.add(mx, Y0 + 1.19, cz + fp.z0 - 0.4, W + 0.9, 0.05, 0.05, TINTS[i].clone().multiplyScalar(0.7));
      // stone joints on the long faces
      for (let x = fp.x0 - 0.2; x <= fp.x1 + 0.2; x += 1.2) {
        B.box.add(cx + x, Y0, cz + fp.z1 + 0.43, 0.05, 1.05, 0.05, joint);
        B.box.add(cx + x, Y0, cz + fp.z0 - 0.43, 0.05, 1.05, 0.05, joint);
      }
      B.box.add(mx, Y0 + 0.5, cz + fp.z1 + 0.43, W + 0.8, 0.04, 0.05, joint);
      B.box.add(mx, Y0 + 0.5, cz + fp.z0 - 0.43, W + 0.8, 0.04, 0.05, joint);
      // steps, a lit portal and a canopy on both fronts
      for (const side of sides) {
        const fz = side > 0 ? cz + fp.z1 : cz + fp.z0;
        B.box.add(mx, Y0, fz + side * 0.95, 3.6, 0.16, 0.7, C("#8e93a6"));
        B.box.add(mx, Y0, fz + side * 0.62, 3.2, 0.34, 0.4, C("#9aa0b4"));
        B.box.add(mx, Y0 + 0.2, fz + side * 0.47, 1.9, 0.85, 0.12, C("#161a2c"));
        B.glow.add(mx, Y0 + 0.28, fz + side * 0.54, 1.5, 0.7, 0.05, C("#ffcf8a").multiplyScalar(0.85));
        B.box.add(mx, Y0 + 1.3, fz + side * 0.9, 2.6, 0.1, 0.9, pick(AWN));
        for (const sx of [-1.2, 1.2]) B.cyl.add(mx + sx, Y0, fz + side * 1.2, 0.1, 1.3, 0.1, C("#e8e0d0"));
        // planters with shrubs at the corners, a bench and a bin
        for (const sx of [-1, 1]) {
          const px = cx + (sx < 0 ? fp.x0 - 0.2 : fp.x1 + 0.2);
          B.box.add(px, Y0, fz + side * 1.1, 1.1, 0.5, 0.9, C("#8a4f45"));
          B.ico.add(px, Y0 + 0.5, fz + side * 1.1, 1.0, 0.9, 1.0, pick([C("#3f6b4f"), C("#4f7d5a"), C("#58844a")]), r() * 3);
          lampPost(px + sx * 1.1, Y0, fz + side * 1.6, 3.6);
        }
        B.box.add(mx - 3.0, Y0, fz + side * 1.5, 1.5, 0.35, 0.4, C("#6b5a48"));
        B.cyl.add(mx + 3.2, Y0, fz + side * 1.5, 0.4, 0.7, 0.4, C("#3a4a5a"));
        if (full) {
          // a flag on a pole in the tint of the place
          B.cyl.add(cx + fp.x1 + 0.9, Y0, fz + side * 1.0, 0.08, 4.2, 0.08, C("#e8e0d0"));
          B.box.add(cx + fp.x1 + 1.4, Y0 + 3.1, fz + side * 1.0, 1.0, 0.6, 0.04, TINTS[i % 6]);
          // tiled paving in the margin
          for (let x = -5.5; x < 5.5; x += 1.1) {
            const tz2 = fz + side * 1.7;
            B.box.add(cx + x, Y0 - 0.01, tz2, 1.0, 0.03, 0.9, ((Math.round(x / 1.1) + i) & 1) ? C("#656d88") : C("#5a6280"));
          }
        }
      }
      // a few café tables at one end
      for (let q = 0; q < (full ? 2 : 0); q++) {
        const tx = cx + fp.x0 - 1.6;
        const tz = cz + (q ? 1.4 : -1.4);
        B.cyl.add(tx, Y0, tz, 0.7, 0.75, 0.7, C("#8a7a62"));
        B.cyl.add(tx, Y0 + 0.75, tz, 0.08, 1.5, 0.08, C("#e8e0d0"));
        B.cone.add(tx, Y0 + 2.1, tz, 2.0, 0.5, 2.0, pick(AWN));
      }
    };
    FOOT.forEach((fp, i) => dress(CASE_XS[i], CASE_Z, fp, i, 0.3, [1, -1], true));
    // the same treatment for the hub (ONE SYSTEM), the CRM and AUTOMATION districts (four towers each) and the antenna
    dress(0, 0, { x0: -4.8, x1: 4.8, z0: -4.8, z1: 4.8 }, 0, 0.03, [1, -1], true);
    for (const [c0, tn] of [[CRM_C, 0], [AUTO_C, 1]] as const) {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) dress(c0.x + sx * 4.2, c0.z + sz * 4.2, { x0: -2.2, x1: 2.2, z0: -2.2, z1: 2.2 }, tn + (sx > 0 ? 2 : 0), 0.3, [sz], false);
    }
    dress(ANT_C.x, ANT_C.z, { x0: -3.2, x1: 3.2, z0: -3.2, z1: 3.2 }, 2, 0.3, [1, -1], true);
    // the heart of each district: the four towers leave a cross of lanes and a square between them; it gets a fountain, tiled paving, lit lanes, benches, planters, lamps with banners, gates at the lane ends and shopfronts with awnings and signs on every inner face
    for (const [c0, tn] of [[CRM_C, 0], [AUTO_C, 1]] as const) {
      const Y = 0.3;
      const tint = TINTS[tn];
      const WOOD = C("#6b5a48");
      // the fountain: a stone basin, glowing water, a jet and a lit rim
      B.cyl.add(c0.x, Y, c0.z, 2.7, 0.5, 2.7, C("#7b829c"));
      B.cyl.add(c0.x, Y + 0.5, c0.z, 2.2, 0.05, 2.2, C("#37c4e8").multiplyScalar(0.9));
      B.cyl.add(c0.x, Y + 0.5, c0.z, 0.4, 1.4, 0.4, C("#c9ced9"));
      B.glow.add(c0.x, Y + 1.9, c0.z, 0.55, 0.3, 0.55, C("#cfeaff"));
      for (let q = 0; q < 8; q++) {
        const an = (q / 8) * Math.PI * 2;
        B.glow.add(c0.x + Math.cos(an) * 1.25, Y + 0.52, c0.z + Math.sin(an) * 1.25, 0.16, 0.08, 0.16, tint.clone().multiplyScalar(0.9));
      }
      // paving: two-tone tiles over the square and the four lanes, with a lit line down each lane
      for (let gx = -8; gx <= 8; gx++) for (let gz = -8; gz <= 8; gz++) {
        const inLane = (Math.abs(gx) <= 1 && Math.abs(gz) <= 8) || (Math.abs(gz) <= 1 && Math.abs(gx) <= 8);
        if (!inLane || (Math.abs(gx) <= 1 && Math.abs(gz) <= 1)) continue;
        B.box.add(c0.x + gx * 1.05, Y, c0.z + gz * 1.05, 1.0, 0.035, 1.0, (gx + gz) & 1 ? C("#656d88") : C("#5a6280"));
      }
      for (const [ax, az] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const px = -az;
        const pz = ax;
        for (let t = 2.2; t < 8; t += 1.4) B.glow.add(c0.x + ax * t, Y + 0.04, c0.z + az * t, ax ? 0.7 : 0.1, 0.03, az ? 0.7 : 0.1, tint.clone().multiplyScalar(0.55));
        // benches, planters with small trees and lamps with banners along both sides of the lane
        for (const sd of [-1, 1]) {
          for (const t of [3.2, 5.9]) {
            const bx0 = c0.x + ax * t + px * sd * 1.35;
            const bz0 = c0.z + az * t + pz * sd * 1.35;
            B.box.add(bx0, Y, bz0, ax ? 1.3 : 0.4, 0.4, az ? 1.3 : 0.4, WOOD);
          }
          for (const t of [4.5, 7.2]) {
            const bx0 = c0.x + ax * t + px * sd * 1.4;
            const bz0 = c0.z + az * t + pz * sd * 1.4;
            B.box.add(bx0, Y, bz0, 0.7, 0.5, 0.7, C("#8a4f45"));
            B.ico.add(bx0, Y + 0.5, bz0, 0.9, 0.9, 0.9, pick([C("#3f6b4f"), C("#4f7d5a"), C("#58844a")]), r() * 3);
          }
          const lx = c0.x + ax * 4.0 + px * sd * 1.62;
          const lz = c0.z + az * 4.0 + pz * sd * 1.62;
          lampPost(lx, Y, lz, 3.6);
          B.box.add(lx + px * sd * 0.2, Y + 2.0, lz + pz * sd * 0.2, 0.04, 1.0, 0.04, C("#e8e0d0"));
          B.box.add(lx + px * sd * 0.2, Y + 1.2, lz + pz * sd * 0.2, 0.04, 1.0, 0.45, tint);
        }
        // a gate at the end of the lane: two pylons, a lit lintel and the tint of the district
        const gx0 = c0.x + ax * 8.2;
        const gz0 = c0.z + az * 8.2;
        for (const sd of [-1, 1]) {
          B.box.add(gx0 + px * sd * 1.7, Y, gz0 + pz * sd * 1.7, 0.6, 2.8, 0.6, C("#4a5068"));
          B.glow.add(gx0 + px * sd * 1.7, Y + 2.8, gz0 + pz * sd * 1.7, 0.4, 0.25, 0.4, C("#ffcf8a"));
        }
        B.box.add(gx0, Y + 2.8, gz0, ax ? 0.5 : 3.8, 0.3, az ? 0.5 : 3.8, C("#4a5068"));
        B.glow.add(gx0, Y + 2.75, gz0, ax ? 0.2 : 3.4, 0.08, az ? 0.2 : 3.4, tint.clone().multiplyScalar(0.8));
      }
      // shopfronts on every inner face of the four towers: lit glass with mullions, a coloured awning and a neon sign
      const SHOP_SIGNS = ["ARCADE", "CAFE", "MARKET", "BAKERY", "DINER", "DELI", "COFFEE", "PIZZA"];
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const tx = c0.x + sx * 4.2;
        const tz = c0.z + sz * 4.2;
        const warm = C("#ffcf8a").multiplyScalar(0.8);
        // the face looking along the x lane
        B.glow.add(tx - sx * 2.24, Y + 1.3, tz, 0.05, 1.5, 3.6, warm);
        for (let q = -1; q <= 1; q++) B.box.add(tx - sx * 2.26, Y + 1.3, tz + q * 1.2, 0.05, 1.5, 0.08, C("#e8e0d0"));
        B.box.add(tx - sx * 2.7, Y + 2.9, tz, 1.1, 0.1, 3.8, pick(AWN), 0, [0, 0, 0], 0, sx * 0.2);
        signsW[signIdx(pick(SHOP_SIGNS))].add(tx - sx * 2.3, Y + 3.5, tz, 2.6, 0.8, 0.1, new THREE.Color(1, 1, 1), Math.PI / 2);
        // and the face looking along the z lane
        B.glow.add(tx, Y + 1.3, tz - sz * 2.24, 3.6, 1.5, 0.05, warm);
        for (let q = -1; q <= 1; q++) B.box.add(tx + q * 1.2, Y + 1.3, tz - sz * 2.26, 0.08, 1.5, 0.05, C("#e8e0d0"));
        B.box.add(tx, Y + 2.9, tz - sz * 2.7, 3.8, 0.1, 1.1, pick(AWN), 0, [0, 0, 0], -sz * 0.2, 0);
        signsW[signIdx(pick(SHOP_SIGNS))].add(tx, Y + 3.5, tz - sz * 2.3, 2.6, 0.8, 0.1, new THREE.Color(1, 1, 1), 0);
        // trees on the outer corners of the slab
        B.cyl.add(c0.x + sx * 7.9, Y, c0.z + sz * 7.9, 0.2, 1.1, 0.2, C("#5a4538"));
        B.ico.add(c0.x + sx * 7.9, Y + 1.9, c0.z + sz * 7.9, 2.0, 1.8, 2.0, pick([C("#3f6b4f"), C("#4f7d5a"), C("#2f5a45")]), r() * 3);
      }
      pools.push([c0.x, Y + 0.1, c0.z, 9]);
    }
  }

  // the beach villas: modern mansions on the long beach of the northern bay, pools at the back facing the sea, a private road behind them
  {
    let yb = 0.65;
    const STONE1 = C("#cfc8b8");
    // three different villas: 0 pool at the back facing the sea, 1 (mirrored) pool in the front garden and a pergola terrace at the back, 2 a long side pool and an extra upper volume
    const mansion = (px: number, pz: number, k: number, v: number) => {
      const f0 = frame(px, pz, yb, k);
      const m = v === 1 ? -1 : 1;
      const f = {
        W: (lx: number, lz: number) => f0.W(m * lx, lz),
        box: (lx: number, lz: number, by: number, w: number, h: number, d: number, c: THREE.Color) => f0.box(m * lx, lz, by, w, h, d, c),
        glow: (lx: number, lz: number, by: number, w: number, h: number, d: number, c: THREE.Color) => f0.glow(m * lx, lz, by, w, h, d, c),
        cyl: (lx: number, lz: number, by: number, w: number, h: number, d: number, c: THREE.Color) => f0.cyl(m * lx, lz, by, w, h, d, c),
        cone: (lx: number, lz: number, by: number, w: number, h: number, d: number, c: THREE.Color) => f0.cone(m * lx, lz, by, w, h, d, c),
        ico: (lx: number, lz: number, by: number, w: number, h: number, d: number, c: THREE.Color) => f0.ico(m * lx, lz, by, w, h, d, c),
      };
      const tone = [["#ece8de", "#8a6a50"], ["#d9d2c2", "#4a4f5c"], ["#f4f1ea", "#6b7a66"]][v];
      const WALL = C(tone[0]);
      const ACC = C(tone[1]);
      const DARK = C("#2c3040");
      const WARM = C("#ffcf8a").multiplyScalar(0.9);
      const STONE = C("#c9c2b2");
      const HEDGE = C("#2f5a45");
      f.box(0, 0, -0.08, 15.4, 0.1, 21.4, C("#4f8a3f"));
      // boundary wall, with the front open at the driveway
      f.box(0, -10.7, 0, 15.6, 1.4, 0.35, STONE);
      for (const sx of [-1, 1]) f.box(sx * 7.8, 0, 0, 0.35, 1.4, 21.4, STONE);
      f.box(-2.7, 10.8, 0, 10.2, 1.4, 0.35, STONE);
      f.box(7.65, 10.8, 0, 0.5, 1.4, 0.35, STONE);
      for (const lx of [2.45, 7.2]) {
        f.box(lx, 10.8, 0, 0.7, 2.0, 0.7, STONE);
        f.glow(lx, 10.8, 2.0, 0.35, 0.3, 0.35, C("#ffd9a0"));
      }
      for (let q = 0; q < 7; q++) f.box(3.0 + q * 0.6, 10.9, 0.0, 0.05, 1.5, 0.05, C("#161a2c")); // an open metal gate leaf
      // the house: ground floor with a glass front, a wood-slat upper floor, slab roofs and a roof terrace
      f.box(-1.8, 2.0, 0, 9.4, 3.2, 6.4, WALL);
      f.box(-1.8, 2.0, 3.2, 10.2, 0.28, 7.2, DARK);
      f.box(-3.0, 1.4, 3.48, 6.2, 2.7, 4.6, ACC);
      for (let q = 0; q < 12; q++) f.box(-6.0 + q * 0.5, 3.72, 3.5, 0.06, 2.6, 0.05, ACC.clone().multiplyScalar(0.7));
      f.glow(-3.0, 3.73, 3.9, 4.6, 1.4, 0.05, WARM);
      f.box(-3.0, 1.4, 6.18, 7.0, 0.25, 5.4, DARK);
      for (const [gx0, gw] of [[-5.2, 2.6], [-2.0, 3.0], [1.1, 1.6]] as const) {
        f.glow(gx0, 5.23, 0.35, gw, 2.5, 0.05, WARM);
        for (let q = 0; q <= Math.round(gw / 0.8); q++) f.box(gx0 - gw / 2 + q * 0.8, 5.24, 0.35, 0.07, 2.5, 0.04, C("#e8e0d0"));
      }
      f.box(1.8, 5.22, 0, 1.3, 2.8, 0.08, C("#6b4a30"));
      for (const sx of [-1, 1]) f.glow(1.8 + sx * 0.9, 5.3, 1.6, 0.14, 0.3, 0.1, C("#ffd9a0"));
      f.box(1.8, 5.8, 0, 2.8, 0.12, 0.9, STONE);
      for (let q = 0; q < 4; q++) f.box(0.5 + q * 0.7, 3.5, 3.48, 0.6, 0.45, 0.34, C("#1f4f8a")); // solar panels
      for (const [tx, tz, tw, td] of [[2.2, 4.0, 1.2, 0.05], [2.2, 0.6, 1.2, 0.05]] as const) f.glow(tx, tz, 3.48, tw, 0.5, td, C("#cfeaff").multiplyScalar(0.45)); // glass railing
      // the garage, its doors and the driveway with a sports car
      f.box(5.6, 2.0, 0, 4.0, 3.0, 6.0, WALL);
      f.box(5.6, 2.0, 3.0, 4.6, 0.26, 6.6, DARK);
      f.glow(5.6, 5.02, 0.2, 3.2, 2.3, 0.05, WARM.clone().multiplyScalar(0.55));
      for (let q = 0; q < 6; q++) f.box(5.6, 5.05, 0.2 + q * 0.38, 3.22, 0.04, 0.03, C("#6b7088"));
      f.box(5.6, 8.0, -0.02, 4.4, 0.1, 6.2, STONE);
      for (let q = 0; q < 6; q++) f.box(5.6, 5.3 + q * 1.0, 0.07, 4.4, 0.02, 0.03, C("#8a8576"));
      const car = pick(["#b3363a", "#161a2c", "#e8e0d0", "#1f4f8a", "#e6b422"]);
      f.box(5.6, 7.4, 0.12, 0.95, 0.4, 2.0, C(car));
      f.box(5.6, 7.3, 0.5, 0.8, 0.3, 1.0, C("#20253a"));
      for (const sx of [-0.32, 0.32]) f.glow(5.6 + sx, 8.42, 0.3, 0.18, 0.12, 0.05, C("#fff6dc"));
      for (let q = 0; q < 5; q++) for (const sx of [3.2, 8.0]) f.glow(sx, 5.8 + q * 1.3, 0.1, 0.12, 0.22, 0.12, C("#ffd9a0").multiplyScalar(0.8));
      // front garden: a fountain, clipped hedges, cypress columns lit from below and flower beds
      if (v !== 1) {
      f.cyl(-3.0, 8.0, 0, 3.0, 0.5, 3.0, STONE);
      f.glow(-3.0, 8.0, 0.5, 2.5, 0.05, 2.5, C("#37c4e8").multiplyScalar(0.7));
      f.cyl(-3.0, 8.0, 0.5, 0.35, 1.2, 0.35, STONE);
      f.glow(-3.0, 8.0, 1.7, 0.4, 0.2, 0.4, C("#cfeaff").multiplyScalar(0.8));
      f.box(-4.0, 9.9, 0, 6.2, 0.9, 0.6, HEDGE);
      for (const [cx2, cz2] of [[-7.0, 9.3], [-6.5, 6.6], [0.6, 9.6], [-0.4, 7.0]]) {
        f.ico(cx2, cz2, 0.1, 1.0, 3.4, 1.0, pick([C("#2f5a45"), C("#36664a")]));
        f.glow(cx2, cz2, 0.05, 0.25, 0.1, 0.25, C("#ffd9a0"));
      }
      for (let q = 0; q < 6; q++) f.glow(-6.2 + q * 0.5, 8.6, 0.12, 0.2, 0.14, 0.2, pick([C("#ff8aa8"), C("#ffffff"), C("#ffd36a")]).multiplyScalar(0.6));
      }
      // the pool: a stone deck, coping, glowing water with corner lights. Back (0), front garden (1) or a long side pool (2)
      const WOOD = C("#8a6a45");
      const pool = (cx: number, cz: number, ww: number, wd: number, margin: [number, number]) => {
        f.box(cx, cz, 0.02, ww + margin[0], 0.12, wd + margin[1], STONE);
        f.box(cx, cz, 0.1, ww + 0.8, 0.16, wd + 0.8, C("#efe9dc"));
        f.glow(cx, cz, 0.22, ww, 0.05, wd, C("#37c4e8").multiplyScalar(0.85));
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) f.glow(cx + sx * (ww / 2 - 0.4), cz + sz * (wd / 2 - 0.3), 0.24, 0.3, 0.06, 0.3, C("#9ff0ff"));
        for (let q = 0; q < Math.floor(ww / 2.4); q++) f.box(cx - ww / 2 + 1.2 + q * 2.4, cz, 0.26, 0.04, 0.02, wd - 0.4, C("#cfeaff"));
      };
      let pcx = -2.2;
      let pcz = -6.0;
      if (v === 0) pool(-2.2, -6.0, 8.8, 3.8, [3.4, 3.4]);
      else if (v === 1) {
        pcz = 8.0;
        pool(-2.2, 8.0, 7.6, 2.6, [2.8, 2.0]);
        for (const lx of [-5.2, 0.8]) {
          f.box(lx, 10.0, 0.14, 0.8, 0.18, 1.0, C("#f2efe6"));
          f.box(lx, 10.3, 0.3, 0.8, 0.08, 0.5, pick([C("#e6b422"), C("#3f6fb0"), C("#b3363a")]));
        }
        // the back is a stone terrace under a timber pergola, with a long table
        f.box(-2.2, -6.0, 0.02, 12.2, 0.12, 7.2, STONE);
        for (const [lx, lz] of [[-6.6, -9.0], [2.2, -9.0], [-6.6, -3.2], [2.2, -3.2]]) f.cyl(lx, lz, 0.1, 0.22, 2.7, 0.22, WOOD);
        for (let q = 0; q < 8; q++) f.box(-2.2, -9.2 + q * 0.85, 2.8, 9.6, 0.1, 0.16, ACC);
        f.box(-2.2, -6.0, 0.14, 3.4, 0.1, 1.3, WOOD);
        for (const lx of [-3.4, -1.0]) for (const lz of [-7.0, -5.0]) f.box(lx, lz, 0.14, 0.5, 0.45, 0.5, C("#2c3040"));
        f.glow(-2.2, -6.0, 2.7, 3.0, 0.05, 0.3, C("#ffd9a0").multiplyScalar(0.7));
      } else {
        pcx = -3.8;
        pcz = -5.6;
        pool(-3.8, -5.6, 5.0, 6.2, [3.0, 2.4]);
        for (let q = 0; q < 5; q++) f.box(-8.4 + q * 0.01, -2.6 - q * 1.1, 0.14, 0.9, 0.12, 0.5, C("#f2efe6")); // a row of sun beds along the pool
        // an extra upper volume over the garage side
        f.box(2.0, 1.0, 3.48, 3.4, 2.3, 3.8, WALL);
        f.box(2.0, 1.0, 5.78, 4.0, 0.22, 4.4, DARK);
        f.glow(2.0, 4.9, 4.4, 2.6, 1.2, 0.05, WARM);
      }
      if (v !== 1) {
        for (let q = 0; q < 4; q++) {
          f.box(-5.4 + q * 1.1, -9.1, 0.14, 0.8, 0.18, 2.0 * 0.5, C("#f2efe6"));
          f.box(-5.4 + q * 1.1, -9.4, 0.3, 0.8, 0.08, 0.6, pick([C("#e6b422"), C("#3f6fb0"), C("#b3363a")]));
        }
        for (const lx of [-4.8, -1.0]) {
          f.cyl(lx, -9.9, 0, 0.08, 2.2, 0.08, C("#e8e0d0"));
          f.cone(lx, -9.9, 2.1, 2.6, 0.55, 2.6, pick(AWN));
        }
      }
      f.box(5.6, -7.5, 2.6, 4.4, 0.2, 3.6, DARK);
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) f.box(5.6 + sx * 2.0, -7.5 + sz * 1.6, 0, 0.14, 2.6, 0.14, C("#e8e0d0"));
      f.glow(5.6, -7.5, 0.1, 3.6, 0.05, 2.8, WARM.clone().multiplyScalar(0.5));
      f.box(5.6, -8.5, 0.12, 2.6, 0.7, 0.7, C("#6b5a48"));
      f.cyl(5.6, -4.2, 0, 1.3, 0.3, 1.3, C("#8e93a6"));
      f.glow(5.6, -4.2, 0.3, 0.7, 0.35, 0.7, C("#ff8a3a"));
      f.box(-2, -10.3, 0, 14.6, 1.7, 0.7, HEDGE);
      for (const [lx, lz] of [[-7.0, -9.6], [2.4, -9.8]]) {
        const [wx, wz] = f.W(lx, lz);
        addPalm({ box: B.box, cyl: B.cyl, cone: B.cone, ico: B.ico }, wx, yb, wz, 1.2, r, ctx.mobile);
        f.glow(lx, lz, 0.05, 0.3, 0.1, 0.3, C("#ffd9a0"));
      }
      const [pwx, pwz] = f.W(pcx, pcz);
      pools.push([pwx, yb + 0.05, pwz, 5]);
    };
    const plotsZ = [-110, -130, -150];
    const VARIANT = [1, 0, 2];
    // the whole row sits on the grass: its seaward edge stays clear of the sand band, and every house shares one line
    let xc = 1e9;
    for (const pz of plotsZ) for (let dz = -9; dz <= 9; dz += 3) xc = Math.min(xc, findCoast(-200, pz + dz, 1, 0, 14.3).x - 10.9);
    // the private road runs parallel to the row, a fixed distance behind it, then round the edge of the suburbs to the northern avenue
    const ROADV = Math.round(xc - 17);
    makePoly([[ROADV, -164], [ROADV, -104], [Math.min(ROADV, -136), -92], [Math.min(ROADV, -136), -58], [RB.x, RB.z - RB.r]], 4.2, ASPHALT, { dash: true, lamps: true });
    plotsZ.forEach((pz, i) => {
      yb = Math.max(0.55, hmax(xc, pz, 8)) + 0.1;
      addRoad(xc, pz, 15);
      spots.push([xc, pz, 15]);
      mansion(xc, pz, 3, VARIANT[i]); // the front faces the road (inland)
      // a gate on the road side, a private boardwalk down to the sand, lanterns and loungers on the beach
      const gz = pz + (VARIANT[i] === 1 ? -4.4 : 4.4); // the gate sits on the other side of the plot on the mirrored villa
      makeStrip([xc - 10.2, gz], [ROADV, gz], 3.4, ASPHALT);
      const water = findCoast(-200, pz, 1, 0, 3.5).x;
      for (let bxp = xc + 11.4; bxp < water; bxp += 0.7) B.box.add(bxp, yb - 0.02, pz, 0.62, 0.1, 2.2, ((Math.round(bxp / 0.7)) & 1) ? C("#8a6a45") : C("#7a5c3a"));
      for (let bxp = xc + 12; bxp < water; bxp += 2.8) for (const sz of [-1.1, 1.1]) {
        B.cyl.add(bxp, yb, pz + sz, 0.1, 0.9, 0.1, C("#6b5a48"));
        B.glow.add(bxp, yb + 0.95, pz + sz, 0.14, 0.14, 0.14, C("#ffd9a0"));
      }
      for (const sz of [-3.2, 3.4]) {
        const sx = Math.min(water - 0.6, xc + 13);
        B.box.add(sx, yb - 0.02, pz + sz, 0.8, 0.18, 2.0, C("#f2efe6"));
        B.box.add(sx, yb + 0.14, pz + sz, 0.8, 0.08, 0.6, pick([C("#e6b422"), C("#3f6fb0"), C("#b3363a")]));
        B.cyl.add(sx - 0.6, yb, pz + sz, 0.08, 2.2, 0.08, C("#e8e0d0"));
        B.cone.add(sx - 0.6, yb + 2.1, pz + sz, 2.6, 0.55, 2.6, pick(AWN));
      }
    });
  }

  // grass, shrubs, rocks and forests go in last, kept off every road, rail, yard and lot
  {
    const pinesW = new Bucket(GEO.cone(), foliageMat);
    const skirts = ctx.mobile ? 3 : 4;
    const TREESW = ["#2f5a45", "#3f6b4f", "#36664a", "#4f7d5a"].map(C);
    const pineW = (px: number, py: number, pz: number, ps: number, pc: THREE.Color) => {
      B.cyl.add(px, py, pz, 0.28 * ps, 1.0 * ps, 0.28 * ps, C("#4a3a2c"));
      for (let k = 0; k < skirts; k++) {
        const wk = (2.0 - k * (1.6 / skirts)) * ps;
        pinesW.add(px, py + (0.7 + k * (3.0 / skirts)) * ps, pz, wk, 1.5 * ps, wk, pc.clone().multiplyScalar(0.74 + k * 0.1), k * 0.7);
      }
    };
    const hN = (x: number, z: number) => {
      const v = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
      return v - Math.floor(v);
    };
    const inCityRect = (x: number, z: number) => x > -74 && x < 94 && z > -92 && z < 98;
    const GRASS = ["#5f8f45", "#6fa04a", "#7a9a48", "#4f7b3e", "#8f9a52"].map(C);
    const SHRUB = ["#3f6b4f", "#4f7d5a", "#58844a", "#46745a"].map(C);
    const tufts = ctx.mobile ? 900 : 2600;
    for (let tries = 0, placed = 0; tries < 40000 && placed < tufts; tries++) {
      const south = r() < 0.4;
      const x = south ? rr(-70, 80) : rr(-220, -80);
      const z = south ? rr(98, 188) : rr(-90, 100);
      if (inCityRect(x, z) || landL(x, z) < 12) continue;
      const h0 = terrainHeight(x, z);
      if (h0 > 2.2 || onRoad(x, z, 1.4)) continue;
      const h = Math.max(0, h0);
      placed++;
      const q = r();
      if (q < 0.7) {
        for (let k = 0; k < 3; k++) {
          const a = r() * Math.PI * 2;
          B.cone.add(x + Math.cos(a) * 0.25, h - 0.05, z + Math.sin(a) * 0.25, 0.28, 0.55 + r() * 0.5, 0.28, pick(GRASS));
        }
      } else if (q < 0.93) {
        const sc = 0.9 + r() * 0.9;
        B.ico.add(x, h + 0.25 * sc, z, sc * 1.3, sc, sc * 1.3, pick(SHRUB), r() * 3);
      } else {
        const sc = 0.5 + r() * 0.7;
        B.ico.add(x, h + 0.1, z, sc * 1.4, sc * 0.8, sc, C("#7d8094"), r() * 3);
      }
    }
    // forests on the hills
    for (let tries = 0; tries < 6000; tries++) {
      const south = r() < 0.35;
      const x = south ? -200 + r() * 500 : -90 - r() * 420;
      const z = south ? 104 + r() * 300 : -320 + r() * 640;
      if (landL(x, z) < 3) continue;
      const h = terrainHeight(x, z);
      if (h < 1.8 || h > 34) continue;
      if (hN(x, z) < 0.45 || onRoad(x, z, 2.6)) continue;
      pineW(x, h, z, (2 + r() * 2.4) * 0.45, pick(TREESW));
    }
    // a scatter of lights, like far-off villages
    for (let k = 0, placed = 0; k < 2600 && placed < 170; k++) {
      const south = r() < 0.35;
      const x = south ? -200 + r() * 460 : -100 - r() * 380;
      const z = south ? 104 + r() * 280 : -300 + r() * 600;
      if (landL(x, z) < 3 || onRoad(x, z, 2)) continue;
      const h = terrainHeight(x, z);
      if (h < 2.5 || h > 55) continue;
      B.glow.add(x, h + 0.3, z, 0.5, 0.35, 0.5, (r() < 0.8 ? C("#ffb870") : C("#9ec8ff")).multiplyScalar(0.7));
      placed++;
    }
    pinesW.build(scene);
  }
  [...signsW, ...boardsW].forEach((b) => b.build(scene));
  cornB.build(scene);
  // the moved cornfield's farmyard, built last so that nothing drawn before it depends on it: a barn on the far side of the corn with two
  // silos, a trodden yard, hay rolls between barn and field, and lamps
  {
    const bx = -80;
    const bz = 160;
    const yb = Math.max(0.1, hmax(bx, bz, 4));
    addRoad(bx, bz, 16);
    B.box.add(bx, yb - 0.04, bz, 24, 0.1, 16, C("#7a6a4c"));
    barnBuilding(bx, bz, 2);
    for (const [sx, sz, sr, sh] of [[-71, 162.4, 2.8, 5.8], [-71, 158.4, 2.2, 4.6]] as const) {
      B.cyl.add(sx, yb, sz, sr, sh, sr, C("#b8b0a0"));
      for (let k = 0; k < Math.floor(sh / 1.3); k++) B.cyl.add(sx, yb + 0.5 + k * 1.3, sz, sr + 0.15, 0.12, sr + 0.15, C("#8e93a6"));
      B.ico.add(sx, yb + sh - 0.7, sz, sr, 1.3, sr, C("#8a8fa0"));
    }
    B.box.add(-72.3, yb, 160.4, 0.18, 5.4, 0.1, C("#2c3040"));
    for (const [hx, hz] of [[-69.2, 155.6], [-67.8, 156.4], [-69.0, 157.4], [-88.2, 157.2], [-89.6, 156.2]]) B.cyl.add(hx, yb + 0.6, hz, 1.2, 1.2, 1.2, C("#c1a840"), 0, [0, 0, 0], Math.PI / 2);
    for (const [lx, lz] of [[-87, 153], [-73, 153]]) lampPost(lx, yb, lz, 3.2);
  }
  Object.values(B).forEach((b) => b.build(scene));
  return out;
}
