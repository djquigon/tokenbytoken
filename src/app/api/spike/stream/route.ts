// Phase 0 spike: a synthetic SSE stream (no OpenAI calls, no cost) for checking buffering,
// heartbeats, maxDuration, and whether client disconnects reach the server.
//
//   GET /api/spike/stream?events=40&intervalMs=150
//
// Each request logs exactly one "[spike …]" line when it ends. Vercel's Logs view groups lines per
// request, so a single summary line keeps the result visible there.

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
  let sent = 0;
  let stop: (() => void) | null = null;
  let finished = false;

  const finish = (how: string) => {
    if (finished) return;
    finished = true;
    stop?.();
    console.log(`[spike ${id}] synthetic ${events}×${intervalMs} ms: ${how}; sent ${sent} of ${events} events`);
  };
  request.signal.addEventListener('abort', () => finish(`client disconnect detected via request.signal at ${elapsed()} ms`));

  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const out = sseWriter(controller);
      out.raw(SAFARI_PADDING);
      out.send('open', { id, events, intervalMs, t: elapsed() });
      let lastWrite = performance.now();
      const timer = setInterval(() => {
        if (out.closed) return;
        sent += 1;
        out.send('tick', { seq: sent, t: elapsed() });
        lastWrite = performance.now();
        if (sent >= events) {
          out.send('end', { seq: sent, t: elapsed() });
          finish(`completed at ${elapsed()} ms`);
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
    cancel() {
      finish(`client disconnect detected via stream cancel() at ${elapsed()} ms`);
    },
  });

  return new Response(body, { headers: SSE_HEADERS });
}
