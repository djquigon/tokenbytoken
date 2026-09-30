import fc from 'fast-check';
import { beforeAll, describe, expect, it } from 'vitest';

import { isSourced, kindOf, read } from '@/shared/provenance/read';
import type { Kind } from '@/shared/provenance';
import { clientMs } from '@/shared/units';
import { body, fixtureUpstream, hello, makeDeps, post, readStream } from '@/test/chat-harness';
import { createChatHandler } from '@/server/chat/handler';

import { CLOSE_CALL_RULE } from './close-calls';
import { finalizeTrace } from './finalize';
import type { FinalizedTrace } from './facts';
import { appendEntry, createLog, type TraceLogEntry, type TraceLogV1 } from './log';
import { foldLive } from './reducer';

let complete: TraceLogV1;

async function recordedLog(name: string): Promise<TraceLogV1> {
  const { upstream } = fixtureUpstream(name);
  const { deps, runAfter } = makeDeps(upstream);
  const res = await createChatHandler(deps)(post(body(hello)));
  const { log } = await readStream(res);
  await runAfter();
  return log;
}

beforeAll(async () => {
  complete = await recordedLog('stream-basic');
});

/** Every Sourced value anywhere in the trace, with the path it was found at. */
function sourcedKinds(trace: FinalizedTrace): Map<Kind, string[]> {
  const found = new Map<Kind, string[]>();
  const seen = new Set<unknown>();
  const walk = (x: unknown, path: string) => {
    if (typeof x !== 'object' || x === null || seen.has(x)) return;
    seen.add(x);
    if (isSourced(x)) {
      const k = kindOf(x);
      found.set(k, [...(found.get(k) ?? []), path]);
      return;
    }
    for (const [key, value] of Object.entries(x)) walk(value, `${path}.${key}`);
  };
  walk(trace, 'trace');
  return found;
}

describe('finalizeTrace', () => {
  it('turns a recorded reply into labeled facts, with no Example values anywhere', () => {
    const trace = finalizeTrace(complete);
    const kinds = sourcedKinds(trace);
    expect(kinds.has('example')).toBe(false);
    expect(kinds.get('recorded')?.length).toBeGreaterThan(100);
    expect(kinds.get('reference')?.some((p) => p.includes('contextWindowTokens'))).toBe(true);

    const first = trace.output.tokens[0];
    if (!first) throw new Error('expected tokens');
    expect(kindOf(first.text)).toBe('recorded');
    expect(kindOf(first.logprob)).toBe('recorded');
    expect(kindOf(first.pct)).toBe('calculated');
    expect(kindOf(first.arrival.server)).toBe('recorded');
    expect(first.tokenId && kindOf(first.tokenId)).toBe('calculated');
    expect(first.alternatives).toHaveLength(20);
    expect(read(first.pct)).toBeCloseTo(Math.exp(read(first.logprob)) * 100, 10);
    expect(trace.cost && kindOf(trace.cost.usd)).toBe('calculated');
    expect(trace.timing.durations.browserToFirstText && kindOf(trace.timing.durations.browserToFirstText)).toBe('calculated');
  });

  it('keeps featured close calls honest: each meets the displayed rule', () => {
    const trace = finalizeTrace(complete);
    const { all, featured } = read(trace.closeCalls);
    expect(featured.length).toBeLessThanOrEqual(CLOSE_CALL_RULE.maxFeatured);
    for (const i of featured) {
      expect(all).toContain(i);
      const token = trace.output.tokens[i];
      expect(token && read(token.closeCall)).toBe(true);
    }
  });

  it('folds the same text live as it finalizes', () => {
    const live = foldLive(complete);
    expect(live.phase).toBe('done');
    expect(live.text).toBe(read(finalizeTrace(complete).output.text));
  });

  it('finalizes any truncated log as interrupted, or stopped when the user pressed Stop', () => {
    const endIndex = complete.entries.findIndex((e) => e.k === 'server' && e.ev.type === 'end');
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: endIndex - 1 }),
        fc.constantFrom<TraceLogEntry['k']>('stream_closed', 'network_error', 'idle_timeout', 'recovered', 'user_abort'),
        (cut, terminal) => {
          const prefix: TraceLogV1 = { ...complete, entries: complete.entries.slice(0, cut + 1) };
          const ended = appendEntry(prefix, { k: terminal, tc: clientMs(9_999_999) } as TraceLogEntry);
          const trace = finalizeTrace(ended);
          const outcome = read(trace.outcome);
          if (terminal === 'user_abort') expect(outcome).toBe('stopped');
          else expect(outcome).toBe('interrupted');
          // An unfinished reply is never signed, so it is never re-sent.
          expect(trace.assistant.sig).toBeNull();
          // Whatever arrived is still there, as recorded.
          expect(read(trace.output.text)).toBe(foldLive(ended).text);
        },
      ),
    );
  });

  it('treats a reply with its final event as complete, whatever follows', () => {
    const withAbort = appendEntry({ ...complete, entries: complete.entries.slice(0, -1) }, { k: 'user_abort', tc: clientMs(1) });
    expect(read(finalizeTrace(withAbort).outcome)).toBe('completed');
  });

  it('records a pre-stream rejection with its error and no facts about a reply', () => {
    let log = createLog('req_1', 'cnv_1', 'msg_1');
    log = appendEntry(log, { k: 'request_sent', tc: clientMs(1), messageIds: ['msg_1'], logprobs: true });
    log = appendEntry(log, { k: 'http_error', tc: clientMs(2), status: 429, error: { code: 'rate_limited', retryAfterSec: 30 } });
    const trace = finalizeTrace(log);
    expect(read(trace.outcome)).toBe('rejected');
    expect(trace.error).toEqual({ code: 'rate_limited', retryAfterSec: 30 });
    expect(trace.request).toBeNull();
    expect(trace.cost).toBeNull();
    expect(trace.output.tokens).toEqual([]);
  });

  it('ignores entries after a terminal one', () => {
    const closed = appendEntry(createLog('r', 'c', 'm'), { k: 'network_error', tc: clientMs(1) });
    expect(appendEntry(closed, { k: 'http_ok', tc: clientMs(2) })).toBe(closed);
  });

  it('labels the emoji gaps and never fills them with alternatives', async () => {
    const trace = finalizeTrace(await recordedLog('stream-unicode'));
    const gaps = trace.output.segments.filter((s) => s.kind === 'gap');
    expect(gaps.map((g) => (g.kind === 'gap' ? read(g.gap.text) : ''))).toEqual([' 👋', '🏽', ' 🧑', '🚀']);
    for (const g of gaps) if (g.kind === 'gap') expect(g.gap.estimatedTokens && kindOf(g.gap.estimatedTokens)).toBe('calculated');
    expect(trace.output.tokens.every((t) => t.alternatives.length > 0)).toBe(true);
  });
});
