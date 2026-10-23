// Grey-box scene caps (M2 spec §5.3) on the 3D preview build: tris and draw calls from
// renderer.info at the overview, on both tiers. Frame times under SwiftShader are
// recorded as advisory only (§5.4); real-GPU numbers come from the trace card.
import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const CAP = { tris: 60_000, draws: 40 } as const;
const VIEWPORTS = [
  { name: '1440', width: 1440, height: 900, tier: 'desktop' },
  { name: '390', width: 390, height: 844, tier: 'phone' },
] as const;
const OUT = process.env.WORLD_OUT;

interface Frame {
  frameMs: number;
  render: { calls: number; triangles: number };
}

for (const vp of VIEWPORTS) {
  test(`overview at ${vp.name} stays under the scene caps`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('./?3d=1&trace=1');
    await page.waitForFunction(() => (window as unknown as { __h0Trace?: { frames: unknown[] } }).__h0Trace?.frames.length! >= 60, null, {
      timeout: 20_000,
    });
    const result = await page.evaluate(() => {
      const w = window as unknown as {
        __h0Trace: { frames: Frame[]; stop(): void };
        __h0World: { tier: string };
      };
      w.__h0Trace.stop();
      return { frames: w.__h0Trace.frames, tier: w.__h0World.tier };
    });
    expect(errors).toEqual([]);
    expect(result.tier).toBe(vp.tier);
    const last = result.frames.at(-1)!;
    expect(last.render.triangles).toBeGreaterThan(0);
    expect(last.render.triangles).toBeLessThanOrEqual(CAP.tris);
    expect(last.render.calls).toBeLessThanOrEqual(CAP.draws);

    // Advisory: skip the warm-up frames, report the median and p95.
    const ms = result.frames.slice(10).map((f) => f.frameMs).sort((a, b) => a - b);
    const pick = (q: number) => ms[Math.min(ms.length - 1, Math.floor(q * ms.length))]!;
    const summary = {
      viewport: `${vp.width}x${vp.height}`,
      tier: result.tier,
      triangles: last.render.triangles,
      calls: last.render.calls,
      frames: ms.length,
      medianMs: Number(pick(0.5).toFixed(2)),
      p95Ms: Number(pick(0.95).toFixed(2)),
    };
    test.info().annotations.push({ type: 'world', description: JSON.stringify(summary) });
    if (summary.p95Ms > 33.4) console.warn(`[advisory] SwiftShader p95 ${summary.p95Ms} ms at ${vp.name}`);
    if (OUT) {
      mkdirSync(OUT, { recursive: true });
      writeFileSync(`${OUT}/world-${vp.name}.json`, JSON.stringify(summary, null, 2));
      await page.screenshot({ path: `${OUT}/world-${vp.name}-overview.png` });
    }
  });
}
