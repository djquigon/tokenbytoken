import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { hashedKey, safetyIdentifier, signReply, verifyReply, type ReplyFields } from './signing';

const keys = { current: 'current-secret-for-tests-0123456789abcdef', previous: null };
const fields: ReplyFields = { conversationId: 'cnv_1', messageId: 'msg_2', previousUserText: 'Why?', text: 'Because.' };
const NOW = 1_790_000_000;
const DAY = 86_400;

describe('reply signatures', () => {
  it('verifies an untouched reply', () => {
    expect(verifyReply(keys, signReply(keys, fields, NOW), fields, NOW + 60, DAY)).toBe('valid');
  });

  it('rejects any change to the reply, its question, its ID, or its conversation', () => {
    const sig = signReply(keys, fields, NOW);
    fc.assert(
      fc.property(fc.constantFrom<keyof ReplyFields>('conversationId', 'messageId', 'previousUserText', 'text'), fc.string(), (field, value) => {
        fc.pre(value !== fields[field]);
        expect(verifyReply(keys, sig, { ...fields, [field]: value }, NOW, DAY)).toBe('invalid');
      }),
    );
  });

  it('rejects forged, malformed, or future-dated signatures', () => {
    const sig = signReply(keys, fields, NOW);
    const [v, kid, iat, mac] = sig.split('.');
    expect(verifyReply(keys, `${v}.${kid}.${iat}.${(mac ?? '').slice(0, -2)}xx`, fields, NOW, DAY)).toBe('invalid');
    expect(verifyReply(keys, `${v}.${kid}.${Number(iat) + 1}.${mac}`, fields, NOW, DAY)).toBe('invalid');
    expect(verifyReply(keys, 'v1.nope', fields, NOW, DAY)).toBe('invalid');
    expect(verifyReply(keys, signReply(keys, fields, NOW + 3_600), fields, NOW, DAY)).toBe('invalid');
    const other = { current: 'another-secret-for-tests-0123456789abcd', previous: null };
    expect(verifyReply(keys, signReply(other, fields, NOW), fields, NOW, DAY)).toBe('invalid');
  });

  it('reports old signatures as expired rather than invalid', () => {
    expect(verifyReply(keys, signReply(keys, fields, NOW - 2 * DAY), fields, NOW, DAY)).toBe('expired');
  });

  it('keeps accepting the previous key during a rotation', () => {
    const oldSig = signReply(keys, fields, NOW);
    const rotated = { current: 'rotated-secret-for-tests-0123456789abcd', previous: keys.current };
    expect(verifyReply(rotated, oldSig, fields, NOW, DAY)).toBe('valid');
    expect(verifyReply(rotated, signReply(rotated, fields, NOW), fields, NOW, DAY)).toBe('valid');
  });
});

describe('hashed identifiers', () => {
  it('fits OpenAI’s 64-character limit and never contains the raw session ID', () => {
    const id = safetyIdentifier(keys, 'ses_abcdef123456');
    expect(id.length).toBeLessThanOrEqual(64);
    expect(id).not.toContain('abcdef123456');
    expect(safetyIdentifier(keys, 'ses_abcdef123456')).toBe(id);
  });

  it('gives different keys for different purposes and values', () => {
    expect(hashedKey(keys, 'ip', '203.0.113.9')).not.toBe(hashedKey(keys, 'session', '203.0.113.9'));
    expect(hashedKey(keys, 'ip', '203.0.113.9')).not.toBe(hashedKey(keys, 'ip', '203.0.113.10'));
    expect(hashedKey(keys, 'ip', '203.0.113.9')).not.toContain('203');
  });
});
