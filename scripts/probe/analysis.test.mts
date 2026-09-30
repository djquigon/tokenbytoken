import { describe, expect, it } from 'vitest';

import {
  alternativesPerToken,
  analyzeFirstPosition,
  chosenOutsideAlternatives,
  costUsd,
  distribution,
  fitOverhead,
  histogram,
  logprobCoverage,
  roundTrip,
  type FirstPositionRun,
} from './analysis.mts';

const utf8 = (s: string) => Array.from(new TextEncoder().encode(s));

describe('distribution', () => {
  it('returns null for no values', () => {
    expect(distribution([])).toBeNull();
  });

  it('computes min, median, and max for odd and even counts', () => {
    expect(distribution([3, 1, 2])).toEqual({ count: 3, min: 1, median: 2, max: 3 });
    expect(distribution([4, 1, 3, 2])).toEqual({ count: 4, min: 1, median: 2.5, max: 4 });
  });
});

describe('histogram', () => {
  it('counts occurrences of each value', () => {
    expect(histogram([1, 1, 2, 1, 3])).toEqual({ '1': 3, '2': 1, '3': 1 });
  });
});

describe('alternativesPerToken', () => {
  it('treats a missing list as zero alternatives', () => {
    expect(alternativesPerToken([{ top_logprobs: [1, 2] }, {}])).toEqual({ count: 2, min: 0, median: 1, max: 2 });
  });
});

describe('chosenOutsideAlternatives', () => {
  it('flags tokens that are not among their own alternatives', () => {
    const result = chosenOutsideAlternatives([
      { token: 'a', top_logprobs: [{ token: 'a' }, { token: 'b' }] },
      { token: 'z', top_logprobs: [{ token: 'a' }] },
    ]);
    expect(result).toEqual({ total: 2, outside: 1, rate: 0.5 });
  });
});

describe('roundTrip', () => {
  // A toy vocabulary: each known string is one token; anything else splits into characters.
  const vocab = new Set([' Hello', ' world', '你好']);
  const encode = (text: string) => (vocab.has(text) ? [1] : Array.from(text).map(() => 0));

  it('counts provider tokens that are exactly one local token', () => {
    const result = roundTrip(
      [
        { token: ' Hello', bytes: utf8(' Hello') },
        { token: ' world', bytes: utf8(' world') },
        { token: ' wor', bytes: utf8(' wor') },
      ],
      encode,
    );
    expect(result).toMatchObject({ total: 3, checkable: 3, single: 2, partialBytes: 0 });
    expect(result.rate).toBeCloseTo(2 / 3);
    expect(result.mismatches).toEqual([{ token: ' wor', localPieces: 4 }]);
  });

  it('sets aside tokens that carry only part of a multi-byte character', () => {
    const emoji = utf8('😀'); // F0 9F 98 80, split across two provider tokens
    const result = roundTrip(
      [
        { token: 'bytes:\\xf0\\x9f', bytes: emoji.slice(0, 2) },
        { token: 'bytes:\\x98\\x80', bytes: emoji.slice(2) },
        { token: '你好', bytes: utf8('你好') },
      ],
      encode,
    );
    expect(result).toMatchObject({ total: 3, checkable: 1, single: 1, partialBytes: 2, rate: 1 });
  });
});

