// Helpers shared by the stage builders. Pure.

import { CLOSE_CALL_RULE } from '@/shared/close-call-rule';
import { derive, deriveAll, illustrate, type Sourced } from '@/shared/provenance';
import { read } from '@/shared/provenance/read';
import { utf8 } from '@/shared/utf8';
import type { Alternative, FinalizedTrace, InputRunFacts, OutputToken } from '@/trace/facts';

import type { PickCopy } from '@/content/walkthrough';

/** A token chip: its text, its ID (from the assumed tokenizer), and, for a piece of a character, which piece. */
export interface TokenPiece {
  readonly text: Sourced<string>;
  readonly id: Sourced<number> | null;
  /** Set when the token is part of a multi-byte character, e.g. part 1 of 2 of an emoji. */
  readonly part: { readonly k: number; readonly n: number; readonly char: string } | null;
}

const lossless = new TextDecoder('utf-8');

/** Splits text into this app's tokens by their UTF-8 byte lengths (CLAUDE.md §3.5: bytes, not strings). */
export function inputPieces(run: InputRunFacts): TokenPiece[] {
  const text = read(run.text);
  const bytes = utf8(text);
  // Character spans, so a token inside one multi-byte character can be named "part k of n of <char>".
  const chars: { start: number; end: number; char: string }[] = [];
  let offset = 0;
  for (const ch of text) {
    const len = utf8(ch).length;
    chars.push({ start: offset, end: offset + len, char: ch });
    offset += len;
  }
  const spans: { from: number; to: number }[] = [];
  let at = 0;
  for (const len of run.byteLengths) {
    spans.push({ from: at, to: at + len });
    at += len;
  }
  return spans.map((span, i) => {
    const container = chars.find((c) => c.start <= span.from && span.to <= c.end && c.end - c.start > span.to - span.from);
    let part: TokenPiece['part'] = null;
    let pieceText: string;
    if (container) {
      const siblings = spans.filter((o) => o.from >= container.start && o.to <= container.end);
      part = { k: siblings.indexOf(span) + 1, n: siblings.length, char: container.char };
      pieceText = container.char;
    } else {
      pieceText = lossless.decode(bytes.slice(span.from, span.to));
    }
    return {
      text: derive('local-token-count', [run.text], () => pieceText),
      id: derive('local-token-count', [run.ids], (ids) => ids[i] ?? -1),
      part,
    };
  });
}

export const outputPiece = (t: OutputToken): TokenPiece => ({ text: t.text, id: t.tokenId, part: null });

/** The reply text before a token (up to `maxPieces` segments), for context around a moment. */
export function textBefore(trace: FinalizedTrace, tokenIndex: number, maxPieces = 8): Sourced<string> | null {
  const segments = trace.output.segments;
  const at = segments.findIndex((s) => s.kind === 'token' && s.token.index === tokenIndex);
  if (at <= 0) return null;
  const texts = segments.slice(Math.max(0, at - maxPieces), at).map((s) => (s.kind === 'token' ? s.token.text : s.gap.text));
  return deriveAll('text-join', texts, (xs) => xs.join(''));
}

/** The first token OpenAI returned, if logprobs were requested and came back. */
export const firstToken = (trace: FinalizedTrace): OutputToken | null => trace.output.tokens[0] ?? null;

/** The first featured close call after token 0, for the loop chapter's replay. */
export function laterMoment(trace: FinalizedTrace): OutputToken | null {
  const { featured } = read(trace.closeCalls);
  const index = featured.find((i) => i > 0);
  return index === undefined ? null : (trace.output.tokens[index] ?? null);
}

/**
 * How a pick compared with the other listed options, so the words match the numbers: "wasn't the top
 * option", "two were close", or "no option had a majority". Uses the displayed close-call rule.
 */
export type PickKind = 'not_top' | 'close' | 'no_majority' | 'clear';

export interface PickComparison {
  readonly kind: PickKind;
  /** The option to name beside the pick: the top option when the pick wasn't it, otherwise the runner-up. */
  readonly other: Alternative | null;
}

export function comparePick(token: OutputToken): PickComparison {
  const [top, second] = token.alternatives;
  if (!top || !top.isChosen) return { kind: 'not_top', other: top ?? null };
  if (second && read(top.pct) - read(second.pct) < CLOSE_CALL_RULE.topTwoWithinPts) return { kind: 'close', other: second };
  if (read(token.pct) < CLOSE_CALL_RULE.chosenUnderPct) return { kind: 'no_majority', other: second ?? null };
  return { kind: 'clear', other: second ?? null };
}

/** The copy's view of a pick: the chosen token, its percentage, and the option to compare it with. */
export function pickCopy(token: OutputToken): PickCopy {
  const { kind, other } = comparePick(token);
  return { chosen: token.text, pct: token.pct, kind, other: other ? { text: other.text, pct: other.pct } : null };
}

/** The options drawn as their own segments of the pick strip: the top ones, always including the pick. */
export function stripOptions(token: OutputToken, max = 6): readonly Alternative[] {
  const chosenAt = token.alternatives.findIndex((a) => a.isChosen);
  const chosen = token.alternatives[chosenAt];
  return chosen && chosenAt >= max ? [...token.alternatives.slice(0, max - 1), chosen] : token.alternatives.slice(0, max);
}

/** The Hook's moment: the first featured close call, or the first token if there are none. */
export function hookMoment(trace: FinalizedTrace): { token: OutputToken; closeCall: boolean } | null {
  const { featured } = read(trace.closeCalls);
  const index = featured[0];
  const token = index === undefined ? firstToken(trace) : trace.output.tokens[index];
  return token ? { token, closeCall: index !== undefined } : null;
}

// ---------------------------------------------------------------------------------------------------
// Seeded examples (CLAUDE.md A10, L3). Stable per turn, always labeled Example, never shown as numbers.

function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Mulberry32: a small deterministic PRNG. */
export function prng(seed: string): () => number {
  let a = hash(seed);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const exampleVectors = (seed: string, count: number, dims: number): Sourced<number[][], 'example'> =>
  illustrate('embedding-vector', seed, [], () => {
    const r = prng(`vectors:${seed}`);
    return Array.from({ length: count }, () => Array.from({ length: dims }, () => r()));
  });

export const SAMPLE_SENTENCE = ['The', ' cat', ' sat', ' on', ' the', ' mat'] as const;

export const sampleSentence = (): Sourced<readonly string[], 'example'> =>
  illustrate('sample-sentence', 'sample', [], () => SAMPLE_SENTENCE);

/** A neutral sample with a repeat, for the duplicate-token and induction patterns (tokens repeat exactly). */
export const SAMPLE_REPEAT = [' red', ' fox', ' saw', ' a', ' red', ' fox'] as const;

export const repeatSentence = (): Sourced<readonly string[], 'example'> =>
  illustrate('sample-sentence', 'sample-repeat', [], () => SAMPLE_REPEAT);

export const exampleScores = (seed: string, cells: number): Sourced<number[], 'example'> =>
  illustrate('vocab-scores', seed, [], () => {
    const r = prng(`scores:${seed}`);
    return Array.from({ length: cells }, () => r() ** 6);
  });
