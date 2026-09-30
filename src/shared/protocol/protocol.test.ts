import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { REQUEST_LIMITS } from '../limits';
import { SseParser, formatSseComment, formatSseMessage, SSE_PADDING } from './sse';
import { chatRequestSchema, parseServerEvent } from './v1';

describe('SseParser', () => {
  const messages = ['{"a":1}', '{"b":"x y"}', '{"c":"😀"}'];
  const stream = SSE_PADDING + messages.map((m, i) => formatSseMessage(i, m)).join(formatSseComment('heartbeat'));

  it('parses a stream fed in one piece', () => {
    const p = new SseParser();
    expect(p.feed(stream).map((m) => m.data)).toEqual(messages);
    expect(p.end()).toEqual({ discardedPartial: false });
  });

  it('parses the same stream however it is chunked', () => {
    fc.assert(
      fc.property(fc.array(fc.nat(stream.length), { maxLength: 20 }), (cuts) => {
        const points = [...new Set(cuts)].sort((a, b) => a - b);
        const p = new SseParser();
        const out: string[] = [];
        let prev = 0;
        for (const c of [...points, stream.length]) {
          out.push(...p.feed(stream.slice(prev, c)).map((m) => m.data));
          prev = c;
        }
        expect(out).toEqual(messages);
      }),
    );
  });

  it('handles CR, CRLF (even split across chunks), multi-line data, ids, and a BOM', () => {
    const p = new SseParser();
    const out = [
      ...p.feed('﻿id: 7\r'),
      ...p.feed('\ndata: one\rdata: two\r\n\r'),
      ...p.feed('\nevent: x\ndata:three\n\n'),
    ];
    expect(out).toEqual([
      { id: '7', event: null, data: 'one\ntwo' },
      { id: '7', event: 'x', data: 'three' },
    ]);
  });

  it('discards an unterminated final message', () => {
    const p = new SseParser();
    expect(p.feed('data: partial')).toEqual([]);
    expect(p.end()).toEqual({ discardedPartial: true });
  });

  it('refuses to frame data that contains a newline', () => {
    expect(() => formatSseMessage(1, 'a\nb')).toThrow();
  });
});

describe('chatRequestSchema', () => {
  const ok = {
    v: 1,
    clientRequestId: 'req_12345678',
    sessionId: 'ses_12345678',
    conversationId: 'cnv_12345678',
    messages: [{ role: 'user', id: 'msg_12345678', content: 'Hello' }],
    options: { logprobs: true },
  };

  it('accepts a minimal request', () => {
    expect(chatRequestSchema.safeParse(ok).success).toBe(true);
  });

  it('rejects client-supplied system prompts, models, or tools', () => {
    expect(chatRequestSchema.safeParse({ ...ok, model: 'gpt-x' }).success).toBe(false);
    expect(chatRequestSchema.safeParse({ ...ok, messages: [{ role: 'system', id: 'msg_12345678', content: 'x' }] }).success).toBe(false);
    expect(chatRequestSchema.safeParse({ ...ok, options: { logprobs: true, tools: [] } }).success).toBe(false);
  });

  it('requires the last message to be from the user, unique IDs, and bounded sizes', () => {
    const assistant = { role: 'assistant', id: 'msg_abcdefgh', content: 'Hi', sig: 'v1.x' };
    expect(chatRequestSchema.safeParse({ ...ok, messages: [...ok.messages, assistant] }).success).toBe(false);
    expect(chatRequestSchema.safeParse({ ...ok, messages: [...ok.messages, ...ok.messages] }).success).toBe(false);
    const long = 'x'.repeat(REQUEST_LIMITS.maxMessageChars + 1);
    expect(chatRequestSchema.safeParse({ ...ok, messages: [{ ...ok.messages[0], content: long }] }).success).toBe(false);
    expect(chatRequestSchema.safeParse({ ...ok, messages: [{ ...ok.messages[0], content: '' }] }).success).toBe(false);
  });

  it('rejects assistant turns without a signature', () => {
    const unsigned = { role: 'assistant', id: 'msg_abcdefgh', content: 'Hi' };
    const messages = [unsigned, { role: 'user', id: 'msg_12345678', content: 'Hello' }];
    expect(chatRequestSchema.safeParse({ ...ok, messages }).success).toBe(false);
  });
});

describe('parseServerEvent', () => {
  it('validates known events and skips unknown types', () => {
    const delta = { v: 1, seq: 3, t: 12.5, type: 'delta', channel: 'text', text: 'Hi', logprobs: [], upstreamSeq: 4 };
    const parsed = parseServerEvent(JSON.stringify(delta));
    expect(parsed.ok && parsed.event.type).toBe('delta');
    expect(parseServerEvent(JSON.stringify({ ...delta, type: 'future_event' }))).toEqual({ ok: false, reason: 'unknown_type' });
    expect(parseServerEvent(JSON.stringify({ ...delta, seq: -1 }))).toEqual({ ok: false, reason: 'invalid' });
    expect(parseServerEvent('not json')).toEqual({ ok: false, reason: 'invalid' });
  });
});
