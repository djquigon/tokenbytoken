import { readFileSync } from 'node:fs';

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { isCharBoundary, utf8 } from '@/shared/utf8';

import { alignTokens, type AlignDelta, type TokenSpan } from './align';

const lossy = new TextDecoder('utf-8'); // non-fatal: partial characters become U+FFFD, like a lossy token string

interface Simulated {
  deltas: AlignDelta[];
  trueSpans: [number, number][];
  tokenBytes: number[][];
  gapDeltas: Set<number>;
}

/**
 * Cuts text into tokens at arbitrary byte offsets (including mid-character), then groups tokens into deltas
 * that each end on a character boundary, as OpenAI's stream does. Some deltas can lose their tokens.
 */
function simulate(text: string, cuts: number[], dropEvery: number | null): Simulated {
  const bytes = utf8(text);
  const points = [...new Set(cuts.map((c) => c % Math.max(1, bytes.length)))].filter((c) => c > 0).sort((a, b) => a - b);
  const bounds = [0, ...points, bytes.length];
  const tokens: [number, number][] = [];
  for (let i = 0; i + 1 < bounds.length; i += 1) {
    const s = bounds[i] ?? 0;
    const e = bounds[i + 1] ?? 0;
    if (e > s) tokens.push([s, e]);
  }
  const deltas: AlignDelta[] = [];
  const trueSpans: [number, number][] = [];
  const tokenBytes: number[][] = [];
  const gapDeltas = new Set<number>();
  let pending: [number, number][] = [];
  for (const span of tokens) {
    pending.push(span);
    if (!isCharBoundary(bytes, span[1])) continue;
    const start = pending[0]?.[0] ?? 0;
    const deltaText = new TextDecoder('utf-8', { fatal: true }).decode(bytes.slice(start, span[1]));
    const drop = dropEvery !== null && deltas.length % dropEvery === dropEvery - 1;
    if (drop) {
      gapDeltas.add(deltas.length);
      deltas.push({ text: deltaText, tokens: [] });
    } else {
      deltas.push({ text: deltaText, tokens: pending.map(([s, e]) => lossy.decode(bytes.slice(s, e))) });
      for (const [s, e] of pending) {
        trueSpans.push([s, e]);
        tokenBytes.push(Array.from(bytes.slice(s, e)));
      }
    }
    pending = [];
  }
  return { deltas, trueSpans, tokenBytes, gapDeltas };
}

// Printable text across scripts and emoji, without a literal U+FFFD (covered by its own test).
const arbText = fc.string({ unit: 'binary', minLength: 1, maxLength: 40 }).map((s) => s.replaceAll('�', '?'));

