// Stage `followup` (chapter 7, from the second turn): the conversation is sent again. What was included or
// dropped is Recorded (done by this app); the context window is Reference; the gauge is not to scale.

import { followupGauge, followupPacking } from '@/content/walkthrough';
import { deriveAll, illustrate, type Sourced } from '@/shared/provenance';
import { read } from '@/shared/provenance/read';
import type { InputRunFacts, RequestFacts } from '@/trace/facts';

import { timing, type BuildContext, type SceneMeta } from '../contract';

export type FollowupScene =
  | (SceneMeta<'followup', 'packing'> & {
      readonly messages: readonly InputRunFacts[];
      readonly dropped: Sourced<readonly { readonly id: string; readonly reason: string }[]>;
    })
  | (SceneMeta<'followup', 'gauge'> & {
      readonly request: RequestFacts;
      readonly input: Sourced<number> | null;
      readonly cached: Sourced<number> | null;
      readonly scale: Sourced<string, 'example'>;
    });

export const isFollowup = (request: RequestFacts | null) => (request ? read(request.context.included).length > 1 : false);

export function buildFollowup(ctx: BuildContext): FollowupScene[] {
  const request = ctx.trace.request;
  if (!request || !isFollowup(request)) return [];
  const messages = request.inputRuns.filter((r) => r.role !== 'instructions');
  const droppedCount = read(request.context.dropped).length;
  const cached = ctx.trace.usage && read(ctx.trace.usage.cachedInputTokens) > 0 ? ctx.trace.usage.cachedInputTokens : null;
  return [
    {
      stage: 'followup',
      view: 'packing',
      key: 'followup:packing',
      chapter: 'followup',
      timing: timing(5_500),
      copy: followupPacking({
        included: deriveAll('count', messages.map((m) => m.text), (xs) => xs.length),
        dropped: droppedCount > 0 ? deriveAll('count', [request.context.dropped], (xs) => (xs[0] ?? []).length) : null,
      }),
      examples: false,
      messages,
      dropped: request.context.dropped,
    },
    {
      stage: 'followup',
      view: 'gauge',
      key: 'followup:gauge',
      chapter: 'followup',
      timing: timing(5_500),
      copy: followupGauge({
        input: ctx.trace.usage?.inputTokens ?? null,
        budget: request.context.inputBudgetTokens,
        window: request.reference.contextWindowTokens,
        cached,
      }),
      examples: true,
      request,
      input: ctx.trace.usage?.inputTokens ?? null,
      cached,
      scale: illustrate('context-gauge', ctx.seed, [], () => 'not to scale'),
    },
  ];
}
