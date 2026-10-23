// Camera rig acceptance on the 3D preview build (M2 spec §1.2–§1.4, §2.4, §6 F17 and
// F20; CHECKLIST B2, B3, B7, B8). Time runs on Playwright's clock, so every fit reads
// frames 16 ms apart and is independent of SwiftShader's speed. The rig writes one
// trace frame per animation frame (?trace=1); the fits use only those frames.
import { mkdirSync } from 'node:fs';
import { type Page, expect, test } from '@playwright/test';
import { drainGpu } from './gpu';

const OUT = process.env.WORLD_OUT;
const CAP = { tris: 60_000, draws: 40 } as const;
const DESKTOP = { width: 1440, height: 900 } as const;
const PHONE = { width: 390, height: 844 } as const;
const STATIONS = ['bootcamp', 'campus', 'city', 'workshop'] as const;
const PATHS = { bootcamp: 'bootcamp', campus: 'teaching', city: 'now', workshop: 'workshop' } as const;

interface P {
  x: number;
  y: number;
  h: number;
}
interface Frame {
  t: number;
  dest: string;
  mode: string;
  u: number;
  e: number;
  pos: P;
  yaw: number;
  pitch: number;
  roll: number;
  fov: number;
  dof: number;
  opacityA: number;
  label: number;
  render: { calls: number; triangles: number };
}
interface Aabb {
  min: P;
  max: P;
}

// cubic-bezier solver, the same maths as src/world/camera/easing.ts (kept separate so
// the fit does not grade the rig with its own code).
function bezier(x1: number, y1: number, x2: number, y2: number) {
  const b = (a: number, c: number, s: number) => 3 * (1 - s) ** 2 * s * a + 3 * (1 - s) * s * s * c + s ** 3;
  return (t: number) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 50; i++) {
      const m = (lo + hi) / 2;
      if (b(x1, x2, m) < t) lo = m;
      else hi = m;
    }
    return b(y1, y2, (lo + hi) / 2);
  };
}
const easeFly = bezier(0.65, 0, 0.35, 1);
const easeOut = bezier(0, 0, 0.58, 1);
const rmse = (xs: number[]) => Math.sqrt(xs.reduce((s, x) => s + x * x, 0) / xs.length);
const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y, a.h - b.h);
const DEG = Math.PI / 180;
const fwd = (f: Frame) => ({ x: Math.cos(f.pitch * DEG) * Math.sin(f.yaw * DEG), y: Math.cos(f.pitch * DEG) * Math.cos(f.yaw * DEG), h: Math.sin(f.pitch * DEG) });

type W = {
  __h0Trace: { frames: Frame[] };
  __h0World: {
    tier: string;
    boxes: Aabb[];
    rig: {
      dest: string;
      mode: string;
      goal: { azimuth: number; polar: number; distance: number };
      go(d: string): void;
      orbitBy(d: { azimuth?: number; polar?: number; scale?: number }): void;
      luminance(): number;
    };
  };
};

async function open(page: Page, viewport: { width: number; height: number }, path = './', reduced = false) {
  await page.setViewportSize(viewport);
  if (reduced) await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.install();
  await page.goto(`${path}?3d=1&trace=1`);
  await page.waitForFunction(() => Boolean((window as unknown as Partial<W>).__h0World?.rig));
  await page.clock.runFor(200);
  return errors;
}

const mark = (page: Page) => page.evaluate(() => (window as unknown as W).__h0Trace.frames.length);
const framesSince = (page: Page, from: number) => page.evaluate((n) => (window as unknown as W).__h0Trace.frames.slice(n), from);
const rig = <T>(page: Page, fn: (r: W['__h0World']['rig'], w: W) => T) =>
  page.evaluate(`(${fn.toString()})(window.__h0World.rig, window)`) as Promise<T>;

/** Runs a hop and returns the frames from the go() to 400 ms after arrival. */
async function hop(page: Page, to: string, extra = 400): Promise<Frame[]> {
  const n = await mark(page);
  await page.evaluate((d) => (window as unknown as W).__h0World.rig.go(d), to);
  for (let i = 0; i < 200; i++) {
    await page.clock.runFor(100);
    if ((await page.evaluate(() => (window as unknown as W).__h0World.rig.mode)) === 'idle') break;
  }
  await page.clock.runFor(extra);
  return framesSince(page, n);
}

