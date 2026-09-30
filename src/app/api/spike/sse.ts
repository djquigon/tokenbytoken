// Shared helpers for the Phase 0 streaming spike routes. Spike code is diagnostic only: it is
// disabled unless SPIKE_ENABLED=1 and will be removed or folded into /api/chat in Phase 1.

import { createHash, timingSafeEqual } from 'node:crypto';

export const SSE_HEADERS = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  'X-Accel-Buffering': 'no',
  'X-Content-Type-Options': 'nosniff',
} as const;

/** Safari buffers streamed responses until 1 KB has arrived, so open with a padding comment. */
export const SAFARI_PADDING = `: ${' '.repeat(2048)}\n\n`;

export const spikeEnabled = () => process.env.SPIKE_ENABLED === '1';

export function notFound(): Response {
  return new Response('Not found', { status: 404 });
}

/** Constant-time comparison of the caller's token against SPIKE_TOKEN. */
export function tokenMatches(provided: string | null): boolean {
  const expected = process.env.SPIKE_TOKEN;
  if (!expected || !provided) return false;
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(provided), digest(expected));
}

/** Writes SSE frames and ignores writes after the stream closes (the client may leave mid-write). */
export function sseWriter(controller: ReadableStreamDefaultController<Uint8Array>) {
  const encoder = new TextEncoder();
  let closed = false;
  return {
    raw(text: string) {
      if (closed) return;
      try {
        controller.enqueue(encoder.encode(text));
      } catch {
        closed = true;
      }
    },
    send(event: string, data: unknown) {
      this.raw(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    },
    close() {
      if (closed) return;
      closed = true;
      try {
        controller.close();
      } catch {
        // Already closed or errored because the client went away.
      }
    },
    get closed() {
      return closed;
    },
  };
}
