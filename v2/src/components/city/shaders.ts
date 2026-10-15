// Low-poly diorama shaders. Everything writes display-space colour directly
// (ColorManagement is off, no tone mapping, no post-processing).

const HASH = /* glsl */ `
  float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
`;

/* -------------------------------------------------------------------- */
/* Buildings: flat-shaded faces, quiet windows, a few warm lights        */
/* -------------------------------------------------------------------- */

export const buildingVertex = /* glsl */ `
  attribute float aSeed;
  attribute vec3 aTint;
  uniform float uSeed;
  uniform vec3 uTintU;
  varying vec3 vWorld;
  varying vec3 vN;
  varying float vSeed;
  varying vec3 vTint;
  void main() {
    mat4 m = modelMatrix;
    #ifdef USE_INSTANCING
      m = modelMatrix * instanceMatrix;
    #endif
    vec4 wp = m * vec4(position, 1.0);
    vWorld = wp.xyz;
    vN = normalize(mat3(m) * normal);
    vSeed = aSeed + uSeed;
    vTint = aTint + uTintU;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

export const buildingFragment = /* glsl */ `
  uniform float uTime;
  uniform float uHover;
  uniform float uActive;
  varying vec3 vWorld;
  varying vec3 vN;
  varying float vSeed;
  varying vec3 vTint;
  ${HASH}
  void main() {
    vec3 n = normalize(vN);
    // flat varyings are not bit-exact across a triangle; snap so hashes never flicker
    float sd = floor(vSeed + 0.5);
    float side = step(abs(n.y), 0.5);

    vec2 uvw = abs(n.x) > 0.5 ? vec2(vWorld.z, vWorld.y) : vec2(vWorld.x, vWorld.y);
    vec2 g = uvw / vec2(0.85, 1.15);
    vec2 id = floor(g);
    vec2 f = fract(g);
    float win = step(0.22, f.x) * step(f.x, 0.78) * step(0.26, f.y) * step(f.y, 0.74);
    win *= step(1.2, vWorld.y); // no windows at street level
    float faceKey = sign(n.x + n.z * 1.7) * 3.1;
    float r = hash(id + sd * 17.0 + faceKey);
    float lit = step(0.7, r);
    float glow = 0.5 + 0.5 * sin(uTime * 0.6 + r * 40.0);

    // soft late-afternoon light from the upper right
    vec3 L = normalize(vec3(0.5, 0.82, 0.38));
    float lam = max(dot(n, L), 0.0);
    float shade = 0.5 + 0.55 * lam;

    vec3 col = vTint * shade;
    vec3 glass = (vTint * 0.5 + vec3(0.07, 0.09, 0.15)) * shade;
    col = mix(col, glass, win * side * 0.9);
    vec3 warmLit = vec3(1.0, 0.8, 0.52) * (0.86 + 0.14 * glow);
    col = mix(col, warmLit, win * side * lit);

    // roofs catch a little more light, the base sits in soft shadow
    col += vec3(0.05, 0.045, 0.04) * step(0.5, n.y);
    col *= mix(0.68, 1.0, smoothstep(0.0, 3.2, vWorld.y));

    col += vec3(0.11, 0.09, 0.07) * (uHover + uActive * 0.8) * shade;
    gl_FragColor = vec4(col, 1.0);
  }
`;

/* -------------------------------------------------------------------- */
/* Ground tile with roads                                                */
/* -------------------------------------------------------------------- */

export const groundVertex = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

export const groundFragment = /* glsl */ `
  varying vec3 vWorld;
  ${HASH}
  void main() {
    vec2 p = vWorld.xz;
    vec2 q = mod(p, 8.0) - 4.0;
    float roadX = 1.0 - step(1.0, abs(q.x));
    float roadZ = 1.0 - step(1.0, abs(q.y));
    float road = max(roadX, roadZ);
    float kerb = max(
      step(1.0, abs(q.x)) * (1.0 - step(1.35, abs(q.x))),
      step(1.0, abs(q.y)) * (1.0 - step(1.35, abs(q.y)))
    );
    float dash = step(0.5, fract((roadX > 0.5 ? p.y : p.x) * 0.5));
    float centre = max(roadX * (1.0 - step(0.07, abs(q.x))), roadZ * (1.0 - step(0.07, abs(q.y)))) * dash;

    vec2 block = floor((p + 4.0) / 8.0);
    float tone = hash(block) * 0.05;
    vec3 col = vec3(0.235, 0.255, 0.33) + tone;
    col = mix(col, vec3(0.3, 0.32, 0.4), kerb);
    col = mix(col, vec3(0.135, 0.15, 0.2), road);
    col = mix(col, vec3(0.5, 0.5, 0.58), centre * 0.5);
    gl_FragColor = vec4(col, 1.0);
  }