/** Splits hop frames into the transition and the frames after arrival. */
function phases(frames: Frame[]) {
  const moving = frames.filter((f) => f.mode !== 'idle');
  const firstIdle = frames.findIndex((f, i) => i > 0 && f.mode === 'idle' && frames[i - 1]!.mode !== 'idle');
  const after = frames.slice(firstIdle);
  const t0 = moving[0]!.t;
  return { moving, after, t0, arrival: after[0]!.t, duration: after[0]!.t - t0 };
}

test.afterEach(({ page }, testInfo) => drainGpu(page, testInfo));

test.describe('F17 curves', () => {
  test('fly, front pair: 1.0 s on cubic-bezier(0.65,0,0.35,1), RMSE ≤ 2%', async ({ page }) => {
    await open(page, DESKTOP, './bootcamp/');
    const f = await hop(page, 'workshop');
    const { moving, after, t0, duration } = phases(f);
    expect(duration).toBeGreaterThanOrEqual(950);
    expect(duration).toBeLessThanOrEqual(1050);
    const p0 = moving[0]!.pos;
    const p3 = after[0]!.pos;
    // Progress from the trace's positions (x runs straight from start to end on the front pair).
    const err = moving.map((m) => (m.pos.x - p0.x) / (p3.x - p0.x) - easeFly((m.t - t0) / 1000));
    expect(rmse(err)).toBeLessThanOrEqual(0.02);
    expect(moving.every((m) => m.roll === 0)).toBe(true);
  });

  test('fly, back pair: arc-length progress on the curve, RMSE ≤ 2%', async ({ page }) => {
    await open(page, DESKTOP, './teaching/');
    const f = await hop(page, 'city');
    const { moving, after, t0, duration } = phases(f);
    expect(Math.abs(duration - 1000)).toBeLessThanOrEqual(50);
    const pts = [...moving.map((m) => m.pos), after[0]!.pos];
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1]! + dist(pts[i - 1]!, pts[i]!));
    const total = cum.at(-1)!;
    const err = moving.map((m, i) => cum[i]! / total - easeFly((m.t - t0) / 1000));
    expect(rmse(err)).toBeLessThanOrEqual(0.02);
  });

  test('crossfade: linear opacity over 300 ± 30 ms; labels ease-out 150 ± 20 ms; DOF 250 ± 30 ms', async ({ page }) => {
    await open(page, DESKTOP);
    const f = await hop(page, 'bootcamp');
    const { moving, after, t0, arrival, duration } = phases(f);
    expect(Math.abs(duration - 300)).toBeLessThanOrEqual(30);
    expect(rmse(moving.map((m) => m.opacityA - (1 - (m.t - t0) / 300)))).toBeLessThanOrEqual(0.02);
    // Labels: hidden from the hop's first frame, then the CSS ease-out from arrival.
    expect(moving.every((m) => m.label === 0)).toBe(true);
    const rise = after.filter((a) => a.t - arrival <= 200);
    expect(rmse(rise.map((a) => a.label - easeOut((a.t - arrival) / 150)))).toBeLessThanOrEqual(0.02);
    const labelDone = after.find((a) => a.label >= 1)!.t - arrival;
    expect(Math.abs(labelDone - 150)).toBeLessThanOrEqual(20);
    const dofEnd = after.at(-1)!.dof;
    const dofDone = after.find((a) => Math.abs(a.dof - dofEnd) < 1e-6)!.t - arrival;
    expect(Math.abs(dofDone - 250)).toBeLessThanOrEqual(30);
    expect(dofDone + duration).toBeLessThanOrEqual(1300);
  });

  test('reduced motion: every hop is a 200 ± 20 ms crossfade with no translation', async ({ page }) => {
    await open(page, DESKTOP, './bootcamp/', true);
    for (const to of ['workshop', 'overview', 'city'] as const) {
      const f = await hop(page, to);
      const { moving, t0, duration } = phases(f);
      expect(moving.every((m) => m.mode === 'fade')).toBe(true);
      expect(Math.abs(duration - 200)).toBeLessThanOrEqual(20);
      expect(rmse(moving.map((m) => m.opacityA - (1 - (m.t - t0) / 200)))).toBeLessThanOrEqual(0.02);
      const p = moving[0]!.pos;
      expect(moving.every((m) => dist(m.pos, p) === 0)).toBe(true);
    }
  });

  test('crossfade luminance stays ≥ 0.9 × min(A, B)', async ({ page }) => {
    await open(page, DESKTOP);
    const a = await rig(page, (r) => r.luminance());
    await hop(page, 'campus');
    const b = await rig(page, (r) => r.luminance());
    await hop(page, 'overview');
    await page.evaluate(() => (window as unknown as W).__h0World.rig.go('campus'));
    const mid: number[] = [];
    for (let i = 0; i < 6; i++) {
      await page.clock.runFor(48);
      mid.push(await rig(page, (r) => r.luminance()));
    }
    for (const l of mid) expect(l).toBeGreaterThanOrEqual(0.9 * Math.min(a, b));
  });
});

