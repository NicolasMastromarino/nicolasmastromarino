import * as THREE from "three";
import type { Bucket } from "./city-kit";

/**
 * Palm trees built from instanced boxes, cones and blobs. Four species are mixed so no two
 * neighbours match: a tall coconut palm, a bushy spiky palm, a slender windswept one and a
 * date palm. Trunks curve and are ringed, and the crowns are layered in tiers of arching
 * fronds (rising, spreading, drooping) so they read as foliage, not as a star of planks.
 */

export type PalmBuckets = { box: Bucket; cyl: Bucket; cone: Bucket; ico: Bucket };

const col = (h: string) => new THREE.Color(h);
const GREENS = ["#2f6a4f", "#3c7d58", "#4f8d52", "#58984f", "#356b4a", "#46845a"].map(col);
const DRY = ["#9a8a45", "#837238"].map(col);
const BARK = ["#7a6249", "#8a6f52", "#6b5640"].map(col);
const RING = col("#5a4733");

type Rng = () => number;
const pick = <T,>(r: Rng, a: T[]) => a[Math.floor(r() * a.length)];

/** rotations (rx, rz with ry = 0, order YXZ) that turn the +y axis into direction d */
const upTo = (dx: number, dy: number, dz: number) => {
  const l = Math.hypot(dx, dy, dz) || 1;
  const x = dx / l;
  const y = dy / l;
  const z = dz / l;
  const rz = -Math.asin(Math.max(-1, Math.min(1, x)));
  const rx = Math.atan2(z, y);
  return { rx, rz };
};

