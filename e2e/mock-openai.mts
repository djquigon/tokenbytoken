// A stand-in for OpenAI's API in end-to-end tests. The app's server reaches it through OPENAI_BASE_URL,
// so the real adapter parses real-shaped SSE. Replies replay the Phase 0 probe fixtures.
//
// Scenarios are chosen by a keyword in the newest user message:
//   UNICODE  → the emoji fixture (text without alternatives)
//   SLOW     → an endless stream, one delta every 60 ms, until the client disconnects
//   CUTOFF   → a few deltas, then the connection ends with no final event
//   FAIL_429 → HTTP 429 rate limit before any output
//   QUOTA    → HTTP 429 spend cap (organization_spend_limit_exceeded)
//   FLAG_ME  → the moderation model flags the message
//
//   node e2e/mock-openai.mts   (port from MOCK_OPENAI_PORT, default 3299)

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import { readProbeFixture, sdkEventsFromFixture } from '../src/test/probe-fixtures.ts';

const PORT = Number(process.env.MOCK_OPENAI_PORT ?? 3299);
const basic = sdkEventsFromFixture(readProbeFixture('gpt-6-luna', 'stream-basic'));
const unicode = sdkEventsFromFixture(readProbeFixture('gpt-6-luna', 'stream-unicode'));
const requests: { path: string; body: unknown }[] = [];

const readJson = (req: IncomingMessage): Promise<unknown> =>
  new Promise((resolve) => {
    let raw = '';
    req.on('data', (c: Buffer) => (raw += c.toString('utf8')));
    req.on('end', () => {
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve(null);
      }
    });
  });

const json = (res: ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function lastUserText(body: unknown): string {
  const input = (body as { input?: unknown })?.input;
  if (!Array.isArray(input)) return '';
  const users = input.filter((m): m is { role: string; content: string } => typeof m === 'object' && m !== null && (m as { role?: unknown }).role === 'user');
  return users.at(-1)?.content ?? '';
}

async function stream(res: ServerResponse, events: { event: { type: string } }[], opts: { endless?: boolean; cutAfter?: number } = {}) {
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
  let closed = false;
  res.on('close', () => (closed = true));
  const write = (event: unknown) => {
    const type = (event as { type: string }).type;
    res.write(`event: ${type}\ndata: ${JSON.stringify(event)}\n\n`);
  };
  const deltas = events.filter((e) => e.event.type === 'response.output_text.delta');
  let sent = 0;
  for (const { event } of events) {
    if (closed) return;
    if (event.type === 'response.output_text.delta') {
      if (opts.cutAfter !== undefined && sent >= opts.cutAfter) {
        res.destroy();
        return;
      }
      sent += 1;
      await sleep(15);
    }
    if (opts.endless && event.type === 'response.output_text.done') {
      for (let i = 0; !closed; i += 1) {
        const d = deltas[i % deltas.length];
        if (d) write({ ...d.event, sequence_number: 1000 + i });
        await sleep(60);
      }
      return;
    }
    write(event);
  }
  res.end();
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  if (req.method === 'GET' && url.pathname === '/__requests') return json(res, 200, requests);
  if (req.method === 'GET' && url.pathname === '/health') return json(res, 200, { ok: true });
  const body = await readJson(req);
  requests.push({ path: url.pathname, body });

  if (url.pathname.endsWith('/moderations')) {
    const inputs = (body as { input?: string[] })?.input ?? [];
    const flagged = inputs.some((t) => t.includes('FLAG_ME'));
    return json(res, 200, {
      id: 'modr-mock',
      model: 'omni-moderation-2024-09-26',
      results: inputs.map(() => ({ flagged, categories: {}, category_scores: {}, category_applied_input_types: {} })),
    });
  }

  if (url.pathname.endsWith('/responses')) {
    const text = lastUserText(body);
    if (text.includes('FAIL_429')) return json(res, 429, { error: { message: 'Rate limit reached', type: 'requests', code: 'rate_limit_exceeded', param: null } });
    if (text.includes('QUOTA')) return json(res, 429, { error: { message: 'Spend limit', type: 'insufficient_quota', code: 'organization_spend_limit_exceeded', param: null } });
    if (text.includes('UNICODE')) return stream(res, unicode);
    if (text.includes('SLOW')) return stream(res, basic, { endless: true });
    if (text.includes('CUTOFF')) return stream(res, basic, { cutAfter: 5 });
    return stream(res, basic);
  }

  json(res, 404, { error: { message: 'not found', type: 'invalid_request_error', code: null, param: null } });
});

server.listen(PORT, '127.0.0.1', () => console.log(`mock OpenAI listening on http://127.0.0.1:${PORT}`));
