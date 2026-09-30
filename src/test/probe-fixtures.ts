// Test helpers: turn the Phase 0 probe fixtures (sanitized OpenAI stream events) back into SDK-shaped
// events, so tests can drive the real adapter mapping with recorded data.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { ResponseStreamEvent } from 'openai/resources/responses/responses';

interface FixtureEvent {
  type: string;
  sequence_number: number | null;
  atMs: number;
  delta?: string;
  logprobs?: { token: string; logprob: number; top_logprobs: { token: string; logprob: number }[] }[];
  text?: string;
}

interface Fixture {
  events: FixtureEvent[];
  final: {
    model: string;
    status: string | null;
    incompleteReason: string | null;
    usage: Record<string, unknown> | null;
    text: string;
    logprobs: { token: string; bytes: number[]; logprob: number; top_logprobs: unknown[] }[] | null;
  };
}

export const readProbeFixture = (model: string, name: string): Fixture =>
  JSON.parse(readFileSync(path.join(process.cwd(), 'fixtures', 'probe', model, `${name}.json`), 'utf8')) as Fixture;

/** SDK-shaped events, with the final response rebuilt from the sanitized record. */
export function sdkEventsFromFixture(fixture: Fixture): { event: ResponseStreamEvent; atMs: number }[] {
  const f = fixture.final;
  const response = {
    id: 'resp_fixture',
    object: 'response',
    model: f.model,
    status: f.status,
    incomplete_details: f.incompleteReason ? { reason: f.incompleteReason } : null,
    error: null,
    usage: f.usage,
    output: [
      {
        type: 'message',
        id: 'msg_fixture',
        role: 'assistant',
        status: 'completed',
        content: [{ type: 'output_text', text: f.text, annotations: [], logprobs: f.logprobs ?? [] }],
      },
    ],
  };
  return fixture.events.map((e) => {
    const base = { type: e.type, sequence_number: e.sequence_number ?? 0 };
    let event: Record<string, unknown>;
    switch (e.type) {
      case 'response.created':
      case 'response.in_progress':
        event = { ...base, response: { ...response, status: 'in_progress', usage: null, output: [] } };
        break;
      case 'response.output_text.delta':
        event = { ...base, item_id: 'msg_fixture', output_index: 0, content_index: 0, delta: e.delta ?? '', logprobs: e.logprobs ?? [] };
        break;
      case 'response.output_text.done':
        event = { ...base, item_id: 'msg_fixture', output_index: 0, content_index: 0, text: e.text ?? f.text, logprobs: [] };
        break;
      case 'response.completed':
      case 'response.incomplete':
      case 'response.failed':
        event = { ...base, response };
        break;
      default:
        event = base;
    }
    return { event: event as unknown as ResponseStreamEvent, atMs: e.atMs };
  });
}
