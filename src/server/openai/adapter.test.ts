import { APIConnectionError, APIConnectionTimeoutError, APIError, APIUserAbortError } from 'openai';
import type { ResponseStreamEvent } from 'openai/resources/responses/responses';
import { describe, expect, it } from 'vitest';

import { UpstreamAborted, UpstreamFailure, buildResponsesBody, mapStreamEvent, mapUpstreamError, type GenerationRequest } from './adapter';

const request: GenerationRequest = {
  instructions: 'Be brief.',
  messages: [
    { role: 'user', content: 'Hi' },
    { role: 'assistant', content: 'Hello!' },
    { role: 'user', content: 'Why is the sky blue?' },
  ],
  settings: { model: 'gpt-6-luna', reasoningEffort: 'none', temperature: 1, topP: 1, topLogprobs: 20, maxOutputTokens: 600 },
  safetyIdentifier: 'tbt_abc',
};

const apiError = (status: number | undefined, body: Record<string, unknown>) =>
  APIError.generate(status, body, 'provider message that must never reach users', new Headers());

describe('buildResponsesBody', () => {
  it('sends the settings this app decided, never storing the response', () => {
    expect(buildResponsesBody(request)).toEqual({
      model: 'gpt-6-luna',
      instructions: 'Be brief.',
      input: request.messages,
      reasoning: { effort: 'none' },
      max_output_tokens: 600,
      temperature: 1,
      top_p: 1,
      top_logprobs: 20,
      include: ['message.output_text.logprobs'],
      store: false,
      truncation: 'disabled',
      safety_identifier: 'tbt_abc',
      stream: true,
      stream_options: { include_obfuscation: false },
    });
  });

  it('asks for no logprobs when they are off', () => {
    const body = buildResponsesBody({ ...request, settings: { ...request.settings, topLogprobs: null } });
    expect(body).not.toHaveProperty('top_logprobs');
    expect(body).not.toHaveProperty('include');
  });
});

describe('mapUpstreamError', () => {
  const code = (err: unknown) => {
    const mapped = mapUpstreamError(err);
    return mapped instanceof UpstreamFailure ? mapped.code : 'aborted';
  };

  it('maps OpenAI errors to fixed codes', () => {
    expect(code(apiError(400, { error: { code: 'context_length_exceeded', message: 'too long' } }))).toBe('upstream_context_length');
    expect(code(apiError(400, { error: { code: 'invalid_value', message: 'Invalid value' } }))).toBe('upstream_refused_request');
    expect(code(apiError(401, { error: { code: 'invalid_api_key' } }))).toBe('upstream_misconfigured');
    expect(code(apiError(404, { error: { code: 'model_not_found' } }))).toBe('upstream_misconfigured');
    expect(code(apiError(429, { error: { code: 'rate_limit_exceeded' } }))).toBe('upstream_rate_limited');
    expect(code(apiError(429, { error: { code: 'organization_spend_limit_exceeded' } }))).toBe('upstream_quota_exhausted');
    expect(code(apiError(429, { error: { type: 'insufficient_quota', code: null } }))).toBe('upstream_quota_exhausted');
    expect(code(apiError(503, { error: { code: 'server_is_overloaded' } }))).toBe('upstream_overloaded');
    expect(code(new APIConnectionTimeoutError())).toBe('upstream_timeout');
    expect(code(new APIConnectionError({ message: 'socket hang up' }))).toBe('upstream_failed');
    expect(code(new Error('anything else'))).toBe('upstream_failed');
    expect(mapUpstreamError(new APIUserAbortError())).toBeInstanceOf(UpstreamAborted);
  });

  it('keeps provider text out of the error message', () => {
    const mapped = mapUpstreamError(apiError(400, { error: { code: 'invalid_value' } }));
    expect(mapped.message).toBe('upstream_refused_request');
  });
});

describe('mapStreamEvent', () => {
  const ev = (e: Record<string, unknown>) => e as unknown as ResponseStreamEvent;

  it('relays refusals on their own channel, without logprobs', () => {
    expect(mapStreamEvent(ev({ type: 'response.refusal.delta', delta: 'No.', sequence_number: 4 }), true)).toEqual({
      kind: 'delta',
      channel: 'refusal',
      text: 'No.',
      logprobs: null,
      upstreamSeq: 4,
    });
    expect(mapStreamEvent(ev({ type: 'response.refusal.done', refusal: 'No.' }), true)).toEqual({ kind: 'done', channel: 'refusal', text: 'No.' });
  });

  it('drops logprobs when they were not requested, and drops malformed alternatives', () => {
    const delta = ev({
      type: 'response.output_text.delta',
      delta: 'Hi',
      sequence_number: 5,
      logprobs: [{ token: 'Hi', logprob: -0.1, top_logprobs: [{ token: 'Hi', logprob: -0.1 }, { token: 'Hey' }] }],
    });
    expect(mapStreamEvent(delta, false)).toMatchObject({ logprobs: null });
    expect(mapStreamEvent(delta, true)).toMatchObject({ logprobs: [{ token: 'Hi', logprob: -0.1, top: [{ token: 'Hi', logprob: -0.1 }] }] });
  });

  it('reports a failed response with a fixed code, and lists output item types (so tool calls would show)', () => {
    const failed = mapStreamEvent(
      ev({
        type: 'response.failed',
        response: { status: 'failed', error: { code: 'server_error', message: 'x' }, output: [{ type: 'reasoning' }, { type: 'function_call' }] },
      }),
      true,
    );
    expect(failed).toMatchObject({ kind: 'terminal', outcome: 'failed', errorCode: 'upstream_overloaded', outputItemTypes: ['reasoning', 'function_call'], usage: null });
  });

  it('reads the final token bytes from the completed response', () => {
    const done = mapStreamEvent(
      ev({
        type: 'response.completed',
        response: {
          status: 'completed',
          incomplete_details: null,
          usage: { input_tokens: 10, input_tokens_details: { cached_tokens: 2, cache_write_tokens: 0 }, output_tokens: 6, output_tokens_details: { reasoning_tokens: 0 }, total_tokens: 16 },
          output: [{ type: 'message', content: [{ type: 'output_text', text: 'Hi', logprobs: [{ token: 'Hi', bytes: [72, 105], logprob: -0.1, top_logprobs: [] }] }] }],
        },
      }),
      true,
    );
    expect(done).toEqual({
      kind: 'terminal',
      outcome: 'completed',
      incompleteReason: null,
      usage: { inputTokens: 10, cachedInputTokens: 2, cacheWriteTokens: 0, outputTokens: 6, reasoningTokens: 0, totalTokens: 16 },
      finalTokenBytes: [[72, 105]],
      outputItemTypes: ['message'],
      errorCode: null,
    });
  });

  it('ignores events this app does not use', () => {
    expect(mapStreamEvent(ev({ type: 'response.in_progress' }), true)).toBeNull();
    expect(mapStreamEvent(ev({ type: 'response.output_item.added' }), true)).toBeNull();
  });
});