describe('analyzeFirstPosition', () => {
  const base: FirstPositionRun = {
    label: 'T=1',
    temperature: 1,
    topP: 1,
    alternatives: [
      { token: 'Blue', logprob: -0.5 },
      { token: 'Red', logprob: -1.5 },
      { token: 'Green', logprob: -2.5 },
    ],
  };
  const repeat: FirstPositionRun = {
    ...base,
    label: 'T=1 again',
    alternatives: base.alternatives.map((a) => ({ ...a, logprob: a.logprob + 0.01 })),
  };

  it('classifies logprobs that ignore temperature as raw scores', () => {
    const hot: FirstPositionRun = { ...base, label: 'T=1.5', temperature: 1.5 };
    const cool: FirstPositionRun = { ...base, label: 'T=0.7', temperature: 0.7 };
    const report = analyzeFirstPosition(base, repeat, [cool, hot]);
    expect(report.semantics).toBe('raw');
    expect(report.noise).toBeCloseTo(0.01);
  });

  it('classifies logprobs whose gaps scale by 1/T as temperature-scaled', () => {
    // Scaling scores by 1/T scales the gap between any two tokens by 1/T.
    const scaleBy = (t: number, label: string): FirstPositionRun => ({
      label,
      temperature: t,
      topP: 1,
      alternatives: base.alternatives.map((a) => ({ token: a.token, logprob: -0.3 + (a.logprob + 0.5) / t })),
    });
    const report = analyzeFirstPosition(base, repeat, [scaleBy(0.7, 'T=0.7'), scaleBy(1.5, 'T=1.5')]);
    expect(report.semantics).toBe('temperature-scaled');
    expect(report.runs[0]?.gapRatio).toBeCloseTo(1 / 0.7);
  });

  it('decides by gap ratios, not by noisy absolute values', () => {
    // A uniform shift changes every value but no gap: still raw scores.
    const shifted: FirstPositionRun = {
      ...base,
      label: 'T=1.5',
      temperature: 1.5,
      alternatives: base.alternatives.map((a) => ({ ...a, logprob: a.logprob - 0.8 })),
    };
    const noisyRepeat: FirstPositionRun = {
      ...base,
      alternatives: base.alternatives.map((a) => ({ ...a, logprob: a.logprob + 1 })),
    };
    expect(analyzeFirstPosition(base, noisyRepeat, [shifted]).semantics).toBe('raw');
  });

  it('is inconclusive without an informative run', () => {
    const topP: FirstPositionRun = { ...base, label: 'top_p=0.1', topP: 0.1 };
    expect(analyzeFirstPosition(base, null, [topP]).semantics).toBe('inconclusive');
  });
});

describe('logprobCoverage', () => {
  it('counts text that arrived without logprob entries and ignores empty deltas', () => {
    const coverage = logprobCoverage([
      { delta: 'Hi', logprobs: [{}] },
      { delta: ' 👋', logprobs: [] },
      { delta: '', logprobs: [] },
      { delta: '!', logprobs: [{}] },
    ]);
    expect(coverage).toEqual({ deltas: 3, deltasWithoutLogprobs: 1, charsWithoutLogprobs: 3, chars: 6, examples: [' 👋'] });
  });
});

describe('fitOverhead', () => {
  it('recovers a per-request and per-message overhead', () => {
    const samples = [1, 2, 3, 5].map((units, i) => ({
      id: String(i),
      units,
      local: 10 * units,
      reported: 10 * units + 3 + 4 * units,
    }));
    const fit = fitOverhead(samples);
    expect(fit?.perRequest).toBeCloseTo(3);
    expect(fit?.perUnit).toBeCloseTo(4);
    expect(fit?.maxResidual).toBeCloseTo(0);
  });

  it('falls back to a constant when every sample has the same shape', () => {
    const fit = fitOverhead([
      { id: 'a', units: 1, local: 5, reported: 12 },
      { id: 'b', units: 1, local: 8, reported: 15 },
    ]);
    expect(fit).toMatchObject({ perRequest: 7, perUnit: 0 });
  });
});

describe('costUsd', () => {
  it('prices uncached, cached, cache-write, and output tokens separately', () => {
    const price = { input: 1, cachedInput: 0.1, cacheWrite: 1.25, output: 4 };
    const usage = {
      input_tokens: 1_000_000,
      output_tokens: 500_000,
      input_tokens_details: { cached_tokens: 200_000, cache_write_tokens: 100_000 },
    };
    // 0.7 uncached + 0.02 cached + 0.125 written + 2 output
    expect(costUsd(usage, price)).toBeCloseTo(2.845);
  });
});
