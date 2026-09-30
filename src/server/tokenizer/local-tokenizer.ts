// This app's tokenizer (ADR 0001): o200k_base via gpt-tokenizer, server-side only so its ~1 MB of ranks
// stays out of the browser. Its counts are Calculated and the tokenizer is named as assumed.

import 'server-only';

import { encode } from 'gpt-tokenizer/encoding/o200k_base';
import ranks from 'gpt-tokenizer/esm/bpeRanks/o200k_base';

import type { TokenRun } from '@/shared/protocol/v1';
import { utf8Length } from '@/shared/utf8';

export interface LocalTokenizer {
  readonly encoding: 'o200k_base';
  encode(text: string): number[];
  count(text: string): number;
  /** UTF-8 length of each token (tokens can end in the middle of a character). */
  byteLengths(ids: readonly number[]): number[];
  /** The ID of a single token's text, or null if the text isn't exactly one token. */
  lookup(tokenText: string): number | null;
  run(key: string, text: string): TokenRun;
}

// Special-token strings such as <|endoftext|> are ordinary text here, because users can type them
// (CLAUDE.md A13).
const NO_SPECIAL = { disallowedSpecial: new Set<string>() };

const byteLength = (id: number): number => {
  const entry = ranks[id];
  if (typeof entry === 'string') return utf8Length(entry);
  if (Array.isArray(entry)) return entry.length;
  throw new Error(`unknown token id ${id}`);
};

export const o200kTokenizer: LocalTokenizer = {
  encoding: 'o200k_base',
  encode: (text) => encode(text, NO_SPECIAL),
  count: (text) => encode(text, NO_SPECIAL).length,
  byteLengths: (ids) => ids.map(byteLength),
  lookup(tokenText) {
    if (tokenText.length === 0) return null;
    const ids = encode(tokenText, NO_SPECIAL);
    return ids.length === 1 ? (ids[0] ?? null) : null;
  },
  run(key, text) {
    const ids = encode(text, NO_SPECIAL);
    return { key, ids, byteLengths: ids.map(byteLength) };
  },
};
