// Frame-time statistics for the trace card (M2 spec §5.4). Pure functions over the
// trace's frameMs values, so the card's numbers can be unit tested.

export interface RunStats {
  /** Frames measured. */
  frames: number;
  /** Median fps: 1000 / the median frame time. */
  fps: number;
  /** Frame time percentiles and maximum, ms. */
  p50: number;
  p95: number;
  max: number;
  /** Missed display refreshes: Σ max(0, round(frameMs / refresh) − 1). */
  dropped: number;
  /** Frames longer than 33.4 ms (CHECKLIST §0). */
  over33: number;
}

/** Display refresh rates the interval snaps to, Hz. */
const RATES = [30, 48, 50, 60, 72, 75, 90, 100, 120, 144, 165, 240] as const;

/** Nearest-rank percentile of an ascending list. */
export function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  const k = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[k]!;
}

/**
 * The display's refresh interval, ms: the 10th-percentile frame time snapped to the
 * nearest common rate, so a busy run is not mistaken for a slow display.
 */
export function refreshMs(frameMs: readonly number[]): number {
  const fast = percentile([...frameMs].sort((a, b) => a - b), 10);
  if (!(fast > 0)) return 1000 / 60;
  let best: number = RATES[0];
  for (const r of RATES) if (Math.abs(1000 / r - fast) < Math.abs(1000 / best - fast)) best = r;
  return 1000 / best;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Statistics of one run's frame times against the display refresh interval. */
export function runStats(frameMs: readonly number[], refresh: number): RunStats {
  const ms = frameMs.filter((m) => m > 0);
  const sorted = [...ms].sort((a, b) => a - b);
  const p50 = percentile(sorted, 50);
  return {
    frames: ms.length,
    fps: p50 > 0 ? round1(1000 / p50) : 0,
    p50: round1(p50),
    p95: round1(percentile(sorted, 95)),
    max: round1(sorted.at(-1) ?? 0),
    dropped: ms.reduce((n, m) => n + Math.max(0, Math.round(m / refresh) - 1), 0),
    over33: ms.filter((m) => m > 33.4).length,
  };
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length === 0 ? 0 : s[(s.length - 1) >> 1]! + (s.length % 2 === 0 ? (s[s.length >> 1]! - s[(s.length - 1) >> 1]!) / 2 : 0);
};

/** The median of each statistic over the runs (§5.4: report the median of 3). */
export function medianStats(runs: readonly RunStats[]): RunStats {
  const pick = (k: keyof RunStats) => median(runs.map((r) => r[k]));
  return {
    frames: Math.round(pick('frames')),
    fps: round1(pick('fps')),
    p50: round1(pick('p50')),
    p95: round1(pick('p95')),
    max: round1(pick('max')),
    dropped: Math.round(pick('dropped')),
    over33: Math.round(pick('over33')),
  };
}
