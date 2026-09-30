// Phase 0 spike: relays a real OpenAI stream so we can confirm, on the deployed host, that a
// client disconnect aborts the upstream request (PLAN §4, Phase 0). Costs a fraction of a cent
// per call, so it requires SPIKE_ENABLED=1 and the x-spike-token header.
//
//   POST /api/spike/openai   (header x-spike-token: <SPIKE_TOKEN>)

import OpenAI, { APIUserAbortError } from 'openai';

import { SAFARI_PADDING, SSE_HEADERS, notFound, spikeEnabled, sseWriter, tokenMatches } from '../sse';

export const maxDuration = 60;

const MODEL = process.env.SPIKE_MODEL ?? 'gpt-6-luna';
const PROMPT = 'Count from 1 to 60, one number per line, with no other text.';

export function POST(request: Request): Response {
  if (!spikeEnabled()) return notFound();
  if (!tokenMatches(request.headers.get('x-spike-token'))) return new Response('Forbidden', { status: 403 });
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return new Response('OPENAI_API_KEY is not configured', { status: 500 });

  const id = crypto.randomUUID().slice(0, 8);
  const started = performance.now();
  const elapsed = () => Math.round(performance.now() - started);
  const log = (message: string) => console.log(`[spike-openai ${id}] ${message}`);
  const upstream = new AbortController();
  let disconnectedAt: number | null = null;
  const onDisconnect = (via: string) => {
    if (disconnectedAt === null) {
      disconnectedAt = elapsed();
      log(`client disconnected (${via}) at ${disconnectedAt} ms; aborting upstream`);
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
      try {
        const client = new OpenAI({ apiKey, maxRetries: 0 });
        const stream = await client.responses.create(
          {
            model: MODEL,
            input: PROMPT,
            ...(MODEL.startsWith('gpt-4') ? {} : { reasoning: { effort: 'none' as const } }),
            max_output_tokens: 400,
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
          log(`upstream error at ${elapsed()} ms: ${err instanceof Error ? err.message : String(err)}`);
          out.send('error', { t: elapsed(), message: 'upstream error (see server log)' });
        }
      } finally {
        // The SDK may end the stream quietly when aborted instead of throwing, so always report how it ended.
        const sinceDisconnect = disconnectedAt === null ? 'no disconnect seen' : `${elapsed() - disconnectedAt} ms after disconnect`;
        log(
          terminal !== null
            ? `finished (${terminal}) at ${elapsed()} ms after ${deltas} deltas`
            : `stream loop ended at ${elapsed()} ms without a terminal event (upstream aborted: ${upstream.signal.aborted}; ${sinceDisconnect}); ${deltas} deltas relayed; usage not reported`,
        );
        out.close();
      }
    },
    cancel(reason) {
      onDisconnect(`stream cancel(): ${String(reason ?? 'no reason')}`);
    },
  });

  return new Response(body, { headers: SSE_HEADERS });
}
