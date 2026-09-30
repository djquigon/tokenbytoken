// Pure analysis helpers for the capability probe: no I/O, clocks, or randomness.
// Covered by analysis.test.mts.

import type { Price } from './candidates.mts';

/** Logprob entry as streamed on `response.output_text.delta`. Streamed entries carry no bytes. */
export interface StreamedLogprob {
  token: string;
  logprob: number;
  top_logprobs?: readonly { token?: string; logprob?: number }[];
}

/** Logprob entry on the final `output_text` content part, which includes UTF-8 bytes. */
export interface FinalLogprob {
  token: string;
  bytes: readonly number[];
  logprob: number;
  top_logprobs: readonly { token: string; bytes: readonly number[]; logprob: number }[];
}

export interface Distribution {
  count: number;
  min: number;
  median: number;
  max: number;
}

function at<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new RangeError(`index ${index} out of range (length ${items.length})`);
  return item;
}

export function distribution(values: readonly number[]): Distribution | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 1 ? at(sorted, mid) : (at(sorted, mid - 1) + at(sorted, mid)) / 2;
  return { count: sorted.length, min: at(sorted, 0), median, max: at(sorted, sorted.length - 1) };
}

export function histogram(values: readonly number[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values) counts[String(value)] = (counts[String(value)] ?? 0) + 1;
  return counts;
}

/** How many alternatives the API returned per token. It may return fewer than requested. */
export function alternativesPerToken(tokens: readonly { top_logprobs?: readonly unknown[] }[]): Distribution | null {
  return distribution(tokens.map((t) => t.top_logprobs?.length ?? 0));
}

/**
 * How often the sampled token is missing from its own returned alternatives. At temperature 1 the
 * sampler can pick a token outside the top N, so the UI must handle "chosen token not listed".
 */
export function chosenOutsideAlternatives(
  tokens: readonly { token: string; top_logprobs?: readonly { token?: string }[] }[],
): { total: number; outside: number; rate: number | null } {
  const outside = tokens.filter((t) => !(t.top_logprobs ?? []).some((alt) => alt.token === t.token)).length;
  return { total: tokens.length, outside, rate: tokens.length === 0 ? null : outside / tokens.length };
}

export interface RoundTrip {
  total: number;
  /** Tokens whose bytes are complete UTF-8 on their own, so they can be checked one at a time. */
  checkable: number;
  /** Checkable tokens that the local tokenizer encodes as exactly one token. */
  single: number;
  /** Tokens holding only part of a multi-byte character; not individually checkable. */
  partialBytes: number;
  rate: number | null;
  mismatches: { token: string; localPieces: number }[];
}

/**
 * Evidence that the provider's vocabulary matches the local tokenizer: every token the model
 * produced should be exactly one entry of the local vocabulary.
 */
export function roundTrip(
  tokens: readonly Pick<FinalLogprob, 'token' | 'bytes'>[],
  encode: (text: string) => readonly number[],
  maxExamples = 20,
): RoundTrip {
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let checkable = 0;
  let single = 0;
  let partialBytes = 0;
  const mismatches: RoundTrip['mismatches'] = [];
  for (const t of tokens) {
    let text: string;
    try {
      text = t.bytes.length > 0 ? decoder.decode(Uint8Array.from(t.bytes)) : t.token;
    } catch {
      partialBytes += 1;
      continue;
    }
    checkable += 1;
    const pieces = encode(text).length;
    if (pieces === 1) single += 1;
    else if (mismatches.length < maxExamples) mismatches.push({ token: text, localPieces: pieces });
  }
  return { total: tokens.length, checkable, single, partialBytes, rate: checkable === 0 ? null : single / checkable, mismatches };
}

export interface FirstPositionRun {
  label: string;
  temperature: number;
  topP: number;
  /** The alternatives returned for output position 1. */
  alternatives: readonly { token: string; logprob: number }[];
}