test.describe('F20 (b): orbited starts', () => {
  test.describe.configure({ timeout: 300_000 });
  for (const from of ['campus', 'city'] as const) {
    test(`from ${from}: 1.00 s, lands on the authored pose, ≤ 45°/s, roll 0, ≥ 12 mm`, async ({ page }) => {
      // A smaller desktop-tier viewport (same 1.6 aspect, so the same FOV): the checks are
      // pose maths, and SwiftShader renders it faster.
      await open(page, { width: 960, height: 600 }, `./${PATHS[from]}/`);
      const to = from === 'campus' ? 'city' : 'campus';
      const boxes = await page.evaluate(() => (window as unknown as W).__h0World.boxes);
      const clear = (p: P) =>
        Math.min(
          ...boxes.map((b) =>
            Math.hypot(Math.max(b.min.x - p.x, 0, p.x - b.max.x), Math.max(b.min.y - p.y, 0, p.y - b.max.y), Math.max(b.min.h - p.h, 0, p.h - b.max.h)),
          ),
        );
      const authored = (await hop(page, to, 300)).at(-1)!;
      await hop(page, from, 300);
      let peak = 0;
      for (const az of [-30, -10, 10, 30])
        for (const polar of [50, 78])
          for (const d of [300, 800]) {
            await page.evaluate(
              ([az, polar, d]) => {
                const r = (window as unknown as W).__h0World.rig;
                r.orbitBy({ azimuth: az! - r.goal.azimuth, polar: polar! - r.goal.polar, scale: d! / r.goal.distance });
              },
              [az, polar, d],
            );
            await page.clock.runFor(600);
            const f = await hop(page, to, 100);
            const { moving, after, duration } = phases(f);
            expect(Math.abs(duration - 1000)).toBeLessThanOrEqual(50);
            const end = after[0]!;
            expect(dist(end.pos, authored.pos)).toBeLessThanOrEqual(1);
            expect(Math.abs(end.yaw - authored.yaw)).toBeLessThanOrEqual(0.5);
            expect(Math.abs(end.pitch - authored.pitch)).toBeLessThanOrEqual(0.5);
            const seq = [...moving, end];
            for (let i = 1; i < seq.length; i++) {
              const a = fwd(seq[i - 1]!);
              const b = fwd(seq[i]!);
              const ang = Math.acos(Math.min(1, a.x * b.x + a.y * b.y + a.h * b.h)) / DEG;
              peak = Math.max(peak, ang / ((seq[i]!.t - seq[i - 1]!.t) / 1000));
            }
            expect(seq.every((m) => m.roll === 0)).toBe(true);
            expect(Math.min(...seq.map((m) => clear(m.pos)))).toBeGreaterThanOrEqual(12);
            await hop(page, from, 100);
          }
      expect(peak).toBeLessThanOrEqual(45);
      test.info().annotations.push({ type: 'peak', description: `${peak.toFixed(1)}°/s` });
      console.log(`[world] F20 from ${from}: peak ${peak.toFixed(1)}°/s over 16 grid starts`);
      await page.close();
    });
  }
});

