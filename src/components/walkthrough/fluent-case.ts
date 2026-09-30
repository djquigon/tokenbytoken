// The recorded "fluent but wrong" case for the deep dive (fixtures/sample/fluent-case.json): a real reply,
// recorded through this app by scripts/record-sample.mts, where the model's top option was a wrong count.
// It is finalized like any other turn, so every value in it carries its label.

import raw from '../../../fixtures/sample/fluent-case.json';

import { finalizeTrace } from '@/trace/finalize';
import type { FinalizedTrace } from '@/trace/facts';
import { traceLogSchema } from '@/trace/log';

let cached: FinalizedTrace | null | undefined;

export function fluentCaseTrace(): FinalizedTrace | null {
  if (cached !== undefined) return cached;
  const parsed = traceLogSchema.safeParse(raw.conversation.turns[0]?.log);
  cached = parsed.success ? finalizeTrace(parsed.data) : null;
  return cached;
}
