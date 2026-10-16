import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { cableFragment, cableVertex, rainFragment, rainVertex } from "./shaders";
import { cityBus } from "./city-bus";
import { INDUSTRIES, laneOf } from "./industries";
import {
  ANT_C,
  AUTO_C,
  CASE_XS,
  CASE_Z,
  CRM_C,
  GROUND,
  HALF,
  LAND_GLSL,
  ZONES,
  findCoast,
  inZone,
  landL,
  rand,
  smooth,
} from "./city-layout";
import { Bucket, GEO, buildCity, paintGround, type Plan } from "./city-kit";
import { HIGHWAY_Z, ROADS_X, ROADS_Z, terrainColor, terrainHeight } from "./city-terrain";
import { dayU, glowReg, makeFoliageMaterial, rainState, makeGlowMaterial, makeTrimMaterial, makeWallMaterial, type Uniform } from "./city-materials";
import { buildWorld, type World } from "./city-world";

export type CityRoute = "home" | "services" | "case-studies" | "about" | "blog" | "contact";

export type HoverInfo = { id: string; label: string; hint: string; href: string };

export type CityLabels = {
  hub: string;
  tools: string[];
  cases: string[];
  crm: string;
  automation: string;
  contact: string;
  hint: string;
  routes: { services: string; caseStudies: string; contact: string };
  /** names and hover hints of the industry buildings, in the order of INDUSTRIES */
  industries: string[];
  industryHint: string;
};

type Opts = {
  canvas: HTMLCanvasElement;
  labels: CityLabels;
  fontFamily: string;
  reduced: boolean;
  mobile: boolean;
  onHover: (info: HoverInfo | null, x: number, y: number) => void;
  onActivate: (info: HoverInfo) => void;
};

type Landmark = {
  id: string;
  info: HoverInfo;
  group: THREE.Group;
  hoverU: Uniform;
  activeU: Uniform;
  mats: Map<string, THREE.MeshStandardMaterial>;
  sprites: THREE.Sprite[];
  hover: number;
  hoverTarget: number;
  active: number;
  activeTarget: number;
  /** ground level under the landmark, for sites that are not at y = 0 */
  baseY: number;
};

// Fog: normal depth haze, plus a fade by distance from the city edge so it melts into mist
// on the west, east and north sides. The south side is the sea and is left alone.
THREE.ShaderChunk.fog_pars_vertex = `
#ifdef USE_FOG
  varying float vFogDepth;
  varying vec3 vFogWorld;
#endif`;
THREE.ShaderChunk.fog_vertex = `
#ifdef USE_FOG
  vFogDepth = - mvPosition.z;
  vFogWorld = (inverse(viewMatrix) * mvPosition).xyz;
#endif`;
THREE.ShaderChunk.fog_pars_fragment = `
#ifdef USE_FOG
  uniform vec3 fogColor;
  varying float vFogDepth;
  varying vec3 vFogWorld;
  uniform float fogNear;
  uniform float fogFar;
#endif`;
THREE.ShaderChunk.fog_fragment = `
#ifdef USE_FOG
  float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
  // the engine widens fogFar by day, which also thins this edge haze
  float nightK = clamp( ( 1500.0 - fogFar ) / 520.0, 0.0, 1.0 );
  fogFactor = max( fogFactor, 0.4 * ( 0.28 + 0.72 * nightK ) * smoothstep( 60.0, 280.0, - vFogWorld.x ) );
  gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`;

const hex = (h: string) => new THREE.Color(h);
const hashN = (x: number, z: number) => {
  const v = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return v - Math.floor(v);
};
const CORAL = hex("#d8694f");
const PERI = hex("#7f8cd6");
const SAGE = hex("#86b08a");
const SAND = hex("#d6b980");
const ICE = hex("#a9c3d6");
const PLUM = hex("#8b6f98");
// facades for the landmarks: a bit lighter and warmer than the surrounding city
const LM_CORAL = hex("#c9806d");
const LM_PERI = hex("#7d89c0");
const LM_SAGE = hex("#7fa28a");
const LM_SAND = hex("#c9ad7e");
const LM_ICE = hex("#8fa7bd");
const LM_PLUM = hex("#8d73a0");

const ELEV = Math.atan(1 / Math.SQRT2); // true isometric elevation (~35.26deg)
const DIST = 280;
const ZOOM_MIN = 30;
const ZOOM_MAX = 106; // how far the camera pulls back on the page routes, in world units of view height
/** how far free roam may pull back */
const ZOOM_MAX_FREE = 106;
/** the stored free-roam zoom may go further than ZOOM_MAX_FREE; the real limit is set in frame() from the screen's shape */
const ZOOM_FREE_STORE = 200;
/** how wide a view free roam may pull back to, in world units: enough to take in the whole city on any screen */
const FREE_VIEW_WIDTH = 190;
const angDiff = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

