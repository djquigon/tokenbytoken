// OpenAI calls for the capability probe. Records only what later phases need as fixtures:
// event types, sequence numbers, deltas, logprobs, final text/logprobs, usage, status, and
// app-measured timings. Response IDs and obfuscation padding are dropped.

import OpenAI, { APIError } from 'openai';
import type {
  Response,
  ResponseCreateParamsNonStreaming,
  ResponseStreamEvent,
} from 'openai/resources/responses/responses';

import type { FinalLogprob, StreamedLogprob, UsageLike } from './analysis.mts';
import type { Candidate } from './candidates.mts';
import type { ChatMessage } from './prompts.mts';

export interface CallSettings {
  instructions?: string;
  input: string | readonly ChatMessage[];
  maxOutputTokens: number;
  temperature?: number;
  topP?: number;
  /** When set, requests logprobs with this many alternatives per token. */
  topLogprobs?: number;
}

export interface ApiFailure {
  status: number | null;
  code: string | null;
  type: string | null;
  message: string;
}

export interface Usage extends UsageLike {
  total_tokens: number;
  input_tokens_details: { cached_tokens: number; cache_write_tokens?: number };
  output_tokens_details: { reasoning_tokens: number };
}

export interface SanitizedResponse {
  model: string;
  status: string | null;
  incompleteReason: string | null;
  usage: Usage | null;
  text: string;
  refusal: string | null;
  /** Final logprobs with UTF-8 bytes, or null when the response carried none. */
  logprobs: FinalLogprob[] | null;
}

export interface RecordedEvent {
  type: string;
  sequence_number: number | null;
  /** Milliseconds since the request was sent, measured by this script. */
  atMs: number;
  delta?: string;
  logprobs?: StreamedLogprob[];
  text?: string;
  response?: SanitizedResponse;
  error?: { code: string | null; message: string };
}

export interface StreamRecord {
  ok: boolean;
  settings: CallSettings;
  error?: ApiFailure;
  events: RecordedEvent[];
  final: SanitizedResponse | null;
  timing: { createdMs: number | null; firstTextMs: number | null; totalMs: number };
}

export interface CreateRecord {
  ok: boolean;
  settings: CallSettings;
  error?: ApiFailure;
  final: SanitizedResponse | null;
  totalMs: number;
}

export function makeClient(apiKey: string): OpenAI {
  return new OpenAI({ apiKey, maxRetries: 2, timeout: 60_000 });
}

function buildParams(candidate: Candidate, s: CallSettings): ResponseCreateParamsNonStreaming {
  return {
    model: candidate.id,
    ...(s.instructions !== undefined ? { instructions: s.instructions } : {}),
    input: typeof s.input === 'string' ? s.input : s.input.map((m) => ({ role: m.role, content: m.content })),
    max_output_tokens: s.maxOutputTokens,
    ...(s.temperature !== undefined ? { temperature: s.temperature } : {}),
    ...(s.topP !== undefined ? { top_p: s.topP } : {}),
    ...(candidate.reasoningEffort !== null ? { reasoning: { effort: candidate.reasoningEffort } } : {}),
    ...(s.topLogprobs !== undefined
      ? { top_logprobs: s.topLogprobs, include: ['message.output_text.logprobs' as const] }
      : {}),
    store: false,
    truncation: 'disabled',
    safety_identifier: 'tokenbytoken-probe',
  };
}

// Provider error messages can echo a masked key; results are committed, so redact defensively.
const redact = (message: string) => message.replace(/sk-[A-Za-z0-9_*-]+/g, 'sk-[redacted]');

function toFailure(err: unknown): ApiFailure {
  if (err instanceof APIError) {
    return {
      status: typeof err.status === 'number' ? err.status : null,
      code: typeof err.code === 'string' ? err.code : null,
      type: typeof err.type === 'string' ? err.type : null,
      message: redact(err.message),
    };
  }
  return { status: null, code: null, type: null, message: redact(err instanceof Error ? err.message : String(err)) };
}

function sanitizeUsage(usage: Response['usage']): Usage | null {
  if (!usage) return null;
  return {
    input_tokens: usage.input_tokens,
    output_tokens: usage.output_tokens,
    total_tokens: usage.total_tokens,
    input_tokens_details: {
      cached_tokens: usage.input_tokens_details.cached_tokens,
      cache_write_tokens: usage.input_tokens_details.cache_write_tokens,
    },
    output_tokens_details: { reasoning_tokens: usage.output_tokens_details.reasoning_tokens },
  };
}

