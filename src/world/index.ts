// The lazy 3D entry, built as the "world" chunk and loaded only when a preview build
// (ENABLE_3D on) is opened with ?3d=1. For now it draws an empty scene with the board
// top, so the three and world chunks exist and can be measured; the blockout and the
// camera rig follow in the next M2 pull requests.
import {
  Color,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  WebGLRenderer,
} from 'three';
import { startTrace, traceOn } from './trace';

// Board top: 2400 × 1200 mm, centred on the origin, in metres (M2 spec §0).
export const BOARD_W = 2.4;
export const BOARD_D = 1.2;
export const FLOCK = '#8E8A62';
const BACKDROP = '#16181A';

export function boot(container: HTMLElement = document.body): WebGLRenderer {
  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const canvas = renderer.domElement;
  canvas.className = 'world';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;display:block;z-index:10;pointer-events:none';
  container.append(canvas);

  const scene = new Scene();
  scene.background = new Color(BACKDROP);
  const board = new Mesh(new PlaneGeometry(BOARD_W, BOARD_D), new MeshBasicMaterial({ color: FLOCK }));
  board.name = 'board_top';
  board.rotation.x = -Math.PI / 2;
  scene.add(board);

  const camera = new PerspectiveCamera(45, 1, 0.05, 20);
  camera.position.set(0, 1.6, 2.2);
  camera.lookAt(0, 0, 0);

  const draw = () => renderer.render(scene, camera);
  const resize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    draw();
  };
  window.addEventListener('resize', resize);
  resize();

  if (traceOn(location.search)) startTrace(renderer, draw);
  return renderer;
}