test.describe('history, deep links, tier swap', () => {
  test('every hop pushes its page, the overview included; orbit does not; Back hops', async ({ page }) => {
    await open(page, DESKTOP);
    const len = await page.evaluate(() => history.length);
    const back = async (to: string) => {
      await page.evaluate(() => history.back());
      for (let i = 0; i < 20 && (await rig(page, (r) => [r.dest, r.mode].join())) !== `${to},idle`; i++) await page.clock.runFor(100);
      expect(await rig(page, (r) => r.dest)).toBe(to);
    };
    await hop(page, 'bootcamp');
    expect(new URL(page.url()).pathname).toMatch(/\/bootcamp\/$/);
    expect(await page.evaluate(() => history.length)).toBe(len + 1);
    await page.evaluate(() => (window as unknown as W).__h0World.rig.orbitBy({ azimuth: 10 }));
    await page.clock.runFor(600);
    expect(await page.evaluate(() => history.length)).toBe(len + 1);
    await hop(page, 'overview');
    expect(await page.evaluate(() => history.length)).toBe(len + 2);
    expect(new URL(page.url()).pathname).toMatch(/\/$/);
    expect(new URL(page.url()).pathname).not.toMatch(/bootcamp/);
    await hop(page, 'workshop');
    expect(new URL(page.url()).pathname).toMatch(/\/workshop\/$/);
    // Back walks workshop → overview → bootcamp → the cold overview.
    await back('overview');
    expect(new URL(page.url()).pathname).not.toMatch(/workshop/);
    await back('bootcamp');
    expect(new URL(page.url()).pathname).toMatch(/\/bootcamp\/$/);
    await back('overview');
    expect(new URL(page.url()).search).toContain('3d=1');
    // Forward hops again.
    await page.evaluate(() => history.forward());
    for (let i = 0; i < 20 && (await rig(page, (r) => r.dest)) !== 'bootcamp'; i++) await page.clock.runFor(100);
    expect(await rig(page, (r) => r.dest)).toBe('bootcamp');
  });

  for (const s of STATIONS) {
    test(`a cold deep link to /${PATHS[s]}/ starts parked at ${s}`, async ({ page }) => {
      await open(page, DESKTOP, `./${PATHS[s]}/`);
      expect(await rig(page, (r) => [r.dest, r.mode])).toEqual([s, 'idle']);
    });
  }

  test('the tier swap crossfades in 300 ms on the same destination, with no history entry', async ({ page }) => {
    await open(page, DESKTOP, './teaching/');
    const len = await page.evaluate(() => history.length);
    const url = page.url();
    const n = await mark(page);
    await page.setViewportSize(PHONE);
    // Chromium may hold the resize event while the clock is paused, so fire it here once
    // the new size is in (a late real event then finds the tier already swapped).
    await expect.poll(() => page.evaluate(() => innerWidth)).toBe(PHONE.width);
    await page.evaluate(() => dispatchEvent(new Event('resize')));
    expect(await page.evaluate(() => (window as unknown as W).__h0World.tier)).toBe('phone');
    await page.clock.runFor(800);
    const f = await framesSince(page, n);
    const { moving, duration } = phases(f);
    expect(moving.every((m) => m.mode === 'fade' && m.dest === 'campus')).toBe(true);
    expect(Math.abs(duration - 300)).toBeLessThanOrEqual(30);
    expect(await page.evaluate(() => (window as unknown as W).__h0World.tier)).toBe('phone');
    expect(await page.evaluate(() => history.length)).toBe(len);
    expect(page.url()).toBe(url);
  });
});

