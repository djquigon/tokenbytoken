// Pacing (docs/PLAN.md §3.5): durations come only from the content being taught, never from measured time.
// Steps start at their base duration; compressible steps shrink proportionally (never below their
// minimum) to reach the target, and everything scales down if the total would pass the hard cap.

export interface Timing {
  readonly baseMs: number;
  readonly minMs: number;
  readonly compressible: boolean;
}

export const PACING = {
  /**
   * The plan's first guess was 90 s at 1×, but that left less time per step than it takes to read the
   * caption. Reading time wins (ADR 0007): the target is a soft aim and no step drops below its reading time.
   */
  targetMs: 150_000,
  capMs: 240_000,
  /** An average adult reading speed for non-fiction, in words per minute. */
  wordsPerMinute: 230,
  /** Time to look at the visual before reading starts. */
  readBaseMs: 1_500,
  /** The montage of remaining tokens: at most 8 s, at most 120 ms per token (docs/PLAN.md §3.5). */
  montageMaxMs: 8_000,
  montagePerTokenMs: 120,
  /** Replaying the options and pick for one chosen token. */
  focusMs: 15_000,
} as const;

const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);

export function fitDurations(steps: readonly Timing[], targetMs: number = PACING.targetMs, capMs: number = PACING.capMs): number[] {
  const base = steps.map((s) => s.baseMs);
  const total = sum(base);
  if (total <= targetMs) return base;

  const fixed = sum(steps.filter((s) => !s.compressible).map((s) => s.baseMs));
  const flexBase = total - fixed;
  const flexMin = sum(steps.filter((s) => s.compressible).map((s) => s.minMs));
  const flexTarget = Math.max(targetMs - fixed, flexMin);
  const scale = flexBase > 0 ? Math.min(1, flexTarget / flexBase) : 1;
  let fitted = steps.map((s) => (s.compressible ? Math.max(s.minMs, s.baseMs * scale) : s.baseMs));

  // Still over the hard cap (many fixed steps): scale everything, down to each step's minimum.
  const fittedTotal = sum(fitted);
  if (fittedTotal > capMs) {
    const k = capMs / fittedTotal;
    fitted = fitted.map((ms, i) => Math.max(steps[i]?.minMs ?? 0, ms * k));
  }
  return fitted.map((ms) => Math.round(ms));
}

/** Time to read a caption of this many words at 1×. */
export const readingMs = (words: number): number => Math.round(PACING.readBaseMs + (words * 60_000) / PACING.wordsPerMinute);

export const montageDurationMs = (tokens: number): number =>
  Math.min(PACING.montageMaxMs, Math.max(1, tokens) * PACING.montagePerTokenMs);
