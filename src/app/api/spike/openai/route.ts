// Phase 0 spike: relays a real OpenAI stream so we can confirm, on the deployed host, that a
// client disconnect aborts the upstream request (PLAN §4, Phase 0). Costs a fraction of a cent
// per call, so it requires SPIKE_ENABLED=1 and the x-spike-token header.
//
//   POST /api/spike/openai   (header x-spike-token: <SPIKE_TOKEN>)
//
// Each request logs exactly one "[spike-openai …]" line when it ends, so the result stays visible in
// Vercel's per-request log grouping. With request cancellation enabled (vercel.json), Vercel may
// terminate the function on disconnect, so the line is written from after().

import { after } from 'next/server';
import OpenAI, { APIUserAbortError } from 'openai';

import { SAFARI_PADDING, SSE_HEADERS, notFound, spikeEnabled, sseWriter, tokenMatches } from '../sse';

export const maxDuration = 60;

const MODEL = process.env.SPIKE_MODEL ?? 'gpt-6-luna';
// Long enough (several seconds) that a stop always lands mid-stream.
const PROMPT = 'Count from 1 to 200, one number per line, with no other text.';

export function POST(request: Request): Response {
  if (!spikeEnabled()) return notFound();
  if (!tokenMatches(request.headers.get('x-spike-token'))) return new Response('Forbidden', { status: 403 });
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return new Response('OPENAI_API_KEY is not configured', { status: 500 });

  const id = crypto.randomUUID().slice(0, 8);
  const started = performance.now();
  const elapsed = () => Math.round(performance.now() - started);
  const upstream = new AbortController();
  const summary = Promise.withResolvers<string>();
  after(async () => console.log(await summary.promise));
  let disconnect: { via: string; at: number } | null = null;
  const onDisconnect = (via: string) => {
    if (disconnect === null) {
      disconnect = { via, at: elapsed() };
      // Safety net: still report if the upstream loop never ends after the disconnect.
      setTimeout(() => summary.resolve(`[spike-openai ${id}] upstream loop still running 5 s after a disconnect via ${via}`), 5_000);
    }
    upstream.abort();
  };
  request.signal.addEventListener('abort', () => onDisconnect('request.signal'));

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const out = sseWriter(controller);
      out.raw(SAFARI_PADDING);
      out.send('open', { id, model: MODEL, t: elapsed() });
      let deltas = 0;
      let terminal: string | null = null;
      let failure: string | null = null;
      try {
        const client = new OpenAI({ apiKey, maxRetries: 0 });
        const stream = await client.responses.create(
          {
            model: MODEL,
            input: PROMPT,
            ...(MODEL.startsWith('gpt-4') ? {} : { reasoning: { effort: 'none' as const } }),
            max_output_tokens: 1000,
            temperature: 1,
            top_p: 1,
            top_logprobs: 20,
            include: ['message.output_text.logprobs'],
            store: false,
            stream: true,
            stream_options: { include_obfuscation: false },
          },
          { signal: upstream.signal },
        );
        out.send('upstream_open', { t: elapsed() });
        for await (const event of stream) {
          if (event.type === 'response.output_text.delta') {
            deltas += 1;
            out.send('delta', { seq: deltas, t: elapsed(), text: event.delta, tokens: event.logprobs.length });
          } else if (event.type === 'response.completed' || event.type === 'response.incomplete') {
            terminal = event.response.status ?? event.type;
            out.send('end', { t: elapsed(), status: event.response.status, usage: event.response.usage });
          }
        }
      } catch (err) {
        if (!(err instanceof APIUserAbortError) && !upstream.signal.aborted) {
          failure = err instanceof Error ? err.message : String(err);
          out.send('error', { t: elapsed(), message: 'upstream error (see server log)' });
        }
      } finally {
        // The SDK may end the stream quietly when aborted instead of throwing, so report how it ended.
        const ended =
          terminal !== null
            ? `finished (${terminal}) at ${elapsed()} ms`
            : failure !== null
              ? `upstream error at ${elapsed()} ms: ${failure}`
              : `upstream stream ended at ${elapsed()} ms without a terminal event (upstream aborted: ${upstream.signal.aborted}${disconnect ? `, ${elapsed() - disconnect.at} ms after the disconnect` : ''}); usage not reported`;
        const detected = disconnect ? `client disconnect detected via ${disconnect.via} at ${disconnect.at} ms` : 'client disconnect: not detected';
        summary.resolve(`[spike-openai ${id}] ${ended}; ${deltas} deltas relayed; ${detected}`);
        out.close();
      }
    },
    cancel() {
      onDisconnect('stream cancel()');
    },
  });

  return new Response(body, { headers: SSE_HEADERS });
}
