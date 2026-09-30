'use client';

import { useRef, useState } from 'react';

interface Row {
  event: string;
  /** Server-side milliseconds since the request started (from the event payload). */
  serverMs: number | null;
  /** Browser-side milliseconds since fetch() was called. */
  clientMs: number;
  detail: string;
}

interface Frame {
  event: string;
  data: unknown;
}

function parseFrame(frame: string): Frame | null {
  let event = 'message';
  const data: string[] = [];
  for (const line of frame.split('\n')) {
    if (line.startsWith(':')) continue; // padding or heartbeat comment
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
  }
  if (data.length === 0) return null;
  try {
    return { event, data: JSON.parse(data.join('\n')) as unknown };
  } catch {
    return { event, data: data.join('\n') };
  }
}

function describe(data: unknown): { serverMs: number | null; detail: string } {
  if (typeof data !== 'object' || data === null) return { serverMs: null, detail: String(data) };
  const entries = Object.entries(data as Record<string, unknown>);
  const t = entries.find(([key]) => key === 't')?.[1];
  const rest = Object.fromEntries(entries.filter(([key]) => key !== 't'));
  return { serverMs: typeof t === 'number' ? t : null, detail: JSON.stringify(rest) };
}

/** Streaming is progressive if arrivals are spread out at least half as much as the server's sends. */
function progressive(rows: readonly Row[]): string {
  const timed = rows.filter((r) => r.serverMs !== null);
  const first = timed[0];
  const last = timed[timed.length - 1];
  if (!first || !last || first === last || first.serverMs === null || last.serverMs === null) return 'not enough events yet';
  const serverSpread = last.serverMs - first.serverMs;
  const clientSpread = last.clientMs - first.clientMs;
  if (serverSpread < 200) return 'server spread too short to judge';
  return clientSpread >= serverSpread * 0.5
    ? `yes: arrivals spread over ${Math.round(clientSpread)} ms vs ${Math.round(serverSpread)} ms of sending`
    : `NO: arrivals bunched into ${Math.round(clientSpread)} ms vs ${Math.round(serverSpread)} ms of sending (buffered)`;
}

/** How many SSE events each network read delivered: OpenAI sends one token per event, but the network can group them. */
function readsSummary(eventsPerRead: readonly number[]): string {
  if (eventsPerRead.length === 0) return 'no reads yet';
  const counts = new Map<number, number>();
  for (const n of eventsPerRead) counts.set(n, (counts.get(n) ?? 0) + 1);
  return [...counts.entries()]
    .sort(([a], [b]) => a - b)
    .map(([events, reads]) => `${reads} read(s) carried ${events} event(s)`)
    .join(', ');
}

export function SpikeClient() {
  const [rows, setRows] = useState<Row[]>([]);
  const [eventsPerRead, setEventsPerRead] = useState<number[]>([]);
  const [status, setStatus] = useState('Idle.');
  const [events, setEvents] = useState(40);
  const [intervalMs, setIntervalMs] = useState(150);
  const [token, setToken] = useState('');
  const controllerRef = useRef<AbortController | null>(null);

  async function run(kind: 'synthetic' | 'openai') {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setRows([]);
    setEventsPerRead([]);
    const t0 = performance.now();
    const since = () => Math.round(performance.now() - t0);
    setStatus('Connecting…');
    try {
      const response =
        kind === 'synthetic'
          ? await fetch(`/api/spike/stream?events=${events}&intervalMs=${intervalMs}`, { signal: controller.signal })
          : await fetch('/api/spike/openai', { method: 'POST', headers: { 'x-spike-token': token }, signal: controller.signal });
      if (!response.ok || !response.body) {
        setStatus(`HTTP ${response.status} after ${since()} ms.`);
        return;
      }
      setStatus(`Streaming (headers after ${since()} ms)…`);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let framesThisRead = 0;
        for (let end = buffer.indexOf('\n\n'); end >= 0; end = buffer.indexOf('\n\n')) {
          const frame = parseFrame(buffer.slice(0, end));
          buffer = buffer.slice(end + 2);
          if (!frame) continue;
          framesThisRead += 1;
          const clientMs = performance.now() - t0;
          setRows((prev) => [...prev, { event: frame.event, clientMs, ...describe(frame.data) }]);
        }
        if (framesThisRead > 0) setEventsPerRead((prev) => [...prev, framesThisRead]);
      }
      setStatus(`Stream ended after ${since()} ms.`);
    } catch (err) {
      setStatus(controller.signal.aborted ? `Stopped by you after ${since()} ms.` : `Error after ${since()} ms: ${String(err)}`);
    }
  }

  function stop() {
    controllerRef.current?.abort();
  }

  return (
    <main className="mx-auto max-w-4xl p-4 font-mono text-sm">
      <h1 className="mb-2 text-lg font-bold">Streaming spike (Phase 0 diagnostic)</h1>
      <p className="mb-4">
        Not part of the product. Checks that streamed events arrive progressively in this browser and that pressing
        Stop reaches the server. Server-side results appear in the function logs as <code>[spike …]</code> lines.
      </p>

      <fieldset className="mb-4 flex flex-wrap items-end gap-3 border p-3">
        <legend>Synthetic stream (no API cost)</legend>
        <label className="flex flex-col">
          Events
          <input className="border px-2 py-1" type="number" min={1} max={600} value={events} onChange={(e) => setEvents(Number(e.target.value))} />
        </label>
        <label className="flex flex-col">
          Interval (ms)
          <input className="border px-2 py-1" type="number" min={10} max={2000} value={intervalMs} onChange={(e) => setIntervalMs(Number(e.target.value))} />
        </label>
        <button className="border px-3 py-1" type="button" onClick={() => void run('synthetic')}>
          Start synthetic stream
        </button>
      </fieldset>

      <fieldset className="mb-4 flex flex-wrap items-end gap-3 border p-3">
        <legend>Real OpenAI stream (costs a fraction of a cent)</legend>
        <label className="flex flex-col">
          Spike token
          <input className="border px-2 py-1" type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} />
        </label>
        <button className="border px-3 py-1" type="button" onClick={() => void run('openai')} disabled={token.length === 0}>
          Start OpenAI stream
        </button>
      </fieldset>

      <div className="mb-4 flex items-center gap-3">
        <button className="border px-3 py-1" type="button" onClick={stop}>
          Stop
        </button>
        <p role="status" aria-live="polite">
          {status}
        </p>
      </div>
      <p className="mb-2">Progressive delivery: {progressive(rows)}</p>
      <p className="mb-2">Network grouping: {readsSummary(eventsPerRead)}</p>

      <table className="w-full border-collapse text-left">
        <caption className="sr-only">Events received, with server send time and browser arrival time</caption>
        <thead>
          <tr>
            <th className="border px-2">#</th>
            <th className="border px-2">Event</th>
            <th className="border px-2">Sent (server ms)</th>
            <th className="border px-2">Arrived (browser ms)</th>
            <th className="border px-2">Data</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              <td className="border px-2">{i + 1}</td>
              <td className="border px-2">{row.event}</td>
              <td className="border px-2">{row.serverMs ?? ''}</td>
              <td className="border px-2">{Math.round(row.clientMs)}</td>
              <td className="border px-2 break-all">{row.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