export type LogprobSemantics = 'raw' | 'temperature-scaled' | 'inconclusive';

export interface SemanticsReport {
  semantics: LogprobSemantics;
  /** Largest |Δ logprob| between two runs with identical settings (server-side nondeterminism). */
  noise: number | null;
  tolerance: number;
  runs: {
    label: string;
    temperature: number;
    topP: number;
    alternatives: number;
    common: number;
    maxAbsDiff: number | null;
    /** Median of gap(run) / gap(baseline) between the baseline's top token and the others. */
    gapRatio: number | null;
    /** The gap ratio expected if the reported logprobs were computed after temperature scaling. */
    expectedIfScaled: number | null;
  }[];
}

function toMap(run: FirstPositionRun): Map<string, number> {
  return new Map(run.alternatives.map((a) => [a.token, a.logprob]));
}

function maxAbsDiff(a: Map<string, number>, b: Map<string, number>): { diff: number | null; common: number } {
  let diff: number | null = null;
  let common = 0;
  for (const [token, lp] of a) {
    const other = b.get(token);
    if (other === undefined) continue;
    common += 1;
    diff = Math.max(diff ?? 0, Math.abs(lp - other));
  }
  return { diff, common };
}

function gapRatio(base: Map<string, number>, run: Map<string, number>, minGap = 0.5): number | null {
  let refToken: string | null = null;
  let refLp = -Infinity;
  for (const [token, lp] of base) {
    if (lp > refLp) {
      refLp = lp;
      refToken = token;
    }
  }
  if (refToken === null) return null;
  const runRef = run.get(refToken);
  if (runRef === undefined) return null;
  const ratios: number[] = [];
  for (const [token, lp] of base) {
    if (token === refToken) continue;
    const baseGap = refLp - lp;
    const other = run.get(token);
    if (baseGap < minGap || other === undefined) continue;
    ratios.push((runRef - other) / baseGap);
  }
  return distribution(ratios)?.median ?? null;
}

/**
 * Do the reported logprobs change with the sampling settings? Only output position 1 is compared,
 * because it's the only position whose context is identical across runs. If the values ignore
 * temperature they're the model's raw scores; if their gaps shrink or grow by 1/T they were
 * computed after temperature scaling.
 */
export function analyzeFirstPosition(
  baseline: FirstPositionRun,
  repeat: FirstPositionRun | null,
  others: readonly FirstPositionRun[],
): SemanticsReport {
  const base = toMap(baseline);
  const noise = repeat ? maxAbsDiff(base, toMap(repeat)).diff : null;
  const tolerance = Math.max(3 * (noise ?? 0.02), 0.05);
  const runs = others.map((run) => {
    const map = toMap(run);
    const { diff, common } = maxAbsDiff(base, map);
    return {
      label: run.label,
      temperature: run.temperature,
      topP: run.topP,
      alternatives: run.alternatives.length,
      common,
      maxAbsDiff: diff,
      gapRatio: gapRatio(base, map),
      expectedIfScaled: run.temperature > 0 ? 1 / run.temperature : null,
    };
  });

  // Only runs at a temperature other than 1 (and above 0) can tell the two hypotheses apart.
  // Gap ratios are the primary evidence: raw scores keep the gaps between tokens fixed (ratio ≈ 1),
  // while temperature scaling multiplies them by 1/T. Absolute values are noisier: identical
  // requests can differ, so they're only a fallback when too few alternatives are shared.
  const informative = runs.filter((r) => r.temperature > 0 && Math.abs(r.temperature - 1) >= 0.2 && r.topP === 1);
  const fitsRaw = (r: (typeof runs)[number]) =>
    r.gapRatio !== null ? Math.abs(r.gapRatio - 1) <= 0.2 : r.maxAbsDiff !== null && r.maxAbsDiff <= tolerance;
  const fitsScaled = (r: (typeof runs)[number]) =>
    r.gapRatio !== null && r.expectedIfScaled !== null && Math.abs(r.gapRatio / r.expectedIfScaled - 1) <= 0.2;
  let semantics: LogprobSemantics = 'inconclusive';
  if (informative.length > 0 && informative.every((r) => fitsRaw(r) && !fitsScaled(r))) semantics = 'raw';
  else if (informative.length > 0 && informative.every((r) => fitsScaled(r) && !fitsRaw(r))) semantics = 'temperature-scaled';
  return { semantics, noise, tolerance, runs };
}