export class CityEngine {
  private o: Opts;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-50, 50, 50, -50, 1, 900);
  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;
  private raf = 0;
  private running = false;
  private clock = new THREE.Clock();
  private time = 0;
  private route: CityRoute = "home";
  private mouse = new THREE.Vector2(0, 0);
  private mouseS = new THREE.Vector2(0, 0);
  private pointerPx = { x: 0, y: 0 };
  private scrollS = 0;
  private shift = 0;
  private camTarget = new THREE.Vector3(0, 0, 0);
  private lastTarget3 = new THREE.Vector3();
  private viewH = 320;
  private az = Math.PI / 4 + 1.4;
  private introTime = 0;
  private raycaster = new THREE.Raycaster();
  private pickables: THREE.Object3D[] = [];
  private landmarks = new Map<string, Landmark>();
  private hovered: Landmark | null = null;
  private hoverEl: EventTarget | null = null;
  private hasMouse = false;
  private frameNo = 0;
  private cityGroup: THREE.Group | null = null;
  private plan: Plan | null = null;
  private accents: THREE.PointLight[] = [];
  private exploring = false;
  private free = { target: new THREE.Vector3(0, 6, 0), zoom: 100, az: Math.PI / 4 };
  private keys = new Set<string>();
  private pointers = new Map<number, { x: number; y: number }>();
  private dragMoved = 0;
  private pinch: { dist: number; ang: number } | null = null;
  private lastDragTarget: EventTarget | null = null;
  private boundDown: (e: PointerEvent) => void;
  private boundUp: (e: PointerEvent) => void;
  private boundWheel: (e: WheelEvent) => void;
  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundKeyUp: (e: KeyboardEvent) => void;
  onExploreExit: (() => void) | null = null;
  private animated: ((t: number, dt: number) => void)[] = [];
  private labels: { sp: THREE.Sprite; w: number }[] = [];
  private time1 = { value: 0 };
  private frameTimes: number[] = [];
  private lowQuality = false;
  private unitBox = GEO.box();
  private boundMove: (e: PointerEvent) => void;
  private boundClick: () => void;
  private boundResize: () => void;
  private world: World | null = null;
  private farmSpots: [number, number, number][] = [];
  private rainOn = false;
  private rainK = 0;
  private dayHold = 1.5; // the city opens in daylight and dry, then evening falls and the rain starts
  private opening = true;
  private dayOn = false;
  private dayK = 1;
  private dayApplied = -1;
  private rainApplied = -1;
  private hemi!: THREE.HemisphereLight;
  private moon!: THREE.DirectionalLight;
  private pinkL!: THREE.DirectionalLight;
  private blueL!: THREE.DirectionalLight;
  private cityLights: { l: THREE.PointLight; base: number }[] = [];
  private terrainGlow = { value: 0.3 };
  private groundMat: THREE.MeshStandardMaterial | null = null;
  /** a landmark the camera is looking at while its panel is open */
  private focusId: string | null = null;
  private seaMat: THREE.ShaderMaterial | null = null;
  private rainU = { value: 1 };
  private rainCenter = { value: new THREE.Vector2() };
  private rainMesh: THREE.LineSegments | null = null;
  private mistMats: { m: THREE.SpriteMaterial; base: number }[] = [];
  private bgCanvas: HTMLCanvasElement | null = null;
  private bgTex: THREE.CanvasTexture | null = null;

  constructor(opts: Opts) {
    this.o = opts;
    this.renderer = new THREE.WebGLRenderer({
      canvas: opts.canvas,
      antialias: opts.mobile, // desktop gets MSAA through the composer target
      powerPreference: "high-performance",
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.buildBackdrop();
    this.buildLights();
    this.buildIsland();
    this.buildLandmarks();
    this.buildCars();
    this.buildMirror();
    this.buildGulls();
    this.buildSea();
    this.buildLandscape();
    this.world = buildWorld({ scene: this.scene, animated: this.animated, mobile: this.o.mobile, plan: this.plan!, time: this.time1, farms: this.farmSpots });
    // (the sprite mist banks are gone: they were cut off in straight lines by the ground and the sea)
    this.buildPeople();
    this.buildRain();
    this.setupComposer();
    this.scene.fog = new THREE.Fog(0x232957, 380, 980);

    this.boundMove = this.onPointerMove.bind(this);
    this.boundClick = this.onClick.bind(this);
    this.boundResize = this.resize.bind(this);
    this.boundDown = this.onPointerDown.bind(this);
    this.boundUp = this.onPointerUp.bind(this);
    this.boundWheel = this.onWheel.bind(this);
    this.boundKeyDown = (e: KeyboardEvent) => {
      if (!this.exploring) return;
      if (e.key === "Escape") {
        this.onExploreExit?.();
        return;
      }
      this.keys.add(e.key.toLowerCase());
    };
    this.boundKeyUp = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase());
    window.addEventListener("pointerdown", this.boundDown);
    window.addEventListener("pointerup", this.boundUp);
    window.addEventListener("pointercancel", this.boundUp);
    window.addEventListener("wheel", this.boundWheel, { passive: false });
    window.addEventListener("keydown", this.boundKeyDown);
    window.addEventListener("keyup", this.boundKeyUp);
    window.addEventListener("pointermove", this.boundMove, { passive: true });
    window.addEventListener("click", this.boundClick);
    window.addEventListener("resize", this.boundResize);
    this.resize();
    this.setupDebugPins();

    if (opts.reduced) {
      this.dayK = 0;
      this.rainK = 0;
      this.dayHold = 0;
      this.opening = false;
      this.introTime = 99;
      this.viewH = 90;
      this.az = Math.PI / 4;
    }
  }

  /**
   * Review helper, only active with ?debug in the URL: a readout of the world coordinates under the cursor,
   * and numbered pins you can drop with M (Backspace removes the last, C copies the list).
   */
  private setupDebugPins() {
    if (typeof window === "undefined" || !new URLSearchParams(window.location.search).has("debug")) return;
    const hud = document.createElement("div");
    hud.style.cssText = "position:fixed;left:12px;top:12px;z-index:9999;max-width:340px;padding:10px 12px;border-radius:10px;background:rgba(10,12,24,0.82);color:#fff;font:12px/1.5 ui-monospace,Menlo,monospace;pointer-events:none;white-space:pre-wrap";
    document.body.appendChild(hud);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.2);
    const pins: { x: number; z: number }[] = [];
    const pinGroup = new THREE.Group();
    this.scene.add(pinGroup);
    let cur: { x: number; z: number } | null = null;
    const draw = () => {
      hud.textContent =
        "DEBUG  (M: pin here, Backspace: remove last, C: copy)\n" +
        (cur ? "cursor  x " + cur.x.toFixed(1) + "   z " + cur.z.toFixed(1) : "cursor  -") +
        pins.map((p, i) => "\npin " + (i + 1) + "   x " + p.x.toFixed(1) + "   z " + p.z.toFixed(1)).join("");
    };
    const rebuild = () => {
      while (pinGroup.children.length) pinGroup.remove(pinGroup.children[0]);
      pins.forEach((p, i) => {
        const beam = new THREE.Mesh(new THREE.BoxGeometry(0.5, 60, 0.5), new THREE.MeshBasicMaterial({ color: 0xff2fd0, fog: false }));
        beam.position.set(p.x, 30, p.z);
        pinGroup.add(beam);
        const cv = document.createElement("canvas");
        cv.width = cv.height = 64;
        const g = cv.getContext("2d")!;
        g.fillStyle = "#ff2fd0";
        g.beginPath();
        g.arc(32, 32, 30, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = "#fff";
        g.font = "bold 40px sans-serif";
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText(String(i + 1), 32, 34);
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: false, fog: false }));
        sp.scale.set(6, 6, 1);
        sp.position.set(p.x, 62, p.z);
        pinGroup.add(sp);
      });
      draw();
    };
    window.addEventListener("pointermove", (e) => {
      const ndc = new THREE.Vector2((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
      this.raycaster.setFromCamera(ndc, this.camera);
      const hit = new THREE.Vector3();
      if (this.raycaster.ray.intersectPlane(plane, hit)) {
        cur = { x: hit.x, z: hit.z };
        draw();
      }
    });
    window.addEventListener("keydown", (e) => {
      const k = e.key.toLowerCase();
      if (k === "m" && cur) {
        pins.push({ ...cur });
        rebuild();
      } else if (k === "backspace") {
        pins.pop();
        rebuild();
      } else if (k === "c" && pins.length) {
        const txt = pins.map((p, i) => "pin " + (i + 1) + ": x " + p.x.toFixed(1) + ", z " + p.z.toFixed(1)).join("\n");
        void navigator.clipboard?.writeText(txt);
      }
    });
    draw();
  }

  /* ------------------------------------------------------------------ */
  /* Public                                                              */
  /* ------------------------------------------------------------------ */

  setRoute(route: CityRoute) {
    this.route = route;
    if (this.hovered) {
      this.hovered.hoverTarget = 0;
      this.hovered = null;
      this.o.onHover(null, 0, 0);
    }
  }

  /** look at an industry building (id like "ind-hvac"), or let go with null */
  setFocus(id: string | null) {
    this.focusId = id;
  }

  setExplore(on: boolean) {
    if (on === this.exploring) return;
    this.exploring = on;
    this.keys.clear();
    this.pointers.clear();
    this.pinch = null;
    if (on) {
      this.free.target.copy(this.camTarget);
      this.free.target.y = 6;
      this.free.zoom = Math.min(Math.max(this.viewH, 40), ZOOM_MAX_FREE);
      this.free.az = this.az;
    }
  }

  setRain(on: boolean) {
    this.rainOn = on;
  }

  setDay(on: boolean) {
    this.dayOn = on;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.clock.start();
    const loop = () => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      this.frame();
    };
    loop();
  }

  dispose() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("pointerdown", this.boundDown);
    window.removeEventListener("pointerup", this.boundUp);
    window.removeEventListener("pointercancel", this.boundUp);
    window.removeEventListener("wheel", this.boundWheel);
    window.removeEventListener("keydown", this.boundKeyDown);
    window.removeEventListener("keyup", this.boundKeyUp);
    window.removeEventListener("pointermove", this.boundMove);
    window.removeEventListener("click", this.boundClick);
    window.removeEventListener("resize", this.boundResize);
    this.scene.traverse((obj) => {
      const m = obj as THREE.Mesh;
      m.geometry?.dispose?.();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose?.();
    });
    this.composer?.dispose();
    this.renderer.dispose();
  }

  /* ------------------------------------------------------------------ */
  /* Atmosphere                                                          */
  /* ------------------------------------------------------------------ */

  private buildBackdrop() {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 512;
    this.bgCanvas = c;
    this.bgTex = new THREE.CanvasTexture(c);
    this.bgTex.colorSpace = THREE.SRGBColorSpace;
    this.paintBackdrop(0);
    this.scene.background = this.bgTex;
  }

  /** Night sky with the reference's split (warm glow bottom-left, cold top-right), blended toward a sunny day. */
  private paintBackdrop(k: number) {
    const c = this.bgCanvas;
    if (!c) return;
    const g = c.getContext("2d")!;
    const mix = (a: string, b: string) => new THREE.Color(a).lerp(new THREE.Color(b), k).getStyle();
    const lerp = (a: number, b: number) => Math.round(a + (b - a) * k);
    const base = g.createLinearGradient(0, 0, 0, 512);
    base.addColorStop(0, mix("#0c1230", "#4c98de"));
    base.addColorStop(0.55, mix("#171c40", "#86c1ee"));
    base.addColorStop(1, mix("#241d3c", "#f1dfc6"));
    g.fillStyle = base;
    g.fillRect(0, 0, 512, 512);
    const wc = lerp(190, 255) + "," + lerp(70, 214) + "," + lerp(90, 150);
    const warm = g.createRadialGradient(40, 520, 10, 40, 520, 380);
    warm.addColorStop(0, "rgba(" + wc + ",0.55)");
    warm.addColorStop(1, "rgba(" + wc + ",0)");
    g.fillStyle = warm;
    g.fillRect(0, 0, 512, 512);
    const cc = lerp(70, 140) + "," + lerp(110, 190) + "," + lerp(230, 255);
    const cold = g.createRadialGradient(500, 60, 10, 500, 60, 340);
    cold.addColorStop(0, "rgba(" + cc + "," + (0.45 - 0.1 * k) + ")");
    cold.addColorStop(1, "rgba(" + cc + ",0)");
    g.fillStyle = cold;
    g.fillRect(0, 0, 512, 512);
    if (this.bgTex) this.bgTex.needsUpdate = true;
  }

  private buildLights() {
    this.hemi = new THREE.HemisphereLight(0x6674c4, 0x241c3a, 0.5);
    this.scene.add(this.hemi);

    // cold moonlight from the back-right: casts the long soft shadows
    const moon = new THREE.DirectionalLight(0x9db4ff, 0.85);
    moon.position.set(46, 96, -40);
    moon.castShadow = true;
    const s = this.o.mobile ? 1024 : 4096;
    moon.shadow.mapSize.set(s, s);
    const sc = moon.shadow.camera;
    sc.left = -118;
    sc.right = 118;
    sc.top = 118;
    sc.bottom = -118;
    sc.near = 10;
    sc.far = 360;
    moon.shadow.bias = -0.0004;
    moon.shadow.normalBias = 0.35;
    this.scene.add(moon);
    this.moon = moon;

    // the two colours bleeding in from the street, like the reference
    const pink = new THREE.DirectionalLight(0xff5c86, 0.95);
    pink.position.set(-90, 38, 70);
    this.scene.add(pink);
    this.pinkL = pink;
    const blue = new THREE.DirectionalLight(0x4f86ff, 0.9);
    blue.position.set(80, 40, 90);
    this.scene.add(blue);
    this.blueL = blue;

    // two coloured lamps that follow whichever landmark you are looking at
    for (const c of [0xff4f9a, 0x4fd8ff]) {
      const pl = new THREE.PointLight(c, 0, 30, 1.6);
      this.scene.add(pl);
      this.accents.push(pl);
    }
  }

  private setupComposer() {
    if (this.o.mobile) return;
    const size = this.renderer.getSize(new THREE.Vector2());
    const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(this.renderer, target);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(size.clone().multiplyScalar(0.5), 0.5, 0.7, 0.88);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
  }

  /* ------------------------------------------------------------------ */
  /* The island                                                          */
  /* ------------------------------------------------------------------ */

  private buildIsland() {
    const root = new THREE.Group();
    this.scene.add(root);

    const city = buildCity(this.time1, this.o.mobile);
    root.add(city.group);
    this.cityGroup = city.group;
    this.plan = city.plan;
    this.animated.push((t) => city.tick(t));
    city.plan.lights.forEach((l) => {
      const pl = new THREE.PointLight(l.color, l.intensity, l.distance, 1.8);
      pl.position.set(l.x, l.y, l.z);
      this.scene.add(pl);
      this.cityLights.push({ l: pl, base: l.intensity });
    });
    this.buildSteam(city.plan.steam);

    const tex = paintGround(city.plan, this.o.mobile ? 7 : 14);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(GROUND.x1 - GROUND.x0, GROUND.z1 - GROUND.z0).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({
        map: tex.map,
        emissiveMap: tex.emissive,
        emissive: new THREE.Color(1, 1, 1),
        emissiveIntensity: 0.9,
        roughnessMap: tex.rough,
        roughness: 1,
        metalness: 0.15,
        alphaMap: tex.alpha,
        transparent: true,
      }),
    );
    this.groundMat = ground.material as THREE.MeshStandardMaterial;
    this.groundMat.onBeforeCompile = (sh) => {
      sh.uniforms.uDay = dayU;
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform float uDay;")
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
        if (diffuseColor.g > diffuseColor.r * 1.12 && diffuseColor.g > diffuseColor.b * 1.12) diffuseColor.rgb *= mix(vec3(0.42, 0.52, 0.85), vec3(1.0), uDay);`,
        );
    };
    ground.position.set((GROUND.x0 + GROUND.x1) / 2, 0.03, (GROUND.z0 + GROUND.z1) / 2);
    ground.receiveShadow = true;
    root.add(ground);



  }

  /* ------------------------------------------------------------------ */
  /* Landmark helpers                                                    */
  /* ------------------------------------------------------------------ */

  private makeLandmark(id: string, info: Omit<HoverInfo, "id">): Landmark {
    const group = new THREE.Group();
    this.scene.add(group);
    const lm: Landmark = {
      id,
      info: { id, ...info },
      group,
      hoverU: { value: 0 },
      activeU: { value: 0 },
      mats: new Map(),
      sprites: [],
      hover: 0,
      hoverTarget: 0,
      active: 0,
      activeTarget: 0,
      baseY: 0,
    };
    this.landmarks.set(id, lm);
    return lm;
  }

  private wallMat(lm: Landmark, tint: THREE.Color, style: number) {
    const key = `${tint.getHexString()}-${style}`;
    let m = lm.mats.get(key);
    if (!m) {
      m = makeWallMaterial({
        time: this.time1,
        hover: lm.hoverU,
        active: lm.activeU,
        color: tint,
        seed: 3 + lm.mats.size * 11 + lm.id.length,
        style,
      });
      lm.mats.set(key, m);
    }
    return m;
  }

  private lmBox(
    lm: Landmark,
    tint: THREE.Color,
    style: number,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    ry = 0,
  ) {
    const mesh = new THREE.Mesh(this.unitBox, this.wallMat(lm, tint, style));
    mesh.scale.set(w, h, d);
    mesh.position.set(x, y, z);
    mesh.rotation.y = ry;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.lm = lm;
    lm.group.add(mesh);
    this.pickables.push(mesh);
    return mesh;
  }

  private lmCyl(
    lm: Landmark,
    tint: THREE.Color,
    style: number,
    rTop: number,
    rBottom: number,
    h: number,
    x: number,
    y: number,
    z: number,
    seg = 12,
  ) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, seg), this.wallMat(lm, tint, style));
    mesh.position.set(x, y + h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.lm = lm;
    lm.group.add(mesh);
    this.pickables.push(mesh);
    return mesh;
  }

  /** Plain detail piece (roof units, slabs, poles) that is not a hover target. */
  private detail(
    parent: THREE.Object3D,
    color: THREE.Color,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    ry = 0,
  ) {
    const m = new THREE.Mesh(this.unitBox, new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.1 }));
    m.scale.set(w, h, d);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  private glow(
    parent: THREE.Object3D,
    color: THREE.Color,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    ry = 0,
    boost = 1,
  ) {
    const mat = new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(1.9 * boost) });
    const m = new THREE.Mesh(this.unitBox, mat);
    m.scale.set(w, h, d);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    parent.add(m);
    return m;
  }

  private roofClutter(parent: THREE.Object3D, x: number, y: number, z: number, w: number, d: number, seed: number) {
    const r = rand(seed);
    const metal = [hex("#7a8094"), hex("#646a7e"), hex("#8a8fa0")];
    const t = 0.16;
    const slab = hex("#8e93a6");
    this.detail(parent, slab, w + t, 0.34, t, x, y, z - d / 2);
    this.detail(parent, slab, w + t, 0.34, t, x, y, z + d / 2);
    this.detail(parent, slab, t, 0.34, d, x - w / 2, y, z);
    this.detail(parent, slab, t, 0.34, d, x + w / 2, y, z);
    const n = 1 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      const ux = x + (r() - 0.5) * (w - 1.2);
      const uz = z + (r() - 0.5) * (d - 1.2);
      this.detail(parent, metal[i % 3], 0.9, 0.55, 0.7, ux, y, uz, r());
      this.detail(parent, hex("#2c3040"), 0.62, 0.06, 0.5, ux, y + 0.55, uz);
    }
  }

  private label(text: string, color: THREE.Color, width = 8, strong = false) {
    const c = document.createElement("canvas");
    c.width = 640;
    c.height = 140;
    const g = c.getContext("2d")!;
    g.font = `600 ${strong ? 52 : 44}px ${this.o.fontFamily}`;
    const tw = Math.min(610, g.measureText(text).width + 96);
    const x = (640 - tw) / 2;
    g.fillStyle = "rgba(0,0,0,0.3)";
    g.beginPath();
    g.roundRect(x + 4, 28, tw, 96, 48);
    g.fill();
    g.fillStyle = "#f6f0e6";
    g.beginPath();
    g.roundRect(x, 20, tw, 96, 48);
    g.fill();
    g.fillStyle = `#${color.getHexString()}`;
    g.beginPath();
    g.arc(x + 38, 68, 12, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#1d2030";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, x + tw / 2 + 14, 70);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    const sp = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false, color: new THREE.Color(0.8, 0.8, 0.8) }),
    );
    sp.renderOrder = 20; // labels always read, never hidden behind a tower
    sp.scale.set(width, width * (140 / 640), 1);
    this.labels.push({ sp, w: width });
    return sp;
  }

  private cable(from: THREE.Vector3, to: THREE.Vector3, lift: number, color: THREE.Color, speed = 0.3, radius = 0.1) {
    const mid = from.clone().add(to).multiplyScalar(0.5);
    mid.y += lift;
    const curve = new THREE.QuadraticBezierCurve3(from, mid, to);
    const geo = new THREE.TubeGeometry(curve, 48, radius, 5, false);
    const mat = new THREE.ShaderMaterial({
      vertexShader: cableVertex,
      fragmentShader: cableFragment,
      uniforms: {
        uTime: this.time1,
        uColor: { value: color.clone() },
        uOff: { value: Math.random() },
        uSpeed: { value: speed },
      },
    });
    this.scene.add(new THREE.Mesh(geo, mat));
    return mat;
  }

  /* ------------------------------------------------------------------ */
  /* Landmarks                                                           */
  /* ------------------------------------------------------------------ */

  private buildLandmarks() {
    this.buildHub();
    this.buildCases();
    this.buildDistricts();
    this.buildIndustries();
    this.buildAntenna();
    this.landmarks.forEach((lm) =>
      lm.group.traverse((o) => {
        if ((o as THREE.Sprite).isSprite) lm.sprites.push(o as THREE.Sprite);
      }),
    );
  }

  private buildHub() {
    const lm = this.makeLandmark("hub", {
      label: this.o.labels.hub,
      hint: this.o.labels.routes.services,
      href: "/services",
    });
    const g = lm.group;
    // shopfront podium, then a stepped tower turned 45deg so every face shows
    this.lmBox(lm, LM_SAND, 2, 9.6, 4.2, 9.6, 0, 0, 0);
    this.detail(g, hex("#8e93a6"), 10, 0.3, 10, 0, 4.2, 0);
    const tiers: [number, number][] = [
      [6.8, 15],
      [5.4, 12],
      [4.2, 10],
      [3.0, 4],
    ];
    let y = 4.5;
    tiers.forEach(([s, h], i) => {
      this.lmBox(lm, i % 2 ? LM_CORAL : hex("#b7bcd0"), 3, s, h, s, 0, y, 0, Math.PI / 4);
      this.detail(g, hex("#8e93a6"), s + 0.5, 0.25, s + 0.5, 0, y + h, 0, Math.PI / 4);
      // a soft warm band marks every setback
      this.glow(g, hex("#ffb870"), s * 0.72 + 0.4, 0.14, s * 0.72 + 0.4, 0, y + h - 0.35, 0, Math.PI / 4, 0.55);
      y += h + 0.25;
    });
    this.roofClutter(g, 0, y, 0, 2.6, 2.6, 5);
    const spire = this.detail(g, hex("#c9ced9"), 0.16, 9, 0.16, 0, y, 0);
    spire.castShadow = false;
    const beacon = this.glow(g, hex("#ff7b5c"), 0.5, 0.5, 0.5, 0, y + 9, 0, 0, 1.3);
    // an open ring around the crown
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(3.6, 0.09, 6, 40),
      new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffcf9a").multiplyScalar(1.5) }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y - 2.2;
    g.add(ring);

    const topY = y + 9;
    const lab = this.label(this.o.labels.hub, CORAL, 11, true);
    lab.position.set(0, topY + 6, 0);
    g.add(lab);

    // tool buildings around the plaza, each wired to the tower
    const pods = this.o.labels.tools;
    pods.forEach((name, i) => {
      const a = (i / pods.length) * Math.PI * 2 + 0.3;
      const x = Math.cos(a) * 10.2;
      const z = Math.sin(a) * 10.2;
      const tint = [LM_PERI, LM_SAGE, LM_SAND][i % 3];
      const plm = this.makeLandmark(`tool-${i}`, {
        label: name,
        hint: this.o.labels.routes.caseStudies,
        href: "/case-studies",
      });
      const h = 6.5 + (i % 3) * 2;
      this.lmBox(plm, tint, i % 2 ? 0 : 2, 3.6, h, 3.6, x, 0, z, a);
      this.detail(plm.group, hex("#8e93a6"), 3.9, 0.28, 3.9, x, h, z, a);
      this.roofClutter(plm.group, x, h + 0.28, z, 3.0, 3.0, 70 + i);
      const pl = this.label(name, tint, 6.8);
      pl.position.set(x, h + 4.2, z);
      plm.group.add(pl);
      const cm = this.cable(
        new THREE.Vector3(x, h + 0.9, z),
        new THREE.Vector3(0, topY * 0.5, 0),
        6 + (i % 2) * 3,
        tint,
        0.26,
        0.09,
      );
      cm.uniforms.uOff.value = i / pods.length;
    });

    // slow ripple on the plaza + a beacon that breathes
    const ripples: THREE.Mesh[] = [];
    for (let i = 0; i < 3; i++) {
      const rm = new THREE.Mesh(
        new THREE.RingGeometry(0.97, 1, 64),
        new THREE.MeshBasicMaterial({ color: hex("#f0b79a"), transparent: true, depthWrite: false, side: THREE.DoubleSide }),
      );
      rm.rotation.x = -Math.PI / 2;
      rm.position.y = 0.3;
      this.scene.add(rm);
      ripples.push(rm);
    }
    this.animated.push((t) => {
      beacon.scale.setScalar(1 + Math.sin(t * 2.4) * 0.3);
      ripples.forEach((rm, i) => {
        const p = (t * 0.2 + i / 3) % 1;
        rm.scale.setScalar(3 + p * 12);
        (rm.material as THREE.MeshBasicMaterial).opacity = (1 - p) * 0.35;
      });
    });
  }

  private buildCases() {
    const tints = [LM_CORAL, LM_PERI, LM_SAGE, LM_SAND, LM_PLUM, LM_ICE];
    const labelTints = [CORAL, PERI, SAGE, SAND, PLUM, ICE];
    for (let i = 0; i < 6; i++) {
      const tint = tints[i];
      const lm = this.makeLandmark(`case-${i}`, {
        label: this.o.labels.cases[i],
        hint: this.o.labels.routes.caseStudies,
        href: "/case-studies",
      });
      const g = lm.group;
      g.position.set(CASE_XS[i], 0, CASE_Z);
      this.detail(g, hex("#59607a"), 12, 0.3, 8, 0, 0, 0);
      const Y = 0.3;
      let top = 14;
      if (i === 0) {
        this.lmBox(lm, tint, 0, 7, 5, 5, 0, Y, 0);
        this.lmBox(lm, tint, 0, 5, 5, 4, 0.6, Y + 5, 0);
        this.lmBox(lm, tint, 3, 3, 4.5, 3, -0.4, Y + 10, 0);
        this.detail(g, hex("#c9ced9"), 0.16, 5, 0.16, 0, Y + 14.5, 0);
        this.glow(g, hex("#ff5a4a"), 0.3, 0.3, 0.3, 0, Y + 19.5, 0);
        top = 21;
      } else if (i === 1) {
        this.lmCyl(lm, tint, 0, 2.8, 3.2, 12, 0, Y, 0, 10);
        for (const yy of [4, 8]) this.lmCyl(lm, tint, 2, 4.8, 4.8, 0.7, 0, Y + yy, 0, 10);
        top = 14.5;
        // helipad: a collar under a round pad, a painted H and ring, edge lights and a windsock
        this.detail(g, hex("#2c3040"), 6.2, 0.5, 6.2, 0, Y + 11.7, 0);
        const padDisc = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 0.3, 40), new THREE.MeshStandardMaterial({ color: hex("#3a3f50"), roughness: 0.8 }));
        padDisc.position.set(0, Y + 12.15, 0);
        padDisc.castShadow = true;
        padDisc.receiveShadow = true;
        g.add(padDisc);
        const padRing = new THREE.Mesh(new THREE.RingGeometry(2.45, 2.7, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.6, 1.5) }));
        padRing.position.set(0, Y + 12.32, 0);
        g.add(padRing);
        this.glow(g, hex("#e8e0d0"), 1.9, 0.04, 0.32, 0, Y + 12.3, 0);
        this.glow(g, hex("#e8e0d0"), 0.32, 0.04, 2.3, -0.85, Y + 12.3, 0);
        this.glow(g, hex("#e8e0d0"), 0.32, 0.04, 2.3, 0.85, Y + 12.3, 0);
        for (let k = 0; k < 16; k++) {
          const an = (k / 16) * Math.PI * 2;
          this.glow(g, hex("#ffcf8a"), 0.22, 0.12, 0.22, Math.cos(an) * 3.25, Y + 12.4, Math.sin(an) * 3.25);
        }
        this.detail(g, hex("#c9ced9"), 0.07, 1.8, 0.07, 3.0, Y + 12.3, -2.2);
        const sock = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.9, 8).translate(0, -0.45, 0).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: hex("#ff7a2a"), roughness: 0.8 }));
        sock.position.set(3.45, Y + 14.0, -2.2);
        g.add(sock);
      } else if (i === 2) {
        [4, 6.5, 8.5, 11.5, 16].forEach((h, k) => this.lmBox(lm, tint, 3, 1.7, h, 3.4, -4.4 + k * 2.2, Y, 0));
        top = 18.5;
      } else if (i === 3) {
        this.lmBox(lm, tint, 3, 3.2, 16, 3.2, -3, Y, 0);
        this.lmBox(lm, tint, 3, 3.2, 12, 3.2, 3, Y, 0);
        this.lmBox(lm, tint, 0, 4, 0.9, 1.6, 0, Y + 9, 0);
        top = 18.5;
      } else if (i === 4) {
        for (let k = 0; k < 12; k++) this.lmBox(lm, tint, 1, 0.36, 3 + (k % 3) * 0.7, 4.2, -5.2 + k * 0.45, Y, 0);
        this.lmBox(lm, tint, 0, 3.4, 14, 4.2, 2.6, Y, 0);
        this.detail(g, hex("#8e93a6"), 4.8, 0.5, 5.2, 2.6, Y + 14, 0);
        top = 18;
      } else {
        [3, 5.2, 7.4, 9.8].forEach((h, k) => this.lmBox(lm, tint, 2, 1.9, h, 3.8, -5 + k * 2.1, Y, 0));
        const disc = this.lmCyl(lm, hex("#3a3f55"), 0, 3, 3, 0.9, 5.2, 7, 0, 24);
        disc.rotation.x = Math.PI / 2;
        disc.position.set(5.2, 8.4, 0);
        this.detail(g, hex("#2c3040"), 0.4, 8, 0.4, 5.2, Y, 0);
        top = 13;
      }
      // soft warm accent along the base so each case reads as its own place
      this.glow(g, labelTints[i], 11.2, 0.08, 0.08, 0, 0.32, 3.9, 0, 0.5);
      const lab = this.label(`${String(i + 1).padStart(2, "0")}  ${this.o.labels.cases[i]}`, labelTints[i], 8.6);
      lab.position.set(0, top + 3.2, 0);
      g.add(lab);
    }
  }

  private buildDistricts() {
    const make = (center: THREE.Vector3, tint: THREE.Color, accent: THREE.Color, name: string, id: string) => {
      const lm = this.makeLandmark(id, { label: name, hint: this.o.labels.routes.services, href: "/services" });
      const g = lm.group;
      g.position.copy(center);
      this.detail(g, hex("#59607a"), 17, 0.3, 17, 0, 0, 0);
      const heights = [12, 17, 10, 14];
      [
        [-4.2, -4.2],
        [4.2, -4.2],
        [-4.2, 4.2],
        [4.2, 4.2],
      ].forEach(([x, z], i) => {
        this.lmBox(lm, tint, i % 2 ? 3 : 0, 4.4, heights[i], 4.4, x, 0.3, z);
        this.detail(g, hex("#8e93a6"), 4.7, 0.25, 4.7, x, heights[i] + 0.3, z);
        this.roofClutter(g, x, heights[i] + 0.55, z, 3.4, 3.4, 400 + i + id.length);
        this.glow(g, accent, 4.6, 0.12, 4.6, x, heights[i] - 1.2, z, 0, 0.5);
      });
      const lab = this.label(name, accent, 9.6, true);
      lab.position.set(0, 25, 0);
      g.add(lab);
    };
    make(CRM_C, LM_CORAL, CORAL, this.o.labels.crm, "crm");
    make(AUTO_C, LM_PERI, PERI, this.o.labels.automation, "automation");
    this.cable(
      new THREE.Vector3(CRM_C.x + 4.2, 17.6, CRM_C.z - 4.2),
      new THREE.Vector3(AUTO_C.x - 4.2, 15.6, AUTO_C.z - 4.2),
      16,
      ICE,
      0.14,
      0.13,
    );
  }

  /** the painted ground of an industry site: every one reads from the sky as a different kind of place */
  private plazaTexture(kind: string, size: number, seed: number) {
    const S = 256;
    const k = S / size;
    const c = document.createElement("canvas");
    c.width = c.height = S;
    const g = c.getContext("2d")!;
    const r = rand(seed);
    const grain = (n: number, light: string, dark: string) => {
      for (let i = 0; i < n; i++) {
        g.fillStyle = r() < 0.5 ? light : dark;
        g.fillRect(r() * S, r() * S, 1 + r() * 1.5, 1 + r() * 1.5);
      }
    };
    const line = (x0: number, y0: number, x1: number, y1: number, w: number, col: string) => {
      g.strokeStyle = col;
      g.lineWidth = w;
      g.beginPath();
      g.moveTo(x0, y0);
      g.lineTo(x1, y1);
      g.stroke();
    };
    if (kind === "hvac") {
      g.fillStyle = "#4b5168";
      g.fillRect(0, 0, S, S);
      grain(900, "rgba(255,255,255,0.07)", "rgba(0,0,0,0.12)");
      // slab joints
      for (let u = 0; u <= size; u += 3.5) {
        line(u * k, 0, u * k, S, 1, "rgba(20,24,40,0.55)");
        line(0, u * k, S, u * k, 1, "rgba(20,24,40,0.55)");
      }
      // service bays along the front, with an ice-blue edge stripe
      for (let b = 0; b <= 4; b++) line((2.2 + b * 2.4) * k, 9.2 * k, (2.2 + b * 2.4) * k, 13.4 * k, 2.2, "#f1d46a");
      g.strokeStyle = "rgba(127,212,255,0.8)";
      g.lineWidth = 2.5;
      g.strokeRect(0.5 * k, 0.5 * k, (size - 1) * k, (size - 1) * k);
      // a painted snowflake on the apron
      const sx = 4.5 * k;
      const sy = 11.0 * k;
      for (let a = 0; a < 3; a++) {
        const an = (a * Math.PI) / 3;
        line(sx - Math.cos(an) * 1.3 * k, sy - Math.sin(an) * 1.3 * k, sx + Math.cos(an) * 1.3 * k, sy + Math.sin(an) * 1.3 * k, 2.4, "rgba(150,220,255,0.85)");
      }
      // drain grates
      for (const [gx, gy] of [[2, 6.6], [12, 3.2]]) {
        g.fillStyle = "#1d2133";
        g.fillRect(gx * k, gy * k, 1.6 * k, 0.9 * k);
        for (let s = 0; s < 5; s++) line((gx + 0.2 + s * 0.3) * k, gy * k, (gx + 0.2 + s * 0.3) * k, (gy + 0.9) * k, 1, "#5b6078");
      }
    } else if (kind === "roofing") {
      g.fillStyle = "#3b3945";
      g.fillRect(0, 0, S, S);
      grain(1200, "rgba(255,255,255,0.08)", "rgba(0,0,0,0.18)");
      // tar and oil stains
      for (let i = 0; i < 7; i++) {
        g.fillStyle = "rgba(10,10,16,0.35)";
        g.beginPath();
        g.ellipse(r() * S, r() * S, 6 + r() * 14, 4 + r() * 9, r() * 3, 0, 7);
        g.fill();
      }
      // a laydown yard: staggered shingle courses in two colours where the pallets stand
      const tile = (x0: number, y0: number, w: number, h: number, c1: string, c2: string) => {
        for (let row = 0; row < h; row++) {
          for (let col = 0; col < w; col++) {
            g.fillStyle = (row + col) % 2 ? c1 : c2;
            const ox = row % 2 ? 0.5 : 0;
            g.fillRect((x0 + col + ox) * 0.7 * k, (y0 + row * 0.5) * k, 0.68 * k, 0.46 * k);
          }
        }
      };
      tile(9.6, 9.0, 5, 5, "#8a4f45", "#7a4439");
      tile(1.8, 1.8, 5, 4, "#5a5f78", "#4e5370");
      // hazard stripes along the front edge
      for (let u = -2; u < size * 2; u++) {
        g.fillStyle = u % 2 ? "#ff8a6a" : "#24242c";
        g.beginPath();
        g.moveTo(u * 0.9 * k, size * k);
        g.lineTo((u * 0.9 + 0.9) * k, size * k);
        g.lineTo((u * 0.9 + 1.6) * k, (size - 0.7) * k);
        g.lineTo((u * 0.9 + 0.7) * k, (size - 0.7) * k);
        g.fill();
      }
    } else if (kind === "plumbing") {
      g.fillStyle = "#4d526a";
      g.fillRect(0, 0, S, S);
      grain(500, "rgba(255,255,255,0.08)", "rgba(0,0,0,0.14)");
      for (let u = 0; u <= size; u += 1.45) {
        line(u * k, 0, u * k, S, 1, "rgba(20,24,40,0.5)");
        line(0, u * k, S, u * k, 1, "rgba(20,24,40,0.5)");
      }
      // a copper pipe run under glass, with a bolt-yellow cable next to it
      line(0, 5.55 * k, S, 5.55 * k, 4, "#b5763f");
      line(0, 5.55 * k, S, 5.55 * k, 1.3, "#e2a46a");
      line(0, 5.3 * k, S, 5.3 * k, 2, "#e0c14a");
      for (const jx of [0.8, 2.4, 4.0, 5.2]) line(jx * k, 5.15 * k, jx * k, 5.75 * k, 3, "#8c5a30");
      // manhole cover
      g.fillStyle = "#2a2e40";
      g.beginPath();
      g.arc(5.0 * k, 3.6 * k, 0.45 * k, 0, 7);
      g.fill();
      g.strokeStyle = "#6b7090";
      g.lineWidth = 1.2;
      for (let a = 0; a < 3; a++) {
        const an = (a * Math.PI) / 3;
        g.beginPath();
        g.moveTo(5.0 * k - Math.cos(an) * 0.4 * k, 3.6 * k - Math.sin(an) * 0.4 * k);
        g.lineTo(5.0 * k + Math.cos(an) * 0.4 * k, 3.6 * k + Math.sin(an) * 0.4 * k);
        g.stroke();
      }
      // a puddle that catches the neon
      g.fillStyle = "rgba(120,170,255,0.35)";
      g.beginPath();
      g.ellipse(0.45 * k, 3.0 * k, 0.4 * k, 0.9 * k, 0.1, 0, 7);
      g.fill();
    } else {
      g.fillStyle = "#3f7a46";
      g.fillRect(0, 0, S, S);
      for (let i = 0; i < 2200; i++) {
        g.strokeStyle = r() < 0.5 ? "rgba(120,190,110,0.5)" : "rgba(25,70,40,0.5)";
        g.lineWidth = 1;
        const x = r() * S;
        const y = r() * S;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + (r() - 0.5) * 3, y - 2 - r() * 3);
        g.stroke();
      }
      // mowing stripes
      for (let u = 0; u < size; u += 1.6) {
        g.fillStyle = "rgba(255,255,255,0.04)";
        g.fillRect(u * k, 0, 0.8 * k, S);
      }
      // mulch beds along the back, with flowers
      for (const [bx, bw] of [[0.9, 3.4], [3.7, 3.4], [6.7, 3.0]]) {
        g.fillStyle = "#5a4030";
        g.beginPath();
        g.roundRect(bx * k, 0.6 * k, bw * k, 1.8 * k, 10);
        g.fill();
        for (let i = 0; i < 14; i++) {
          g.fillStyle = ["#ff7fb0", "#ffd36a", "#ffffff", "#ff8a6a"][Math.floor(r() * 4)];
          g.beginPath();
          g.arc((bx + 0.3 + r() * (bw - 0.6)) * k, (0.9 + r() * 1.2) * k, 1.6, 0, 7);
          g.fill();
        }
      }
      // a stepping-stone path winding to the front door
      for (let i = 0; i < 9; i++) {
        const t = i / 8;
        const px = (7.0 + Math.sin(t * 3.2) * 0.6) * k;
        const py = (7.6 + t * 6.2) * k;
        g.fillStyle = "#b8b4a4";
        g.beginPath();
        g.ellipse(px, py, 0.55 * k, 0.4 * k, 0.3, 0, 7);
        g.fill();
      }
      // the wet ring of the sprinkler
      g.strokeStyle = "rgba(160,220,255,0.35)";
      g.lineWidth = 2;
      g.beginPath();
      g.arc(10.6 * k, 12 * k, 1.9 * k, 0, 7);
      g.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }

  /** a rotated piece: poles, ramps, roof edges (detail() only turns about y) */
  private bar(parent: THREE.Object3D, color: THREE.Color, w: number, h: number, d: number, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) {
    const m: THREE.Mesh = new THREE.Mesh(this.unitBox, new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.15 }));
    m.scale.set(w, h, d);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  private post(parent: THREE.Object3D, color: THREE.Color, rad: number, h: number, x: number, y: number, z: number, seg = 10) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, h, seg), new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.15 }));
    m.position.set(x, y + h / 2, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  /** one building per industry, each placed on a real site and each reading as a different trade */
  private buildIndustries() {
    const tints = { hvac: LM_ICE, roofing: LM_CORAL, plumbing: LM_PERI, outdoor: LM_SAGE } as const;
    INDUSTRIES.forEach((ind, n) => {
      const tint = tints[ind.id];
      const accent = hex(ind.color);
      const name = this.o.labels.industries[n] ?? ind.en.name;
      const lm = this.makeLandmark(`ind-${ind.id}`, { label: name, hint: this.o.labels.industryHint.replace("{name}", name), href: `/industries/${ind.id}` });
      const g = lm.group;
      const block = ind.site === "block";
      // out of town the pad is levelled terrain; downtown the block sits on the street grid at ground level
      lm.baseY = ind.ground;
      g.position.set(ind.x, ind.ground, ind.z);
      const size = block ? 5.8 : 14;
      const T = block ? 0.2 : 0.3;
      const Y = T;
      const slab = this.detail(g, hex("#59607a"), size, T, size, 0, 0, 0);
      slab.receiveShadow = true;
      const top = new THREE.Mesh(
        new THREE.PlaneGeometry(size, size),
        new THREE.MeshStandardMaterial({ map: this.plazaTexture(ind.id, size, 40 + n * 17), roughness: 0.85, metalness: 0.05 }),
      );
      top.rotation.x = -Math.PI / 2;
      top.position.y = T + 0.01;
      top.receiveShadow = true;
      g.add(top);
      // the access lane to the nearest road
      const lane = laneOf(ind);
      if (lane) {
        const lx = lane.x - ind.x;
        const lz = lane.z - ind.z;
        this.detail(g, hex("#2a2d3a"), lane.w, T, lane.d, lx, 0, lz);
        const alongZ = lane.d >= lane.w;
        const len = alongZ ? lane.d : lane.w;
        for (let s = -len / 2 + 1.4; s < len / 2 - 0.8; s += 2.2) this.glow(g, hex("#d8d2b0"), alongZ ? 0.14 : 0.9, 0.04, alongZ ? 0.9 : 0.14, lx + (alongZ ? 0 : s), T + 0.02, lz + (alongZ ? s : 0), 0, 0.7);
      }
      const edge = size / 2 - 0.4;
      this.glow(g, accent, size - 0.8, 0.08, 0.08, 0, T + 0.02, edge, 0, 0.55);
      this.glow(g, accent, size - 0.8, 0.08, 0.08, 0, T + 0.02, -edge, 0, 0.55);
      let labelY = 10;
      if (ind.id === "hvac") {
        // a plant hall with rooftop condensers, a tall flue, ducts, ground chillers and a glowing snowflake
        this.lmBox(lm, tint, 2, 8.4, 5, 5.4, 0.6, Y, -0.8);
        this.detail(g, hex("#8e93a6"), 8.8, 0.3, 5.8, 0.6, Y + 5, -0.8);
        this.lmBox(lm, tint, 0, 5.2, 3.6, 3.6, -0.8, Y + 5.3, -0.8);
        for (const [cx, cz] of [[-2.8, 0.4], [-2.8, -2.0], [3.0, -0.8]]) {
          this.lmCyl(lm, hex("#9aa4b8"), 0, 1.15, 1.15, 0.9, cx, Y + 5.3, cz, 16);
          this.detail(g, hex("#2c3040"), 1.7, 0.06, 1.7, cx, Y + 6.22, cz, Math.PI / 4);
          this.detail(g, hex("#c9ced9"), 0.12, 0.05, 1.6, cx, Y + 6.3, cz);
          this.detail(g, hex("#c9ced9"), 1.6, 0.05, 0.12, cx, Y + 6.3, cz);
        }
        this.lmCyl(lm, hex("#7a8094"), 0, 0.5, 0.62, 5.5, 3.4, Y + 5.3, -2.7, 10);
        this.detail(g, hex("#c9ced9"), 1.3, 0.2, 1.3, 3.4, Y + 10.8, -2.7);
        this.detail(g, hex("#7a8094"), 4.6, 0.3, 0.3, 1.2, Y + 9.0, -2.7);
        for (let k = 0; k < 3; k++) this.glow(g, accent, 2.2, 0.16, 0.12, 0.6, Y + 6.2, 1.96, (k * Math.PI) / 3, 1.0);
        this.glow(g, hex("#ff9a5a"), 7.2, 0.1, 0.06, 0.6, Y + 0.8, 1.96, 0, 0.8);
        // ground chillers with fans, and an insulated pipe run up to the hall
        for (const cz of [-3.8, -1.2]) {
          this.detail(g, hex("#aab2c4"), 2.2, 1.7, 1.8, -5.6, Y, cz);
          this.post(g, hex("#161a2c"), 0.62, 0.08, -5.6, Y + 1.7, cz, 14);
          this.glow(g, accent, 0.12, 0.1, 1.5, -4.46, Y + 0.9, cz, 0, 0.8);
        }
        this.detail(g, hex("#e8ebf2"), 4.4, 0.24, 0.24, -3.2, Y + 1.2, 2.0);
        this.detail(g, hex("#5b9ad8"), 4.4, 0.1, 0.1, -3.2, Y + 1.5, 2.0);
        for (const px of [-5.2, -3.2, -1.2]) this.detail(g, hex("#6b7088"), 0.14, 1.2, 0.14, px, Y, 2.0);
        // a thermostat pole: half ice, half flame
        this.post(g, hex("#8e93a6"), 0.07, 3.4, 5.8, Y, -4.8);
        this.glow(g, hex("#7fd4ff"), 0.9, 0.5, 0.14, 5.8, Y + 3.3, -4.8, 0, 1.0);
        this.glow(g, hex("#ff8a4a"), 0.9, 0.5, 0.14, 5.8, Y + 3.8, -4.8, 0, 1.0);
        // a service van with a stripe
        this.detail(g, hex("#e8e6e0"), 2.8, 1.5, 1.4, 3.8, Y, 4.7);
        this.detail(g, hex("#3f6fb0"), 2.85, 0.25, 1.45, 3.8, Y + 0.5, 4.7);
        this.detail(g, hex("#9ec8ff"), 0.8, 0.6, 1.3, 4.9, Y + 0.7, 4.7);
        labelY = 11.5;
      } else if (ind.id === "roofing") {
        // a house under a big hip roof, with a chimney, a ladder, scaffolding, a roof conveyor, pallets and a dumpster
        this.lmBox(lm, tint, 0, 7.2, 4, 6.2, 0, Y, 0);
        const roof = new THREE.Mesh(new THREE.ConeGeometry(5.6, 3.6, 4), new THREE.MeshStandardMaterial({ color: hex("#8a4f45"), roughness: 0.85 }));
        roof.rotation.y = Math.PI / 4;
        roof.scale.set(1.16, 1, 1);
        roof.position.set(0, Y + 4 + 1.8, 0);
        roof.castShadow = true;
        g.add(roof);
        for (let k = 1; k <= 3; k++) {
          const row = new THREE.Mesh(new THREE.ConeGeometry(5.6 - k * 1.05, 0.12, 4), new THREE.MeshStandardMaterial({ color: hex("#6a3a32"), roughness: 0.9 }));
          row.rotation.y = Math.PI / 4;
          row.scale.set(1.16, 1, 1);
          row.position.set(0, Y + 4 + 0.35 + k * 0.7, 0);
          g.add(row);
        }
        // one slope is bare underlayment: the job is half done
        this.bar(g, hex("#2f3246"), 3.2, 0.12, 1.6, 0, Y + 5.83, 2.0, 0.737, 0, 0);
        this.detail(g, hex("#7f5049"), 0.8, 2.0, 0.8, 1.8, Y + 5.2, -0.6);
        this.detail(g, hex("#c9ced9"), 0.12, 6.0, 0.12, -3.9, Y, 3.2);
        this.detail(g, hex("#c9ced9"), 0.12, 6.0, 0.12, -3.5, Y, 3.2);
        for (let k = 0; k < 7; k++) this.detail(g, hex("#c9ced9"), 0.5, 0.06, 0.06, -3.7, Y + 0.6 + k * 0.8, 3.2);
        // scaffolding on the east wall
        for (const sz of [-2.6, -0.4, 1.8, 3.0]) this.post(g, hex("#9aa4b8"), 0.07, 4.6, 4.3, Y, sz, 6);
        for (const sy of [1.4, 2.9, 4.4]) this.detail(g, hex("#9aa4b8"), 0.1, 0.1, 6.2, 4.3, Y + sy, 0.2);
        for (const sy of [1.5, 3.0]) this.detail(g, hex("#a07a4c"), 0.9, 0.08, 5.6, 4.35, Y + sy, 0.2);
        // a roof conveyor leaning on the back wall
        this.bar(g, hex("#e6b422"), 0.5, 0.3, 5.2, 0, Y + 2.35, -4.6, -1.13, 0, 0);
        this.detail(g, hex("#464b63"), 1.6, 0.35, 1.0, 0, Y, -6.0);
        // pallets of shingles and rolls of underlayment
        for (let k = 0; k < 3; k++) this.detail(g, hex(k % 2 ? "#6a3a32" : "#8a4f45"), 1.6, 0.35, 1.0, 4.4, Y + k * 0.36, 4.7);
        for (let k = 0; k < 2; k++) this.detail(g, hex("#464b63"), 1.6, 0.35, 1.0, 5.6, Y + k * 0.36, 3.0);
        for (const [rx, rz] of [[-5.4, -4.4], [-4.6, -5.2], [-5.5, -5.4]]) this.post(g, hex("#1f2233"), 0.42, 1.3, rx, Y, rz, 10);
        // a dumpster
        this.detail(g, hex("#3f6f4a"), 2.4, 1.2, 1.4, -5.2, Y, 0.4);
        this.bar(g, hex("#2f5238"), 2.5, 0.1, 1.5, -5.2, Y + 1.25, 0.4, 0, 0, 0.12);
        // traffic cones and a tar kettle
        for (const cx of [-1.4, 0.2, 1.8]) {
          const cone = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.7, 8), new THREE.MeshStandardMaterial({ color: hex("#ff7a3a"), roughness: 0.7 }));
          cone.position.set(cx, Y + 0.35, 5.8);
          g.add(cone);
        }
        this.post(g, hex("#5b6078"), 0.55, 0.9, -5.4, Y, 3.2, 12);
        this.glow(g, hex("#ff7a3a"), 0.7, 0.08, 0.7, -5.4, Y + 0.92, 3.2, 0, 1.2);
        this.glow(g, accent, 6.4, 0.1, 0.06, 0, Y + 0.9, 3.12, 0, 0.8);
        this.detail(g, hex("#d9a441"), 2.6, 1.4, 1.5, -2.0, Y, 5.6); // a work truck
        this.detail(g, hex("#8e93a6"), 1.2, 0.2, 1.4, -2.7, Y + 1.4, 5.6);
        labelY = 12;
      } else if (ind.id === "plumbing") {
        // a tall slim building that fills one downtown block: copper pipes up the front, a water tank on legs, a service pole with a bolt
        this.lmBox(lm, tint, 3, 3.6, 9.2, 3.4, -0.3, Y, -0.5);
        this.lmBox(lm, LM_SAND, 2, 4.6, 2.2, 1.0, -0.2, Y, 1.7);
        this.detail(g, hex("#8e93a6"), 4.0, 0.26, 3.8, -0.3, Y + 9.2, -0.5);
        for (const [lx, lz] of [[-1.2, -1.4], [0.6, -1.4], [-1.2, 0.4], [0.6, 0.4]]) this.detail(g, hex("#6b7088"), 0.12, 1.4, 0.12, lx, Y + 9.46, lz);
        this.lmCyl(lm, hex("#7fb0d8"), 0, 1.15, 1.15, 1.9, -0.3, Y + 10.8, -0.5, 14);
        const cap = new THREE.Mesh(new THREE.ConeGeometry(1.3, 0.8, 14), new THREE.MeshStandardMaterial({ color: hex("#5b6478"), roughness: 0.7 }));
        cap.position.set(-0.3, Y + 13.1, -0.5);
        g.add(cap);
        for (const px of [-1.5, -1.05]) this.post(g, hex("#c9804a"), 0.12, 6.4, px, Y + 2.6, 1.35, 8);
        this.detail(g, hex("#c9804a"), 0.55, 0.26, 0.26, -1.28, Y + 5.0, 1.35);
        this.detail(g, hex("#c9804a"), 0.55, 0.26, 0.26, -1.28, Y + 7.6, 1.35);
        // the service pole at the corner
        this.post(g, hex("#9aa4b8"), 0.12, 8.8, 2.35, Y, -2.35, 8);
        this.detail(g, hex("#9aa4b8"), 2.4, 0.14, 0.14, 2.35, Y + 8.4, -2.35);
        this.detail(g, hex("#9aa4b8"), 1.7, 0.14, 0.14, 2.35, Y + 7.3, -2.35);
        for (const sx of [-1.0, 1.0]) this.glow(g, hex("#ffd36a"), 0.2, 0.2, 0.2, 2.35 + sx, Y + 8.5, -2.35, 0, 1.4);
        // a bolt on the east wall and a water drop on the west one
        this.glow(g, hex("#ffd36a"), 0.12, 1.3, 0.2, 1.58, Y + 7.3, -0.5, 0, 1.2);
        this.bar(g, hex("#ffd36a"), 0.12, 1.1, 0.2, 1.58, Y + 6.2, -0.1, 0, 0, 0.5).material = new THREE.MeshBasicMaterial({ color: hex("#ffd36a").multiplyScalar(2.6) });
        this.bar(g, hex("#7fd4ff"), 0.1, 0.9, 0.9, -2.18, Y + 7.2, -0.5, 0.785, 0, 0).material = new THREE.MeshBasicMaterial({ color: hex("#7fd4ff").multiplyScalar(2.6) });
        this.glow(g, hex("#ff9a5a"), 4.2, 0.1, 0.06, -0.2, Y + 0.6, 2.24, 0, 0.8);
        labelY = 14;
      } else {
        // a low building with a green roof, a greenhouse, planters, hedges, a mower, rising bubbles and a sprinkler
        this.lmBox(lm, tint, 2, 8.4, 3.6, 4.6, -1.6, Y, -1.2);
        this.detail(g, hex("#5f8f4a"), 8.8, 0.45, 5.0, -1.6, Y + 3.6, -1.2);
        for (const [tx, tz] of [[-4.6, -0.6], [-2.2, -2.6], [0.4, -0.2]]) {
          this.detail(g, hex("#5a4538"), 0.25, 1.0, 0.25, tx, Y + 4.05, tz);
          const c = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 0), new THREE.MeshStandardMaterial({ color: hex("#4f7d5a"), roughness: 0.9, flatShading: true }));
          c.position.set(tx, Y + 5.4, tz);
          c.castShadow = true;
          g.add(c);
        }
        this.lmBox(lm, hex("#bfe4de"), 3, 3.6, 3.0, 3.8, 4.0, Y, -1.2);
        this.detail(g, hex("#d8f2ee"), 3.8, 0.35, 4.0, 4.0, Y + 3.0, -1.2);
        this.glow(g, hex("#ff4fd0"), 3.0, 0.14, 0.05, 4.0, Y + 1.5, 0.74, 0, 0.5);
        for (let k = -3; k <= 3; k++) {
          if (k === 0) continue; // the path runs through the gap
          const h = new THREE.Mesh(this.unitBox, new THREE.MeshStandardMaterial({ color: hex("#3f6f4a"), roughness: 0.9 }));
          h.scale.set(1.0, 0.9, 0.8);
          h.position.set(k * 1.5, Y, 2.2);
          g.add(h);
        }
        // raised planters at the back, with flowers
        for (const [px, flowers] of [[-4.4, "#ff7fb0"], [-1.6, "#ffd36a"], [1.2, "#ffffff"]] as const) {
          this.detail(g, hex("#6b4a36"), 2.4, 0.5, 0.9, px, Y, -5.2);
          for (let k = 0; k < 5; k++) this.glow(g, hex(flowers), 0.22, 0.22, 0.22, px - 0.9 + k * 0.45, Y + 0.62, -5.2 + ((k % 2) - 0.5) * 0.4, 0, 0.9);
        }
        // sod, mulch, a mower and a sprinkler
        for (let k = 0; k < 3; k++) this.detail(g, hex("#4f9a5a"), 1.6, 0.34, 1.0, 5.6, Y + k * 0.35, -5.0);
        const mulch = new THREE.Mesh(new THREE.ConeGeometry(1.0, 0.9, 7), new THREE.MeshStandardMaterial({ color: hex("#5a4030"), roughness: 1 }));
        mulch.position.set(-5.8, Y + 0.45, 3.6);
        g.add(mulch);
        this.detail(g, hex("#c83c3c"), 1.0, 0.5, 0.6, -3.4, Y + 0.15, 4.8);
        this.bar(g, hex("#2c3040"), 0.06, 0.06, 0.9, -3.9, Y + 0.7, 4.8, 0, 0, -0.6);
        for (const wz of [-0.3, 0.3]) this.detail(g, hex("#161a2c"), 0.3, 0.3, 0.1, -3.4, Y, 4.8 + wz);
        const sprinkler = new THREE.Group();
        sprinkler.position.set(3.4, Y, 5.4);
        g.add(sprinkler);
        this.post(sprinkler, hex("#7a8094"), 0.06, 0.5, 0, 0, 0, 6);
        const dropMat = new THREE.MeshBasicMaterial({ color: hex("#cfeaff"), transparent: true, opacity: 0.7, depthWrite: false });
        const drops: THREE.Mesh[] = [];
        for (let k = 0; k < 9; k++) {
          const d = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), dropMat);
          sprinkler.add(d);
          drops.push(d);
        }
        this.animated.push((t) => {
          sprinkler.rotation.y = t * 1.6;
          drops.forEach((d, k) => {
            const u = (t * 0.9 + k / 9) % 1;
            d.position.set(u * 2.6, 0.5 + Math.sin(u * Math.PI) * 1.1, 0);
          });
        });
        // the cleaning side: a van, a bucket and bubbles
        const bubbleMat = new THREE.MeshBasicMaterial({ color: hex("#cfeaff"), transparent: true, opacity: 0.5, depthWrite: false });
        const bubbles: THREE.Mesh[] = [];
        for (let k = 0; k < 7; k++) {
          const b = new THREE.Mesh(new THREE.SphereGeometry(0.35 + (k % 3) * 0.12, 10, 8), bubbleMat);
          b.position.set(-5.6 + (k % 3) * 0.5, Y + 1 + k * 0.4, -3.0 + (k % 2) * 0.4);
          g.add(b);
          bubbles.push(b);
        }
        this.animated.push((t) => bubbles.forEach((b, k) => (b.position.y = Y + 1 + ((t * 0.5 + k * 0.17) % 1) * 4.6)));
        this.post(g, hex("#4a9fd8"), 0.34, 0.6, -5.6, Y, -2.4, 10);
        this.detail(g, hex("#e8e6e0"), 2.6, 1.4, 1.4, 1.2, Y, 5.3);
        this.detail(g, hex("#4f9a5a"), 2.65, 0.3, 1.45, 1.2, Y + 0.5, 5.3);
        labelY = 10;
      }
      this.industryFinish(g, ind.id, accent, size, T, block, Y);
      const lab = this.label(name, accent, block ? 6.4 : 7.6);
      lab.position.set(0, labelY + 3.4, 0);
      g.add(lab);
    });
  }

  private poolTex: THREE.CanvasTexture | null = null;

  /** what every industry site shares: a pool of its colour on the ground, corner lamps, a lit sign, and one moving thing that says what the trade does */
  private industryFinish(g: THREE.Group, id: string, accent: THREE.Color, size: number, T: number, block: boolean, Y: number) {
    if (!this.poolTex) {
      const c = document.createElement("canvas");
      c.width = c.height = 128;
      const x = c.getContext("2d")!;
      const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, "rgba(255,255,255,0.9)");
      gr.addColorStop(0.45, "rgba(255,255,255,0.32)");
      gr.addColorStop(1, "rgba(255,255,255,0)");
      x.fillStyle = gr;
      x.fillRect(0, 0, 128, 128);
      this.poolTex = new THREE.CanvasTexture(c);
    }
    const poolMat = new THREE.MeshBasicMaterial({ map: this.poolTex, color: accent, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(size * 1.9, size * 1.9), poolMat);
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = T + 0.04;
    pool.renderOrder = 2;
    g.add(pool);
    // the pool is a night effect: by day it would only wash the plaza out
    this.animated.push(() => (poolMat.opacity = 0.5 * (1 - this.dayK)));

    // lamps at the corners of the pad (only the street-facing ones on a city block)
    const e = size / 2 - 0.5;
    const corners: [number, number][] = block ? [[-e, e], [e, e]] : [[-e, -e], [e, -e], [-e, e], [e, e]];
    for (const [cx, cz] of corners) {
      this.post(g, hex("#2c3040"), 0.07, 3.4, cx, Y, cz, 6);
      this.detail(g, hex("#2c3040"), 0.5, 0.08, 0.12, cx, Y + 3.4, cz);
      this.glow(g, hex("#ffe2a8"), 0.34, 0.16, 0.34, cx, Y + 3.3, cz, 0, 1.3);
    }
    // a lit sign board on a post at the street edge
    const sx = block ? 2.2 : -size / 2 + 1.2;
    const sz = block ? 2.6 : size / 2 - 0.6;
    this.post(g, hex("#2c3040"), 0.08, 2.2, sx, Y, sz, 6);
    this.detail(g, hex("#161a2c"), 2.4, 1.0, 0.12, sx, Y + 2.2, sz);
    this.glow(g, accent, 2.1, 0.08, 0.06, sx, Y + 2.9, sz + 0.07, 0, 1.2);
    this.glow(g, accent, 2.1, 0.08, 0.06, sx, Y + 2.5, sz + 0.07, 0, 1.2);

    // one moving detail per trade
    const puffs = (mat: THREE.Material, n: number, x: number, y: number, z: number, rise: number, r0: number) => {
      const list: THREE.Mesh[] = [];
      for (let k = 0; k < n; k++) {
        const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), mat);
        g.add(m);
        list.push(m);
      }
      this.animated.push((t) => {
        list.forEach((m, k) => {
          const u = (t * 0.22 + k / n) % 1;
          m.position.set(x + Math.sin(t * 0.7 + k) * 0.25 * u, y + u * rise, z);
          m.scale.setScalar(r0 * (0.5 + u * 1.7));
        });
      });
    };
    if (id === "hvac") {
      // cold vapour from the flue
      puffs(new THREE.MeshBasicMaterial({ color: hex("#dff4ff"), transparent: true, opacity: 0.32, depthWrite: false }), 5, 3.4, Y + 11.2, -2.7, 4.2, 0.4);
    } else if (id === "roofing") {
      // chimney smoke and a blinking job-site beacon on the ridge
      puffs(new THREE.MeshBasicMaterial({ color: hex("#9a9db0"), transparent: true, opacity: 0.3, depthWrite: false }), 5, 1.8, Y + 7.4, -0.6, 4.0, 0.35);
      const beacon = this.glow(g, hex("#ff7a3a"), 0.5, 0.5, 0.5, 0, Y + 8.1, 0, 0, 1.6);
      this.animated.push((t) => beacon.scale.setScalar(0.35 + Math.max(0, Math.sin(t * 4)) * 0.4));
    } else if (id === "plumbing") {
      // a stream of drops falling down the west wall from the tank
      const dropMat = new THREE.MeshBasicMaterial({ color: hex("#9fdcff"), transparent: true, opacity: 0.8, depthWrite: false });
      const drops: THREE.Mesh[] = [];
      for (let k = 0; k < 7; k++) {
        const d = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), dropMat);
        d.scale.y = 1.7;
        g.add(d);
        drops.push(d);
      }
      this.animated.push((t) => drops.forEach((d, k) => (d.position.set(-2.4, Y + 10.2 - ((t * 0.7 + k / 7) % 1) * 9.8, -0.5 + (k % 2) * 0.25))));
    } else {
      // fireflies drifting over the yard
      const flies: THREE.Mesh[] = [];
      for (let k = 0; k < 9; k++) flies.push(this.glow(g, hex("#e8ff9a"), 0.14, 0.14, 0.14, 0, Y + 1.5, 0, 0, 1.6));
      this.animated.push((t) =>
        flies.forEach((f, k) => {
          const a = t * (0.25 + (k % 3) * 0.08) + k * 2.1;
          f.position.set(Math.cos(a) * (3.4 + (k % 4)), Y + 1.2 + Math.sin(t * 1.3 + k) * 0.6 + (k % 3) * 0.5, Math.sin(a * 1.2) * (3.4 + (k % 3)));
          f.visible = this.dayK < 0.5;
        }),
      );
    }
  }

  private buildAntenna() {
    const lm = this.makeLandmark("antenna", {
      label: this.o.labels.contact,
      hint: this.o.labels.routes.contact,
      href: "/contact",
    });
    const g = lm.group;
    g.position.copy(ANT_C);
    this.lmBox(lm, LM_SAGE, 2, 6.4, 3.6, 6.4, 0, 0.3, 0);
    this.detail(g, hex("#8e93a6"), 6.7, 0.25, 6.7, 0, 3.9, 0);
    const mast = this.lmCyl(lm, hex("#c9ced9"), 0, 0.25, 0.8, 30, 0, 4.15, 0, 6);
    mast.castShadow = false;
    const ringMat = new THREE.MeshStandardMaterial({ color: hex("#d9dde8"), roughness: 0.6, metalness: 0.4 });
    [9, 16, 23, 30].forEach((y, i) => {
      const t = new THREE.Mesh(new THREE.TorusGeometry(1.5 - i * 0.26, 0.09, 4, 14), ringMat);
      t.rotation.x = Math.PI / 2;
      t.position.y = y;
      g.add(t);
    });
    const dish = new THREE.Mesh(
      new THREE.ConeGeometry(1.4, 0.8, 18, 1, true),
      new THREE.MeshStandardMaterial({ color: hex("#d9dde8"), roughness: 0.5, side: THREE.DoubleSide }),
    );
    dish.position.set(1.1, 24, 0);
    dish.rotation.z = -Math.PI / 2.4;
    g.add(dish);
    const blink = this.glow(g, hex("#ff5a4a"), 0.5, 0.5, 0.5, 0, 34.6, 0, 0, 1.2);

    const waves: THREE.Mesh[] = [];
    for (let i = 0; i < 3; i++) {
      const w = new THREE.Mesh(
        new THREE.RingGeometry(0.97, 1, 48),
        new THREE.MeshBasicMaterial({ color: hex("#9fd6b8"), transparent: true, depthWrite: false, side: THREE.DoubleSide }),
      );
      w.rotation.x = -Math.PI / 2;
      w.position.y = 33.5;
      g.add(w);
      waves.push(w);
    }
    const lab = this.label(this.o.labels.contact, SAGE, 8.4, true);
    lab.position.set(0, 42, 0);
    g.add(lab);
    this.animated.push((t) => {
      blink.scale.setScalar(0.8 + Math.max(0, Math.sin(t * 3)) * 0.9);
      waves.forEach((w, i) => {
        const p = (t * 0.22 + i / 3) % 1;
        w.scale.setScalar(2 + p * 20);
        (w.material as THREE.MeshBasicMaterial).opacity = (1 - p) * (1 - p) * 0.5;
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Traffic                                                             */
  /* ------------------------------------------------------------------ */

  /** The sea: rolling swells that rise, break and wash up the beach along the real, curved coastline. */
  private buildSea() {
    const lights: { x: number; z: number; c: THREE.Color; i: number }[] = [];
    const push = (x: number, z: number, color: string, i: number) => lights.push({ x, z, c: new THREE.Color(color), i });
    if (this.lighthouseAt) push(this.lighthouseAt.x, this.lighthouseAt.z, "#ffcf8a", 1.4);
    const seaLights = (this.plan?.seaLights ?? []).filter((l) => landL(l.x, l.z) < 0);
    seaLights.slice(0, 4).forEach((l) => push(l.x, l.z, l.color, l.i));
    this.boatLights.slice(0, 3).forEach((b) => push(b.x, b.z, b.color, 0.9));
    while (lights.length < 8) lights.push({ x: 0, z: 0, c: new THREE.Color(0, 0, 0), i: 0 });

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: this.time1,
        uFog: { value: new THREE.Color(0x232957) },
        uDay: dayU,
        uL: { value: lights.slice(0, 8).map((l) => new THREE.Vector4(l.x, l.z, 0, l.i)) },
        uLC: { value: lights.slice(0, 8).map((l) => new THREE.Vector3(l.c.r, l.c.g, l.c.b)) },
      },
      vertexShader: `
        varying vec3 vW;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vW = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uFog;
        uniform float uDay;
        uniform vec4 uL[8];
        uniform vec3 uLC[8];
        varying vec3 vW;
        ${LAND_GLSL}
        float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(h(i), h(i + vec2(1.0, 0.0)), f.x), mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), f.x), f.y);
        }
        void main() {
          vec2 p = vW.xz;
          float t = uTime;
          float L = landL(p);
          if (L > 0.6) discard;                // land is drawn by the city ground and the terrain
          float d = max(-L, 0.0);              // metres of water between here and the shore
          float w = noise(p * 0.35 + vec2(t * 0.15, t * 0.1)) * 0.6 + noise(p * 0.9 - vec2(t * 0.25, 0.0)) * 0.4;
          vec3 deep = mix(vec3(0.004, 0.012, 0.04), vec3(0.04, 0.2, 0.36), uDay);
          vec3 shallow = mix(vec3(0.014, 0.06, 0.095), vec3(0.14, 0.5, 0.58), uDay);
          vec3 col = mix(shallow, deep, smoothstep(0.0, 30.0, d));
          col += vec3(0.004, 0.01, 0.025) * w;

          // crests rolling toward the beach
          float band = abs(fract(d * 0.16 - t * 0.07 + noise(vec2(p.x * 0.2 + p.y * 0.1, t * 0.2)) * 0.3) - 0.5);
          col += mix(vec3(0.16, 0.22, 0.34), vec3(0.5, 0.72, 0.8), uDay) * smoothstep(0.05, 0.0, band) * smoothstep(24.0, 2.0, d) * 0.3;
          // foam that wiggles along the shoreline
          float sh = sin((p.x + p.y) * 0.55 + t * 0.9) * 0.35 + sin((p.x - p.y) * 0.17 - t * 0.5) * 0.3;
          float foam = smoothstep(1.5, 0.0, d - 0.3 - sh * 0.5 - abs(sin(t * 0.7)) * 0.6);
          col = mix(col, mix(vec3(0.5, 0.58, 0.72), vec3(0.92, 0.97, 1.0), uDay), foam * 0.5);

          // moon glitter
          float g = pow(max(0.0, noise(p * 2.2 + vec2(t * 0.3, -t * 0.2)) - 0.72) * 3.2, 2.0);
          col += mix(vec3(0.3, 0.4, 0.7), vec3(1.0, 0.95, 0.8), uDay) * g * (0.32 + uDay * 0.5) * (0.35 + 0.65 * smoothstep(90.0, 8.0, d));

          // streaks of light from lamps, boats and the lighthouse
          for (int i = 0; i < 8; i++) {
            vec4 Lt = uL[i];
            if (Lt.w <= 0.0) continue;
            float dx = abs(p.x - Lt.x);
            float dz = p.y - Lt.y;
            float streak = exp(-dx * dx / (0.8 + max(0.0, dz) * 0.1)) * exp(-abs(dz) * 0.05) * step(-2.0, dz);
            float shim = 0.5 + 0.5 * noise(vec2(p.x * 1.6, p.y * 0.55 - t * 1.3));
            col += uLC[i] * streak * shim * Lt.w * 0.32 * (1.0 - uDay);
          }
          float far = smoothstep(60.0, 260.0, d);
          col = mix(col, uFog, far * 0.85);
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    this.seaMat = mat;
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400).rotateX(-Math.PI / 2), mat);
    sea.position.set(0, -0.06, 0);
    this.scene.add(sea);
  }

  private boatLights: { x: number; z: number; color: string }[] = [];
  private lighthouseAt: THREE.Vector3 | null = null;

  private makeBoat(hull: string, sailColor: string | null) {
    const g = new THREE.Group();
    const hm = new THREE.MeshStandardMaterial({ color: hex(hull), roughness: 0.6, metalness: 0.1 });
    const add = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material, ry = 0) => {
      const mesh = new THREE.Mesh(this.unitBox, m);
      mesh.scale.set(w, h, d);
      mesh.position.set(x, y, z);
      mesh.rotation.y = ry;
      mesh.castShadow = true;
      g.add(mesh);
      return mesh;
    };
    add(3.0, 0.55, 1.1, 0, 0, 0, hm);
    add(0.78, 0.55, 0.78, 1.62, 0, 0, hm, Math.PI / 4);
    add(1.1, 0.55, 0.85, -0.5, 0.55, 0, new THREE.MeshStandardMaterial({ color: hex("#d8d4c8"), roughness: 0.7 }));
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 3.2, 5), new THREE.MeshStandardMaterial({ color: hex("#c9ced9") }));
    mast.position.set(0.3, 1.9, 0);
    g.add(mast);
    if (sailColor) {
      const tri = new THREE.BufferGeometry();
      tri.setAttribute("position", new THREE.Float32BufferAttribute([0, 0.5, 0, 0, 3.3, 0, 1.4, 0.5, 0], 3));
      tri.computeVertexNormals();
      const sail = new THREE.Mesh(tri, new THREE.MeshStandardMaterial({ color: hex(sailColor), roughness: 0.9, side: THREE.DoubleSide }));
      sail.position.set(0.35, 0.3, 0);
      sail.rotation.y = Math.PI;
      g.add(sail);
    }
    const lantern = new THREE.Mesh(this.unitBox, new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.6, 0.8) }));
    lantern.scale.set(0.16, 0.16, 0.16);
    lantern.position.set(-1.3, 1.1, 0);
    g.add(lantern);
    const red = new THREE.Mesh(this.unitBox, new THREE.MeshBasicMaterial({ color: new THREE.Color(2.0, 0.2, 0.15) }));
    red.scale.set(0.1, 0.1, 0.1);
    red.position.set(0.3, 3.5, 0.35);
    g.add(red);
    return g;
  }

  /** Lighthouse, boats at the piers and out on the water. Everything is placed relative to the coast. */
  private buildCoastLife() {
    // lighthouse on a little rock, out to sea beyond the south-east corner
    const spot = findCoast(52, 30, 1, 0.25, -20);
    this.lighthouseAt = spot;
    const lh = new THREE.Group();
    lh.position.set(spot.x, 0, spot.z);
    const rockMat = new THREE.MeshStandardMaterial({ color: hex("#55596b"), roughness: 0.95, flatShading: true });
    for (const [x, z, sc] of [
      [0, 0, 4.2],
      [3.4, 1.6, 2.4],
      [-3.2, -1.2, 2.8],
      [1.2, -3, 2.0],
    ] as const) {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), rockMat);
      m.position.set(x, 0.2, z);
      m.scale.set(sc, sc * 0.7, sc);
      m.castShadow = true;
      lh.add(m);
    }
    for (let i = 0; i < 4; i++) {
      const t = new THREE.Mesh(
        new THREE.CylinderGeometry(1.25 - i * 0.07, 1.4 - i * 0.07, 2.3, 10),
        new THREE.MeshStandardMaterial({ color: i % 2 ? hex("#c9302c") : hex("#e6e2da"), roughness: 0.7 }),
      );
      t.position.y = 2.4 + i * 2.3;
      t.castShadow = true;
      lh.add(t);
    }
    const gallery = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.3, 10), new THREE.MeshStandardMaterial({ color: hex("#2c3040") }));
    gallery.position.y = 11.7;
    lh.add(gallery);
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 1.4, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.4, 1.2) }));
    lamp.position.y = 12.55;
    lh.add(lamp);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.15, 1.1, 10), new THREE.MeshStandardMaterial({ color: hex("#c9302c") }));
    roof.position.y = 13.8;
    lh.add(roof);
    const beams = new THREE.Group();
    beams.position.y = 12.55;
    for (const dir of [1, -1]) {
      const b = new THREE.Mesh(
        new THREE.BoxGeometry(50, 0.5, 0.9),
        new THREE.MeshBasicMaterial({ color: 0xffe2a8, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false }),
      );
      b.position.x = 25 * dir;
      beams.add(b);
    }
    lh.add(beams);
    const lhLight = new THREE.PointLight(0xffd59a, 70, 26, 1.8);
    lhLight.position.set(spot.x, 12.5, spot.z);
    this.scene.add(lhLight);
    this.scene.add(lh);
    this.animated.push((t) => {
      beams.rotation.y = t * 0.45;
    });

    // boats: moored at each pier, at anchor off the beaches, and two sailing slowly
    type Boat = { g: THREE.Group; x: number; z: number; heading: number; phase: number; path?: { cx: number; cz: number; rx: number; rz: number; speed: number } };
    const boats: Boat[] = [];
    const place = (hull: string, sail: string | null, x: number, z: number, heading: number, path?: Boat["path"]) => {
      const g = this.makeBoat(hull, sail);
      this.scene.add(g);
      boats.push({ g, x, z, heading, phase: Math.random() * 6, path });
    };
    const piers = this.plan?.piers ?? [];
    const hulls = ["#2f4a7a", "#b3363a", "#e6e2da", "#3f6fb0"];
    piers.forEach((p, i) => {
      const along = p.axis === "z";
      place(hulls[i * 2], null, p.x + (along ? 3.9 : 0), p.z - (along ? 12 : -3.9) + (along ? 0 : 12), along ? Math.PI / 2 : 0);
      place(hulls[i * 2 + 1], null, p.x - (along ? 3.9 : 0), p.z - (along ? 4 : 3.9) + (along ? 0 : 4), along ? Math.PI / 2 : 0);
    });
    const a1 = findCoast(40, -10, 1, 0, -14);
    const a2 = findCoast(10, -50, 0.3, -1, -16);
    place("#e6e2da", "#e8e4d8", a1.x, a1.z, 0.4);
    place("#3f6fb0", "#d9a441", a2.x, a2.z, -0.3);
    const s1 = findCoast(40, -10, 1, 0.25, -46);
    const s2 = findCoast(5, -40, 0.25, -1, -46);
    place("#2f3548", "#e8e4d8", s1.x, s1.z, 0, { cx: s1.x, cz: s1.z, rx: 40, rz: 12, speed: 0.05 });
    place("#8b5a8c", "#d8694f", s2.x, s2.z, 0, { cx: s2.x, cz: s2.z, rx: 12, rz: 36, speed: -0.04 });
    boats.slice(0, 5).forEach((b) => this.boatLights.push({ x: b.x - 1.3, z: b.z, color: "#ffc98a" }));
    this.animated.push((t) => {
      boats.forEach((b, i) => {
        let x = b.x;
        let z = b.z;
        let heading = b.heading;
        if (b.path) {
          const a = t * b.path.speed + i;
          x = b.path.cx + Math.cos(a) * b.path.rx;
          z = b.path.cz + Math.sin(a) * b.path.rz;
          const vx = -Math.sin(a) * b.path.rx * Math.sign(b.path.speed);
          const vz = Math.cos(a) * b.path.rz * Math.sign(b.path.speed);
          heading = Math.atan2(-vz, vx);
        }
        b.g.position.set(x, -0.4 + Math.sin(t * 1.3 + b.phase) * 0.12, z);
        b.g.rotation.set(Math.sin(t * 0.9 + b.phase) * 0.04, heading, Math.sin(t * 1.1 + b.phase) * 0.05);
      });
    });
  }

  /** Gulls wheeling over the beaches and the water. */
  private buildGulls() {
    this.buildCoastLife();
    const r = rand(88);
    const n = this.o.mobile ? 8 : 18;
    const flock = Array.from({ length: n }, () => {
      let cx = 0;
      let cz = 60;
      for (let tries = 0; tries < 80; tries++) {
        const x = -60 + r() * 160;
        const z = -90 + r() * 170;
        const L = landL(x, z);
        if (L < 6 && L > -30) {
          cx = x;
          cz = z;
          break;
        }
      }
      return { cx, cz, R: 5 + r() * 14, h: 7 + r() * 10, w: (0.35 + r() * 0.35) * (r() < 0.5 ? 1 : -1), ph: r() * 6.28, flap: 7 + r() * 3 };
    });
    const mat = new THREE.MeshStandardMaterial({ color: 0xe9eef7, roughness: 0.8, emissive: 0x283044 });
    const body = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.14, 0.18), mat, n);
    const wingGeo = new THREE.BoxGeometry(0.34, 0.03, 0.7).translate(0, 0, 0.35);
    const wings = new THREE.InstancedMesh(wingGeo, mat, n * 2);
    [body, wings].forEach((m) => {
      m.frustumCulled = false;
      this.scene.add(m);
    });
    const base = new THREE.Matrix4();
    const M = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const p = new THREE.Vector3();
    const one = new THREE.Vector3(1, 1, 1);
    const flip = new THREE.Matrix4().makeScale(1, 1, -1);
    const rx = new THREE.Matrix4();
    this.animated.push((t) => {
      flock.forEach((f, i) => {
        const a = f.ph + t * f.w;
        const x = f.cx + Math.cos(a) * f.R + Math.sin(t * 0.05 + i) * 6;
        const z = f.cz + Math.sin(a) * f.R;
        const y = f.h + Math.sin(t * 0.7 + i) * 0.8;
        const vx = -Math.sin(a) * Math.sign(f.w);
        const vz = Math.cos(a) * Math.sign(f.w);
        e.set(Math.sign(f.w) * 0.35, Math.atan2(-vz, vx), 0, "YXZ");
        q.setFromEuler(e);
        base.compose(p.set(x, y, z), q, one);
        body.setMatrixAt(i, base);
        rx.makeRotationX(Math.sin(t * f.flap + i) * 0.7);
        M.multiplyMatrices(base, rx);
        wings.setMatrixAt(i * 2, M);
        M.multiply(flip);
        wings.setMatrixAt(i * 2 + 1, M);
      });
      body.instanceMatrix.needsUpdate = true;
      wings.instanceMatrix.needsUpdate = true;
    });
  }

  /** The countryside: fields, hills and mountain ranges beyond the western edge, a highway into town. */
  private buildLandscape() {
    // --- terrain mesh, low-poly with vertex colours ---
    const SIZE = 1300;
    const SEG = this.o.mobile ? 108 : 190;
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG).rotateX(-Math.PI / 2);
    const pos = geo.getAttribute("position");
    const colors = new Float32Array(pos.count * 3);
    const tmp = new THREE.Color();
    const dark = new THREE.Color("#0b0d16");
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = terrainHeight(x, z);
      pos.setY(i, h);
      if (h < -1) tmp.copy(dark);
      else terrainColor(x, z, h, tmp);
      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const tmat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, metalness: 0 });
    // the land glows faintly with sky light: self-lit by its own colour so ranges read against the night
    tmat.onBeforeCompile = (sh) => {
      sh.uniforms.uGlow = this.terrainGlow;
      sh.uniforms.uDay = dayU;
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vTP;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvTP = position;");
      sh.fragmentShader = sh.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
        uniform float uGlow;
        uniform float uDay;
        varying vec3 vTP;
        ${LAND_GLSL}
        float th(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float tn(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(th(i), th(i + vec2(1.0, 0.0)), f.x), mix(th(i + vec2(0.0, 1.0)), th(i + vec2(1.0, 1.0)), f.x), f.y);
        }`,
        )
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
        // moonlight: cooler and darker than daylight, so the fields do not glow green at night
        diffuseColor.rgb *= mix(vec3(0.42, 0.52, 0.85), vec3(1.0), uDay);
        {
          vec2 p = vTP.xz;
          float low = 1.0 - smoothstep(3.0, 8.0, vTP.y);
          // patches, tufts and fine blades at three scales, plus a few wildflowers
          float t = (tn(p * 0.11) - 0.5) * 0.3 + (tn(p * 0.6 + 7.0) - 0.5) * 0.26 + (tn(p * vec2(3.2, 1.9) + 3.0) - 0.5) * 0.3 + (tn(p * vec2(1.4, 5.0) + 11.0) - 0.5) * 0.18;
          diffuseColor.rgb *= 1.0 + t * (0.55 + 0.45 * low);
          float cellId = th(floor(p * 2.2));
          float fl = step(0.992, cellId) * low;
          vec3 petals = mix(vec3(0.95, 0.9, 0.55), vec3(0.92, 0.55, 0.7), step(0.5, th(floor(p * 2.2) + 3.0)));
          diffuseColor.rgb = mix(diffuseColor.rgb, petals, fl * 0.75);
          // the beach: the same bands as the city ground (wet, damp, dry sand, dunes, boardwalk), all round the coast
          float L = landL(p);
          if (L < 14.0) {
            float bn = th(floor(p * 4.0));
            vec3 WETc = vec3(0.29, 0.28, 0.35);
            vec3 DAMPc = vec3(0.478, 0.431, 0.408);
            vec3 DRYc = vec3(0.639, 0.561, 0.447);
            vec3 DUNEc = vec3(0.337, 0.435, 0.29);
            vec3 PLANKc = vec3(0.42, 0.353, 0.282);
            vec3 sc;
            if (L <= 0.0) sc = WETc;
            else if (L < 1.6) sc = mix(WETc, DAMPc, L / 1.6);
            else if (L < 3.8) sc = mix(DAMPc, DRYc, (L - 1.6) / 2.2);
            else if (L < 9.5) sc = DRYc * (0.95 + 0.1 * bn);
            else {
              float tt = clamp((L - 9.5) / 2.9, 0.0, 1.0);
              sc = bn < tt * 0.9 ? DUNEc : DRYc;
              if (L > 10.3 && L < 11.7) sc = PLANKc * (sin((p.x + p.y) * 5.2) > 0.85 ? 0.8 : 1.0);
            }
            sc = pow(sc, vec3(2.2)) * (0.92 + bn * 0.16);
            diffuseColor.rgb = mix(diffuseColor.rgb, sc, (1.0 - smoothstep(11.8, 14.0, L)) * (1.0 - smoothstep(1.5, 5.5, vTP.y)));
          }
        }`,
        )
        .replace(
          "#include <emissivemap_fragment>",
          `#include <emissivemap_fragment>
        totalEmissiveRadiance += diffuseColor.rgb * uGlow;`,
        );
    };
    const terrain = new THREE.Mesh(geo, tmat);
    terrain.receiveShadow = true;
    this.scene.add(terrain);

    const r = rand(515);
    const trimMat = makeTrimMaterial();
    const glowMat = makeGlowMaterial(1.9);
    const walls = new Bucket(GEO.box(), trimMat);
    const roofs = new Bucket(GEO.gable(), trimMat);
    const cyls = new Bucket(GEO.cyl(), trimMat);
    const cones = new Bucket(GEO.cone(), trimMat);
    const foliageMat = makeFoliageMaterial();
    const icos = new Bucket(GEO.ico(), foliageMat);
    const pines = new Bucket(GEO.cone(), foliageMat);
    const glows = new Bucket(GEO.box(), glowMat, { cast: false, receive: false });
    const col = (h: string) => new THREE.Color(h);
    const skirts = this.o.mobile ? 3 : 4;
    /** a pine: a trunk and a stack of narrowing skirts, darker at the bottom and lighter at the tip */
    const pine = (px: number, py: number, pz: number, ps: number, pc: THREE.Color) => {
      cyls.add(px, py, pz, 0.28 * ps, 1.0 * ps, 0.28 * ps, col("#4a3a2c"));
      for (let k = 0; k < skirts; k++) {
        const wk = (2.0 - k * (1.6 / skirts)) * ps;
        pines.add(px, py + (0.7 + k * (3.0 / skirts)) * ps, pz, wk, 1.5 * ps, wk, pc.clone().multiplyScalar(0.74 + k * 0.1), k * 0.7);
      }
    };
    const PLASTER = ["#b7a48f", "#a89a86", "#b98d84", "#a7b3a0"].map(col);
    const TREES = ["#2f5a45", "#3f6b4f", "#36664a", "#4f7d5a"].map(col);

    // --- farms scattered over the fields ---
    const farms: [number, number][] = [];
    for (let tries = 0; tries < 900 && farms.length < 38; tries++) {
      const south = r() < 0.4;
      const x = south ? -50 + r() * 140 : -84 - r() * 120;
      const z = south ? 104 + r() * 100 : -96 + r() * 192;
      if (x > -132 && x < 100 && z < 126 && z > -98) continue; // the suburbs, the stadium and the station live here
      if (x > -158 && x < -76 && z > 4 && z < 68) continue; // the stadium and its car parks
      if (x > -196 && x < -150 && z > -2 && z < 36) continue; // the gas station
      if (x > -134 && x < -68 && z > -174 && z < -96) continue; // the beach villas
      if (INDUSTRIES.some((i) => i.site === "open" && Math.hypot(i.x - x, i.z - z) < 26)) continue; // the industry sites
      if (Math.abs(x + 140) < 20 && z > -56 && z < 10) continue; // the link road between the avenue and the highway
      if (landL(x, z) < 34 ||(x < -60 && Math.abs(z + 14) < 20) || (x < -60 ? ROADS_Z.some((rz) => Math.abs(z - rz) < 20) : ROADS_X.some((rx) => Math.abs(x - rx) < 20))) continue;
      const h = terrainHeight(x, z);
      if (h > 2.4) continue;
      if (farms.some((f) => Math.hypot(f[0] - x, f[1] - z) < 16)) continue;
      farms.push([x, z]);
      const y = h;
      // each farmstead is turned a different way; the buildings themselves come from the world module
      const q = Math.floor(r() * 4);
      this.farmSpots.push([x, z, q]);
      const cs = Math.round(Math.cos((q * Math.PI) / 2));
      const sn = Math.round(Math.sin((q * Math.PI) / 2));
      const at = (dx: number, dz: number): [number, number] => [x + dx * cs + dz * sn, z - dx * sn + dz * cs];
      // yard light and a few trees
      {
        const [lx, lz] = at(-2.4, 2.6);
        cyls.add(lx, y, lz, 0.1, 3.0, 0.1, col("#2c3040"));
        glows.add(lx, y + 3.0, lz, 0.32, 0.18, 0.32, col("#ffc98a"));
      }
      for (let k = 0; k < 4; k++) {
        const tx = x + (r() - 0.5) * 18;
        const tz = z + (r() - 0.5) * 14;
        const sz = 1.8 + r() * 1.2;
        if (r() < 0.5) pine(tx, y, tz, sz * 0.5, TREES[Math.floor(r() * TREES.length)]);
        else {
          cyls.add(tx, y, tz, 0.3, 1.3, 0.3, col("#5a4538"));
          icos.add(tx, y + 1.8, tz, sz * 1.5, sz * 1.3, sz * 1.5, TREES[Math.floor(r() * TREES.length)], r() * 3);
        }
      }
    }

    [walls, roofs, cyls, cones, icos, pines, glows].forEach((b) => b.build(this.scene));

  }

  /** Soft mist banks along the edges that dissolve into the night. */
  private buildMist() {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    const gr = g.createRadialGradient(64, 64, 2, 64, 64, 62);
    gr.addColorStop(0, "rgba(120,130,190,0.55)");
    gr.addColorStop(1, "rgba(120,130,190,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const r = rand(61);
    const n = this.o.mobile ? 14 : 34;
    const sprites: { sp: THREE.Sprite; sx: number; sz: number; ph: number }[] = [];
    for (let i = 0; i < n; i++) {
      const edge = r();
      let x: number;
      let z: number;
      if (edge < 0.34) {
        x = -HALF - 10 - r() * 50;
        z = -90 + r() * 150;
      } else if (edge < 0.68) {
        x = HALF - 4 + r() * 12;
        z = -HALF + r() * (HALF + 52);
      } else {
        x = -HALF + r() * HALF * 2;
        z = -HALF + 4 - r() * 12;
      }
      const spm = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.26 + r() * 0.2, fog: false });
      this.mistMats.push({ m: spm, base: spm.opacity });
      const sp = new THREE.Sprite(spm);
      const s = 26 + r() * 30;
      sp.scale.set(s, s * 0.6, 1);
      sp.position.set(x, 1.5 + r() * 8, z);
      this.scene.add(sp);
      sprites.push({ sp, sx: x, sz: z, ph: r() * 6 });
    }
    this.animated.push((t) => {
      sprites.forEach(({ sp, sx, sz, ph }) => {
        sp.position.x = sx + Math.sin(t * 0.06 + ph) * 3;
        sp.position.z = sz + Math.cos(t * 0.05 + ph) * 2;
      });
    });
  }

  /** The wet streets reflect the city: a flipped copy sits under the translucent asphalt. */
  private buildMirror() {
    if (!this.cityGroup) return;
    const mirror = new THREE.Group();
    mirror.scale.set(1, -1, 1);
    const copy = (src: THREE.Object3D) => {
      // userData.lm points back at the landmark (circular), which Object3D.clone cannot serialise
      const held: [THREE.Object3D, unknown][] = [];
      src.traverse((o) => {
        if (o.userData.lm) {
          held.push([o, o.userData.lm]);
          delete o.userData.lm;
        }
      });
      const c = src.clone(true);
      held.forEach(([o, lm]) => (o.userData.lm = lm));
      const kill: THREE.Object3D[] = [];
      c.traverse((o) => {
        if ((o as THREE.Sprite).isSprite) kill.push(o);
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.castShadow = false;
          m.receiveShadow = false;
        }
      });
      kill.forEach((o) => o.parent?.remove(o));
      return c;
    };
    mirror.add(copy(this.cityGroup));
    this.landmarks.forEach((lm) => mirror.add(copy(lm.group)));
    this.scene.add(mirror);
  }

  private buildSteam(spots: { x: number; z: number }[]) {
    if (!spots.length) return;
    const per = 6;
    const mesh = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(0.5, 0),
      new THREE.MeshBasicMaterial({ color: 0xb9c3e6, transparent: true, opacity: 0.2, depthWrite: false }),
      spots.length * per,
    );
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    const M = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const sc = new THREE.Vector3();
    this.animated.push((t) => {
      spots.forEach((sp, i) => {
        for (let k = 0; k < per; k++) {
          const ph = (t * 0.32 + k / per + i * 0.17) % 1;
          p.set(sp.x + Math.sin(ph * 6 + k) * 0.35 + ph * 0.6, 0.2 + ph * 4.4, sp.z + Math.cos(ph * 5 + k) * 0.25);
          sc.setScalar((0.35 + ph * 1.1) * (1 - ph * ph));
          M.compose(p, q, sc);
          mesh.setMatrixAt(i * per + k, M);
        }
      });
      mesh.instanceMatrix.needsUpdate = true;
    });
  }

  /** People with umbrellas walking the sidewalks. */
  private buildPeople() {
    const r = rand(303);
    const n = this.o.mobile ? 40 : 120;
    const blocks: [number, number][] = [];
    for (let i = -8; i <= 8; i++) {
      for (let j = -8; j <= 5; j++) {
        const cx = i * 8;
        const cz = j * 8;
        if (inZone(cx, cz, 4.5) || cz <= -48) continue;
        blocks.push([cx, cz]);
      }
    }
    const coats = ["#2a2f45", "#3a2f3f", "#23353f", "#4a3a34", "#2f2f2f"].map(hex);
    const brollies = ["#d8694f", "#4fa3a5", "#d4a24c", "#8b5a8c", "#6a86d6", "#cfd3dc", "#b3363a"].map(hex);
    const people = Array.from({ length: n }, () => {
      const [cx, cz] = blocks[Math.floor(r() * blocks.length)];
      return { cx, cz, phase: r(), speed: (0.7 + r() * 0.6) * (r() < 0.5 ? 1 : -1), coat: coats[Math.floor(r() * coats.length)], brolly: brollies[Math.floor(r() * brollies.length)] };
    });
    const body = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.14, 0.17, 0.85, 6).translate(0, 0.425, 0),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }),
      n,
    );
    const umb = new THREE.InstancedMesh(
      new THREE.ConeGeometry(0.5, 0.26, 8).translate(0, 1.2, 0),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }),
      n,
    );
    people.forEach((p, i) => {
      body.setColorAt(i, p.coat);
      umb.setColorAt(i, p.brolly);
    });
    [body, umb].forEach((m) => {
      m.castShadow = true;
      m.frustumCulled = false;
      this.scene.add(m);
    });
    const half = 2.85;
    const perim = half * 8;
    const M = new THREE.Matrix4();
    const M2 = new THREE.Matrix4();
    const zeroM = new THREE.Matrix4().makeScale(0, 0, 0);
    const usc = new THREE.Vector3(1, 1, 1);
    const pos = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const sc = new THREE.Vector3(1, 1, 1);
    this.animated.push((t) => {
      const um = smooth(0.12, 0.6, rainState.value); // umbrellas only while it rains
      people.forEach((p, i) => {
        let u = (((p.phase + (t * p.speed) / perim) % 1) + 1) % 1;
        u *= 4;
        const side = Math.floor(u);
        const f = u - side;
        const a = -half + f * half * 2;
        let x = 0;
        let z = 0;
        if (side === 0) { x = a; z = -half; }
        else if (side === 1) { x = half; z = a; }
        else if (side === 2) { x = -a; z = half; }
        else { x = -half; z = -a; }
        pos.set(p.cx + x, 0.06 + Math.abs(Math.sin(t * 6 + i)) * 0.03, p.cz + z);
        M.compose(pos, q, sc);
        body.setMatrixAt(i, M);
        if (um < 0.02) umb.setMatrixAt(i, zeroM);
        else {
          usc.set(um, um, um);
          M2.compose(pos, q, usc);
          umb.setMatrixAt(i, M2);
        }
      });
      body.instanceMatrix.needsUpdate = true;
      umb.instanceMatrix.needsUpdate = true;
    });
  }

  private buildCars() {
    const r = rand(77);
    const count = this.o.mobile ? 36 : 84;
    const palette = ["#b3363a", "#d9a441", "#cfd3dc", "#3f6fb0", "#6b7488", "#2f3548", "#d8694f", "#4a9a8a"].map(hex);
    // each car works one stretch of real street: it slows down at the ends, turns round and drives back,
    // so none of them ever vanishes in front of the player
    type Car = { axis: 0 | 1; centre: number; lo: number; hi: number; rate: number; ph: number; color: THREE.Color };
    const cars: Car[] = [];
    const roadOk = (axis: 0 | 1, centre: number, a: number) => {
      const x = axis === 0 ? a : centre;
      const z = axis === 0 ? centre : a;
      return !inZone(x, z, 0.5) && Math.max(-x, (z - 60) * 1.6 + 52) <= 62 && landL(x, z) > 6;
    };
    for (let tries = 0; cars.length < count && tries < 4000; tries++) {
      const axis = (r() < 0.5 ? 0 : 1) as 0 | 1;
      const n = Math.floor(r() * 18) - 9;
      const centre = 4 + 8 * n;
      if (axis === 0 && centre > ZONES.cases.z0 - 1 && centre < ZONES.cases.z1 + 1) continue;
      const a0 = (r() - 0.5) * HALF * 2;
      if (!roadOk(axis, centre, a0)) continue;
      let lo = a0;
      while (lo > -HALF && roadOk(axis, centre, lo - 1)) lo--;
      let hi = a0;
      while (hi < HALF && roadOk(axis, centre, hi + 1)) hi++;
      if (hi - lo < 16) continue;
      const half = (hi - lo) / 2;
      cars.push({ axis, centre, lo, hi, rate: (3 + r() * 4) / half, ph: r() * Math.PI * 2, color: palette[Math.floor(r() * palette.length)] });
    }
    const total = cars.length;

    const body = new THREE.InstancedMesh(
      this.unitBox,
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.5 }),
      total,
    );
    const cabin = new THREE.InstancedMesh(
      this.unitBox,
      new THREE.MeshStandardMaterial({ color: 0x1b2236, roughness: 0.2, metalness: 0.6 }),
      total,
    );
    const lights = new THREE.InstancedMesh(this.unitBox, new THREE.MeshBasicMaterial({ color: 0xffffff }), total * 4);
    [body, cabin, lights].forEach((m) => {
      m.castShadow = m !== lights;
      m.frustumCulled = false;
      this.scene.add(m);
    });
    cars.forEach((c, i) => body.setColorAt(i, c.color));
    const white = new THREE.Color(2.2, 1.9, 1.4);
    const red = new THREE.Color(1.8, 0.2, 0.15);
    for (let i = 0; i < total; i++) {
      lights.setColorAt(i * 4, white);
      lights.setColorAt(i * 4 + 1, white);
      lights.setColorAt(i * 4 + 2, red);
      lights.setColorAt(i * 4 + 3, red);
    }

    const M = new THREE.Matrix4();
    const base = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const sc = new THREE.Vector3(1, 1, 1);
    const p = new THREE.Vector3();
    const local = (x: number, y: number, z: number, sx: number, sy: number, sz: number) =>
      new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(sx, sy, sz));
    const LB = local(0, 0.12, 0, 1.7, 0.36, 0.82);
    const LC = local(-0.1, 0.46, 0, 0.95, 0.32, 0.7);
    const LL = [
      local(0.86, 0.22, 0.26, 0.06, 0.12, 0.2),
      local(0.86, 0.22, -0.26, 0.06, 0.12, 0.2),
      local(-0.86, 0.22, 0.26, 0.06, 0.12, 0.2),
      local(-0.86, 0.22, -0.26, 0.06, 0.12, 0.2),
    ];

    this.animated.push((t) => {
      cars.forEach((c, i) => {
        const phase = c.ph + t * c.rate;
        const mid = (c.lo + c.hi) / 2;
        const half = (c.hi - c.lo) / 2;
        const along = mid - half * Math.cos(phase);
        const dir = Math.sin(phase) >= 0 ? 1 : -1;
        // drive on the right of the road centreline, whichever way the car is heading
        const lane = c.centre + (c.axis === 0 ? 0.5 * dir : -0.5 * dir);
        const x = c.axis === 0 ? along : lane;
        const z = c.axis === 0 ? lane : along;
        const heading = c.axis === 0 ? (dir > 0 ? 0 : Math.PI) : dir > 0 ? -Math.PI / 2 : Math.PI / 2;
        e.set(0, heading, 0);
        q.setFromEuler(e);
        base.compose(p.set(x, 0.05, z), q, sc);
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
  }

  /* ------------------------------------------------------------------ */
  /* Rain                                                                */
  /* ------------------------------------------------------------------ */

  private buildRain() {
    const n = this.o.mobile ? 1400 : 4400;
    const r = rand(55);
    const pos = new Float32Array(n * 2 * 3);
    const drop = new Float32Array(n * 2 * 4);
    const end = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      const x = (r() - 0.5) * 280;
      const z = (r() - 0.5) * 280;
      const phase = r();
      const speed = 38 + r() * 24;
      for (let k = 0; k < 2; k++) {
        drop.set([x, z, phase, speed], (i * 2 + k) * 4);
        end[i * 2 + k] = k;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aDrop", new THREE.BufferAttribute(drop, 4));
    geo.setAttribute("aEnd", new THREE.BufferAttribute(end, 1));
    const mat = new THREE.ShaderMaterial({
      vertexShader: rainVertex,
      fragmentShader: rainFragment,
      transparent: true,
      depthWrite: false,
      uniforms: { uTime: this.time1, uRain: this.rainU, uCenter: this.rainCenter },
    });
    const rain = new THREE.LineSegments(geo, mat);
    this.rainMesh = rain;
    rain.frustumCulled = false;
    this.scene.add(rain);
  }

  /* ------------------------------------------------------------------ */
  /* Day / night and weather                                             */
  /* ------------------------------------------------------------------ */

  private applyDay(k: number) {
    dayU.value = k;
    this.paintBackdrop(k);
    const fogNight = new THREE.Color(0x232957);
    const fogDay = new THREE.Color(0xa9c8e8);
    const fog = fogNight.clone().lerp(fogDay, k);
    if (this.scene.fog) {
      const sf = this.scene.fog as THREE.Fog;
      sf.color.copy(fog);
      sf.near = 380 + 320 * k;
      sf.far = 980 + 520 * k;
    }
    (this.seaMat?.uniforms.uFog.value as THREE.Color | undefined)?.copy(fog);
    this.hemi.color.set(0x6674c4).lerp(new THREE.Color(0xbfd8ff), k);
    this.hemi.groundColor.set(0x241c3a).lerp(new THREE.Color(0x7a7a60), k);
    this.hemi.intensity = 0.5 + 0.55 * k;
    this.moon.color.set(0x9db4ff).lerp(new THREE.Color(0xfff1d6), k);
    this.moon.intensity = 0.85 + 1.5 * k;
    this.moon.position.set(46 + (-70 - 46) * k, 96 + 8 * k, -40 + 30 * k);
    this.pinkL.intensity = 0.95 * (1 - k) + 0.1 * k;
    this.blueL.intensity = 0.9 * (1 - k) + 0.3 * k;
    this.renderer.toneMappingExposure = 1.05 - 0.13 * k;
    if (this.bloom) {
      this.bloom.strength = 0.5 - 0.34 * k;
      this.bloom.threshold = 0.88 + 0.3 * k;
    }
    this.terrainGlow.value = 0.3 - 0.2 * k;
    if (this.groundMat) this.groundMat.emissiveIntensity = 0.9 - 0.7 * k;
    this.cityLights.forEach((c) => (c.l.intensity = c.base * (1 - 0.94 * k)));
    this.world?.nightLights.forEach((c) => (c.light.intensity = c.base * (1 - 0.94 * k)));
    this.world?.nightBeams.forEach((c) => (c.mat.opacity = c.base * (1 - k)));
    glowReg.forEach(({ mat, base }) => mat.color.copy(base).multiplyScalar(1 - 0.88 * k));
    this.mistMats.forEach(({ m, base }) => (m.opacity = base * (1 - 0.8 * k)));
  }

  private updateAtmosphere(dt: number) {
    this.rainCenter.value.set(this.camTarget.x, this.camTarget.z);
    if (this.dayHold > 0) this.dayHold -= dt;
    const hold = this.dayHold > 0;
    const dTarget = hold || this.dayOn ? 1 : 0;
    this.dayK += (dTarget - this.dayK) * (1 - Math.exp(-dt * (this.opening ? 1.1 : 2.6)));
    if (Math.abs(dTarget - this.dayK) < 0.003) {
      this.dayK = dTarget;
      if (!hold) this.opening = false;
    }
    if (this.dayK !== this.dayApplied) {
      this.applyDay(this.dayK);
      this.dayApplied = this.dayK;
    }
    const rTarget = hold ? 0 : this.rainOn ? 1 : 0;
    this.rainK += (rTarget - this.rainK) * (1 - Math.exp(-dt * 3));
    if (Math.abs(rTarget - this.rainK) < 0.01) this.rainK = rTarget;
    rainState.value = this.rainK;
    if (this.rainK !== this.rainApplied) {
      this.rainU.value = this.rainK;
      if (this.rainMesh) this.rainMesh.visible = this.rainK > 0.01;
      this.rainApplied = this.rainK;
    }
  }

  /* ------------------------------------------------------------------ */
  /* Rendering                                                           */
  /* ------------------------------------------------------------------ */

  private resize() {
    const c = this.o.canvas;
    const w = Math.max(1, c.clientWidth);
    const h = Math.max(1, c.clientHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, this.lowQuality ? 1 : this.o.mobile ? 1.5 : 2);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.composer?.setPixelRatio(dpr);
    this.composer?.setSize(w, h);
    this.bloom?.resolution.set(w / 2, h / 2);
  }

  /* ------------------------------------------------------------------ */
  /* Interaction                                                         */
  /* ------------------------------------------------------------------ */

  private onPointerMove(e: PointerEvent) {
    this.mouse.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
    this.pointerPx = { x: e.clientX, y: e.clientY };
    const prev = this.pointers.get(e.pointerId);
    if (prev && this.exploring) {
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      this.dragMoved += Math.abs(dx) + Math.abs(dy);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 1) {
        if (e.buttons & 2 || e.shiftKey) this.free.az -= dx * 0.006;
        else this.pan(dx, dy);
      } else if (this.pointers.size === 2 && this.pinch) {
        const [a, b] = [...this.pointers.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const ang = Math.atan2(b.y - a.y, b.x - a.x);
        this.free.zoom = Math.min(ZOOM_FREE_STORE, Math.max(ZOOM_MIN, this.free.zoom * (this.pinch.dist / Math.max(1, dist))));
        this.free.az -= ang - this.pinch.ang;
        this.pinch = { dist, ang };
      }
    }
    if (e.pointerType !== "mouse") return;
    this.hasMouse = true;
    this.hoverEl = e.target;
    this.pick();
  }

  private pick() {
    // only react when the pointer is over the open 3D scene, not over UI
    const el = this.hoverEl as HTMLElement | null;
    const overCanvas = !el || el === this.o.canvas || el === document.body || el === document.documentElement;
    let hit: Landmark | null = null;
    if (overCanvas) {
      const ndc = new THREE.Vector2(
        (this.pointerPx.x / window.innerWidth) * 2 - 1,
        -(this.pointerPx.y / window.innerHeight) * 2 + 1,
      );
      this.raycaster.setFromCamera(ndc, this.camera);
      const hits = this.raycaster.intersectObjects(this.pickables, false);
      if (hits.length) hit = hits[0].object.userData.lm as Landmark;
    }
    if (hit !== this.hovered) {
      if (this.hovered) this.hovered.hoverTarget = 0;
      this.hovered = hit;
      if (hit) hit.hoverTarget = 1;
      document.body.style.cursor = hit ? "pointer" : "";
    }
    this.o.onHover(hit ? hit.info : null, this.pointerPx.x, this.pointerPx.y);
  }

  private overOpenScene(target: EventTarget | null) {
    const el = target as HTMLElement | null;
    return !el || el === this.o.canvas || el === document.body || el === document.documentElement;
  }

  private onPointerDown(e: PointerEvent) {
    if (!this.overOpenScene(e.target)) return;
    this.lastDragTarget = e.target;
    this.dragMoved = 0;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), ang: Math.atan2(b.y - a.y, b.x - a.x) };
    }
  }

  private onPointerUp(e: PointerEvent) {
    const wasTap = this.pointers.has(e.pointerId) && this.dragMoved < 6 && this.pointers.size === 1;
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinch = null;
    // taps on touch screens: pick and open
    if (wasTap && e.pointerType !== "mouse" && this.overOpenScene(e.target)) {
      this.pointerPx = { x: e.clientX, y: e.clientY };
      this.hoverEl = e.target;
      this.pick();
      if (this.hovered) this.o.onActivate(this.hovered.info);
    }
  }

  private onWheel(e: WheelEvent) {
    if (!this.exploring || !this.overOpenScene(e.target)) return;
    e.preventDefault();
    this.free.zoom = Math.min(ZOOM_FREE_STORE, Math.max(ZOOM_MIN, this.free.zoom * Math.exp(e.deltaY * 0.0012)));
  }

  private pan(dx: number, dy: number) {
    const upp = this.viewH / Math.max(1, this.o.canvas.clientHeight);
    const az = this.az;
    const rx = Math.cos(az);
    const rz = -Math.sin(az);
    const fx = -Math.sin(az);
    const fz = -Math.cos(az);
    const gy = (dy * upp) / Math.sin(ELEV);
    this.free.target.x += -rx * dx * upp + fx * gy;
    this.free.target.z += -rz * dx * upp + fz * gy;
    this.clampFree();
  }

  private clampFree() {
    const lim = HALF - 6;
    this.free.target.x = Math.max(-110, Math.min(92, this.free.target.x));
    this.free.target.z = Math.max(-lim - 12, Math.min(110, this.free.target.z));
  }

  private onClick() {
    // a drag is not a click
    if (this.dragMoved > 6) return;
    if (this.hovered) this.o.onActivate(this.hovered.info);
  }

  /* ------------------------------------------------------------------ */
  /* Camera rigs (true isometric: fixed elevation, azimuth + zoom + pan) */
  /* ------------------------------------------------------------------ */

  /**
   * Sideways framing for the text column: put the middle of the city in the middle of the space the copy leaves free
   * (the column geometry is the same as .rail in globals.css), so no landmark sits behind a headline at any width.
   */
  private railShift(side: "left" | "right") {
    const W = Math.max(1, window.innerWidth);
    const gutter = Math.max(32, (W - 1024) / 2);
    if (side === "left") return Math.min(0.34, (gutter + 620 + 40) / (2 * W));
    return Math.max(-0.34, (W - (gutter + 580 + 40)) / (2 * W) - 0.5);
  }

  private rig(t: number, s: number) {
    const target = new THREE.Vector3();
    let zoom = 80;
    let az = Math.PI / 4;
    let shift = 0;
    let shiftM = 0; // the same idea on a phone, where the city sits in the top half
    const cue = cityBus.cue;
    const tt = this.o.reduced ? 0 : t;

    if (this.focusId) {
      const fm = this.landmarks.get(this.focusId);
      if (fm) {
        target.set(fm.group.position.x, 4, fm.group.position.z);
        return { target, zoom: 34, az: Math.PI / 4 + 0.3, shift: -0.17, shiftM: 0 };
      }
    }
    if (this.exploring) return { target: this.free.target, zoom: this.free.zoom, az: this.free.az, shift: 0, shiftM: 0 };

    switch (this.route) {
      case "home": {
        // open on the same view as the case studies: the case row on the far edge, zoomed all the way out
        target.set(0, 4, CASE_Z + 6 + s * 30);
        zoom = 120 - s * 20;
        az = (5 * Math.PI) / 4 + Math.sin(tt * 0.12) * 0.07;
        // the end of the page swings round to the beach, the pier and the sea
        const beach = Math.max(0, (s - 0.55) / 0.45);
        const bk = beach * beach * (3 - 2 * beach);
        target.lerp(new THREE.Vector3(-4, 3, 52), bk);
        zoom = zoom * (1 - bk) + 78 * bk;
        az += angDiff(az, Math.PI / 4 + 0.5) * bk;
        shift = this.railShift("left");
        shiftM = -0.09;
        break;
      }
      case "services": {
        if (cue === "crm") {
          target.set(CRM_C.x, 9, CRM_C.z);
          zoom = 56;
          az = Math.PI / 4 + 0.2;
        } else if (cue === "auto") {
          target.set(AUTO_C.x, 9, AUTO_C.z);
          zoom = 56;
          az = Math.PI / 4 - 0.2;
        } else if (cue === "process") {
          target.set(0, 6, 8);
          zoom = 150;
          az = Math.PI / 4 + Math.sin(tt * 0.1) * 0.1;
        } else {
          target.set(0, 5, 6);
          zoom = 150;
          az = Math.PI / 4;
        }
        shift = this.railShift("left");
        break;
      }
      case "case-studies": {
        const m = /^case-(\d)$/.exec(cue);
        if (m) {
          const i = Number(m[1]);
          target.set(CASE_XS[i], 7, CASE_Z);
          zoom = 46;
          // look from the far side so the row is the near edge of the island
          az = (5 * Math.PI) / 4 + (i % 2 ? -0.18 : 0.18);
        } else {
          target.set(0, 4, CASE_Z + 6);
          zoom = 120;
          az = (5 * Math.PI) / 4;
        }
        shift = this.railShift("left");
        break;
      }
      case "about": {
        target.set(0, 3, 24);
        zoom = 150;
        az = Math.PI / 4 + 0.55 + Math.sin(tt * 0.1) * 0.08 + s * 1.4;
        shift = this.railShift("left");
        break;
      }
      case "blog": {
        target.set(4, 4, 40 - s * 78);
        zoom = 60;
        az = Math.PI / 4 + Math.sin(tt * 0.15) * 0.08;
        shift = this.railShift("left");
        break;
      }
      case "contact": {
        target.set(ANT_C.x, 12, ANT_C.z);
        zoom = 64;
        az = Math.PI / 4 + tt * 0.07;
        shift = this.railShift("right");
        break;
      }
    }
    return { target, zoom, az, shift, shiftM };
  }

  private frame() {
    const rawDt = this.clock.getDelta();
    const dt = Math.min(rawDt, 0.1);
    this.time += this.o.reduced ? dt * 0.35 : dt;
    this.time1.value = this.time;
    this.introTime += dt;

    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const scroll = Math.min(1, Math.max(0, window.scrollY / max));
    this.scrollS += (scroll - this.scrollS) * (1 - Math.exp(-dt * 4));
    this.mouseS.lerp(this.mouse, 1 - Math.exp(-dt * 3));

    if (this.exploring) {
      const k = this.keys;
      const step = this.viewH * 0.6 * dt;
      let mx = 0;
      let my = 0;
      if (k.has("w") || k.has("arrowup")) my += 1;
      if (k.has("s") || k.has("arrowdown")) my -= 1;
      if (k.has("a") || k.has("arrowleft")) mx += 1;
      if (k.has("d") || k.has("arrowright")) mx -= 1;
      if (mx || my) this.pan((mx * step) / (this.viewH / Math.max(1, this.o.canvas.clientHeight)), (my * step) / (this.viewH / Math.max(1, this.o.canvas.clientHeight)));
      if (k.has("q")) this.free.az += dt * 1.1;
      if (k.has("e")) this.free.az -= dt * 1.1;
      if (k.has("+") || k.has("=")) this.free.zoom = Math.max(ZOOM_MIN, this.free.zoom * Math.exp(-dt * 1.2));
      if (k.has("-") || k.has("_")) this.free.zoom = Math.min(ZOOM_FREE_STORE, this.free.zoom * Math.exp(dt * 1.2));
    }
    const rig = this.rig(this.time, this.scrollS);
    let zoom = Math.min(rig.zoom, this.exploring ? ZOOM_FREE_STORE : ZOOM_MAX);
    // portrait screens: show more of the scene
    const aspectNow = this.o.canvas.clientWidth / Math.max(1, this.o.canvas.clientHeight);
    const portrait = aspectNow < 1.1 ? 1 + (1.1 / aspectNow - 1) * 0.8 : 1;
    zoom *= portrait;
    // free roam may pull back until the view is wide enough for the whole city: on a phone that is much further than
    // the opening view, which used to be the farthest it could go
    if (this.exploring) zoom = Math.min(zoom, Math.max(ZOOM_MAX_FREE * portrait, FREE_VIEW_WIDTH / Math.max(0.2, aspectNow)));

    // cinematic damping: slow settle on first load, then responsive
    const k = this.o.reduced ? 12 : this.introTime < 3 ? 0.9 + this.introTime * 0.3 : 2.2;
    const f = 1 - Math.exp(-Math.max(dt, 0.0001) * k);
    this.camTarget.lerp(rig.target, f);
    this.viewH = Math.exp(Math.log(this.viewH) + (Math.log(zoom) - Math.log(this.viewH)) * f);
    this.az += angDiff(this.az, rig.az) * f;

    // a gentle pull-back while the camera is travelling
    const speed = this.lastTarget3.distanceTo(this.camTarget) / Math.max(dt, 0.0001);
    this.lastTarget3.copy(this.camTarget);
    const breathe = 1 + Math.min(speed * 0.0035, 0.07);

    const cam = this.camera;
    const h = this.viewH * breathe;
    cam.left = (-h * aspectNow) / 2;
    cam.right = (h * aspectNow) / 2;
    cam.top = h / 2;
    cam.bottom = -h / 2;

    const dir = new THREE.Vector3(Math.sin(this.az) * Math.cos(ELEV), Math.sin(ELEV), Math.cos(this.az) * Math.cos(ELEV));
    const look = this.camTarget.clone();
    cam.position.copy(look).addScaledVector(dir, DIST);
    cam.lookAt(look);
    cam.updateMatrixWorld();
    if (!this.o.reduced) {
      const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
      const up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
      const unit = h * 0.012;
      cam.position.addScaledVector(right, this.mouseS.x * unit * 1.4).addScaledVector(up, -this.mouseS.y * unit);
    }
    cam.updateProjectionMatrix();

    // sideways framing for the text column
    const isDesktop = window.innerWidth >= 1024;
    const scrollFade = 1 - smooth(0.0, 0.7, window.scrollY / Math.max(1, window.innerHeight));
    const keep = this.route === "case-studies" || this.route === "services";
    const wantShift = isDesktop ? rig.shift * (keep ? 1 : scrollFade) : rig.shiftM * scrollFade;
    this.shift += (wantShift - this.shift) * (1 - Math.exp(-dt * 3));
    const w = this.o.canvas.clientWidth;
    const hh = this.o.canvas.clientHeight;
    // phones: lift the scene into the top half so the copy can sit below it
    const lift = this.focusId && !isDesktop ? 0.24 * hh : !isDesktop && this.route === "home" && !this.exploring ? 0.2 * scrollFade * hh : 0;
    if (Math.abs(this.shift) > 0.0005 || lift > 0.5) cam.setViewOffset(w, hh, -this.shift * w, lift, w, hh);
    else cam.clearViewOffset();

    // landmark hover / active: the building lifts a little and warms up
    const cueMatch = /^case-(\d)$/.exec(cityBus.cue);
    this.landmarks.forEach((lm) => {
      const isActiveCase = this.route === "case-studies" && cueMatch && lm.id === `case-${cueMatch[1]}`;
      const isActiveDistrict =
        this.route === "services" &&
        ((cityBus.cue === "crm" && lm.id === "crm") || (cityBus.cue === "auto" && lm.id === "automation"));
      lm.activeTarget = isActiveCase || isActiveDistrict || this.focusId === lm.id ? 1 : 0;
      lm.hover += (lm.hoverTarget - lm.hover) * (1 - Math.exp(-dt * 9));
      lm.active += (lm.activeTarget - lm.active) * (1 - Math.exp(-dt * 4));
      lm.group.position.y = lm.baseY + lm.hover * 0.7 + lm.active * 0.9;
      lm.hoverU.value = lm.hover;
      lm.activeU.value = lm.active;
    });

    // labels: only the ones that matter for where you are, plus whatever you point at
    const route = this.route;
    this.landmarks.forEach((lm) => {
      const id = lm.id;
      let show = lm.hover > 0.05 || lm.active > 0.5;
      if (this.exploring) show = show || id === "hub" || id === "crm" || id === "automation" || id === "antenna" || id.startsWith("case-") || id.startsWith("ind-");
      else if (this.focusId === id) show = true;
      else if (route === "home") show = show || id === "hub" || id.startsWith("tool-");
      else if (route === "services") show = show || id === "hub" || id === "crm" || id === "automation";
      else if (route === "contact") show = show || id === "antenna";
      lm.sprites.forEach((sp) => (sp.visible = show));
    });

    // coloured lamps follow the focused landmark
    let focus: Landmark | null = null;
    let fw = 0;
    this.landmarks.forEach((lm) => {
      const w = Math.max(lm.hover, lm.active);
      if (w > fw) {
        fw = w;
        focus = lm;
      }
    });
    this.accents.forEach((pl, i) => {
      const f = focus as Landmark | null;
      if (f) {
        const gp = f.group.position;
        pl.position.lerp(new THREE.Vector3(gp.x + (i ? 6 : -6), gp.y + 8, gp.z + 6), 0.12);
      }
      pl.intensity += ((f ? 190 * fw : 0) - pl.intensity) * 0.12;
    });

    const lk = Math.min(2.6, Math.max(0.9, h / 64));
    this.labels.forEach(({ sp, w: lw }) => sp.scale.set(lw * lk, lw * lk * (140 / 640), 1));

    this.updateAtmosphere(Math.min(rawDt, 1));
    this.animated.forEach((fn) => fn(this.time, dt));

    this.frameNo++;
    if (this.hasMouse && this.frameNo % 6 === 0) this.pick();

    if (this.composer && !this.lowQuality) this.composer.render();
    else this.renderer.render(this.scene, cam);

    // quality governor
    this.frameTimes.push(dt);
    if (this.frameTimes.length > 120) {
      const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
      this.frameTimes = [];
      if (avg > 0.034 && !this.lowQuality && this.introTime > 4) {
        this.lowQuality = true;
        this.resize();
      }
    }
  }
}