test.describe('input and layout', () => {
  test('the canvas does not cover the page: Skip is the first Tab stop and the facts are reachable', async ({ page }) => {
    await open(page, DESKTOP);
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement?.matches('a.corner.skip'))).toBe(true);
    const region = await page.locator('.layout-region').boundingBox();
    expect(region).toMatchObject({ x: 0, y: 0, width: DESKTOP.width, height: DESKTOP.height });
    // The M1 page follows the region and is what sits under the pointer there.
    await page.evaluate(() => document.querySelector('main#main')!.scrollIntoView());
    const hit = await page.evaluate(() => {
      const m = document.querySelector('main#main')!.getBoundingClientRect();
      const el = document.elementFromPoint(m.left + 40, Math.max(m.top, 80) + 20);
      return { inMain: Boolean(el?.closest('main#main')), canvas: el instanceof HTMLCanvasElement };
    });
    expect(hit).toEqual({ inMain: true, canvas: false });
    // The top bar stays above the region.
    await page.evaluate(() => scrollTo(0, 0));
    const top = await page.evaluate(() => {
      const s = document.querySelector('a.corner.skip')!.getBoundingClientRect();
      return document.elementFromPoint(s.left + s.width / 2, s.top + s.height / 2)?.closest('a.corner.skip') !== null;
    });
    expect(top).toBe(true);
  });

  test('a plain wheel scrolls the page; drag orbits past 8 px; arrows and the switcher hop', async ({ page }) => {
    await open(page, DESKTOP);
    await page.mouse.move(720, 450);
    await page.mouse.wheel(0, 400);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
    await page.evaluate(() => scrollTo(0, 0));
    await page.clock.runFor(50);
    await page.mouse.move(720, 450);
    await page.mouse.down();
    await page.mouse.move(725, 450);
    expect(await rig(page, (r) => r.goal.azimuth)).toBe(0);
    await page.mouse.move(800, 450, { steps: 8 });
    await page.mouse.up();
    expect(await rig(page, (r) => r.goal.azimuth)).toBeLessThan(0);
    await page.getByRole('button', { name: '2021 Bootcamp' }).click();
    for (let i = 0; i < 10 && (await rig(page, (r) => r.mode)) !== 'idle'; i++) await page.clock.runFor(100);
    expect(await rig(page, (r) => r.dest)).toBe('bootcamp');
    await page.keyboard.press('ArrowRight');
    for (let i = 0; i < 20 && (await rig(page, (r) => r.dest)) !== 'campus'; i++) await page.clock.runFor(100);
    expect(await rig(page, (r) => r.dest)).toBe('campus');
    await expect(page.getByRole('button', { name: '2022–26 Campus' })).toHaveAttribute('aria-current', 'true');
  });
});

test.describe('scene counts at every pose', () => {
  for (const [name, vp] of [
    ['1440', DESKTOP],
    ['390', PHONE],
  ] as const) {
    test(`overview and the four stations at ${name} stay under the caps`, async ({ page }) => {
      await open(page, vp);
      const rows: string[] = [];
      for (const d of ['overview', ...STATIONS]) {
        if (d !== 'overview') await hop(page, d, 300);
        const last = (await framesSince(page, (await mark(page)) - 1))[0]!;
        expect(last.render.triangles).toBeLessThanOrEqual(CAP.tris);
        expect(last.render.calls).toBeLessThanOrEqual(CAP.draws);
        rows.push(`${d} ${last.render.triangles}/${last.render.calls}`);
        if (d !== 'overview') await hop(page, 'overview', 100);
      }
      console.log(`[world] ${name} tris/draws: ${rows.join(', ')}`);
    });
  }
});

/**
 * open(), then pauses the page clock. On the running clock the page keeps drawing in real
 * time, and at 1440 SwiftShader is still busy with those frames when each screenshot asks.
 */
async function still(page: Page, vp: { width: number; height: number }, path = './') {
  await open(page, vp, path);
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 50));
  await page.clock.runFor(100);
}

test.describe('screenshots', () => {
  test.skip(!OUT, 'WORLD_OUT not set');
  for (const [name, vp] of [
    ['1440', DESKTOP],
    ['390', PHONE],
  ] as const) {
    test(`overview and a transition at ${name}`, async ({ page }) => {
      test.setTimeout(120_000);
      mkdirSync(OUT!, { recursive: true });
      await still(page, vp);
      await page.screenshot({ path: `${OUT}/rig-${name}-overview.png` });
      // Mid-crossfade, overview → Bootcamp, 150 of 300 ms.
      await page.evaluate(() => (window as unknown as W).__h0World.rig.go('bootcamp'));
      await page.clock.runFor(150);
      await page.screenshot({ path: `${OUT}/rig-${name}-crossfade-overview-bootcamp-150ms.png` });
      // Mid-fly on each pair, 500 of 1000 ms.
      for (const [from, path, to] of [
        ['bootcamp', './bootcamp/', 'workshop'],
        ['campus', './teaching/', 'city'],
      ] as const) {
        await still(page, vp, path);
        await page.screenshot({ path: `${OUT}/rig-${name}-${from}.png` });
        await page.evaluate((d) => (window as unknown as W).__h0World.rig.go(d), to);
        await page.clock.runFor(500);
        await page.screenshot({ path: `${OUT}/rig-${name}-fly-${from}-${to}-500ms.png` });
      }
    });
  }
});
