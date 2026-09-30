// Sends one turn to /api/chat and records everything that happens as TraceLog entries: the request,
// the HTTP result, every server event with its arrival time and network read, and how the stream ended.
// Stop is an AbortController; a watchdog ends a stream that goes silent (heartbeats count as activity).

import { z } from 'zod';

import { SseParser } from '@/shared/protocol/sse';
import { appErrorSchema, parseServerEvent, type ChatRequestV1 } from '@/shared/protocol/v1';
import type { ClientMs } from '@/shared/units';
import type { TraceLogEntry } from '@/trace/log';

export interface SendTurnOptions {
  readonly request: ChatRequestV1;
  readonly signal: AbortSignal;
  /** End the stream as interrupted after this long with no bytes at all. */
  readonly idleTimeoutMs: number;
  readonly now: () => ClientMs;
  readonly onEntry: (entry: TraceLogEntry) => void;
  readonly fetchImpl?: typeof fetch;
  readonly endpoint?: string;
}

const errorBodySchema = z.object({ error: appErrorSchema });

async function readAppError(res: Response) {
  try {
    const parsed = errorBodySchema.safeParse(await res.json());
    return parsed.success ? parsed.data.error : null;
  } catch {
    return null;
  }
}

export async function sendTurn(opts: SendTurnOptions): Promise<void> {
  const { request, signal, now, onEntry } = opts;
  const doFetch = opts.fetchImpl ?? fetch;
  onEntry({ k: 'request_sent', tc: now(), messageIds: request.messages.map((m) => m.id), logprobs: request.options.logprobs });

  let res: Response;
  try {
    res = await doFetch(opts.endpoint ?? '/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request),
      signal,
    });
  } catch {
    onEntry(signal.aborted ? { k: 'user_abort', tc: now() } : { k: 'network_error', tc: now() });
    return;
  }

  if (!res.ok) {
    const error = await readAppError(res);
    onEntry({ k: 'http_error', tc: now(), status: res.status, error });
    return;
  }
  if (!(res.headers.get('content-type') ?? '').includes('text/event-stream') || !res.body) {
    onEntry({ k: 'protocol_error', tc: now(), detail: 'bad_response' });
    return;
  }
  onEntry({ k: 'http_ok', tc: now() });

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const parser = new SseParser();
  let idle = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const arm = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      idle = true;
      void reader.cancel().catch(() => undefined);
    }, opts.idleTimeoutMs);
  };

  let readIndex = 0;
  let lastSeq = 0;
  try {
    arm();
    for (;;) {
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await reader.read();
      } catch {
        onEntry(signal.aborted ? { k: 'user_abort', tc: now() } : idle ? { k: 'idle_timeout', tc: now() } : { k: 'network_error', tc: now() });
        return;
      }
      if (chunk.done) break;
      arm();
      readIndex += 1;
      const tc = now();
      for (const message of parser.feed(decoder.decode(chunk.value, { stream: true }))) {
        const parsed = parseServerEvent(message.data);
        if (!parsed.ok) {
          if (parsed.reason === 'unknown_type') {
            onEntry({ k: 'unknown_event', tc });
            continue;
          }
          onEntry({ k: 'protocol_error', tc, detail: 'invalid_event' });
          await reader.cancel().catch(() => undefined);
          return;
        }
        if (parsed.event.seq <= lastSeq) {
          onEntry({ k: 'protocol_error', tc, detail: 'out_of_order' });
          await reader.cancel().catch(() => undefined);
          return;
        }
        lastSeq = parsed.event.seq;
        onEntry({ k: 'server', ev: parsed.event, tc, read: readIndex });
      }
    }
    if (signal.aborted) onEntry({ k: 'user_abort', tc: now() });
    else if (idle) onEntry({ k: 'idle_timeout', tc: now() });
    else onEntry({ k: 'stream_closed', tc: now() });
  } finally {
    clearTimeout(timer);
  }
}
