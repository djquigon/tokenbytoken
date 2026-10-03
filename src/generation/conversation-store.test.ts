import { beforeAll, describe, expect, it } from 'vitest';

import { createChatHandler } from '@/server/chat/handler';
import type { ChatRequestV1 } from '@/shared/protocol/v1';
import { read } from '@/shared/provenance/read';
import { clientMs } from '@/shared/units';
import { body, fixtureUpstream, hello, makeDeps, post, readStream } from '@/test/chat-harness';
import type { TraceLogEntry, TraceLogV1 } from '@/trace/log';

import type { SendTurnOptions } from './client';
import { createConversationStore, historyFor, traceOf, type StoreDeps } from './conversation-store';
import { CONVERSATION_KEY, loadConversation, type KeyValueStorage } from './persist';

let recorded: TraceLogV1;

beforeAll(async () => {
  const { upstream } = fixtureUpstream('stream-basic');
  const { deps, runAfter } = makeDeps(upstream);
  const res = await createChatHandler(deps)(post(body(hello)));
  recorded = (await readStream(res)).log;
  await runAfter();
});

class MemoryStorage implements KeyValueStorage {
  readonly data = new Map<string, string>();
  constructor(private readonly quotaBytes = Infinity) {}
  getItem = (k: string) => this.data.get(k) ?? null;
  setItem = (k: string, v: string) => {
    if (v.length > this.quotaBytes) throw new DOMException('quota', 'QuotaExceededError');
    this.data.set(k, v);
  };
  removeItem = (k: string) => void this.data.delete(k);
}

/** Replays the recorded entries (after request_sent), stopping early if aborted. */
function replaySend(opts: { stopAfter?: number } = {}) {
  const requests: ChatRequestV1[] = [];
  const sendTurn = async (o: SendTurnOptions) => {
    requests.push(o.request);
    o.onEntry({ k: 'request_sent', tc: o.now(), messageIds: o.request.messages.map((m) => m.id), logprobs: true });
    const entries = recorded.entries.filter((e) => e.k !== 'request_sent');
    let n = 0;
    for (const e of entries) {
      if (o.signal.aborted || (opts.stopAfter !== undefined && n >= opts.stopAfter)) {
        o.onEntry({ k: 'user_abort', tc: o.now() });
        return;
      }
      o.onEntry(e as TraceLogEntry);
      n += 1;
      await Promise.resolve();
    }
  };
  return { sendTurn, requests };
}

function makeStore(send: StoreDeps['sendTurn'], storage: KeyValueStorage | null = new MemoryStorage()) {
  let id = 0;
  let t = 0;
  return createConversationStore({
    sendTurn: send,
    now: () => clientMs((t += 1)),
    randomId: () => `00000000-0000-4000-8000-${String((id += 1)).padStart(12, '0')}`,
    storage,
    preferences: null,
    idleTimeoutMs: 45_000,
    scheduleFlush: (flush) => queueMicrotask(flush),
  });
}

