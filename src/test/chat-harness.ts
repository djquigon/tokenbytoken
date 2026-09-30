// Test harness for the chat route: a fake OpenAI that replays recorded probe fixtures through the real
// adapter mapping, request builders, and a reader that records the SSE body as a TraceLog.

import { MemoryLimitsStore } from '@/server/limits/memory-store';
import type { LimitsPolicy } from '@/server/limits/store';
import { UpstreamAborted, UpstreamFailure, buildResponsesBody, mapStreamEvent, type Upstream, type UpstreamEvent } from '@/server/openai/adapter';
import type { SigningKeys } from '@/server/signing/signing';
import { o200kTokenizer } from '@/server/tokenizer/local-tokenizer';
import { SseParser } from '@/shared/protocol/sse';
import { parseServerEvent, type ServerEventV1 } from '@/shared/protocol/v1';
import { clientMs } from '@/shared/units';
import { createLog, type TraceLogEntry, type TraceLogV1 } from '@/trace/log';
import { readProbeFixture, sdkEventsFromFixture } from '@/test/probe-fixtures';

import type { ChatDeps } from '@/server/chat/handler';

export const KEYS: SigningKeys = { current: 'test-signing-secret-that-is-long-enough-0001', previous: null };
export const NOW = Date.UTC(2026, 8, 30, 12, 0, 0);
export const POLICY: LimitsPolicy = {
  sessionPerDay: 30,
  ipPerMinute: 30,
  ipPerDay: 300,
  dailyBudgetMicroUsd: 550_000,
  ipDailyBudgetMicroUsd: 150_000,
  lockTtlMs: 75_000,
  reservationTtlSec: 172_800,
};

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A fake OpenAI that replays SDK-shaped events through the real adapter mapping. */
export function fixtureUpstream(
  name: string,
  opts: { delayMs?: number; flagged?: boolean; failBeforeOutput?: UpstreamFailure; hang?: boolean; endless?: boolean } = {},
) {
  const seen: { aborted: boolean; generateCalls: number; moderated: string[][] } = { aborted: false, generateCalls: 0, moderated: [] };
  const events = sdkEventsFromFixture(readProbeFixture('gpt-6-luna', name));
  const upstream: Upstream = {
    describe: (req) => ({ endpoint: 'POST /v1/responses', body: buildResponsesBody(req) as unknown as Record<string, unknown> }),
    async *generate(req, signal) {
      seen.generateCalls += 1;
      if (opts.failBeforeOutput) throw opts.failBeforeOutput;
      yield { kind: 'open' } satisfies UpstreamEvent;
      if (opts.hang) {
        await new Promise<void>((resolve) => signal.addEventListener('abort', () => resolve()));
        seen.aborted = true;
        throw new UpstreamAborted();
      }
      const list = opts.endless
        ? function* () {
            const delta = events.find((e) => e.event.type === 'response.output_text.delta');
            yield* events.slice(0, 2);
            for (;;) if (delta) yield delta;
          }
        : function* () {
            yield* events;
          };
      for (const { event } of list()) {
        if (signal.aborted) {
          seen.aborted = true;
          throw new UpstreamAborted();
        }
        if (opts.delayMs) await sleep(opts.delayMs);
        const mapped = mapStreamEvent(event, req.settings.topLogprobs !== null);
        if (mapped) yield mapped;
      }
    },
    async moderate(texts) {
      seen.moderated.push([...texts]);
      return { model: 'omni-moderation-2024-09-26', flagged: opts.flagged ?? false };
    },
  };
  return { upstream, seen };
}

export function makeDeps(upstream: Upstream | null, over: Partial<ChatDeps> = {}) {
  const tasks: (() => Promise<void>)[] = [];
  const logs: Record<string, unknown>[] = [];
  let n = 0;
  const store = new MemoryLimitsStore();
  const deps: ChatDeps = {
    upstream,
    store,
    keys: KEYS,
    tokenizer: o200kTokenizer,
    botCheck: async () => ({ isBot: false }),
    after: (task) => tasks.push(task),
    nowMs: () => NOW,
    monotonicMs: () => performance.now(),
    randomId: () => `id-${String((n += 1)).padStart(8, '0')}`,
    log: (entry) => logs.push({ ...entry }),
    allowedOrigins: [],
    limits: POLICY,
    ...over,
  };
  return { deps, tasks, logs, store, runAfter: () => Promise.all(tasks.map((t) => t())) };
}

export interface Msg {
  role: 'user' | 'assistant';
  id: string;
  content: string;
  sig?: string;
}

export const body = (messages: Msg[], over: Record<string, unknown> = {}) =>
  JSON.stringify({
    v: 1,
    clientRequestId: 'req_00000001',
    sessionId: 'ses_00000001',
    conversationId: 'cnv_00000001',
    messages,
    options: { logprobs: true },
    ...over,
  });

export const post = (payload: string, init: { signal?: AbortSignal; headers?: Record<string, string> } = {}) =>
  new Request('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { origin: 'http://localhost:3000', host: 'localhost:3000', 'content-type': 'application/json', ...init.headers },
    body: payload,
    signal: init.signal,
  });

export const hello: Msg[] = [{ role: 'user', id: 'msg_00000001', content: 'In two or three sentences, explain why the sky looks blue.' }];

/** Reads the SSE body the way the browser does, and records it as a TraceLog. */
export async function readStream(res: Response, onEvent?: (ev: ServerEventV1, count: number) => void): Promise<{ events: ServerEventV1[]; log: TraceLogV1 }> {
  let log = createLog('req_00000001', 'cnv_00000001', 'msg_00000001');
  const push = (e: TraceLogEntry) => {
    log = { ...log, entries: [...log.entries, e] };
  };
  let tc = 1_000;
  push({ k: 'request_sent', tc: clientMs(tc), messageIds: ['msg_00000001'], logprobs: true });
  push({ k: 'http_ok', tc: clientMs((tc += 5)) });
  const events: ServerEventV1[] = [];
  const parser = new SseParser();
  const decoder = new TextDecoder();
  const reader = res.body?.getReader();
  let readIndex = 0;
  for (;;) {
    const chunk = await reader?.read();
    if (!chunk || chunk.done) break;
    readIndex += 1;
    tc += 3;
    for (const m of parser.feed(decoder.decode(chunk.value, { stream: true }))) {
      const parsed = parseServerEvent(m.data);
      if (!parsed.ok) throw new Error(`bad event: ${parsed.reason}`);
      events.push(parsed.event);
      push({ k: 'server', ev: parsed.event, tc: clientMs(tc), read: readIndex });
      onEvent?.(parsed.event, events.length);
    }
  }
  push({ k: 'stream_closed', tc: clientMs((tc += 1)) });
  return { events, log };
}

