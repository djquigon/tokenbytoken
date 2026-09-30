// The token rain claims its glyphs are real tokens: every entry must be exactly one token of the tokenizer
// this app uses, and the pool must have thousands of words and numbers (npm run rain regenerates it).

import { encode } from 'gpt-tokenizer/encoding/o200k_base';
import { describe, expect, it } from 'vitest';

import pool from './rain-tokens.json';

describe('token rain pool', () => {
  it('is thousands of real tokens, words and numbers alike', () => {
    expect(pool.tokens.length).toBeGreaterThanOrEqual(3_000);
    expect(new Set(pool.tokens).size).toBe(pool.tokens.length);
    expect(pool.tokens.filter((t) => /^\d+$/.test(t)).length).toBe(1_000);
    for (const t of pool.tokens) expect(encode(t, { disallowedSpecial: new Set() }), t).toHaveLength(1);
  });
});
