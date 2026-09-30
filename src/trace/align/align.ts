// Token/text alignment (docs/PLAN.md §3.5, ADR 0003 finding 2). Places each token OpenAI returned on the
// reply text, by UTF-8 bytes.
//
// What the stream gives us:
// - Each delta carries complete characters of text plus the tokens OpenAI returned for it (usually one).
// - Some deltas carry text with no tokens at all (observed for some emoji). Those become gaps: the text is
//   known, the tokens are not, and nothing is filled in.
// - Streamed token strings have no bytes. A token that ends mid-character can't be represented exactly as
//   a string, so its string may be lossy. OpenAI's final token list has bytes, but it can come back empty.
//
// Per delta, in order of preference:
// 1. The tokens' bytes (final bytes where available, otherwise the string's UTF-8) tile the delta exactly.
// 2. Exactly one token's bytes are unknown: its length is whatever the certain neighbors leave over.
// 3. Otherwise the delta's tokens are kept in order, but their positions inside the delta are unknown.

import { bytesEqual, isCharBoundary, utf8 } from '@/shared/utf8';

export interface AlignDelta {
  readonly text: string;
  /** Token strings OpenAI returned with this delta, or null when logprobs weren't requested. */
  readonly tokens: readonly string[] | null;
}

export interface AlignInput {
  readonly deltas: readonly AlignDelta[];
  /** Bytes for every streamed token, in order, from OpenAI's final list. Ignored if the count differs. */
  readonly finalTokenBytes: readonly (readonly number[])[] | null;
}

export interface TokenSpan {
  readonly kind: 'token';
  /** Index among all streamed tokens. */
  readonly tokenIndex: number;
  readonly deltaIndex: number;
  /** Byte range in the joined text. For `placement: "delta"` this is the whole delta. */
  readonly start: number;
  readonly end: number;
  /** How the range was found. "delta" means only the containing delta is known. */
  readonly placement: 'exact' | 'eliminated' | 'delta';
  /** The token starts or ends in the middle of a character. */
  readonly partialStart: boolean;
  readonly partialEnd: boolean;
  readonly bytesFrom: 'final' | 'string' | 'elimination' | 'unknown';
}

export interface GapSpan {
  readonly kind: 'gap';
  readonly deltaIndex: number;
  readonly start: number;
  readonly end: number;
}

export type AlignSegment = TokenSpan | GapSpan;

export interface AlignResult {
  readonly text: string;
  readonly bytes: Uint8Array;
  /** Tokens and gaps in text order. Empty when logprobs weren't requested. */
  readonly segments: readonly AlignSegment[];
  readonly tokenCount: number;
  /** True when every piece of text is covered by tokens OpenAI returned (false when logprobs were off). */
  readonly coveredFully: boolean;
  readonly usedFinalBytes: boolean;
  readonly issues: readonly AlignIssue[];
}

export type AlignIssue =
  | { readonly kind: 'final_bytes_count_mismatch'; readonly expected: number; readonly got: number }
  | { readonly kind: 'unplaced_tokens'; readonly deltaIndex: number };

const REPLACEMENT = '�';

export function alignTokens(input: AlignInput): AlignResult {
  const text = input.deltas.map((d) => d.text).join('');
  const bytes = utf8(text);
  const totalTokens = input.deltas.reduce((n, d) => n + (d.tokens?.length ?? 0), 0);
  const issues: AlignIssue[] = [];

  let finalBytes: readonly (readonly number[])[] | null = input.finalTokenBytes;
  if (finalBytes && finalBytes.length !== totalTokens) {
    // An empty final list is expected when some text came without tokens; don't report that.
    if (finalBytes.length > 0) issues.push({ kind: 'final_bytes_count_mismatch', expected: totalTokens, got: finalBytes.length });
    finalBytes = null;
  }

  const segments: AlignSegment[] = [];
  let offset = 0;
  let tokenIndex = 0;
  let coveredFully = true;
  const logprobsRequested = input.deltas.some((d) => d.tokens !== null);

  input.deltas.forEach((delta, deltaIndex) => {
    const deltaBytes = utf8(delta.text);
    const start = offset;
    const end = offset + deltaBytes.length;
    offset = end;
    if (!logprobsRequested) return;
    const tokens = delta.tokens ?? [];
    if (tokens.length === 0) {
      if (deltaBytes.length > 0) {
        segments.push({ kind: 'gap', deltaIndex, start, end });
        coveredFully = false;
      }
      return;
    }

    const firstToken = tokenIndex;
    tokenIndex += tokens.length;
    const candidates = tokens.map((token, i) => {
      const fromFinal = finalBytes?.[firstToken + i];
      if (fromFinal) return { bytes: Uint8Array.from(fromFinal), from: 'final' as const };
      if (token.includes(REPLACEMENT) && !delta.text.includes(REPLACEMENT)) return { bytes: null, from: 'unknown' as const };
      return { bytes: utf8(token), from: 'string' as const };
    });

    const placed = tile(bytes, start, end, candidates.map((c) => c.bytes));
    if (placed) {
      placed.forEach(([s, e], i) => {
        const c = candidates[i];
        segments.push({
          kind: 'token',
          tokenIndex: firstToken + i,
          deltaIndex,
          start: s,
          end: e,
          placement: c?.bytes ? 'exact' : 'eliminated',
          partialStart: !isCharBoundary(bytes, s),
          partialEnd: !isCharBoundary(bytes, e),
          bytesFrom: c?.bytes ? (c.from === 'final' ? 'final' : 'string') : 'elimination',
        });
      });
      return;
    }

    issues.push({ kind: 'unplaced_tokens', deltaIndex });
    tokens.forEach((_, i) => {
      segments.push({
        kind: 'token',
        tokenIndex: firstToken + i,
        deltaIndex,
        start,
        end,
        placement: 'delta',
        partialStart: false,
        partialEnd: false,
        bytesFrom: 'unknown',
      });
    });
  });

  return {
    text,
    bytes,
    segments,
    tokenCount: totalTokens,
    coveredFully: logprobsRequested ? coveredFully : text.length === 0,
    usedFinalBytes: finalBytes !== null && totalTokens > 0,
    issues,
  };
}

/**
 * Lays token byte strings end to end over bytes[start, end). At most one entry may be null (unknown); it
 * takes whatever length the others leave. Returns the ranges, or null if they don't fit exactly.
 */
function tile(
  bytes: Uint8Array,
  start: number,
  end: number,
  parts: readonly (Uint8Array | null)[],
): [number, number][] | null {
  const unknown = parts.filter((p) => p === null).length;
  if (unknown > 1) return null;
  const known = parts.reduce((n, p) => n + (p?.length ?? 0), 0);
  const leftover = end - start - known;
  if (unknown === 0 ? leftover !== 0 : leftover <= 0) return null;
  const out: [number, number][] = [];
  let cursor = start;
  for (const p of parts) {
    const len = p ? p.length : leftover;
    if (p && !bytesEqual(bytes, cursor, p)) return null;
    out.push([cursor, cursor + len]);
    cursor += len;
  }
  return cursor === end ? out : null;
}