export function sanitizeResponse(response: Response): SanitizedResponse {
  let text = '';
  let refusal: string | null = null;
  let logprobs: FinalLogprob[] | null = null;
  for (const item of response.output) {
    if (item.type !== 'message') continue;
    for (const part of item.content) {
      if (part.type === 'output_text') {
        text += part.text;
        if (part.logprobs) {
          logprobs ??= [];
          logprobs.push(
            ...part.logprobs.map((lp) => ({
              token: lp.token,
              bytes: lp.bytes,
              logprob: lp.logprob,
              top_logprobs: lp.top_logprobs.map((alt) => ({ token: alt.token, bytes: alt.bytes, logprob: alt.logprob })),
            })),
          );
        }
      } else if (part.type === 'refusal') {
        refusal = (refusal ?? '') + part.refusal;
      }
    }
  }
  return {
    model: response.model,
    status: response.status ?? null,
    incompleteReason: response.incomplete_details?.reason ?? null,
    usage: sanitizeUsage(response.usage),
    text,
    refusal,
    logprobs,
  };
}

function recordEvent(event: ResponseStreamEvent, atMs: number): RecordedEvent {
  const base = { type: event.type, sequence_number: event.sequence_number, atMs: Math.round(atMs * 10) / 10 };
  switch (event.type) {
    case 'response.output_text.delta':
      return {
        ...base,
        delta: event.delta,
        logprobs: event.logprobs.map((lp) => ({
          token: lp.token,
          logprob: lp.logprob,
          ...(lp.top_logprobs ? { top_logprobs: lp.top_logprobs.map((alt) => ({ token: alt.token, logprob: alt.logprob })) } : {}),
        })),
      };
    case 'response.output_text.done':
      return { ...base, text: event.text };
    case 'response.completed':
    case 'response.incomplete':
    case 'response.failed':
      return { ...base, response: sanitizeResponse(event.response) };
    case 'error':
      return { ...base, error: { code: event.code, message: event.message } };
    default:
      return base;
  }
}

export async function streamCall(client: OpenAI, candidate: Candidate, settings: CallSettings): Promise<StreamRecord> {
  const t0 = performance.now();
  const events: RecordedEvent[] = [];
  let createdMs: number | null = null;
  let firstTextMs: number | null = null;
  let final: SanitizedResponse | null = null;
  try {
    const stream = await client.responses.create({
      ...buildParams(candidate, settings),
      stream: true,
      stream_options: { include_obfuscation: false },
    });
    for await (const event of stream) {
      const atMs = performance.now() - t0;
      const recorded = recordEvent(event, atMs);
      events.push(recorded);
      if (event.type === 'response.created') createdMs ??= recorded.atMs;
      if (event.type === 'response.output_text.delta' && event.delta.length > 0) firstTextMs ??= recorded.atMs;
      if (recorded.response) final = recorded.response;
    }
    const totalMs = performance.now() - t0;
    const ok = final !== null && final.status !== 'failed';
    return { ok, settings, events, final, timing: { createdMs, firstTextMs, totalMs } };
  } catch (err) {
    return { ok: false, settings, error: toFailure(err), events, final, timing: { createdMs, firstTextMs, totalMs: performance.now() - t0 } };
  }
}

export async function createCall(client: OpenAI, candidate: Candidate, settings: CallSettings): Promise<CreateRecord> {
  const t0 = performance.now();
  try {
    const response = await client.responses.create(buildParams(candidate, settings));
    const final = sanitizeResponse(response);
    return { ok: final.status !== 'failed', settings, final, totalMs: performance.now() - t0 };
  } catch (err) {
    return { ok: false, settings, error: toFailure(err), final: null, totalMs: performance.now() - t0 };
  }
}

/** Streamed logprob entries, in order, from a recorded stream. */
export function streamedLogprobs(record: StreamRecord): StreamedLogprob[] {
  return record.events.flatMap((e) => (e.type === 'response.output_text.delta' ? (e.logprobs ?? []) : []));
}

/** Text deltas with the logprob entries that arrived alongside them. */
export function textDeltas(record: StreamRecord): { delta: string; logprobs: StreamedLogprob[] }[] {
  return record.events
    .filter((e) => e.type === 'response.output_text.delta')
    .map((e) => ({ delta: e.delta ?? '', logprobs: e.logprobs ?? [] }));
}

/** Number of logprob entries carried by each non-empty text delta. */
export function tokensPerDelta(record: StreamRecord): number[] {
  return record.events
    .filter((e) => e.type === 'response.output_text.delta' && (e.delta?.length ?? 0) > 0)
    .map((e) => e.logprobs?.length ?? 0);
}

export function doneText(record: StreamRecord): string | null {
  return record.events.find((e) => e.type === 'response.output_text.done')?.text ?? null;
}
