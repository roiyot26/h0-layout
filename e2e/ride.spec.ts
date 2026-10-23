// Ride acceptance on the 3D preview build (M2 spec §1.2 chase and cab, C12; CHECKLIST
// M2-10 and M2-13). Time runs on Playwright's clock (paused, then stepped), and every
// check reads the rig's own trace frames (?trace=1), so SwiftShader's speed does not
// matter. Long stretches of the lap step the rig directly (no render per step) and then
// fast-forward the page clock to the same time.
import { mkdirSync, writeFileSync } from 'node:fs';
import { type Page, expect, test } from '@playwright/test';
import { drainGpu, setDraw } from './gpu';

const OUT = process.env.WORLD_OUT;
const CAP = { tris: 60_000, draws: 40 } as const;
const DESKTOP = { width: 1440, height: 900 } as const;
const PHONE = { width: 390, height: 844 } as const;
/** The desktop tier at the same 1.6 aspect (so the same lens), cheaper to render. */
const SMALL = { width: 960, height: 600 } as const;
const PARKED = 818.5;
const SPEED = 128;
const LAG_MM = SPEED * 0.35;

interface P {
  x: number;
  y: number;
  h: number;
}
interface Ride {
  t: number;
  s: number;
  v: number;
  cam: string;
  sc: number;
  yaw: number;
}
interface Frame {
  t: number;
  dest: string;
  mode: string;
  pos: P;
  yaw: number;
  pitch: number;
  roll: number;
  fov: number;
  opacityA: number;
  ride?: Ride;
  render: { calls: number; triangles: number };
}
type R = {
  dest: string;
  mode: string;
  riding: string | null;
  cabUnlocked: boolean;
  go(d: string): void;
  ride(): void;
  endRide(): void;
  rideCam(c: string): void;
  nextStation(d?: number): void;
  unlockCab(): void;
  orbitBy(d: { azimuth?: number }): void;
  frame(now: number): void;
};
type W = { __h0Trace: { frames: Frame[] }; __h0World: { tier: string; rig: R; renderer: { render: (...a: unknown[]) => void } } };

const DEG = Math.PI / 180;
const fwd = (f: Frame) => ({ x: Math.cos(f.pitch * DEG) * Math.sin(f.yaw * DEG), y: Math.cos(f.pitch * DEG) * Math.cos(f.yaw * DEG), h: Math.sin(f.pitch * DEG) });
const angle = (a: P, b: P) => Math.acos(Math.min(1, Math.max(-1, a.x * b.x + a.y * b.y + a.h * b.h))) / DEG;

async function open(page: Page, viewport: { width: number; height: number }, path = './', reduced = false) {
  await page.setViewportSize(viewport);
  if (reduced) await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.install();
  await page.goto(`${path}?3d=1&trace=1`);
  await page.waitForFunction(() => Boolean((window as unknown as Partial<W>).__h0World?.rig));
  await page.clock.runFor(200);
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 50));
  await page.clock.runFor(100);
  return errors;
}

const state = (page: Page) => page.evaluate(() => {
  const r = (window as unknown as W).__h0World.rig;
  return { dest: r.dest, mode: r.mode, riding: r.riding, cab: r.cabUnlocked, focus: document.activeElement?.className ?? '' };
});
const mark = (page: Page) => page.evaluate(() => (window as unknown as W).__h0Trace.frames.length);
const framesSince = (page: Page, from: number) => page.evaluate((n) => (window as unknown as W).__h0Trace.frames.slice(n), from);

/**
 * Steps the rig at 60 Hz without rendering, then brings the page clock to the same time.
 * rig.frame() draws every step, so the draw is switched off for the loop: a lap is ~4,000
 * steps, which SwiftShader would otherwise spend minutes drawing. The trace still records.
 */
