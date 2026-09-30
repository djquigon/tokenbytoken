import { createHash } from 'node:crypto';

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { APP_ERRORS, APP_ERROR_CODES, isAppErrorCode } from './errors';
import { sha256Hex } from './sha256';
import { spokenTokenText, visibleTokenText } from './token-display';
import { charEndAtOrAfter, charStartAtOrBefore, isCharBoundary, sequenceLength, utf8 } from './utf8';

describe('sha256Hex', () => {
  it('matches known vectors', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('matches node:crypto for any text, including across block boundaries', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'binary', maxLength: 300 }), (text) => {
        expect(sha256Hex(text)).toBe(createHash('sha256').update(text, 'utf8').digest('hex'));
      }),
    );
  });
});

describe('utf8 helpers', () => {
  it('finds character boundaries in multi-byte text', () => {
    const bytes = utf8('a😀b'); // 1 + 4 + 1 bytes
    expect([0, 1, 2, 3, 4, 5, 6].map((i) => isCharBoundary(bytes, i))).toEqual([true, true, false, false, false, true, true]);
    expect(charStartAtOrBefore(bytes, 3)).toBe(1);
    expect(charEndAtOrAfter(bytes, 3)).toBe(5);
    expect(sequenceLength(0xf0)).toBe(4);
    expect(sequenceLength(0x80)).toBe(0);
  });
});

describe('errors', () => {
  it('gives every code copy and a consistent stage', () => {
    for (const code of APP_ERROR_CODES) {
      const spec = APP_ERRORS[code];
      expect(spec.title.length).toBeGreaterThan(0);
      expect(spec.body.length).toBeGreaterThan(0);
      // Pre-stream errors are HTTP responses, so they need a status; the others must not have one.
      expect('status' in spec).toBe(spec.stage === 'pre_stream');
    }
    expect(isAppErrorCode('rate_limited')).toBe(true);
    expect(isAppErrorCode('toString')).toBe(false);
  });
});

describe('token display', () => {
  it('makes whitespace visible and speakable', () => {
    expect(visibleTokenText(' the\n')).toBe('␣the↵');
    expect(spokenTokenText(' the')).toBe('space, "the"');
    expect(spokenTokenText('\n\n')).toBe('newline, newline');
    expect(spokenTokenText('')).toBe('empty');
  });
});