export function addPalm(b: PalmBuckets, x: number, y: number, z: number, s: number, r: Rng, lite = false) {
  const q = r();
  const kind = q < 0.35 ? 0 : q < 0.6 ? 1 : q < 0.8 ? 2 : 3; // coconut, bushy, slender, date
  const a = r() * Math.PI * 2;
  const segs = kind === 1 ? 3 : kind === 2 ? 7 : kind === 3 ? 4 : 6;
  const segH = (kind === 1 ? 0.8 : kind === 2 ? 0.78 : 0.82) * s;
  const bend = (kind === 2 ? 1.5 : kind === 1 ? 0.25 : 0.7) * (0.4 + r()) * s * (r() < 0.5 ? -1 : 1);
  const w0 = (kind === 1 ? 0.42 : kind === 2 ? 0.26 : 0.34) * s;
  const w1 = w0 * 0.62;
  const bark = pick(r, BARK);

  // trunk: tilted segments along a gentle curve, tapering, with a darker ring at every joint
  const P: [number, number, number][] = [];
  for (let k = 0; k <= segs; k++) {
    const t = k / segs;
    const off = bend * t * t;
    P.push([x + Math.cos(a) * off, y + k * segH, z + Math.sin(a) * off]);
  }
  for (let k = 0; k < segs; k++) {
    const [px, py, pz] = P[k];
    const [nx, ny, nz] = P[k + 1];
    const dx = nx - px;
    const dy = ny - py;
    const dz = nz - pz;
    const { rx, rz } = upTo(dx, dy, dz);
    const len = Math.hypot(dx, dy, dz);
    const w = w0 + (w1 - w0) * (k / segs);
    b.cyl.add(px, py, pz, w, len * 1.04, w, bark, 0, [0, 0, 0], rx, rz);
    if (kind !== 1 || k > 0) b.cyl.add(px, py + len * 0.02, pz, w * 1.18, 0.1 * s, w * 1.18, RING, 0, [0, 0, 0], rx, rz);
  }
  const [cx, cy, cz] = P[segs];
  const base = kind === 1 ? w0 * 1.6 : w1 * 1.7;
  b.ico.add(cx, cy + 0.05 * s, cz, base * 1.3, base, base * 1.3, col("#5d6b3a"), r() * 3);

  // a frond: two arching blades (rising then drooping), the second one narrower
  const frond = (th: number, e1: number, e2: number, L1: number, L2: number, w: number, color: THREE.Color) => {
    const d1 = [Math.cos(e1) * Math.cos(th), Math.sin(e1), Math.cos(e1) * Math.sin(th)];
    const c1 = [cx + (d1[0] * L1) / 2, cy + (d1[1] * L1) / 2, cz + (d1[2] * L1) / 2];
    b.box.add(c1[0], c1[1], c1[2], L1, 0.05 * s, w, color, -th, [0, 0, 0], 0, e1);
    const ex = cx + d1[0] * L1;
    const ey = cy + d1[1] * L1;
    const ez = cz + d1[2] * L1;
    const d2 = [Math.cos(e2) * Math.cos(th), Math.sin(e2), Math.cos(e2) * Math.sin(th)];
    b.box.add(ex + (d2[0] * L2) / 2, ey + (d2[1] * L2) / 2, ez + (d2[2] * L2) / 2, L2, 0.05 * s, w * 0.66, color, -th, [0, 0, 0], 0, e2);
  };
  const spike = (th: number, e: number, L: number, w: number, color: THREE.Color) => {
    const dx = Math.cos(e) * Math.cos(th);
    const dy = Math.sin(e);
    const dz = Math.cos(e) * Math.sin(th);
    const { rx, rz } = upTo(dx, dy, dz);
    b.cone.add(cx, cy, cz, w, L, w * 0.32, color, 0, [0, 0, 0], rx, rz);
  };
  const ring = (n: number, off: number, fn: (th: number, i: number) => void) => {
    const m = lite ? Math.max(4, n - 2) : n;
    for (let i = 0; i < m; i++) fn(off + (i / m) * Math.PI * 2 + (r() - 0.5) * 0.25, i);
  };
  const green = () => pick(r, GREENS);
  const lowColor = () => (r() < 0.22 ? pick(r, DRY) : green());

  if (kind === 0) {
    // coconut palm: three tiers, the lowest hanging down, plus a bunch of coconuts
    ring(5, r() * 6, (th) => frond(th, 1.0, 0.25, 0.8 * s, 0.8 * s, 0.4 * s, green()));
    ring(7, r() * 6, (th) => frond(th, 0.4, -0.65, 1.3 * s, 1.35 * s, 0.55 * s, green()));
    ring(7, r() * 6, (th) => frond(th, 0.05, -1.15, 1.15 * s, 1.1 * s, 0.5 * s, lowColor()));
    for (let i = 0; i < 3; i++) b.ico.add(cx + Math.cos(i * 2.1) * 0.22 * s, cy - 0.2 * s, cz + Math.sin(i * 2.1) * 0.22 * s, 0.28 * s, 0.28 * s, 0.28 * s, col("#6b4f34"), r() * 3);
  } else if (kind === 1) {
    // bushy palm: layered spikes, upright in the middle and drooping at the skirt
    ring(7, r() * 6, (th) => spike(th, 1.2, 1.7 * s, 0.5 * s, green()));
    ring(8, r() * 6, (th) => spike(th, 0.55, 2.2 * s, 0.6 * s, green()));
    ring(7, r() * 6, (th) => spike(th, -0.1, 1.9 * s, 0.55 * s, lowColor()));
  } else if (kind === 2) {
    // slender, windswept palm: a few long arching fronds on a tall bent trunk
    ring(6, r() * 6, (th, i) => frond(th, 0.65 - (i % 2) * 0.35, -1.0, 1.5 * s, 1.5 * s, 0.42 * s, i % 3 === 0 ? lowColor() : green()));
    ring(4, r() * 6, (th) => frond(th, 1.15, 0.1, 0.8 * s, 0.7 * s, 0.34 * s, green()));
    b.ico.add(cx, cy - 0.15 * s, cz, 0.26 * s, 0.26 * s, 0.26 * s, col("#6b4f34"), r() * 3);
  } else {
    // date palm: short and full, two dense skirts of arching fronds
    ring(9, r() * 6, (th) => frond(th, 0.55, -0.55, 1.0 * s, 1.0 * s, 0.5 * s, green()));
    ring(9, r() * 6, (th) => frond(th, 0.1, -1.0, 0.95 * s, 0.9 * s, 0.46 * s, lowColor()));
    ring(5, r() * 6, (th) => frond(th, 1.05, 0.2, 0.7 * s, 0.6 * s, 0.34 * s, green()));
  }
}