async function advance(page: Page, ms: number, until?: 'ride-over') {
  const ran = await page.evaluate(
    ([ms, until]) => {
      const w = window as unknown as W;
      const f = w.__h0Trace.frames;
      const start = Math.max(performance.now(), f.at(-1)?.t ?? 0);
      const r = w.__h0World.renderer;
      const draw = r.render;
      r.render = () => undefined;
      let t = 0;
      try {
        while (t < (ms as number)) {
          t += 1000 / 60;
          w.__h0World.rig.frame(start + t);
          if (until && !w.__h0World.rig.riding) break;
        }
      } finally {
        r.render = draw;
      }
      return t;
    },
    [ms, until] as const,
  );
  await page.clock.fastForward(Math.ceil(ran));
  await page.clock.runFor(17);
  return ran;
}

test.afterEach(({ page }, testInfo) => drainGpu(page, testInfo));

test.describe('M2-10 ride', () => {
  test.describe.configure({ timeout: 180_000 });

  test('chase: 0.128 m/s at cruise, 0.35 s spring lag, 50 mm lens, 70 mm above rail, ≤ 45°/s', async ({ page }) => {
    await open(page, SMALL);
    await setDraw(page, false);
    const n = await mark(page);
    await page.click('.ride-start');
    await page.clock.runFor(12_000);
    const f = (await framesSince(page, n)).filter((x) => x.mode === 'ride' && x.ride);
    expect(f.length).toBeGreaterThan(600);
    // Speed from the trace's own positions, over 1 s windows at cruise.
    const cruise = f.filter((x) => x.ride!.v === SPEED);
    expect(cruise.length).toBeGreaterThan(300);
    for (let i = 0; i + 60 < cruise.length; i += 60) {
      const a = cruise[i]!;
      const b = cruise[i + 60]!;
      if (b.ride!.t - a.ride!.t > 1100) continue;
      expect(Math.abs(((b.ride!.s - a.ride!.s) / (b.ride!.t - a.ride!.t)) * 1000 - SPEED)).toBeLessThanOrEqual(5);
    }
    // Lag: the camera trails its goal (180 mm behind the 309 mm train) by v·τ at steady cruise.
    const steady = cruise.filter((x, i) => i > 200 && x.ride!.t < cruise[0]!.ride!.t + 9000);
    for (const x of steady) expect(Math.abs(x.ride!.s - 309 - 180 - x.ride!.sc - LAG_MM)).toBeLessThanOrEqual(2.5);
    expect(f.every((x) => x.fov === 27)).toBe(true);
    expect(f.filter((x) => Math.abs(x.pos.h - 76.8) < 1e-6).length).toBeGreaterThan(300);
    // Turn rate, frame to frame.
    let peak = 0;
    for (let i = 1; i < f.length; i++) peak = Math.max(peak, angle(fwd(f[i - 1]!), fwd(f[i]!)) / ((f[i]!.t - f[i - 1]!.t) / 1000));
    expect(peak).toBeLessThanOrEqual(45);
    expect(f.every((x) => x.roll === 0)).toBe(true);
  });

  test('one lap: four 6 s stops, 41.7 ± 1.5 s running, announced arrivals, the cab unlocks, a crossfade home', async ({ page }) => {
    await open(page, SMALL, './workshop/');
    await setDraw(page, false);
    const len = await page.evaluate(() => history.length);
    const url = page.url();
    await page.evaluate(() => {
      const w = window as unknown as { __said: string[] };
      w.__said = [];
      const el = document.querySelector('.layout-region [aria-live]')!;
      new MutationObserver((records) => {
        for (const r of records) for (const node of r.addedNodes) w.__said.push(node.textContent ?? '');
      }).observe(el, { childList: true });
    });
    const n = await mark(page);
    await page.click('.ride-start');
    expect(await page.locator('.ride-cab').isHidden()).toBe(true);
    await page.clock.runFor(400);
    await advance(page, 80_000, 'ride-over');
    const f = (await framesSince(page, n)).filter((x) => x.ride);
    const end = f.at(-1)!.ride!;
    expect(Math.abs(end.t - 65_650)).toBeLessThanOrEqual(100);
    // Standstills: v = 0 runs between departures.
    const stops: number[] = [];
    let from: number | null = null;
    for (const x of f) {
      if (x.ride!.v === 0 && from === null && x.ride!.t > 100) from = x.ride!.t;
      if (x.ride!.v > 0 && from !== null) {
        stops.push(x.ride!.t - from);
        from = null;
      }
    }
    expect(stops.length).toBe(3);
    // Each stop costs 6 s: the braking and starting ramps plus the standstill.
    for (const s of stops) expect(Math.abs(s - 3630)).toBeLessThanOrEqual(40);
    const running = end.t - 4 * 6000;
    expect(Math.abs(running / 1000 - 41.7)).toBeLessThanOrEqual(1.5);
    expect(end.s - PARKED).toBeCloseTo(5331.4, 0);
    const s = await state(page);
    expect(s.riding).toBeNull();
    expect(s.cab).toBe(true);
    const said = await page.evaluate(() => (window as unknown as { __said: string[] }).__said);
    for (const name of ['Campus', 'City', 'Workshop', 'Bootcamp']) expect(said.some((t) => t.includes(name))).toBe(true);
    expect(said.some((t) => /cab view is unlocked/.test(t))).toBe(true);
    // Home by crossfade to the view the ride started from, with no history entry.
    expect(s.mode).toBe('fade');
    await page.clock.runFor(400);
    expect(await state(page)).toMatchObject({ dest: 'workshop', mode: 'idle', riding: null });
    expect(await page.evaluate(() => history.length)).toBe(len);
    expect(page.url()).toBe(url);
    expect(await page.locator('.ride-start').isVisible()).toBe(true);
  });

  for (const [name, vp, how] of [
    ['1440', DESKTOP, 'Esc'],
    ['390', PHONE, '✕'],
  ] as const) {
    test(`${how} ends the ride at ${name} within 100 ms; focus returns to Ride; ✕ is 48 px; no history`, async ({ page }) => {
      await open(page, vp, './teaching/');
      await setDraw(page, false);
      const len = await page.evaluate(() => history.length);
      const url = page.url();
      await page.click('.ride-start');
      let s = await state(page);
      expect(s.riding).toBe('chase');
      expect(s.focus).toContain('ride-exit');
      expect(await page.locator('.switcher').isHidden()).toBe(true);
      const box = (await page.locator('.ride-exit').boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(48);
      expect(box.height).toBeGreaterThanOrEqual(48);
      expect(await page.locator('.ride-exit').getAttribute('aria-label')).toBe('End the ride');
      await page.clock.runFor(1500);
      const n = await mark(page);
      if (how === 'Esc') await page.keyboard.press('Escape');
      else await page.locator('.ride-exit').click();
      s = await state(page);
      // On the press itself: the ride is over, the train parked, the crossfade home begun.
      expect(s.riding).toBeNull();
      expect(s.mode).toBe('fade');
      expect(s.focus).toContain('ride-start');
      await page.clock.runFor(100);
      const f = await framesSince(page, n);
      expect(f.length).toBeGreaterThan(3);
      expect(f.every((x) => !x.ride && x.mode === 'fade' && x.dest === 'campus')).toBe(true);
      // The old view fades out linearly over 300 ms from the press.
      const last = f.at(-1)!;
      expect(Math.abs(last.opacityA - (1 - (last.t - f[0]!.t) / 300))).toBeLessThanOrEqual(0.06);
      expect(last.opacityA).toBeLessThan(0.75);
      await page.clock.runFor(400);
      expect(await state(page)).toMatchObject({ dest: 'campus', mode: 'idle', riding: null });
      expect(await page.locator('.switcher').isVisible()).toBe(true);
      expect(await page.evaluate(() => history.length)).toBe(len);
      expect(page.url()).toBe(url);
    });
  }

  test('cab: hidden until unlocked; 28 mm lens, 33 mm above rail, 3° down; drag yaws ±25°', async ({ page }) => {
    await open(page, SMALL);
    await setDraw(page, false);
    await page.click('.ride-start');
    await page.clock.runFor(1000);
    expect(await page.locator('.ride-cab').isHidden()).toBe(true);
    await page.evaluate(() => (window as unknown as W).__h0World.rig.unlockCab());
    await expect(page.locator('.ride-cab')).toBeVisible();
    await page.locator('.ride-cab').click();
    expect(await page.locator('.ride-cab').getAttribute('aria-pressed')).toBe('true');
    await page.clock.runFor(400);
    let n = await mark(page);
    await page.clock.runFor(1000);
    let f = await framesSince(page, n);
    expect(f.every((x) => x.mode === 'ride' && x.ride!.cam === 'cab' && x.fov === 46.4)).toBe(true);
    expect(f.every((x) => Math.abs(x.pos.h - 39.8) < 1e-6 && Math.abs(x.pitch + 3) < 1e-6 && x.roll === 0)).toBe(true);
    // Drag: azimuth maps to yaw, clamped at ±25° from the track heading.
    const base = f.at(-1)!.yaw;
    await page.evaluate(() => (window as unknown as W).__h0World.rig.orbitBy({ azimuth: -60 }));
    n = await mark(page);
    await page.clock.runFor(50);
    f = await framesSince(page, n);
    expect(f.at(-1)!.ride!.yaw).toBe(25);
    expect(Math.abs(((f.at(-1)!.yaw - base + 540) % 360) - 180 - 25)).toBeLessThanOrEqual(1);
    await page.locator('.ride-cab').click();
    await page.clock.runFor(400);
    expect(await state(page)).toMatchObject({ riding: 'chase' });
    expect(await page.locator('.ride-cab').getAttribute('aria-pressed')).toBe('false');
  });

  test('Back during a ride ends it and hops back', async ({ page }) => {
    await open(page, SMALL);
    await setDraw(page, false);
    await page.evaluate(() => (window as unknown as W).__h0World.rig.go('city'));
    await page.clock.runFor(800);
    await page.click('.ride-start');
    await page.clock.runFor(1000);
    await page.evaluate(() => history.back());
    for (let i = 0; i < 20 && (await state(page)).mode !== 'idle'; i++) await page.clock.runFor(100);
    expect(await state(page)).toMatchObject({ dest: 'overview', riding: null, mode: 'idle' });
  });

  test('the tier swap mid-ride crossfades onto the phone chase and keeps riding', async ({ page }) => {
    await open(page, SMALL);
    await setDraw(page, false);
    await page.click('.ride-start');
    await page.clock.runFor(2000);
    const n = await mark(page);
    await page.setViewportSize(PHONE);
    // Chromium may hold the resize event while the clock is paused, so fire it here once
    // the new size is in (a late real event then finds the tier already swapped).
    await expect.poll(() => page.evaluate(() => innerWidth)).toBe(PHONE.width);
    await page.evaluate(() => dispatchEvent(new Event('resize')));
    expect(await page.evaluate(() => (window as unknown as W).__h0World.tier)).toBe('phone');
    await page.clock.runFor(800);
    const f = await framesSince(page, n);
    const fade = f.filter((x) => x.mode === 'fade');
    expect(Math.abs(fade.at(-1)!.t - fade[0]!.t - 300)).toBeLessThanOrEqual(40);
    expect(f.every((x) => x.ride && x.ride.t > 1900)).toBe(true);
    expect(f.at(-1)!).toMatchObject({ mode: 'ride', fov: 37.8 });
    expect((await state(page)).riding).toBe('chase');
  });
});

test.describe('M2-13 ride, reduced motion', () => {
  test('the train stays parked; station views come on input, each a 200 ms crossfade; no history', async ({ page }) => {
    await open(page, SMALL, './', true);
    await setDraw(page, false);
    const len = await page.evaluate(() => history.length);
    let n = await mark(page);
    await page.click('.ride-start');
    const s = await state(page);
    expect(s.riding).toBe('stations');
    expect(s.focus).toContain('ride-next');
    await page.clock.runFor(1500);
    let f = await framesSince(page, n);
    const fade = f.filter((x) => x.mode === 'fade');
    expect(fade.every((x) => x.pos.x === fade[0]!.pos.x)).toBe(true);
    expect(Math.abs(fade.at(-1)!.t - fade[0]!.t - 200)).toBeLessThanOrEqual(25);
    expect(f.every((x) => x.mode !== 'fly' && x.mode !== 'ride')).toBe(true);
    expect(f.filter((x) => x.ride).every((x) => x.ride!.s === PARKED && x.ride!.v === 0)).toBe(true);
    expect((await state(page)).dest).toBe('bootcamp');
    for (const [how, to] of [
      ['click', 'campus'],
      ['ArrowRight', 'city'],
      ['click', 'workshop'],
      ['ArrowLeft', 'city'],
    ] as const) {
      n = await mark(page);
      if (how === 'click') await page.locator('.ride-next').click();
      else await page.keyboard.press(how);
      await page.clock.runFor(400);
      f = await framesSince(page, n);
      expect(f.every((x) => x.mode === 'fade' || x.mode === 'idle')).toBe(true);
      const d = f.filter((x) => x.mode === 'fade');
      expect(Math.abs(d.at(-1)!.t - d[0]!.t - 200)).toBeLessThanOrEqual(25);
      expect((await state(page)).dest).toBe(to);
    }
    await page.clock.runFor(5000);
    expect((await state(page)).dest).toBe('city');
    expect(await page.evaluate(() => history.length)).toBe(len);
    await page.keyboard.press('Escape');
    await page.clock.runFor(400);
    expect(await state(page)).toMatchObject({ dest: 'overview', riding: null, mode: 'idle' });
    expect(await page.evaluate(() => history.length)).toBe(len);
  });
});

test.describe('ride counts', () => {
  test.describe.configure({ timeout: 300_000 });
  for (const [name, vp] of [
    ['1440', DESKTOP],
    ['390', PHONE],
  ] as const) {
    test(`chase and cab at ${name} stay under the caps over a lap`, async ({ page }) => {
      await open(page, vp);
      await page.evaluate(() => (window as unknown as W).__h0World.rig.unlockCab());
      await page.click('.ride-start');
      await page.clock.runFor(400);
      const peak = { chase: { tris: 0, draws: 0 }, cab: { tris: 0, draws: 0 } };
      for (let k = 0; k < 16; k++) {
        for (const cam of ['chase', 'cab'] as const) {
          await page.evaluate((c) => (window as unknown as W).__h0World.rig.rideCam(c), cam);
          // Step past the camera switch, then sample the one frame advance() renders.
          await advance(page, 350);
          const last = (await framesSince(page, (await mark(page)) - 1))[0]!;
          expect(last.mode).toBe('ride');
          peak[cam].tris = Math.max(peak[cam].tris, last.render.triangles);
          peak[cam].draws = Math.max(peak[cam].draws, last.render.calls);
        }
        await advance(page, 3300);
      }
      for (const c of Object.values(peak)) {
        expect(c.tris).toBeLessThanOrEqual(CAP.tris);
        expect(c.draws).toBeLessThanOrEqual(CAP.draws);
      }
      console.log(`[world] ${name} ride peak tris/draws: chase ${peak.chase.tris}/${peak.chase.draws}, cab ${peak.cab.tris}/${peak.cab.draws}`);
      if (OUT) {
        mkdirSync(OUT, { recursive: true });
        writeFileSync(`${OUT}/ride-counts-${name}.json`, JSON.stringify(peak));
      }
    });
  }
});