describe('alignTokens', () => {
  it('places every token exactly when OpenAI returns final bytes', () => {
    fc.assert(
      fc.property(arbText, fc.array(fc.nat(), { maxLength: 30 }), (text, cuts) => {
        const sim = simulate(text, cuts, null);
        const r = alignTokens({ deltas: sim.deltas, finalTokenBytes: sim.tokenBytes });
        const tokens = r.segments.filter((s): s is TokenSpan => s.kind === 'token');
        expect(r.text).toBe(text);
        expect(tokens.map((t) => [t.start, t.end])).toEqual(sim.trueSpans);
        expect(tokens.every((t) => t.placement === 'exact' && t.bytesFrom === 'final')).toBe(true);
        expect(r.coveredFully).toBe(true);
        expect(r.issues).toEqual([]);
      }),
    );
  });

  it('never invents positions without final bytes: exact, eliminated, or delta-only', () => {
    fc.assert(
      fc.property(arbText, fc.array(fc.nat(), { maxLength: 30 }), (text, cuts) => {
        const sim = simulate(text, cuts, null);
        const r = alignTokens({ deltas: sim.deltas, finalTokenBytes: null });
        const tokens = r.segments.filter((s): s is TokenSpan => s.kind === 'token');
        expect(tokens).toHaveLength(sim.trueSpans.length);
        tokens.forEach((t, i) => {
          const truth = sim.trueSpans[i];
          if (t.placement === 'delta') {
            // Only the containing delta is claimed, and it does contain the token.
            expect(t.start).toBeLessThanOrEqual(truth?.[0] ?? -1);
            expect(t.end).toBeGreaterThanOrEqual(truth?.[1] ?? Infinity);
          } else {
            expect([t.start, t.end]).toEqual(truth);
          }
        });
        // A delta with at most one lossy token is always resolved.
        sim.deltas.forEach((d, di) => {
          const lossyCount = (d.tokens ?? []).filter((tok) => tok.includes('�')).length;
          if (lossyCount <= 1) expect(tokens.filter((t) => t.deltaIndex === di).every((t) => t.placement !== 'delta')).toBe(true);
        });
      }),
    );
  });

  it('marks text that came without tokens as gaps, covering it exactly once', () => {
    fc.assert(
      fc.property(arbText, fc.array(fc.nat(), { maxLength: 30 }), fc.integer({ min: 1, max: 3 }), (text, cuts, dropEvery) => {
        const sim = simulate(text, cuts, dropEvery);
        const r = alignTokens({ deltas: sim.deltas, finalTokenBytes: null });
        // Exactly-placed segments tile the text in order with no overlaps.
        let cursor = 0;
        for (const s of r.segments) {
          if (s.kind === 'token' && s.placement === 'delta') continue;
          expect(s.start).toBeGreaterThanOrEqual(cursor);
          cursor = s.end;
        }
        const gaps = r.segments.filter((s) => s.kind === 'gap');
        expect(gaps.map((g) => g.deltaIndex)).toEqual([...sim.gapDeltas].filter((i) => (sim.deltas[i]?.text.length ?? 0) > 0));
        expect(r.coveredFully).toBe(sim.gapDeltas.size === 0);
      }),
    );
  });

  it('flags partial characters, e.g. an emoji split over two tokens', () => {
    const emoji = utf8('😀'); // 4 bytes
    const r = alignTokens({
      deltas: [{ text: '😀', tokens: [lossy.decode(emoji.slice(0, 3)), lossy.decode(emoji.slice(3))] }],
      finalTokenBytes: [Array.from(emoji.slice(0, 3)), Array.from(emoji.slice(3))],
    });
    expect(r.segments).toMatchObject([
      { kind: 'token', start: 0, end: 3, partialStart: false, partialEnd: true },
      { kind: 'token', start: 3, end: 4, partialStart: true, partialEnd: false },
    ]);
  });

  it('ignores a final list whose length does not match the streamed tokens', () => {
    const r = alignTokens({ deltas: [{ text: 'Hi', tokens: ['Hi'] }], finalTokenBytes: [[72], [105]] });
    expect(r.issues).toEqual([{ kind: 'final_bytes_count_mismatch', expected: 1, got: 2 }]);
    expect(r.segments).toMatchObject([{ kind: 'token', start: 0, end: 2, bytesFrom: 'string' }]);
  });

  it('falls back to delta placement rather than guessing when text contains a literal U+FFFD', () => {
    const r = alignTokens({ deltas: [{ text: 'a�', tokens: ['a', '��'] }], finalTokenBytes: null });
    expect(r.segments.every((s) => s.kind === 'token' && s.placement === 'delta')).toBe(true);
    expect(r.issues).toEqual([{ kind: 'unplaced_tokens', deltaIndex: 0 }]);
  });

  it('returns no segments when logprobs were not requested', () => {
    const r = alignTokens({ deltas: [{ text: 'Hi', tokens: null }], finalTokenBytes: null });
    expect(r.segments).toEqual([]);
    expect(r.coveredFully).toBe(false);
  });

  it('aligns the recorded probe fixtures (contract test)', () => {
    type Fixture = { events: { type: string; delta?: string; logprobs?: { token: string }[] }[]; final: { text: string; logprobs: { bytes: number[] }[] | null } };
    for (const name of ['stream-basic', 'stream-unicode']) {
      const f = JSON.parse(readFileSync(`fixtures/probe/gpt-6-luna/${name}.json`, 'utf8')) as Fixture;
      const deltas = f.events
        .filter((e) => e.type === 'response.output_text.delta')
        .map((e) => ({ text: e.delta ?? '', tokens: (e.logprobs ?? []).map((l) => l.token) }));
      const finalBytes = f.final.logprobs && f.final.logprobs.length > 0 ? f.final.logprobs.map((l) => l.bytes) : null;
      const r = alignTokens({ deltas, finalTokenBytes: finalBytes });
      expect(r.text).toBe(f.final.text);
      expect(r.issues).toEqual([]);
      if (name === 'stream-unicode') {
        // Four emoji pieces came with no tokens; they are gaps, never filled in.
        expect(r.segments.filter((s) => s.kind === 'gap')).toHaveLength(4);
        expect(r.coveredFully).toBe(false);
      } else {
        expect(r.usedFinalBytes).toBe(true);
        expect(r.coveredFully).toBe(true);
      }
    }
  });
});
