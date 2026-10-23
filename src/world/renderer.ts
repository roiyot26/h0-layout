// The world renderer (M2 spec §4.1, STYLE §3): WebGLRenderer at the DPR rule, the sun
// and sky lights, exponential fog, and the overview camera for the tier. No tone
// mapping, shadows or post: the grey-box is flat Lambert on purpose.
import {
  Color,
  DirectionalLight,
  FogExp2,
  HemisphereLight,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three';
import { buildBlockout, type SetPiece } from './blockout';
import { OVERVIEW, fovFor, pixelRatioFor, tierFor } from './camera/poses';
import type { Aabb } from './terrain/clearance';
import { type Tier, toThree } from './units';

export const SUN = { direction: [-0.912, 0.242, 0.332] as const, colour: 0xffc99d } as const;
export const SKY = { sky: 0x8fa9b8, ground: 0x8e8a62 } as const;
export const FOG = { colour: 0xd8c6a6, density: 0.1 } as const;
/**
 * Light levels. Sun : sky is the locked 4 : 1; the overall level is tuned so the
 * overview's mean linear luminance sits near 0.2 (Lambert divides by π, hence > 1).
 */
export const LIGHT = { sun: 8, sky: 2 } as const;

export interface World {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;
  tier: Tier;
  pieces: SetPiece[];
  /** Every set piece's clearance boxes (§3.4) for the current tier. */
  boxes: Aabb[];
  /** Canvas size in CSS px. */
  width: number;
  height: number;
  draw(): void;
  /** Fits the drawing buffer to the container. Returns true when the tier changed (the blockout is rebuilt). */
  resize(): boolean;
  dispose(): void;
}

function lights(scene: Scene): void {
  const sun = new DirectionalLight(SUN.colour, LIGHT.sun);
  sun.name = 'sun';
  sun.position.set(...SUN.direction);
  scene.add(sun, sun.target);
  const sky = new HemisphereLight(SKY.sky, SKY.ground, LIGHT.sky);
  sky.name = 'sky';
  scene.add(sky);
}

/**
 * Build the scene for a tier, with the canvas filling `container` (the layout region).
 * The tier still follows the window (§1.1). `forceTier` pins it (tests). The camera
 * starts at the tier's overview; the rig drives it from then on.
 */
export function createWorld(container: HTMLElement, forceTier?: Tier): World {
  const renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(pixelRatioFor(window.devicePixelRatio));
  renderer.info.autoReset = false;
  const canvas = renderer.domElement;
  canvas.className = 'world';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.tabIndex = -1;
  container.prepend(canvas);

  const scene = new Scene();
  scene.background = new Color(FOG.colour);
  scene.fog = new FogExp2(FOG.colour, FOG.density);
  lights(scene);

  const camera = new PerspectiveCamera();
  const pick = () => forceTier ?? tierFor(window.innerWidth, window.innerHeight);
  let tier = pick();
  let pieces = buildBlockout(scene, tier);
  let boxes = pieces.flatMap((p) => p.aabbs);
  let width = 0;
  let height = 0;

  const world: World = {
    renderer,
    scene,
    camera,
    get tier() {
      return tier;
    },
    get pieces() {
      return pieces;
    },
    get boxes() {
      return boxes;
    },
    get width() {
      return width;
    },
    get height() {
      return height;
    },
    draw: () => renderer.render(scene, camera),
    resize() {
      width = Math.max(1, container.clientWidth);
      height = Math.max(1, container.clientHeight);
      const next = pick();
      const changed = next !== tier;
      if (changed) {
        for (const p of pieces) scene.remove(p.group);
        tier = next;
        pieces = buildBlockout(scene, tier);
        boxes = pieces.flatMap((p) => p.aabbs);
      }
      renderer.setSize(width, height, false);
      return changed;
    },
    dispose() {
      renderer.dispose();
      canvas.remove();
    },
  };
  world.resize();
  const o = OVERVIEW[tier];
  camera.position.set(...toThree(o.position));
  camera.aspect = width / height;
  camera.fov = fovFor(o, tier, camera.aspect, 'overview');
  camera.near = o.near;
  camera.far = o.far;
  camera.lookAt(...toThree(o.target));
  camera.updateProjectionMatrix();
  return world;
}