describe('conversation store', () => {
  it('isolates a new send from callbacks and cleanup of a cleared request', async () => {
    const pending: { options: SendTurnOptions; finish: () => void }[] = [];
    const storage = new MemoryStorage();
    const store = makeStore((options) => new Promise<void>((finish) => pending.push({ options, finish })), storage);
    store.getState().hydrate();
    const old = store.getState().send('Old question');
    const a = pending[0]!;
    a.options.onEntry({ k: 'request_sent', tc: a.options.now(), messageIds: [], logprobs: true });
    store.getState().clear();
    const next = store.getState().send('New question');
    const b = pending[1]!;
    a.options.onEntry({ k: 'user_abort', tc: a.options.now() });
    a.finish();
    await old;
    expect(a.options.signal.aborted).toBe(true);
    expect(store.getState().streaming).toBe(true);
    expect(store.getState().turns).toHaveLength(1);
    expect(store.getState().turns[0]?.done).toBe(false);
    expect(storage.getItem(CONVERSATION_KEY)).toBeNull();
    store.getState().stop();
    expect(b.options.signal.aborted).toBe(true);
    b.options.onEntry({ k: 'user_abort', tc: b.options.now() });
    b.finish();
    await next;
    expect(store.getState().streaming).toBe(false);
    expect(store.getState().turns[0]?.user.content).toBe('New question');
    expect(store.getState().turns[0]?.done).toBe(true);
  });

  it('sends a turn, keeps the signed reply, and re-sends it next turn', async () => {
    const { sendTurn, requests } = replaySend();
    const store = makeStore(sendTurn);
    store.getState().hydrate();
    await store.getState().send('Why is the sky blue?');
    const [turn] = store.getState().turns;
    expect(turn?.done).toBe(true);
    expect(turn?.assistant?.sig).toMatch(/^v1\./);
    expect(turn?.assistant?.content.length).toBeGreaterThan(20);
    const trace = turn ? traceOf(turn) : null;
    expect(trace && read(trace.outcome)).toBe('completed');

    await store.getState().send('And at sunset?');
    const second = requests[1];
    expect(second?.messages.map((m) => m.role)).toEqual(['user', 'assistant', 'user']);
    expect(second?.messages[1]).toMatchObject({ role: 'assistant', sig: turn?.assistant?.sig });
    expect(second?.conversationId).toBe(requests[0]?.conversationId);
  });

  it('does not re-send a stopped reply, but keeps the question', async () => {
    const { sendTurn, requests } = replaySend({ stopAfter: 10 });
    const store = makeStore(sendTurn);
    store.getState().hydrate();
    await store.getState().send('Why is the sky blue?');
    const [turn] = store.getState().turns;
    const trace = turn ? traceOf(turn) : null;
    expect(trace && read(trace.outcome)).toBe('stopped');
    expect(turn?.assistant?.sig ?? null).toBeNull();
    await store.getState().send('Try again, shorter.');
    expect(requests[1]?.messages.map((m) => m.role)).toEqual(['user', 'user']);
  });

  it('leaves rejected messages out of later requests', () => {
    const turns = [
      { id: 't1', user: { id: 'msg_a', content: 'flagged text' }, log: null, assistant: null, done: true, live: { terminal: 'http_error' } },
      { id: 't2', user: { id: 'msg_b', content: 'fine' }, log: null, assistant: { id: 'msg_c', content: 'ok', sig: 'v1.x' }, done: true, live: { terminal: 'stream_closed' } },
    ] as unknown as Parameters<typeof historyFor>[0];
    expect(historyFor(turns).map((m) => m.id)).toEqual(['msg_b', 'msg_c']);
  });

  it('retries the last turn as a new request', async () => {
    const { sendTurn, requests } = replaySend({ stopAfter: 3 });
    const store = makeStore(sendTurn);
    store.getState().hydrate();
    await store.getState().send('Hello?');
    await store.getState().retryLast();
    expect(store.getState().turns).toHaveLength(1);
    expect(requests).toHaveLength(2);
    expect(requests[1]?.clientRequestId).not.toBe(requests[0]?.clientRequestId);
    expect(requests[1]?.messages).toHaveLength(1);
  });

  it('restores from sessionStorage, marking a mid-stream reload as interrupted', async () => {
    const storage = new MemoryStorage();
    const { sendTurn } = replaySend();
    const store = makeStore(sendTurn, storage);
    store.getState().hydrate();
    await store.getState().send('Why is the sky blue?');

    // Simulate a reload that happened mid-stream: strip the ending from the stored log.
    const saved = loadConversation(storage);
    if (!saved?.turns[0]?.log) throw new Error('expected a stored log');
    const cut = { ...saved.turns[0].log, entries: saved.turns[0].log.entries.slice(0, 12) };
    storage.setItem(CONVERSATION_KEY, JSON.stringify({ ...saved, turns: [{ ...saved.turns[0], assistant: null, log: cut }] }));

    const reloaded = makeStore(sendTurn, storage);
    reloaded.getState().hydrate();
    const [turn] = reloaded.getState().turns;
    expect(reloaded.getState().sessionId).toBe(saved.sessionId);
    expect(turn?.log?.entries.at(-1)?.k).toBe('recovered');
    expect(turn && traceOf(turn)?.interruption).toBe('reload');
  });

  it('ignores corrupted storage', () => {
    const storage = new MemoryStorage();
    storage.setItem(CONVERSATION_KEY, '{"v":1,"turns":"nope"}');
    const store = makeStore(replaySend().sendTurn, storage);
    store.getState().hydrate();
    expect(store.getState().turns).toEqual([]);
    expect(store.getState().sessionId).toMatch(/^ses_/);
  });

  it('drops old logs, not text, when storage runs out', async () => {
    const storage = new MemoryStorage(60_000);
    const { sendTurn } = replaySend();
    const store = makeStore(sendTurn, storage);
    store.getState().hydrate();
    for (const q of ['one', 'two', 'three']) await store.getState().send(q);
    const saved = loadConversation(storage);
    expect(saved?.turns.map((t) => t.user.content)).toEqual(['one', 'two', 'three']);
    expect(saved?.turns.some((t) => t.log === null)).toBe(true);
    expect(store.getState().storageNote).not.toBeNull();
  });

  it('clears everything but the tab session', async () => {
    const storage = new MemoryStorage();
    const store = makeStore(replaySend().sendTurn, storage);
    store.getState().hydrate();
    await store.getState().send('hi');
    const { sessionId, conversationId } = store.getState();
    store.getState().clear();
    expect(store.getState().turns).toEqual([]);
    expect(store.getState().sessionId).toBe(sessionId);
    expect(store.getState().conversationId).not.toBe(conversationId);
    expect(storage.getItem(CONVERSATION_KEY)).toBeNull();
  });
});
