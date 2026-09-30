// The only module that knows OpenAI's request and event shapes (CLAUDE.md §4). It builds the Responses API
// request, maps stream events to provider-agnostic UpstreamEvents, and maps SDK errors to AppErrorCodes.
// Facts verified 2026-09-30 against the SDK types (openai 7.25) and developers.openai.com.

import 'server-only';

import OpenAI, { APIConnectionError, APIConnectionTimeoutError, APIError, APIUserAbortError } from 'openai';
import type {
  Response as OpenAIResponse,
  ResponseCreateParamsStreaming,
  ResponseStreamEvent,
  ResponseUsage,
} from 'openai/resources/responses/responses';

import type { AppErrorCode } from '@/shared/errors';
import type { WireLogprob, WireUsage } from '@/shared/protocol/v1';

export interface GenerationSettings {
  readonly model: string;
  readonly reasoningEffort: 'none' | null;
  readonly temperature: number | null;
  readonly topP: number | null;
  /** Alternatives per token (0–20), or null to not request logprobs. */
  readonly topLogprobs: number | null;
  readonly maxOutputTokens: number;
}

export interface GenerationRequest {
  readonly instructions: string;
  readonly messages: readonly { readonly role: 'user' | 'assistant'; readonly content: string }[];
  readonly settings: GenerationSettings;
  /** A hash of the anonymous session; never an IP or personal data. */
  readonly safetyIdentifier: string;
}

export type UpstreamEvent =
  /** The HTTP response arrived and the stream is open. */
  | { readonly kind: 'open' }
  | { readonly kind: 'created'; readonly model: string }
  | {
      readonly kind: 'delta';
      readonly channel: 'text' | 'refusal';
      readonly text: string;
      readonly logprobs: WireLogprob[] | null;
      readonly upstreamSeq: number;
    }
  | { readonly kind: 'done'; readonly channel: 'text' | 'refusal'; readonly text: string }
  | {
      readonly kind: 'terminal';
      readonly outcome: 'completed' | 'incomplete' | 'failed';
      readonly incompleteReason: string | null;
      readonly usage: WireUsage | null;
      readonly finalTokenBytes: number[][] | null;
      readonly outputItemTypes: string[];
      readonly errorCode: AppErrorCode | null;
    };

export interface UpstreamCall {
  readonly endpoint: string;
  /** Exactly the JSON body sent, for "View the full request". */
  readonly body: Readonly<Record<string, unknown>>;
}

export interface ModerationResult {
  readonly model: string;
  readonly flagged: boolean;
}

export interface Upstream {
  describe(req: GenerationRequest): UpstreamCall;
  /** Yields `open` once the stream is accepted. Throws UpstreamFailure, or UpstreamAborted on abort. */
  generate(req: GenerationRequest, signal: AbortSignal): AsyncIterable<UpstreamEvent>;
  moderate(texts: readonly string[], model: string, signal: AbortSignal): Promise<ModerationResult>;
}

export class UpstreamFailure extends Error {
  constructor(
    readonly code: AppErrorCode,
    /** For the server log only: never shown to users. */
    readonly detail: { readonly status?: number; readonly type?: string; readonly providerCode?: string } = {},
  ) {
    super(code);
    this.name = 'UpstreamFailure';
  }
}

export class UpstreamAborted extends Error {
  constructor() {
    super('aborted');
    this.name = 'UpstreamAborted';
  }
}

export function buildResponsesBody(req: GenerationRequest): ResponseCreateParamsStreaming {
  const s = req.settings;
  return {
    model: s.model,
    instructions: req.instructions,
    input: req.messages.map((m) => ({ role: m.role, content: m.content })),
    ...(s.reasoningEffort ? { reasoning: { effort: s.reasoningEffort } } : {}),
    max_output_tokens: s.maxOutputTokens,
    ...(s.temperature !== null ? { temperature: s.temperature } : {}),
    ...(s.topP !== null ? { top_p: s.topP } : {}),
    ...(s.topLogprobs !== null ? { top_logprobs: s.topLogprobs, include: ['message.output_text.logprobs'] } : {}),
    store: false,
    truncation: 'disabled',
    safety_identifier: req.safetyIdentifier,
    stream: true,
    // The server-to-OpenAI link is trusted, so padding against length side channels isn't needed.
    stream_options: { include_obfuscation: false },
  };
}

const QUOTA_CODES = new Set([
  'credit_balance_exhausted',
  'organization_spend_limit_exceeded',
  'project_spend_limit_exceeded',
  'organization_usage_limit_exceeded',
  'insufficient_quota',
]);

/** Maps an SDK error to an AppErrorCode. Provider text goes to the log only, never to users. */
export function mapUpstreamError(err: unknown): UpstreamFailure | UpstreamAborted {
  if (err instanceof UpstreamFailure || err instanceof UpstreamAborted) return err;
  if (err instanceof APIUserAbortError) return new UpstreamAborted();
  if (err instanceof APIConnectionTimeoutError) return new UpstreamFailure('upstream_timeout');
  if (err instanceof APIConnectionError) return new UpstreamFailure('upstream_failed');
  if (err instanceof APIError) {
    const detail = { status: err.status, type: err.type, providerCode: err.code ?? undefined };
    const status = err.status;
    if (status === 400) {
      const tooLong = err.code === 'context_length_exceeded' || /context (length|window)|maximum context|too many tokens/i.test(err.message);
      return new UpstreamFailure(tooLong ? 'upstream_context_length' : 'upstream_refused_request', detail);
    }
    if (status === 401 || status === 403 || status === 404) return new UpstreamFailure('upstream_misconfigured', detail);
    if (status === 429) {
      const quota = QUOTA_CODES.has(err.code ?? '') || err.type === 'insufficient_quota';
      return new UpstreamFailure(quota ? 'upstream_quota_exhausted' : 'upstream_rate_limited', detail);
    }
    if (status !== undefined && status >= 500) return new UpstreamFailure('upstream_overloaded', detail);
    return new UpstreamFailure('upstream_failed', detail);
  }
  return new UpstreamFailure('upstream_failed');
}

