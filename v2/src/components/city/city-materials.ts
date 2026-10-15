import * as THREE from "three";

export type Uniform = { value: number };

/** 0 = night, 1 = day. One shared uniform so every material follows the toggle. */
export const dayU: Uniform = { value: 0 };
/** 0 = dry, 1 = pouring: the rain, shared so people and the helicopter can react to it. */
export const rainState: Uniform = { value: 0 };
/** Lit-from-inside materials register here so the engine can switch them off by day. */
export const glowReg: { mat: THREE.MeshBasicMaterial; base: THREE.Color }[] = [];
export function registerGlow(mat: THREE.MeshBasicMaterial) {
  glowReg.push({ mat, base: mat.color.clone() });
}

type WallOpts = {
  time: Uniform;
  hover?: Uniform;
  active?: Uniform;
  /** non-instanced meshes carry their seed/style here instead of aInfo */
  seed?: number;
  style?: number;
  color?: THREE.ColorRepresentation;
};

/**
 * Facade material. A normal physically-lit standard material (so it gets the
 * moon, rim lights and real shadows) with the look of a lived-in building
 * injected on top: window grids, warm lit rooms, shopfront glass, floor lines
 * and a little ambient occlusion at the street. Everything is driven by world
 * position so every building size gets correctly proportioned windows.
 *
 * style: 0 office  1 residential  2 commercial (shop glass at street level)
 *        3 glass tower
 */