`;

/* -------------------------------------------------------------------- */
/* Little cars carrying data along the roads                             */
/* -------------------------------------------------------------------- */

export const packetVertex = /* glsl */ `
  attribute float aLane;
  attribute float aAxis;
  attribute float aSpeed;
  attribute float aOff;
  attribute vec3 aColor;
  uniform float uTime;
  uniform float uHalf;
  varying vec3 vColor;
  varying float vShade;
  void main() {
    float t = fract(uTime * aSpeed + aOff);
    float along = (t - 0.5) * uHalf * 2.0;
    float grow = smoothstep(0.0, 0.05, t) * smoothstep(1.0, 0.95, t);
    vec3 local = position * grow;
    vec3 pos;
    if (aAxis < 0.5) {
      local *= vec3(1.5, 0.5, 0.75);
      pos = vec3(along, 0.28, aLane);
    } else {
      local *= vec3(0.75, 0.5, 1.5);
      pos = vec3(aLane, 0.28, along);
    }
    vColor = aColor;
    vShade = 0.72 + 0.28 * max(normal.y, 0.0) + 0.1 * normal.x;
    gl_Position = projectionMatrix * viewMatrix * vec4(pos + local, 1.0);
  }
`;

export const packetFragment = /* glsl */ `
  varying vec3 vColor;
  varying float vShade;
  void main() {
    gl_FragColor = vec4(vColor * vShade, 1.0);
  }
`;

/* -------------------------------------------------------------------- */
/* Cables with soft pulses of data                                       */
/* -------------------------------------------------------------------- */

export const cableVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const cableFragment = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uOff;
  uniform float uSpeed;
  varying vec2 vUv;
  void main() {
    float t = fract(vUv.x - uTime * uSpeed + uOff);
    float p = smoothstep(0.0, 0.025, t) * smoothstep(0.1, 0.025, t);
    float t2 = fract(vUv.x - uTime * uSpeed * 0.8 + uOff + 0.5);
    float p2 = smoothstep(0.0, 0.025, t2) * smoothstep(0.08, 0.025, t2);
    vec3 col = mix(uColor * 0.62, vec3(1.0, 0.95, 0.85), clamp(p + p2, 0.0, 1.0) * 0.9);
    gl_FragColor = vec4(col, 1.0);
  }
`;

/* -------------------------------------------------------------------- */
/* Rain: thin slanted streaks falling through the whole island           */
/* -------------------------------------------------------------------- */

export const rainVertex = /* glsl */ `
  attribute vec4 aDrop;
  attribute float aEnd;
  uniform float uTime;
  uniform vec2 uCenter;
  void main() {
    float H = 74.0;
    float R = 140.0;
    float y = mod(aDrop.z * H - uTime * aDrop.w, H);
    float yy = y + aEnd * 1.25;
    // the rain is a tile that wraps around the camera, so it falls over whatever you are looking at
    vec2 rel = mod(aDrop.xy - uCenter + R, 2.0 * R) - R;
    vec3 p = vec3(uCenter.x + rel.x + yy * 0.22, yy, uCenter.y + rel.y - yy * 0.1);
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }
`;

export const rainFragment = /* glsl */ `
  uniform float uRain;
  void main() {
    gl_FragColor = vec4(0.66, 0.76, 1.0, 0.11 * uRain);
  }
`;
