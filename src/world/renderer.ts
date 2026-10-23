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
import { OVERVIEW, type Pose, fovFor, pixelRatioFor, tierFor } from './camera/poses';
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
  draw(): void;
  resize(): void;
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

function applyPose(camera: PerspectiveCamera, pose: Pose, tier: Tier, aspect: number): void {
  camera.position.set(...toThree(pose.position));
  camera.near = pose.near;
  camera.far = pose.far;
  camera.aspect = aspect;
  camera.fov = fovFor(pose, tier, aspect, 'overview');
  camera.lookAt(...toThree(pose.target));
  camera.updateProjectionMatrix();
}

/** Build the scene for a tier. `forceTier` pins it (tests); otherwise the viewport picks. */
export function createWorld(container: HTMLElement, forceTier?: Tier): World {
  const renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(pixelRatioFor(window.devicePixelRatio));
  const canvas = renderer.domElement;
  canvas.className = 'world';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;display:block;z-index:10;pointer-events:none';
  container.append(canvas);

  const scene = new Scene();
  scene.background = new Color(FOG.colour);
  scene.fog = new FogExp2(FOG.colour, FOG.density);
  lights(scene);

  const camera = new PerspectiveCamera();
  const pick = () => forceTier ?? tierFor(window.innerWidth, window.innerHeight);
  let tier = pick();
  let pieces = buildBlockout(scene, tier);

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
    draw: () => renderer.render(scene, camera),
    resize() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const next = pick();
      if (next !== tier) {
        for (const p of pieces) scene.remove(p.group);
        tier = next;
        pieces = buildBlockout(scene, tier);
      }
      renderer.setSize(w, h, false);
      applyPose(camera, OVERVIEW[tier], tier, w / h);
      world.draw();
    },
    dispose() {
      window.removeEventListener('resize', world.resize);
      renderer.dispose();
      canvas.remove();
    },
  };
  window.addEventListener('resize', world.resize);
  world.resize();
  return world;
}
