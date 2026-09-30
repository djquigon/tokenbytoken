// Phase 0 spike: a synthetic SSE stream (no OpenAI calls, no cost) for checking buffering,
// heartbeats, maxDuration, and whether client disconnects reach the server.
//
//   GET /api/spike/stream?events=40&intervalMs=150
//
// Watch the server log for "[spike] ..." lines to see which disconnect signal fired, and when.

import { SAFARI_PADDING, SSE_HEADERS, notFound, spikeEnabled, sseWriter } from '../sse';

export const maxDuration = 60;

const clampInt = (raw: string | null, fallback: number, min: number, max: number) => {
  const n = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

export function GET(request: Request): Response {
  if (!spikeEnabled()) return notFound();
  const url = new URL(request.url);
  const events = clampInt(url.searchParams.get('events'), 40, 1, 600);
  const intervalMs = clampInt(url.searchParams.get('intervalMs'), 150, 10, 2000);
  const id = crypto.randomUUID().slice(0, 8);
  const started = performance.now();
  const elapsed = () => Math.round(performance.now() - started);
  let stop: (() => void) | null = null;

  const log = (message: string) => console.log(`[spike ${id}] ${message}`);
  request.signal.addEventListener('abort', () => {
    log(`request.signal aborted at ${elapsed()} ms`);
    stop?.();
  });

  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const out = sseWriter(controller);
      out.raw(SAFARI_PADDING);
      out.send('open', { id, events, intervalMs, t: elapsed() });
      log(`started: ${events} events every ${intervalMs} ms`);
      let seq = 0;
      let lastWrite = performance.now();
      const timer = setInterval(() => {
        if (out.closed) return;
        seq += 1;
        out.send('tick', { seq, t: elapsed() });
        lastWrite = performance.now();
        if (seq >= events) {
          out.send('end', { seq, t: elapsed() });
          log(`completed at ${elapsed()} ms`);
          stop?.();
        }
      }, intervalMs);
      const heartbeat = setInterval(() => {
        if (performance.now() - lastWrite >= 15_000) out.raw(`: heartbeat ${elapsed()}\n\n`);
      }, 5_000);
      stop = () => {
        clearInterval(timer);
        clearInterval(heartbeat);
        out.close();
      };
    },
    cancel(reason) {
      log(`stream cancel() at ${elapsed()} ms (${String(reason ?? 'no reason')})`);
      stop?.();
    },
  });

  return new Response(body, { headers: SSE_HEADERS });
}