export interface DeltaLike {
  delta: string;
  logprobs: readonly unknown[];
}

export interface Coverage {
  /** Text deltas with content. */
  deltas: number;
  /** Text deltas whose text arrived with no logprob entries (for example, some emoji). */
  deltasWithoutLogprobs: number;
  /** Characters (UTF-16 units) of delta text that arrived with no logprob entries. */
  charsWithoutLogprobs: number;
  chars: number;
  examples: string[];
}

/** How much of the streamed text came with per-token logprobs. Gaps must be labeled in the UI. */
export function logprobCoverage(deltas: readonly DeltaLike[], maxExamples = 10): Coverage {
  let charsWithoutLogprobs = 0;
  let deltasWithoutLogprobs = 0;
  let chars = 0;
  let count = 0;
  const examples: string[] = [];
  for (const d of deltas) {
    if (d.delta.length === 0) continue;
    count += 1;
    chars += d.delta.length;
    if (d.logprobs.length > 0) continue;
    deltasWithoutLogprobs += 1;
    charsWithoutLogprobs += d.delta.length;
    if (examples.length < maxExamples) examples.push(d.delta);
  }
  return { deltas: count, deltasWithoutLogprobs, charsWithoutLogprobs, chars, examples };
}

export interface OverheadSample {
  id: string;
  /** Messages plus one if instructions were sent. */
  units: number;
  local: number;
  reported: number;
}

export interface OverheadFit {
  perRequest: number;
  perUnit: number;
  maxResidual: number;
  samples: number;
}

/**
 * Least-squares fit of (reported − local) = perRequest + perUnit × units. The gap is the
 * formatting OpenAI adds around messages, which a local tokenizer can't see.
 */
export function fitOverhead(samples: readonly OverheadSample[]): OverheadFit | null {
  const n = samples.length;
  if (n === 0) return null;
  const xs = samples.map((s) => s.units);
  const ys = samples.map((s) => s.reported - s.local);
  const sx = xs.reduce((a, b) => a + b, 0);
  const sy = ys.reduce((a, b) => a + b, 0);
  const sxy = xs.reduce((acc, x, i) => acc + x * at(ys, i), 0);
  const sxx = xs.reduce((acc, x) => acc + x * x, 0);
  const denom = n * sxx - sx * sx;
  const perUnit = denom === 0 ? 0 : (n * sxy - sx * sy) / denom;
  const perRequest = (sy - perUnit * sx) / n;
  const maxResidual = Math.max(...xs.map((x, i) => Math.abs(at(ys, i) - (perRequest + perUnit * x))));
  return { perRequest, perUnit, maxResidual, samples: n };
}

export interface UsageLike {
  input_tokens: number;
  output_tokens: number;
  input_tokens_details?: { cached_tokens?: number; cache_write_tokens?: number } | null;
}

/** Estimated cost in USD from reported usage and a dated price table. */
export function costUsd(usage: UsageLike, price: Price): number {
  const cached = usage.input_tokens_details?.cached_tokens ?? 0;
  const written = usage.input_tokens_details?.cache_write_tokens ?? 0;
  const uncached = Math.max(0, usage.input_tokens - cached - written);
  return (
    (uncached * price.input +
      cached * price.cachedInput +
      written * (price.cacheWrite ?? price.input) +
      usage.output_tokens * price.output) /
    1_000_000
  );
}
