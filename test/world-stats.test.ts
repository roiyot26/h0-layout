import { describe, expect, it } from 'vitest';
import { medianStats, percentile, refreshMs, runStats } from '../src/world/stats';

describe('trace card statistics (§5.4)', () => {
  it('nearest-rank percentiles', () => {
    const s = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(s, 50)).toBe(50);
    expect(percentile(s, 95)).toBe(95);
    expect(percentile(s, 100)).toBe(100);
    expect(percentile([], 50)).toBe(0);
  });

  it('snaps the refresh interval to a common rate', () => {
    expect(refreshMs(Array(50).fill(16.6))).toBeCloseTo(1000 / 60, 6);
    expect(refreshMs([...Array(50).fill(8.4), ...Array(50).fill(30)])).toBeCloseTo(1000 / 120, 6);
    expect(refreshMs([])).toBeCloseTo(1000 / 60, 6);
  });

  it('a steady 60 Hz run drops nothing', () => {
    const r = runStats(Array(600).fill(1000 / 60), 1000 / 60);
    expect(r).toEqual({ frames: 600, fps: 60, p50: 16.7, p95: 16.7, max: 16.7, dropped: 0, over33: 0 });
  });

  it('counts missed refreshes and frames over 33.4 ms', () => {
    const ms = [...Array(97).fill(1000 / 60), 33.3, 50, 100];
    const r = runStats(ms, 1000 / 60);
    // 33.3 misses 1, 50 misses 2, 100 misses 5.
    expect(r.dropped).toBe(8);
    expect(r.over33).toBe(2);
    expect(r.max).toBe(100);
    expect(r.p95).toBe(16.7);
  });

  it('ignores the zero-length first frame', () => {
    expect(runStats([0, 20, 20], 1000 / 60).frames).toBe(2);
  });

  it('reports the median of the runs per statistic', () => {
    const a = runStats(Array(10).fill(10), 10);
    const b = runStats(Array(10).fill(20), 10);
    const c = runStats(Array(10).fill(40), 10);
    expect(medianStats([c, a, b])).toEqual(b);
  });
});