export function makeWallMaterial(o: WallOpts) {
  const mat = new THREE.MeshStandardMaterial({
    color: o.color ?? 0xffffff,
    roughness: 0.82,
    metalness: 0.06,
  });
  const hover = o.hover ?? { value: 0 };
  const active = o.active ?? { value: 0 };
  const info = new THREE.Vector3(o.seed ?? 0, o.style ?? 0, 0);

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = o.time;
    shader.uniforms.uDay = dayU;
    shader.uniforms.uHover = hover;
    shader.uniforms.uActive = active;
    shader.uniforms.uInfo = { value: info };

    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        /* glsl */ `#include <common>
        attribute vec3 aInfo;
        uniform vec3 uInfo;
        varying vec3 vWP;
        varying vec3 vWN;
        varying vec3 vInfo;`,
      )
      .replace(
        "#include <begin_vertex>",
        /* glsl */ `#include <begin_vertex>
        mat4 wm = modelMatrix;
        #ifdef USE_INSTANCING
          wm = modelMatrix * instanceMatrix;
        #endif
        vWP = (wm * vec4(transformed, 1.0)).xyz;
        vWN = normalize(mat3(wm) * normal);
        vInfo = aInfo + uInfo;`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        /* glsl */ `#include <common>
        uniform float uTime;
        uniform float uDay;
        uniform float uHover;
        uniform float uActive;
        varying vec3 vWP;
        varying vec3 vWN;
        varying vec3 vInfo;
        float hash21(vec2 p) {
          vec3 p3 = fract(vec3(p.xyx) * 0.1031);
          p3 += dot(p3, p3.yzx + 33.33);
          return fract((p3.x + p3.y) * p3.z);
        }`,
      )
      .replace(
        "#include <color_fragment>",
        /* glsl */ `#include <color_fragment>
        vec3 winEmit = vec3(0.0);
        float winMask = 0.0;
        float fullG = 0.0;
        {
          vec3 n = normalize(vWN);
          float sd = floor(vInfo.x + 0.5);
          float style = floor(vInfo.y + 0.5);
          float side = step(abs(n.y), 0.5);
          vec2 uvw = abs(n.x) > 0.5 ? vec2(vWP.z, vWP.y) : vec2(vWP.x, vWP.y);
          float faceKey = sign(n.x + n.z * 1.7) * 3.1;

          vec2 cell = vec2(1.05, 1.3);
          float mx = 0.2;
          if (style > 0.5 && style < 1.5) { cell = vec2(1.6, 1.4); mx = 0.16; }
          if (style > 1.5 && style < 2.5) { cell = vec2(1.25, 1.35); mx = 0.18; }
          if (style > 2.5) { cell = vec2(0.82, 1.05); mx = 0.05; }
          float full = step(3.5, style);
          if (full > 0.5) { cell = vec2(1.15, 1.3); mx = 0.025; }
          fullG = full;
          vec2 g = uvw / cell;
          vec2 id = floor(g);
          vec2 f = fract(g);
          float win = step(mx, f.x) * step(f.x, 1.0 - mx) * mix(step(0.22, f.y) * step(f.y, 0.82), step(0.035, f.y) * step(f.y, 0.965), full);

          // street level: big warm shopfront glass on commercial buildings
          float shop = 0.0;
          if (style > 1.5 && style < 2.5) {
            vec2 gs = vec2(uvw.x / 1.9, 0.0);
            float fx = fract(gs.x);
            shop = step(0.08, fx) * step(fx, 0.92) * step(0.45, vWP.y) * step(vWP.y, 2.75);
            win *= step(3.3, vWP.y);
          } else {
            win *= step(1.5, vWP.y);
          }

          float life = hash21(vec2(sd, 3.7)) * 0.26;
          float r = hash21(id + sd * 17.0 + faceKey);
          float lit = max(step(0.76 - life * 0.7, r), full * step(0.4, r));
          float flick = step(0.995, hash21(id + floor(uTime * 0.4) + sd));
          float kind = hash21(id * 1.7 + sd + 9.0);
          vec3 warm = vec3(1.0, 0.72, 0.4);
          if (kind > 0.74) warm = vec3(0.72, 0.84, 1.0);
          if (kind > 0.93) warm = vec3(1.0, 0.45, 0.62);
          if (kind < 0.07) warm = vec3(0.45, 0.95, 0.9);

          // inner pane vs frame, sill, curtains, masonry, mullions, pilasters, rain streaks
          float inset = mix(0.07, 0.02, full);
          float winI = step(mx + inset, f.x) * step(f.x, 1.0 - mx - inset) * mix(step(0.29, f.y) * step(f.y, 0.78), step(0.07, f.y) * step(f.y, 0.93), full) * (win > 0.5 ? 1.0 : 0.0);
          float frameM = win * (1.0 - winI) * side;
          float sill = step(0.17, f.y) * step(f.y, 0.25) * step(mx - 0.05, f.x) * step(f.x, 1.0 - mx + 0.05) * side * step(1.5, vWP.y);
          float glass = max(win, shop) * side;
          vec3 shopWarm = mix(vec3(1.0, 0.66, 0.34), vec3(1.0, 0.82, 0.55), hash21(vec2(floor(uvw.x / 1.9), sd)));
          float shopLit = step(0.12, hash21(vec2(floor(uvw.x / 1.9) + sd, 5.0)));
          float floorLine = 1.0 - smoothstep(0.0, 0.1, f.y) * 0.0;

          // unlit glass is dark and a touch bluish; frames stay in the wall colour
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.32, 0.38, 0.55), glass * (1.0 - lit * 0.4));
          diffuseColor.rgb *= mix(0.72, 1.0, smoothstep(0.0, 3.0, vWP.y));
          diffuseColor.rgb *= mix(0.88, 1.0, step(0.12, f.y));
          diffuseColor.rgb *= 1.0 - 0.5 * frameM;
          diffuseColor.rgb *= 1.0 + 0.3 * sill;
          float glassTower = step(2.5, style);
          float bx = fract(uvw.x * 1.6 + mod(floor(vWP.y * 5.0), 2.0) * 0.5);
          float by = fract(vWP.y * 5.0);
          float brick = clamp(step(0.93, bx) + step(0.9, by), 0.0, 1.0);
          diffuseColor.rgb *= 1.0 - 0.08 * brick * side * (1.0 - win) * (1.0 - glassTower);
          float mull = clamp(step(0.93, f.x) + step(0.94, f.y), 0.0, 1.0);
          diffuseColor.rgb *= 1.0 - 0.18 * mull * glassTower * side;
          float pil = step(0.88, fract(uvw.x / (cell.x * 4.0)));
          diffuseColor.rgb *= 1.0 - 0.09 * pil * side * (1.0 - win) * (1.0 - glassTower);
          float sr = hash21(vec2(floor(uvw.x * 5.0), sd));
          float streak = step(0.78, sr) * smoothstep(1.0, 0.0, fract(vWP.y * 0.07 + sr));
          diffuseColor.rgb *= 1.0 - 0.2 * streak * side;
          float curt = step(0.55, hash21(id + 7.7 + sd)) * step(f.y, 0.56);

          float nightK = 1.0 - uDay * 0.94;
          winEmit += warm * 1.05 * winI * side * lit * (1.0 - flick * 0.6) * (1.0 - 0.55 * curt) * nightK;
          winEmit += shopWarm * 0.85 * shop * side * shopLit * (1.0 - uDay * 0.85);
          winEmit += vec3(0.02, 0.03, 0.06) * glass * (1.0 - frameM);
          winEmit += vec3(0.30, 0.46, 0.66) * glass * (1.0 - frameM) * uDay * 0.42;
          if (full > 0.5) {
            // full glass: a blue-black mirror that reflects the sky, brighter toward the top, with a slow sheen across it
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.14, 0.26, 0.42), glass * 0.85);
            float skyK = 0.5 + 0.5 * smoothstep(0.0, 60.0, vWP.y);
            winEmit += mix(vec3(0.05, 0.10, 0.22), vec3(0.26, 0.46, 0.78), uDay) * glass * skyK * 0.5;
            float sheen = smoothstep(0.82, 1.0, sin(vWP.x * 0.33 + vWP.z * 0.33 + vWP.y * 0.1)) * 0.4;
            winEmit += vec3(0.7, 0.86, 1.0) * sheen * glass * (0.25 + uDay * 0.9);
          }
          winEmit += vec3(1.0, 0.78, 0.5) * glass * (uHover * 0.7 + uActive * 0.26);
          diffuseColor.rgb += vec3(0.05, 0.04, 0.03) * (uHover * 0.8 + uActive * 0.35);
          winMask = glass;
        }`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        /* glsl */ `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, mix(0.18, 0.05, fullG), winMask);`,
      )
      .replace(
        "#include <metalnessmap_fragment>",
        `#include <metalnessmap_fragment>
        metalnessFactor = mix(metalnessFactor, 0.9, winMask * fullG);`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        /* glsl */ `#include <emissivemap_fragment>
        totalEmissiveRadiance += winEmit;`,
      );
  };
  mat.customProgramCacheKey = () => "wall-v3";
  return mat;
}