function mapUsage(u: ResponseUsage | undefined): WireUsage | null {
  if (!u) return null;
  return {
    inputTokens: u.input_tokens,
    cachedInputTokens: u.input_tokens_details?.cached_tokens ?? 0,
    cacheWriteTokens: u.input_tokens_details?.cache_write_tokens ?? null,
    outputTokens: u.output_tokens,
    reasoningTokens: u.output_tokens_details?.reasoning_tokens ?? 0,
    totalTokens: u.total_tokens,
  };
}

function finalTokenBytes(response: OpenAIResponse): number[][] | null {
  const out: number[][] = [];
  for (const item of response.output ?? []) {
    if (item.type !== 'message') continue;
    for (const part of item.content) {
      if (part.type !== 'output_text') continue;
      for (const lp of part.logprobs ?? []) out.push([...lp.bytes]);
    }
  }
  return out.length > 0 ? out : null;
}

function failedCode(response: OpenAIResponse): AppErrorCode {
  const code = response.error?.code;
  if (code === 'rate_limit_exceeded') return 'upstream_rate_limited';
  if (code === 'invalid_prompt') return 'upstream_refused_request';
  if (code === 'server_error') return 'upstream_overloaded';
  return 'upstream_failed';
}

function terminal(response: OpenAIResponse): UpstreamEvent {
  const outcome = response.status === 'completed' ? 'completed' : response.status === 'incomplete' ? 'incomplete' : 'failed';
  return {
    kind: 'terminal',
    outcome,
    incompleteReason: response.incomplete_details?.reason ?? null,
    usage: mapUsage(response.usage),
    finalTokenBytes: finalTokenBytes(response),
    outputItemTypes: (response.output ?? []).map((item) => item.type),
    errorCode: outcome === 'failed' ? failedCode(response) : null,
  };
}

/** Maps one OpenAI stream event. Events this app doesn't use return null. */
export function mapStreamEvent(ev: ResponseStreamEvent, logprobsRequested: boolean): UpstreamEvent | null {
  switch (ev.type) {
    case 'response.created':
      return { kind: 'created', model: ev.response.model };
    case 'response.output_text.delta':
      return {
        kind: 'delta',
        channel: 'text',
        text: ev.delta,
        logprobs: logprobsRequested
          ? ev.logprobs.map((lp) => ({
              token: lp.token,
              logprob: lp.logprob,
              top: (lp.top_logprobs ?? []).flatMap((t) =>
                t.token !== undefined && t.logprob !== undefined ? [{ token: t.token, logprob: t.logprob }] : [],
              ),
            }))
          : null,
        upstreamSeq: ev.sequence_number,
      };
    case 'response.refusal.delta':
      return { kind: 'delta', channel: 'refusal', text: ev.delta, logprobs: null, upstreamSeq: ev.sequence_number };
    case 'response.output_text.done':
      return { kind: 'done', channel: 'text', text: ev.text };
    case 'response.refusal.done':
      return { kind: 'done', channel: 'refusal', text: ev.refusal };
    case 'response.completed':
    case 'response.incomplete':
    case 'response.failed':
      return terminal(ev.response);
    default:
      return null;
  }
}

export function createOpenAIUpstream(apiKey: string, options: { timeoutMs: number; baseURL?: string }): Upstream {
  // One retry, and only before any output: the SDK retries the initial request, never a stream.
  const client = new OpenAI({ apiKey, maxRetries: 1, timeout: options.timeoutMs, ...(options.baseURL ? { baseURL: options.baseURL } : {}) });
  return {
    describe: (req) => ({ endpoint: 'POST /v1/responses', body: buildResponsesBody(req) as unknown as Record<string, unknown> }),
    async *generate(req, signal) {
      const logprobsRequested = req.settings.topLogprobs !== null;
      let stream: AsyncIterable<ResponseStreamEvent>;
      try {
        stream = await client.responses.create(buildResponsesBody(req), { signal });
      } catch (err) {
        throw mapUpstreamError(err);
      }
      yield { kind: 'open' };
      try {
        for await (const ev of stream) {
          const mapped = mapStreamEvent(ev, logprobsRequested);
          if (mapped) yield mapped;
        }
      } catch (err) {
        const mapped = mapUpstreamError(err);
        // Once streaming, anything but an error OpenAI reported (or our own abort) is a dropped connection.
        if (mapped instanceof UpstreamFailure && !(err instanceof APIError && err.status !== undefined) && !(err instanceof APIError && err.error)) {
          throw new UpstreamFailure('upstream_stream_interrupted');
        }
        throw mapped;
      }
      if (signal.aborted) throw new UpstreamAborted();
    },
    async moderate(texts, model, signal) {
      try {
        const res = await client.moderations.create({ model, input: [...texts] }, { signal });
        return { model: res.model, flagged: res.results.some((r) => r.flagged) };
      } catch (err) {
        throw mapUpstreamError(err);
      }
    },
  };
}