/**
 * Leaves and needles: a lit standard material with clumps of lighter and darker foliage and a
 * soft vertical banding, driven by world position so every tree gets its own texture.
 */
export function makeFoliageMaterial() {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0 });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vFP;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vec4 fw = modelMatrix * vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          fw = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
        #endif
        vFP = fw.xyz;`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vFP;
        float fh(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        {
          vec3 q = vFP;
          float leaf = fh(floor(q * vec3(3.6, 3.2, 3.6)));
          float clump = fh(floor(q * vec3(1.3, 1.1, 1.3) + 7.0));
          float shade = 0.82 + leaf * 0.26 + (clump - 0.5) * 0.18;
          float band = smoothstep(0.0, 1.0, fract(q.y * 1.8));
          diffuseColor.rgb *= shade * (0.88 + 0.16 * band);
        }`,
      );
  };
  mat.customProgramCacheKey = () => "foliage-v1";
  return mat;
}

/** A big LED billboard: gradient panel with a headline and a small line under it. */
export function makeBoardTexture(headline: string, sub: string, c1: string, c2: string) {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 448;
  const g = c.getContext("2d")!;
  const gr = g.createLinearGradient(0, 0, 1024, 448);
  gr.addColorStop(0, c1);
  gr.addColorStop(1, c2);
  g.fillStyle = gr;
  g.fillRect(0, 0, 1024, 448);
  g.fillStyle = "rgba(0,0,0,0.18)";
  for (let y = 0; y < 448; y += 8) g.fillRect(0, y, 1024, 2); // LED scanlines
  g.fillStyle = "#fff8ec";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.shadowColor = "rgba(0,0,0,0.45)";
  g.shadowBlur = 18;
  g.font = "800 150px 'Arial Black', Arial, sans-serif";
  g.fillText(headline, 512, 190);
  g.font = "600 52px Arial, sans-serif";
  g.fillText(sub, 512, 345);
  g.strokeStyle = "rgba(255,255,255,0.85)";
  g.lineWidth = 10;
  g.strokeRect(18, 18, 988, 412);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Matte props: roofs, awnings, poles, tanks, trunks. Colour comes per instance. */
export function makeTrimMaterial() {
  return new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.78, metalness: 0.1 });
}

/** Lit-from-inside things (lamp bulbs, neon, headlights). HDR colour feeds the bloom. */
export function makeGlowMaterial(intensity = 1.8) {
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(intensity, intensity, intensity) });
  registerGlow(mat);
  return mat;
}

/** Neon sign: a dark panel with glowing text drawn into a canvas. */
export function makeSignTexture(text: string, color: string, vertical = false) {
  const c = document.createElement("canvas");
  c.width = vertical ? 128 : 512;
  c.height = vertical ? 512 : 160;
  const g = c.getContext("2d")!;
  g.fillStyle = "#0b0d18";
  g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = color;
  g.lineWidth = 6;
  g.shadowColor = color;
  g.shadowBlur = 18;
  g.strokeRect(10, 10, c.width - 20, c.height - 20);
  g.fillStyle = color;
  g.textAlign = "center";
  g.textBaseline = "middle";
  if (vertical) {
    g.font = "700 74px 'Arial Black', Arial, sans-serif";
    const letters = text.split("");
    const step = (c.height - 60) / letters.length;
    letters.forEach((ch, i) => g.fillText(ch, c.width / 2, 40 + step * (i + 0.5)));
  } else {
    g.font = "700 88px 'Arial Black', Arial, sans-serif";
    g.fillText(text, c.width / 2, c.height / 2 + 4);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
